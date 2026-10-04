import mongoose, { Schema } from "mongoose";

export interface IAlbum {
  slug: string;
  title: string;
  eventName: string;
  eventDate: Date | null;
  description: string;
  coverPublicId: string;
  photographer: string;
  photographerUrl: string;
  order: number;
  isPublished: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const albumSchema = new Schema<IAlbum>(
  {
    slug: { type: String, required: true, unique: true, index: true, trim: true },
    title: { type: String, required: true, trim: true },
    // Varios álbumes pueden pertenecer al mismo evento (Atletas, Ganadores…).
    eventName: { type: String, default: "", trim: true },
    eventDate: { type: Date, default: null },
    description: { type: String, default: "" },
    coverPublicId: { type: String, default: "" },
    photographer: { type: String, default: "" },
    photographerUrl: { type: String, default: "" },
    order: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Album = mongoose.models.Album || mongoose.model<IAlbum>("Album", albumSchema);
