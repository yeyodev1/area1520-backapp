/**
 * Importa la galería de AREA Games 2026 (Pixieset) a Cloudinary y Mongo.
 *
 * Uso: pnpm import:gallery <manifest.json> <carpeta-fotos> [curation.json]
 *   manifest: [{ name, gallery, w, h }] en el orden original de Pixieset
 *   carpeta:  archivos nombrados "<gallery>-<name>"
 *   curation: { hero: [], featured: [], ... , hidden: [] } con nombres de archivo
 *
 * Es idempotente: busca cada foto por publicId antes de subirla.
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { env } from "../config/env";
import { Album } from "../models/album.model";
import { Photo, PHOTO_TAGS, PhotoTag } from "../models/photo.model";
import { uploadWithPublicId } from "../services/cloudinary.service";

const EVENT = "AREA Games 2026";
const EVENT_DATE = new Date("2026-09-12T12:00:00-05:00");
const PHOTOGRAPHER = "Hafana Hafana";
const PHOTOGRAPHER_URL = "https://hafanahafana.pixieset.com/area1520games2026/";
const CONCURRENCY = 8;

const ALBUMS: Record<string, { slug: string; title: string; description: string; order: number }> = {
  atletas: {
    slug: "area-games-2026-atletas",
    title: "Atletas",
    description: "Cada repetición de la VI edición de los AREA Games: Sede Garzota vs Sede La Joya.",
    order: 1,
  },
  ganadores: {
    slug: "area-games-2026-ganadores",
    title: "Ganadores",
    description: "Los podios de la VI edición de los AREA Games.",
    order: 2,
  },
};

interface ManifestItem {
  name: string;
  gallery: string;
  w: number;
  h: number;
}

type Curation = Partial<Record<PhotoTag | "hidden", string[]>>;

async function runPool<T>(items: T[], worker: (item: T, index: number) => Promise<void>) {
  let cursor = 0;
  const runners = Array.from({ length: CONCURRENCY }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      await worker(items[index], index);
    }
  });
  await Promise.all(runners);
}

async function main() {
  const [manifestPath, photosDir, curationPath] = process.argv.slice(2);
  if (!manifestPath || !photosDir) {
    console.error("Uso: pnpm import:gallery <manifest.json> <carpeta-fotos> [curation.json]");
    process.exit(1);
  }

  const manifest: ManifestItem[] = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const curation: Curation = curationPath ? JSON.parse(fs.readFileSync(curationPath, "utf8")) : {};

  const tagsByFile = new Map<string, PhotoTag[]>();
  for (const tag of PHOTO_TAGS) {
    for (const file of curation[tag] ?? []) {
      tagsByFile.set(file, [...(tagsByFile.get(file) ?? []), tag]);
    }
  }
  const hidden = new Set(curation.hidden ?? []);

  await mongoose.connect(env.DB_URI);

  const albumIds: Record<string, mongoose.Types.ObjectId> = {};
  for (const [gallery, data] of Object.entries(ALBUMS)) {
    const album = await Album.findOneAndUpdate(
      { slug: data.slug },
      {
        $set: {
          title: data.title,
          eventName: EVENT,
          eventDate: EVENT_DATE,
          description: data.description,
          photographer: PHOTOGRAPHER,
          photographerUrl: PHOTOGRAPHER_URL,
          order: data.order,
        },
      },
      { upsert: true, new: true },
    );
    albumIds[gallery] = album._id;
  }

  const orderByGallery: Record<string, number> = {};
  const queue = manifest.map((item) => {
    orderByGallery[item.gallery] = (orderByGallery[item.gallery] ?? 0) + 1;
    return { ...item, order: orderByGallery[item.gallery] };
  });

  let done = 0;
  let uploaded = 0;
  let failed = 0;

  await runPool(queue, async (item) => {
    const file = `${item.gallery}-${item.name}`;
    const publicId = `area1520/area-games-2026/${item.gallery}/${path.parse(item.name).name}`;
    const tags = tagsByFile.get(file) ?? [];
    try {
      const existing = await Photo.findOne({ publicId });
      if (existing) {
        existing.set({ tags, isHidden: hidden.has(file), order: item.order });
        await existing.save();
      } else {
        const result = await uploadWithPublicId(path.join(photosDir, file), publicId);
        await Photo.create({
          album: albumIds[item.gallery],
          publicId: result.publicId,
          url: result.url,
          width: result.width || item.w,
          height: result.height || item.h,
          originalName: item.name,
          order: item.order,
          tags,
          isHidden: hidden.has(file),
        });
        uploaded++;
      }
    } catch (error) {
      failed++;
      console.error(`✖ ${file}:`, (error as Error).message);
    }
    done++;
    if (done % 50 === 0 || done === queue.length) {
      console.log(`${done}/${queue.length} (subidas nuevas: ${uploaded}, fallidas: ${failed})`);
    }
  });

  // La portada de cada álbum sale de la curaduría si hay, si no de la primera foto.
  for (const gallery of Object.keys(ALBUMS)) {
    const cover =
      (await Photo.findOne({ album: albumIds[gallery], tags: "hero", isHidden: false })) ??
      (await Photo.findOne({ album: albumIds[gallery], tags: "featured", isHidden: false })) ??
      (await Photo.findOne({ album: albumIds[gallery], isHidden: false }).sort({ order: 1 }));
    if (cover) await Album.updateOne({ _id: albumIds[gallery] }, { coverPublicId: cover.publicId });
  }

  console.log(`✔ Importación terminada. Nuevas: ${uploaded}. Fallidas: ${failed}.`);
  await mongoose.disconnect();
  if (failed) process.exit(1);
}

main().catch((error) => {
  console.error("✖ Falló la importación:", error);
  process.exit(1);
});
