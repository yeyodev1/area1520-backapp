import { Album } from "../models/album.model";
import { Lead } from "../models/lead.model";
import { Photo } from "../models/photo.model";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export async function getStats() {
  const since = new Date(Date.now() - WEEK_MS);
  const [leadsTotal, leadsNuevo, leadsLast7Days, photosTotal, photosHidden, albums] =
    await Promise.all([
      Lead.countDocuments(),
      Lead.countDocuments({ status: "nuevo" }),
      Lead.countDocuments({ createdAt: { $gte: since } }),
      Photo.countDocuments(),
      Photo.countDocuments({ isHidden: true }),
      Album.countDocuments(),
    ]);

  return {
    leads: { total: leadsTotal, nuevo: leadsNuevo, last7Days: leadsLast7Days },
    photos: { total: photosTotal, hidden: photosHidden },
    albums,
  };
}
