import type { QueryCategory } from "@/types";

/**
 * Extract table names from FROM and JOIN clauses in SQL.
 */
export function extractTables(sql: string): string[] {
  const tables = new Set<string>();

  // Match FROM <table> and JOIN <table> patterns
  // Handles optional backticks and aliases
  const pattern = /(?:FROM|JOIN)\s+`?(\w+)`?/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(sql)) !== null) {
    tables.add(match[1].toLowerCase());
  }

  return [...tables];
}

/**
 * Extract join patterns from ON conditions: "table1→table2".
 */
export function extractJoins(sql: string): string[] {
  const joins = new Set<string>();

  // Match ON <t1>.<col> = <t2>.<col> patterns
  const pattern = /ON\s+`?(\w+)`?\.\w+\s*=\s*`?(\w+)`?\.\w+/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(sql)) !== null) {
    const t1 = match[1].toLowerCase();
    const t2 = match[2].toLowerCase();
    // Normalize order alphabetically for dedup
    const pair = t1 < t2 ? `${t1}→${t2}` : `${t2}→${t1}`;
    joins.add(pair);
  }

  return [...joins];
}

/**
 * Detect a category based on tables used in the query.
 */
const CATEGORY_TABLE_MAP: Record<string, QueryCategory> = {
  sales_funnels: "funnel",
  campaigns: "funnel",
  invoices: "billing",
  receipts: "billing",
  receipt_allocations: "billing",
  payment_plans: "billing",
  fees: "billing",
  cases: "cases",
  services: "cases",
  service_types: "cases",
  contact_requests: "leads",
  appointments: "leads",
  persons: "clients",
  phones: "clients",
  users: "staff",
  courts: "courts",
  judges: "courts",
  court_dates: "courts",
};

// Priority order: more specific categories win over generic ones
const CATEGORY_PRIORITY: QueryCategory[] = [
  "funnel",
  "billing",
  "courts",
  "staff",
  "leads",
  "cases",
  "clients",
  "general",
];

export function detectCategory(tables: string[]): QueryCategory {
  const hits = new Map<QueryCategory, number>();

  for (const table of tables) {
    const cat = CATEGORY_TABLE_MAP[table];
    if (cat) {
      hits.set(cat, (hits.get(cat) ?? 0) + 1);
    }
  }

  if (hits.size === 0) return "general";

  // Return highest-priority category that has hits
  for (const cat of CATEGORY_PRIORITY) {
    if (hits.has(cat)) return cat;
  }

  return "general";
}
