import { env } from "../config/env";
import { layout, sendEmail } from "./email.service";

const LOCATION_LABELS: Record<string, string> = {
  garzota: "Garzota",
  "la-joya": "La Joya",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Avisa al equipo de un lead nuevo. Nunca lanza: si el correo falla, el
 * lead ya quedó guardado y se ve en el panel.
 */
export async function notifyNewLead(lead: {
  name: string;
  phone: string;
  email?: string;
  location: string;
  preferredSchedule?: string;
  goal?: string;
  experience?: string;
}): Promise<void> {
  if (!env.LEADS_NOTIFY_EMAIL) return;

  try {
    const rows: [string, string][] = [
      ["Nombre", lead.name],
      ["Teléfono", lead.phone],
      ["Correo", lead.email || "—"],
      ["Sede", LOCATION_LABELS[lead.location] || lead.location],
      ["Horario preferido", lead.preferredSchedule || "—"],
      ["Objetivo", lead.goal || "—"],
      ["Experiencia", lead.experience || "—"],
    ];
    const table = rows
      .map(
        ([label, value]) =>
          `<tr><td style="padding:4px 12px 4px 0;color:#71717a">${label}</td><td style="padding:4px 0"><strong>${escapeHtml(value)}</strong></td></tr>`,
      )
      .join("");
    const digits = lead.phone.replace(/\D/g, "");
    const whatsapp = digits
      ? `<p style="margin-top:20px"><a href="https://wa.me/${digits}" style="color:#111">Escribir por WhatsApp</a></p>`
      : "";

    const html = layout(
      "Nuevo lead desde la web",
      `<table cellpadding="0" cellspacing="0">${table}</table>${whatsapp}`,
    );
    await sendEmail(env.LEADS_NOTIFY_EMAIL, `Nuevo lead: ${lead.name}`, html);
  } catch (error) {
    console.error("[leads] no se pudo enviar el aviso:", error);
  }
}
