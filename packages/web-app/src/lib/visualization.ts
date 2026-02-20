import type { ParsedQueryResult, VisualizationRecommendation } from "@/types";

export function recommendVisualization(
  result: ParsedQueryResult
): VisualizationRecommendation {
  const { headers, rows, rowCount } = result;

  if (rowCount === 0 || headers.length === 0) {
    return { type: "table", reason: "No data" };
  }

  // Rule 1: Single row, single column → big number
  if (rowCount === 1 && headers.length === 1) {
    return {
      type: "big-number",
      xKey: headers[0],
      yKey: headers[0],
      reason: "Single value result",
    };
  }

  // Rule 2: Single row with a numeric column among few → big number
  if (rowCount === 1 && headers.length <= 3) {
    const numericHeader = headers.find(
      (h) => typeof rows[0][h] === "number" || !isNaN(Number(rows[0][h]))
    );
    if (numericHeader) {
      return {
        type: "big-number",
        xKey: numericHeader,
        yKey: numericHeader,
        reason: "Single aggregate value",
      };
    }
  }

  // Rule 3: Two columns — one label, one numeric → bar or pie
  if (headers.length === 2) {
    const [col1, col2] = headers;
    const col1IsNumeric = rows.every(
      (r) => typeof r[col1] === "number" || !isNaN(Number(r[col1]))
    );
    const col2IsNumeric = rows.every(
      (r) => typeof r[col2] === "number" || !isNaN(Number(r[col2]))
    );

    if (!col1IsNumeric && col2IsNumeric) {
      return {
        type: rowCount <= 8 ? "pie" : "bar",
        xKey: col1,
        yKey: col2,
        reason:
          rowCount <= 8
            ? "Categorical data with few categories"
            : "Categorical data",
      };
    }
    if (col1IsNumeric && !col2IsNumeric) {
      return {
        type: rowCount <= 8 ? "pie" : "bar",
        xKey: col2,
        yKey: col1,
        reason: "Categorical data",
      };
    }
  }

  // Rule 4: Date/time column + numeric column → line chart
  if (headers.length >= 2) {
    const datePattern = /date|time|month|year|created|updated|_at$/i;
    const dateCol = headers.find((h) => datePattern.test(h));
    if (dateCol) {
      const numericCol = headers.find(
        (h) =>
          h !== dateCol &&
          rows.every(
            (r) => typeof r[h] === "number" || !isNaN(Number(r[h]))
          )
      );
      if (numericCol) {
        return {
          type: "line",
          xKey: dateCol,
          yKey: numericCol,
          reason: "Time series data detected",
        };
      }
    }
  }

  // Rule 5: Three columns — two categorical + one numeric → heatmap candidate
  if (headers.length === 3 && rowCount >= 4) {
    const numericCols = headers.filter((h) =>
      rows.every((r) => typeof r[h] === "number" || !isNaN(Number(r[h])))
    );
    const categoricalCols = headers.filter((h) => !numericCols.includes(h));
    if (categoricalCols.length === 2 && numericCols.length === 1) {
      return {
        type: "heatmap",
        xKey: categoricalCols[0],
        yKey: numericCols[0],
        reason: "Cross-tabulated data suitable for heatmap",
      };
    }
  }

  // Default: table
  return { type: "table", reason: "Complex data best viewed as table" };
}
