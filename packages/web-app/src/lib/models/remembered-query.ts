import mongoose, { Schema, type Document, type Model } from "mongoose";
import type { IRememberedQuery, QueryCategory } from "@/types";

export interface RememberedQueryDocument
  extends Omit<IRememberedQuery, "_id">,
    Document {}

const rememberedQuerySchema = new Schema<RememberedQueryDocument>(
  {
    naturalLanguage: {
      type: String,
      required: [true, "Natural language question is required"],
      trim: true,
    },
    generatedSQL: {
      type: String,
      required: [true, "Generated SQL is required"],
      trim: true,
    },
    tables: {
      type: [String],
      default: [],
    },
    joins: {
      type: [String],
      default: [],
    },
    category: {
      type: String,
      enum: [
        "funnel",
        "billing",
        "cases",
        "leads",
        "clients",
        "staff",
        "courts",
        "general",
      ] as QueryCategory[],
      default: "general",
    },
    rememberedBy: {
      type: String,
      required: [true, "User ID is required"],
    },
    rememberedByName: {
      type: String,
      required: [true, "User name is required"],
      trim: true,
    },
    tier: {
      type: Number,
      enum: [1, 2],
      required: [true, "Tier is required"],
    },
  },
  {
    timestamps: true,
  }
);

rememberedQuerySchema.index({ generatedSQL: 1 }, { unique: true });
rememberedQuerySchema.index({ category: 1 });

export const RememberedQuery: Model<RememberedQueryDocument> =
  mongoose.models.RememberedQuery ||
  mongoose.model<RememberedQueryDocument>(
    "RememberedQuery",
    rememberedQuerySchema
  );
