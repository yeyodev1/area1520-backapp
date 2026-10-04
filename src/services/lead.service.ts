import { Types } from "mongoose";
import { CustomError } from "../errors/customError.error";
import { Lead, LEAD_STATUSES, LOCATIONS, LeadStatus } from "../models/lead.model";
import { assertObjectId, parsePagination, toPaginated } from "../utils/pagination";
import { notifyNewLead } from "./leadNotify.service";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RATE_WINDOW_MS = 10 * 60 * 1000;
// Cuenta también envíos inválidos: 10 deja margen para corregir errores de tipeo.
const RATE_MAX = 10;

// En memoria: en Vercel cada instancia lleva su propio conteo. Basta para
// frenar a un bot torpe; no es un límite exacto.
const attempts = new Map<string, number[]>();

function checkRateLimit(ip: string): void {
  const now = Date.now();
  const recent = (attempts.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) {
    attempts.set(ip, recent);
    throw new CustomError("Demasiados intentos, intenta en unos minutos", 429);
  }
  recent.push(now);
  attempts.set(ip, recent);

  // Limpieza ocasional para que el mapa no crezca sin fin.
  if (attempts.size > 5000) {
    for (const [key, times] of attempts) {
      if (times.every((t) => now - t >= RATE_WINDOW_MS)) attempts.delete(key);
    }
  }
}

function text(value: unknown, max = 500): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export interface LeadInput {
  name?: unknown;
  phone?: unknown;
  email?: unknown;
  location?: unknown;
  preferredSchedule?: unknown;
  goal?: unknown;
  experience?: unknown;
  website?: unknown;
}

export async function createPublic(input: LeadInput, ip: string) {
  // Honeypot: un humano no ve el campo "website". Al bot se le responde
  // como si todo hubiera ido bien para que no reintente.
  if (typeof input.website === "string" && input.website.trim()) {
    const now = new Date();
    return {
      _id: new Types.ObjectId().toString(),
      name: text(input.name, 120),
      status: "nuevo",
      createdAt: now,
      updatedAt: now,
    };
  }

  checkRateLimit(ip);

  const name = text(input.name, 120);
  if (name.length < 2) throw new CustomError("Escribe tu nombre", 400);

  const phone = text(input.phone, 40).replace(/[^\d+]/g, "");
  if (phone.replace(/\D/g, "").length < 7) throw new CustomError("Escribe un teléfono válido", 400);

  const email = text(input.email, 200).toLowerCase();
  if (email && !EMAIL.test(email)) throw new CustomError("Correo inválido", 400);

  const location = text(input.location, 40);
  if (!(LOCATIONS as readonly string[]).includes(location)) {
    throw new CustomError("Elige una sede válida", 400);
  }

  const lead = await Lead.create({
    name,
    phone,
    email,
    location,
    preferredSchedule: text(input.preferredSchedule, 200),
    goal: text(input.goal, 500),
    experience: text(input.experience, 200),
    source: "web",
  });

  // Sin await: el aviso no debe demorar ni tumbar la respuesta.
  void notifyNewLead(lead.toObject());
  return lead;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function list(query: {
  status?: unknown;
  q?: unknown;
  page?: unknown;
  limit?: unknown;
}) {
  const pg = parsePagination(query.page, query.limit, 20, 100);
  const filter: Record<string, unknown> = {};

  const status = text(query.status, 40);
  if (status) {
    if (!(LEAD_STATUSES as readonly string[]).includes(status)) {
      throw new CustomError("Estado inválido", 400);
    }
    filter.status = status;
  }

  const q = text(query.q, 100);
  if (q) {
    const regex = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ name: regex }, { phone: regex }, { email: regex }];
  }

  const [items, total] = await Promise.all([
    Lead.find(filter).sort({ createdAt: -1 }).skip(pg.skip).limit(pg.limit).lean(),
    Lead.countDocuments(filter),
  ]);
  return toPaginated(items, total, pg.page, pg.limit);
}

async function findLead(id: string): Promise<any> {
  assertObjectId(id, "Lead no encontrado");
  const lead = await Lead.findById(id);
  if (!lead) throw new CustomError("Lead no encontrado", 404);
  return lead;
}

export async function update(id: string, input: { status?: unknown; notes?: unknown }) {
  const lead = await findLead(id);

  if (input.status !== undefined) {
    if (!(LEAD_STATUSES as readonly unknown[]).includes(input.status)) {
      throw new CustomError(`Estado inválido. Usa: ${LEAD_STATUSES.join(", ")}`, 400);
    }
    lead.status = input.status as LeadStatus;
  }
  if (input.notes !== undefined) lead.notes = typeof input.notes === "string" ? input.notes : "";

  await lead.save();
  return lead;
}

export async function remove(id: string): Promise<void> {
  const lead = await findLead(id);
  await Lead.deleteOne({ _id: lead._id });
}
