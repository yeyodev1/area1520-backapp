import mongoose, { Schema, Types } from "mongoose";

export const PHOTO_TAGS = ["hero", "featured", "community", "podium", "medals", "coach"] as const;
export type PhotoTag = (typeof PHOTO_TAGS)[number];

export interface IPhoto {
  album: Types.ObjectId;
  publicId: string;
  url: string;
  width: number;
  height: number;
  originalName: string;
  order: number;
  tags: PhotoTag[];
  isHidden: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const photoSchema = new Schema<IPhoto>(
  {
    album: { type: Schema.Types.ObjectId, ref: "Album", required: true, index: true },
    // publicId es la llave de idempotencia de la importación.
    publicId: { type: String, required: true, unique: true },
    url: { type: String, required: true },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    originalName: { type: String, default: "" },
    order: { type: Number, default: 0 },
    tags: { type: [String], enum: PHOTO_TAGS, default: [], index: true },
    isHidden: { type: Boolean, default: false },
  },
  { timestamps: true },
);

photoSchema.index({ album: 1, isHidden: 1, order: 1 });

export const Photo = mongoose.models.Photo || mongoose.model<IPhoto>("Photo", photoSchema);
