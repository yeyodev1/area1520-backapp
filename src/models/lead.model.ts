import mongoose, { Schema } from "mongoose";

export const LEAD_STATUSES = ["nuevo", "contactado", "agendado", "inscrito", "descartado"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LOCATIONS = ["garzota", "la-joya"] as const;
export type Location = (typeof LOCATIONS)[number];

export interface ILead {
  name: string;
  phone: string;
  email: string;
  location: Location;
  preferredSchedule: string;
  goal: string;
  experience: string;
  source: string;
  status: LeadStatus;
  notes: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const leadSchema = new Schema<ILead>(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, default: "", lowercase: true, trim: true },
    location: { type: String, enum: LOCATIONS, required: true },
    preferredSchedule: { type: String, default: "" },
    goal: { type: String, default: "" },
    experience: { type: String, default: "" },
    source: { type: String, default: "web" },
    status: { type: String, enum: LEAD_STATUSES, default: "nuevo", index: true },
    notes: { type: String, default: "" },
  },
  { timestamps: true },
);

export const Lead = mongoose.models.Lead || mongoose.model<ILead>("Lead", leadSchema);
