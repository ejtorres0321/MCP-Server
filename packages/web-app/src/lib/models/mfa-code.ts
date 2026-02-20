import mongoose, { Schema, type Document, type Model } from "mongoose";
import type { IMfaCode } from "@/types";

export interface MfaCodeDocument extends Omit<IMfaCode, "_id">, Document {}

const mfaCodeSchema = new Schema<MfaCodeDocument>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // TTL index — MongoDB auto-deletes when expiresAt is reached
    },
    usedAt: {
      type: Date,
      default: null,
    },
    attempts: {
      type: Number,
      default: 0,
      max: 5,
    },
  },
  {
    timestamps: true,
  }
);

export const MfaCode: Model<MfaCodeDocument> =
  mongoose.models.MfaCode || mongoose.model<MfaCodeDocument>("MfaCode", mfaCodeSchema);
