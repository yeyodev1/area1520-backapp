import { Request, Response, NextFunction } from "express";
import * as leadService from "../services/lead.service";

// Detrás del proxy de Vercel la IP real llega en x-forwarded-for.
function clientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim();
  return first || req.ip || req.socket.remoteAddress || "desconocida";
}

/** POST /api/leads — formulario público de la web. */
export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const lead = await leadService.createPublic(req.body ?? {}, clientIp(req));
    res.status(201).json(lead);
  } catch (error) {
    next(error);
  }
}
