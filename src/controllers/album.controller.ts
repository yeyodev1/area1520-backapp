import { Request, Response, NextFunction } from "express";
import * as albumService from "../services/album.service";

/** GET /api/albums — álbumes publicados con photoCount. */
export async function list(_req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await albumService.listPublished());
  } catch (error) {
    next(error);
  }
}

/** GET /api/albums/:slug */
export async function getBySlug(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await albumService.getPublishedBySlug(String(req.params.slug)));
  } catch (error) {
    next(error);
  }
}

/** GET /api/albums/:slug/photos?page=&limit= */
export async function listPhotos(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await albumService.listPublishedPhotos(
      String(req.params.slug),
      req.query.page,
      req.query.limit,
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
