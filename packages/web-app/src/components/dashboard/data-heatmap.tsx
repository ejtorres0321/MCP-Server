"use client";

import { useMemo, useState } from "react";

interface DataHeatmapProps {
  data: Record<string, unknown>[];
  headers: string[];
}

function interpolateColor(value: number, min: number, max: number): string {
  if (max === min) return "rgb(219, 234, 254)"; // blue-100
  const ratio = (value - min) / (max - min);
  // From blue-50 (#eff6ff) → blue-500 (#3b82f6) → blue-900 (#1e3a8a)
  if (ratio <= 0.5) {
    const t = ratio * 2;
    const r = Math.round(239 + (59 - 239) * t);
    const g = Math.round(246 + (130 - 246) * t);
    const b = Math.round(255 + (246 - 255) * t);
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    const t = (ratio - 0.5) * 2;
    const r = Math.round(59 + (30 - 59) * t);
    const g = Math.round(130 + (58 - 130) * t);
    const b = Math.round(246 + (138 - 246) * t);
    return `rgb(${r}, ${g}, ${b})`;
  }
}

function textColor(value: number, min: number, max: number): string {
  if (max === min) return "#1e3a5f";
  const ratio = (value - min) / (max - min);
  return ratio > 0.45 ? "#ffffff" : "#1e3a5f";
}

export function DataHeatmap({ data, headers }: DataHeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);

  const { rowLabels, colLabels, grid, valueCol, min, max, rowKey, colKey } =
    useMemo(() => {
      // Detect: 2 categorical + 1 numeric
      const numericCols = headers.filter((h) =>
        data.every(
          (r) => typeof r[h] === "number" || !isNaN(Number(r[h]))
        )
      );
      const categoricalCols = headers.filter(
        (h) => !numericCols.includes(h)
      );

      const vCol = numericCols[0] ?? headers[headers.length - 1];
      const rKey = categoricalCols[0] ?? headers[0];
      const cKey = categoricalCols[1] ?? headers[1];

      // Build unique labels
      const rowSet = new Set<string>();
      const colSet = new Set<string>();
      for (const row of data) {
        rowSet.add(String(row[rKey] ?? ""));
        colSet.add(String(row[cKey] ?? ""));
      }
      const rLabels = [...rowSet];
      const cLabels = [...colSet];

      // Build grid[rowLabel][colLabel] = value
      const g: Record<string, Record<string, number>> = {};
      let lo = Infinity;
      let hi = -Infinity;
      for (const row of data) {
        const r = String(row[rKey] ?? "");
        const c = String(row[cKey] ?? "");
        const v = Number(row[vCol]) || 0;
        if (!g[r]) g[r] = {};
        g[r][c] = v;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }

      return {
        rowLabels: rLabels,
        colLabels: cLabels,
        grid: g,
        valueCol: vCol,
        min: lo === Infinity ? 0 : lo,
        max: hi === -Infinity ? 0 : hi,
        rowKey: rKey,
        colKey: cKey,
      };
    }, [data, headers]);

  if (rowLabels.length === 0 || colLabels.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-gray-500">
        Not enough data for a heatmap
      </div>
    );
  }

  return (
    <div className="w-full overflow-auto rounded-lg border border-gray-200 bg-white p-4">
      {/* Legend */}
      <div className="mb-3 flex items-center gap-3 text-xs text-gray-500">
        <span>{rowKey} vs {colKey}</span>
        <span className="text-gray-400">|</span>
        <span>Value: {valueCol}</span>
        <div className="ml-auto flex items-center gap-1">
          <span>{min.toLocaleString()}</span>
          <div
            className="h-3 w-24 rounded"
            style={{
              background: `linear-gradient(to right, ${interpolateColor(min, min, max)}, ${interpolateColor((min + max) / 2, min, max)}, ${interpolateColor(max, min, max)})`,
            }}
          />
          <span>{max.toLocaleString()}</span>
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-auto">
        <table className="border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white px-3 py-2 text-left text-xs font-semibold text-gray-600">
                {rowKey} \ {colKey}
              </th>
              {colLabels.map((col) => (
                <th
                  key={col}
                  className="whitespace-nowrap px-3 py-2 text-center text-xs font-semibold text-gray-600"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowLabels.map((row) => (
              <tr key={row}>
                <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-1.5 text-xs font-medium text-gray-700">
                  {row}
                </td>
                {colLabels.map((col) => {
                  const val = grid[row]?.[col];
                  const cellKey = `${row}|${col}`;
                  const hasValue = val !== undefined;
                  return (
                    <td
                      key={col}
                      className="relative px-1 py-1"
                      onMouseEnter={() => setHoveredCell(cellKey)}
                      onMouseLeave={() => setHoveredCell(null)}
                    >
                      <div
                        className="flex min-h-[36px] min-w-[56px] items-center justify-center rounded text-xs font-medium transition-transform"
                        style={
                          hasValue
                            ? {
                                backgroundColor: interpolateColor(val, min, max),
                                color: textColor(val, min, max),
                                transform:
                                  hoveredCell === cellKey
                                    ? "scale(1.08)"
                                    : "scale(1)",
                              }
                            : {
                                backgroundColor: "#f9fafb",
                                color: "#d1d5db",
                              }
                        }
                      >
                        {hasValue ? val.toLocaleString() : "-"}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
