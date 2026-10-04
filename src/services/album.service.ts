import { Types } from "mongoose";
import { CustomError } from "../errors/customError.error";
import { Album } from "../models/album.model";
import { Photo } from "../models/photo.model";
import { slugify } from "../utils/slugify";
import { assertObjectId, parsePagination, toPaginated } from "../utils/pagination";

export interface AlbumInput {
  title?: unknown;
  eventName?: unknown;
  eventDate?: unknown;
  description?: unknown;
  isPublished?: unknown;
  order?: unknown;
  coverPublicId?: unknown;
}

/**
 * Conteo de fotos por álbum en una sola agregación. Las fotos sin el campo
 * isHidden cuentan como visibles.
 */
async function countPhotos(
  albumIds: Types.ObjectId[],
): Promise<Map<string, { visible: number; hidden: number }>> {
  if (albumIds.length === 0) return new Map();
  const rows = await Photo.aggregate<{ _id: Types.ObjectId; visible: number; hidden: number }>([
    { $match: { album: { $in: albumIds } } },
    {
      $group: {
        _id: "$album",
        visible: { $sum: { $cond: [{ $eq: ["$isHidden", true] }, 0, 1] } },
        hidden: { $sum: { $cond: [{ $eq: ["$isHidden", true] }, 1, 0] } },
      },
    },
  ]);
  return new Map(rows.map((r) => [r._id.toString(), { visible: r.visible, hidden: r.hidden }]));
}

export async function listPublished() {
  const albums = await Album.find({ isPublished: true }).sort({ order: 1, createdAt: 1 }).lean();
  const counts = await countPhotos(albums.map((a: any) => a._id));
  return albums.map((a: any) => ({
    ...a,
    photoCount: counts.get(a._id.toString())?.visible ?? 0,
  }));
}

async function findPublishedBySlug(slug: string): Promise<any> {
  const album = await Album.findOne({ slug, isPublished: true }).lean();
  if (!album) throw new CustomError("Álbum no encontrado", 404);
  return album;
}

export async function getPublishedBySlug(slug: string) {
  const album = await findPublishedBySlug(slug);
  const counts = await countPhotos([album._id]);
  return { ...album, photoCount: counts.get(album._id.toString())?.visible ?? 0 };
}

export async function listPublishedPhotos(slug: string, page: unknown, limit: unknown) {
  const album = await findPublishedBySlug(slug);
  const pg = parsePagination(page, limit, 40, 100);
  const filter = { album: album._id, isHidden: { $ne: true } };
  const [items, total] = await Promise.all([
    Photo.find(filter).sort({ order: 1, _id: 1 }).skip(pg.skip).limit(pg.limit).lean(),
    Photo.countDocuments(filter),
  ]);
  return toPaginated(items, total, pg.page, pg.limit);
}

export async function listAll() {
  const albums = await Album.find().sort({ order: 1, createdAt: 1 }).lean();
  const counts = await countPhotos(albums.map((a: any) => a._id));
  return albums.map((a: any) => {
    const c = counts.get(a._id.toString());
    return { ...a, photoCount: c?.visible ?? 0, hiddenCount: c?.hidden ?? 0 };
  });
}

export async function findById(id: string): Promise<any> {
  assertObjectId(id, "Álbum no encontrado");
  const album = await Album.findById(id);
  if (!album) throw new CustomError("Álbum no encontrado", 404);
  return album;
}

/** Si el slug ya existe agrega -2, -3… hasta encontrar uno libre. */
async function uniqueSlug(base: string): Promise<string> {
  const root = base || "album";
  let candidate = root;
  let n = 2;
  while (await Album.exists({ slug: candidate })) {
    candidate = `${root}-${n}`;
    n += 1;
  }
  return candidate;
}

function parseDate(value: unknown): Date | null {
  if (value === null || value === "" || value === undefined) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new CustomError("Fecha del evento inválida", 400);
  return date;
}

function parseTitle(value: unknown): string {
  const title = typeof value === "string" ? value.trim() : "";
  if (title.length < 2) throw new CustomError("El título del álbum es obligatorio", 400);
  return title;
}

export async function create(input: AlbumInput) {
  const title = parseTitle(input.title);
  if (input.isPublished !== undefined && typeof input.isPublished !== "boolean") {
    throw new CustomError("isPublished debe ser verdadero o falso", 400);
  }

  // Los álbumes nuevos van al final de la lista.
  const last: any = await Album.findOne().sort({ order: -1 }).select("order").lean();
  return Album.create({
    slug: await uniqueSlug(slugify(title)),
    title,
    eventName: typeof input.eventName === "string" ? input.eventName.trim() : "",
    eventDate: parseDate(input.eventDate),
    description: typeof input.description === "string" ? input.description : "",
    isPublished: typeof input.isPublished === "boolean" ? input.isPublished : true,
    order: (last?.order ?? 0) + 1,
  });
}

export async function update(id: string, input: AlbumInput) {
  const album = await findById(id);

  // El slug no cambia con el título: romperlo dejaría enlaces compartidos sin destino.
  if (input.title !== undefined) album.title = parseTitle(input.title);
  if (input.eventName !== undefined) album.eventName = String(input.eventName ?? "").trim();
  if (input.eventDate !== undefined) album.eventDate = parseDate(input.eventDate);
  if (input.description !== undefined) album.description = String(input.description ?? "");
  if (input.isPublished !== undefined) {
    if (typeof input.isPublished !== "boolean") {
      throw new CustomError("isPublished debe ser verdadero o falso", 400);
    }
    album.isPublished = input.isPublished;
  }
  if (input.order !== undefined) {
    const order = Number(input.order);
    if (!Number.isFinite(order)) throw new CustomError("El orden debe ser un número", 400);
    album.order = order;
  }
  if (input.coverPublicId !== undefined) {
    const coverPublicId = String(input.coverPublicId ?? "");
    if (coverPublicId && !(await Photo.exists({ album: album._id, publicId: coverPublicId }))) {
      throw new CustomError("La portada debe ser una foto del álbum", 400);
    }
    album.coverPublicId = coverPublicId;
  }

  await album.save();
  return album;
}

export async function remove(id: string): Promise<void> {
  const album = await findById(id);
  if (await Photo.exists({ album: album._id })) {
    throw new CustomError("El álbum tiene fotos; elimínalas primero", 409);
  }
  await Album.deleteOne({ _id: album._id });
}
