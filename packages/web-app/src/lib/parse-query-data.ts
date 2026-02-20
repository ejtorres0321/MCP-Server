import type { ParsedQueryResult } from "@/types";

export function parseQueryData(data: string): ParsedQueryResult {
  try {
    const parsed = JSON.parse(data);

    // Handle direct array: [{col: val}, ...]
    if (Array.isArray(parsed) && parsed.length > 0) {
      return {
        headers: Object.keys(parsed[0]),
        rows: parsed,
        rowCount: parsed.length,
      };
    }

    // Handle MCP wrapper: { rowCount, executionTimeMs, rows: [...] }
    if (parsed.rows && Array.isArray(parsed.rows)) {
      return {
        headers: parsed.rows.length > 0 ? Object.keys(parsed.rows[0]) : [],
        rows: parsed.rows,
        rowCount: parsed.rowCount ?? parsed.rows.length,
      };
    }

    // Handle single object (e.g., { count: 42 })
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      const keys = Object.keys(parsed).filter(
        (k) => k !== "rowCount" && k !== "executionTimeMs"
      );
      if (keys.length > 0 && !parsed.rows) {
        return {
          headers: keys,
          rows: [parsed],
          rowCount: 1,
        };
      }
    }

    return { headers: [], rows: [], rowCount: 0 };
  } catch (e) {
    console.error("[parseQueryData] Failed to parse:", e, "Data:", data?.slice(0, 200));
    return { headers: [], rows: [], rowCount: 0 };
  }
}
