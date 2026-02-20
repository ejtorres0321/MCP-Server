"use server";

import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { RememberedQuery } from "@/lib/models/remembered-query";
import {
  extractTables,
  extractJoins,
  detectCategory,
} from "@/lib/query-memory/sql-helpers";
import { invalidateQueryMemoryCache } from "@/lib/query-memory/build-summary";
import type { IRememberedQuery } from "@/types";

async function requireAuth() {
  const session = await auth();
  if (
    !session?.user?.id ||
    !session.user.mfaVerified ||
    !session.user.isApproved
  ) {
    throw new Error("Unauthorized");
  }
  return session;
}

interface RememberInput {
  naturalLanguage: string;
  generatedSQL: string;
  tier: 1 | 2;
}

export async function rememberQuery(
  input: RememberInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await requireAuth();
    await connectDB();

    // Dedup check
    const existing = await RememberedQuery.findOne({
      generatedSQL: input.generatedSQL,
    });
    if (existing) {
      return { success: true }; // Already remembered, treat as success
    }

    const tables = extractTables(input.generatedSQL);
    const joins = extractJoins(input.generatedSQL);
    const category = detectCategory(tables);

    await RememberedQuery.create({
      naturalLanguage: input.naturalLanguage,
      generatedSQL: input.generatedSQL,
      tables,
      joins,
      category,
      rememberedBy: session.user.id,
      rememberedByName: session.user.name ?? "Unknown",
      tier: input.tier,
    });

    invalidateQueryMemoryCache();

    return { success: true };
  } catch (error) {
    console.error("[QueryMemory] rememberQuery error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to remember query",
    };
  }
}

export async function forgetQuery(
  queryId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAuth();
    await connectDB();

    const result = await RememberedQuery.findByIdAndDelete(queryId);
    if (!result) {
      return { success: false, error: "Query not found" };
    }

    invalidateQueryMemoryCache();

    return { success: true };
  } catch (error) {
    console.error("[QueryMemory] forgetQuery error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete query",
    };
  }
}

export async function listRememberedQueries(): Promise<IRememberedQuery[]> {
  try {
    await requireAuth();
    await connectDB();

    const queries = await RememberedQuery.find()
      .sort({ createdAt: -1 })
      .lean<IRememberedQuery[]>();

    // Serialize MongoDB _id to string
    return queries.map((q) => ({
      ...q,
      _id: String(q._id),
    }));
  } catch (error) {
    console.error("[QueryMemory] listRememberedQueries error:", error);
    return [];
  }
}
