import { Types } from "mongoose";
import { CustomError } from "../errors/customError.error";

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
}

/** Normaliza page/limit para no confiar en lo que mande el cliente. */
export function parsePagination(
  page: unknown,
  limit: unknown,
  defaultLimit: number,
  maxLimit: number,
): { page: number; limit: number; skip: number } {
  const p = Math.max(1, Math.floor(Number(page)) || 1);
  const l = Math.min(maxLimit, Math.max(1, Math.floor(Number(limit)) || defaultLimit));
  return { page: p, limit: l, skip: (p - 1) * l };
}

export function toPaginated<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
): Paginated<T> {
  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

/** Un id mal formado se responde como "no existe" en vez de un CastError 500. */
export function assertObjectId(id: string, message: string): void {
  if (!Types.ObjectId.isValid(id)) throw new CustomError(message, 404);
}
