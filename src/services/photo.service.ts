import crypto from "crypto";
import { CustomError } from "../errors/customError.error";
import { Album } from "../models/album.model";
import { Photo, PHOTO_TAGS, PhotoTag } from "../models/photo.model";
import { deleteImage, uploadWithPublicId } from "./cloudinary.service";
import { assertObjectId, parsePagination, toPaginated } from "../utils/pagination";
import { findById as findAlbumById } from "./album.service";

const ADMIN_FILTERS = ["all", "visible", "hidden", "tagged"] as const;

function isPhotoTag(value: unknown): value is PhotoTag {
  return typeof value === "string" && (PHOTO_TAGS as readonly string[]).includes(value);
}

/** Fotos visibles de álbumes publicados con un tag (hero, featured…). */
export async function listByTag(tag: unknown, limit: unknown, albumSlug: unknown) {
  if (!tag) throw new CustomError("Indica un tag", 400);
  if (!isPhotoTag(tag)) {
    throw new CustomError(`Tag inválido. Usa: ${PHOTO_TAGS.join(", ")}`, 400);
  }
  const { limit: l } = parsePagination(1, limit, 12, 60);

  const albumFilter: Record<string, unknown> = { isPublished: true };
  if (typeof albumSlug === "string" && albumSlug) albumFilter.slug = albumSlug;
  const albums = await Album.find(albumFilter).select("_id").lean();
  if (albums.length === 0) return [];

  return Photo.find({
    album: { $in: albums.map((a: any) => a._id) },
    tags: tag,
    isHidden: { $ne: true },
  })
    .sort({ order: 1, _id: 1 })
    .limit(l)
    .lean();
}

export async function listForAdmin(
  albumId: string,
  page: unknown,
  limit: unknown,
  filter: unknown,
) {
  const album = await findAlbumById(albumId);
  const pg = parsePagination(page, limit, 60, 200);
  const mode = (ADMIN_FILTERS as readonly string[]).includes(String(filter))
    ? String(filter)
    : "all";

  const query: Record<string, unknown> = { album: album._id };
  if (mode === "visible") query.isHidden = { $ne: true };
  if (mode === "hidden") query.isHidden = true;
  if (mode === "tagged") query["tags.0"] = { $exists: true };

  const [items, total] = await Promise.all([
    Photo.find(query).sort({ order: 1, _id: 1 }).skip(pg.skip).limit(pg.limit).lean(),
    Photo.countDocuments(query),
  ]);
  return toPaginated(items, total, pg.page, pg.limit);
}

export async function uploadToAlbum(albumId: string, files: Express.Multer.File[]) {
  const album = await findAlbumById(albumId);
  if (!files || files.length === 0) throw new CustomError("No llegó ninguna imagen", 400);
  if (files.some((f) => !f.mimetype.startsWith("image/"))) {
    throw new CustomError("Solo se permiten imágenes", 400);
  }

  const last: any = await Photo.findOne({ album: album._id })
    .sort({ order: -1 })
    .select("order")
    .lean();
  let order = (last?.order ?? 0) + 1;

  const created = [];
  // En serie: 20 subidas en paralelo saturan la conexión y el límite de Cloudinary.
  for (const file of files) {
    // uploadWithPublicId devuelve width/height; uploadBuffer no.
    const dataUri = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
    const suffix = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const result = await uploadWithPublicId(dataUri, `area1520/albums/${album.slug}/${suffix}`);
    const photo = await Photo.create({
      album: album._id,
      publicId: result.publicId,
      url: result.url,
      width: result.width || 0,
      height: result.height || 0,
      originalName: file.originalname || "",
      order,
    });
    order += 1;
    created.push(photo);
  }

  // Un álbum nuevo sin portada toma la primera foto subida.
  if (!album.coverPublicId && created.length > 0) {
    await Album.updateOne({ _id: album._id }, { coverPublicId: created[0].publicId });
  }
  return created;
}

async function findPhoto(id: string): Promise<any> {
  assertObjectId(id, "Foto no encontrada");
  const photo = await Photo.findById(id);
  if (!photo) throw new CustomError("Foto no encontrada", 404);
  return photo;
}

export async function update(
  id: string,
  input: { isHidden?: unknown; tags?: unknown; order?: unknown },
) {
  const photo = await findPhoto(id);

  if (input.isHidden !== undefined) {
    if (typeof input.isHidden !== "boolean") {
      throw new CustomError("isHidden debe ser verdadero o falso", 400);
    }
    photo.isHidden = input.isHidden;
  }
  if (input.tags !== undefined) {
    if (!Array.isArray(input.tags) || !input.tags.every(isPhotoTag)) {
      throw new CustomError(`Tags inválidos. Usa: ${PHOTO_TAGS.join(", ")}`, 400);
    }
    photo.tags = Array.from(new Set(input.tags));
  }
  if (input.order !== undefined) {
    const order = Number(input.order);
    if (!Number.isFinite(order)) throw new CustomError("El orden debe ser un número", 400);
    photo.order = order;
  }

  await photo.save();
  return photo;
}

export async function remove(id: string): Promise<void> {
  const photo = await findPhoto(id);
  await deleteImage(photo.publicId);
  await Photo.deleteOne({ _id: photo._id });
  await Album.updateOne({ _id: photo.album, coverPublicId: photo.publicId }, { coverPublicId: "" });
}
