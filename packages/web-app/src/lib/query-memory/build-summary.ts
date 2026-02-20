import { connectDB } from "@/lib/db";
import { RememberedQuery } from "@/lib/models/remembered-query";
import type { QueryCategory } from "@/types";

// ── In-memory cache (5-minute TTL) ──────────────────────────────────

let cachedSummary: string | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function invalidateQueryMemoryCache(): void {
  cachedSummary = null;
  cacheTimestamp = 0;
}

// ── Category labels ─────────────────────────────────────────────────

const CATEGORY_LABELS: Record<QueryCategory, string> = {
  funnel: "Sales Funnel",
  billing: "Billing & Invoices",
  cases: "Cases & Services",
  leads: "Leads & Contact Requests",
  clients: "Clients & Persons",
  staff: "Staff & Attorneys",
  courts: "Courts & Hearings",
  general: "General",
};

// ── Main builder ────────────────────────────────────────────────────

export async function buildQueryMemorySummary(): Promise<string> {
  // Return cached if still fresh
  if (cachedSummary !== null && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return cachedSummary;
  }

  await connectDB();

  const queries = await RememberedQuery.find()
    .sort({ createdAt: -1 })
    .lean<
      Array<{
        naturalLanguage: string;
        generatedSQL: string;
        tables: string[];
        joins: string[];
        category: QueryCategory;
      }>
    >();

  if (queries.length === 0) {
    cachedSummary = "";
    cacheTimestamp = Date.now();
    return cachedSummary;
  }

  const lines: string[] = [
    "QUERY MEMORY — Previously verified working queries. Use these as reference for similar questions:",
  ];

  // Collect all unique join patterns
  const allJoins = new Set<string>();
  for (const q of queries) {
    for (const j of q.joins) allJoins.add(j);
  }

  if (allJoins.size > 0) {
    lines.push("");
    lines.push("Known working join patterns: " + [...allJoins].join(", "));
  }

  // Group by category
  const grouped = new Map<QueryCategory, typeof queries>();
  for (const q of queries) {
    const list = grouped.get(q.category) ?? [];
    list.push(q);
    grouped.set(q.category, list);
  }

  for (const [category, items] of grouped) {
    lines.push("");
    lines.push(`[${CATEGORY_LABELS[category]}]`);
    // Up to 5 examples per category
    for (const item of items.slice(0, 5)) {
      const truncatedSQL =
        item.generatedSQL.length > 200
          ? item.generatedSQL.slice(0, 200) + "..."
          : item.generatedSQL;
      lines.push(`Q: ${item.naturalLanguage}`);
      lines.push(`SQL: ${truncatedSQL}`);
    }
  }

  cachedSummary = lines.join("\n");
  cacheTimestamp = Date.now();

  console.log(
    `[QueryMemory] Built summary: ${queries.length} queries, ${cachedSummary.length} chars`
  );

  return cachedSummary;
}
