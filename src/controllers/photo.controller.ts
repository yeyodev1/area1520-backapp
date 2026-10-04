import { Request, Response, NextFunction } from "express";
import * as photoService from "../services/photo.service";

/** GET /api/photos?tag=&limit=&album= */
export async function listByTag(req: Request, res: Response, next: NextFunction) {
  try {
    const photos = await photoService.listByTag(req.query.tag, req.query.limit, req.query.album);
    res.status(200).json(photos);
  } catch (error) {
    next(error);
  }
}
