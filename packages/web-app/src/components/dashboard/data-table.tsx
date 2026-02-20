"use client";

import { useState, useMemo } from "react";

interface DataTableProps {
  headers: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

type SortDir = "asc" | "desc";

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return value.toLocaleString();
  return String(value);
}

export function DataTable({ headers, rows, rowCount }: DataTableProps) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    return [...rows].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      const aNum = Number(aVal);
      const bNum = Number(bVal);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortDir === "asc" ? aNum - bNum : bNum - aNum;
      }
      const aStr = String(aVal);
      const bStr = String(bVal);
      return sortDir === "asc"
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });
  }, [rows, sortKey, sortDir]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  if (rows.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-gray-500">
        No results
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="overflow-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="sticky top-0 z-10 bg-gray-50">
            <tr>
              {headers.map((h) => (
                <th
                  key={h}
                  onClick={() => handleSort(h)}
                  className="cursor-pointer select-none whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 hover:bg-gray-100"
                >
                  <span className="inline-flex items-center gap-1">
                    {h}
                    {sortKey === h && (
                      <span className="text-accent">
                        {sortDir === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {sortedRows.map((row, i) => {
              // Build a composite key from row index + first 3 cell values for stable identity
              const keyParts = headers.slice(0, 3).map((h) => String(row[h] ?? ""));
              const rowKey = `${i}-${keyParts.join("|")}`;
              return (
              <tr
                key={rowKey}
                className="transition-colors even:bg-gray-50/50 hover:bg-blue-50/50"
              >
                {headers.map((h) => {
                  const val = row[h];
                  const isNull = val === null || val === undefined;
                  return (
                    <td
                      key={h}
                      className="max-w-[300px] truncate whitespace-nowrap px-3 py-1.5 text-gray-700"
                      title={isNull ? "NULL" : String(val)}
                    >
                      {isNull ? (
                        <span className="italic text-gray-400">NULL</span>
                      ) : (
                        formatCell(val)
                      )}
                    </td>
                  );
                })}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-2 text-right text-xs text-gray-500">
        {rowCount} row{rowCount !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
