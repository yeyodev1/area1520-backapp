import { Request, Response, NextFunction } from "express";
import * as adminService from "../services/admin.service";
import * as albumService from "../services/album.service";
import * as leadService from "../services/lead.service";
import * as photoService from "../services/photo.service";

/** GET /api/admin/stats */
export async function stats(_req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await adminService.getStats());
  } catch (error) {
    next(error);
  }
}

/** GET /api/admin/leads?status=&q=&page=&limit= */
export async function listLeads(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await leadService.list(req.query));
  } catch (error) {
    next(error);
  }
}

/** PATCH /api/admin/leads/:id — body: { status?, notes? } */
export async function updateLead(req: Request, res: Response, next: NextFunction) {
  try {
    const { status, notes } = req.body ?? {};
    res.status(200).json(await leadService.update(String(req.params.id), { status, notes }));
  } catch (error) {
    next(error);
  }
}

/** DELETE /api/admin/leads/:id */
export async function deleteLead(req: Request, res: Response, next: NextFunction) {
  try {
    await leadService.remove(String(req.params.id));
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

/** GET /api/admin/albums — incluye no publicados. */
export async function listAlbums(_req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await albumService.listAll());
  } catch (error) {
    next(error);
  }
}

/** POST /api/admin/albums */
export async function createAlbum(req: Request, res: Response, next: NextFunction) {
  try {
    const { title, eventName, eventDate, description, isPublished } = req.body ?? {};
    const album = await albumService.create({
      title,
      eventName,
      eventDate,
      description,
      isPublished,
    });
    res.status(201).json(album);
  } catch (error) {
    next(error);
  }
}

/** PATCH /api/admin/albums/:id */
export async function updateAlbum(req: Request, res: Response, next: NextFunction) {
  try {
    const { title, eventName, eventDate, description, isPublished, order, coverPublicId } =
      req.body ?? {};
    const album = await albumService.update(String(req.params.id), {
      title,
      eventName,
      eventDate,
      description,
      isPublished,
      order,
      coverPublicId,
    });
    res.status(200).json(album);
  } catch (error) {
    next(error);
  }
}

/** DELETE /api/admin/albums/:id */
export async function deleteAlbum(req: Request, res: Response, next: NextFunction) {
  try {
    await albumService.remove(String(req.params.id));
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

/** GET /api/admin/albums/:id/photos?page=&limit=&filter=all|visible|hidden|tagged */
export async function listAlbumPhotos(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await photoService.listForAdmin(
      String(req.params.id),
      req.query.page,
      req.query.limit,
      req.query.filter,
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

/** POST /api/admin/albums/:id/photos — multipart, campo "files". */
export async function uploadAlbumPhotos(req: Request, res: Response, next: NextFunction) {
  try {
    const files = Array.isArray(req.files) ? req.files : [];
    const photos = await photoService.uploadToAlbum(String(req.params.id), files);
    res.status(201).json(photos);
  } catch (error) {
    next(error);
  }
}

/** PATCH /api/admin/photos/:id — body: { isHidden?, tags?, order? } */
export async function updatePhoto(req: Request, res: Response, next: NextFunction) {
  try {
    const { isHidden, tags, order } = req.body ?? {};
    res
      .status(200)
      .json(await photoService.update(String(req.params.id), { isHidden, tags, order }));
  } catch (error) {
    next(error);
  }
}

/** DELETE /api/admin/photos/:id — borra en Cloudinary y en Mongo. */
export async function deletePhoto(req: Request, res: Response, next: NextFunction) {
  try {
    await photoService.remove(String(req.params.id));
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}
