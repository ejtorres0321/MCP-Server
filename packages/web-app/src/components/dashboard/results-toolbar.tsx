"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { exportToExcel, exportToPDF } from "@/lib/export-utils";
import type { VisualizationType, VisualizationRecommendation } from "@/types";
import { cn } from "@/lib/utils";

interface ResultsToolbarProps {
  recommendation: VisualizationRecommendation;
  activeView: VisualizationType;
  onViewChange: (view: VisualizationType) => void;
  headers: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  generatedSQL?: string;
  onRemember?: () => void;
  isRemembered?: boolean;
  isRemembering?: boolean;
}

function ViewTab({
  label,
  view,
  activeView,
  onClick,
}: {
  label: string;
  view: VisualizationType;
  activeView: VisualizationType;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
        activeView === view
          ? "bg-accent text-white"
          : "text-gray-600 hover:bg-gray-100"
      )}
    >
      {label}
    </button>
  );
}

export function ResultsToolbar({
  recommendation,
  activeView,
  onViewChange,
  headers,
  rows,
  rowCount,
  generatedSQL,
  onRemember,
  isRemembered,
  isRemembering,
}: ResultsToolbarProps) {
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null);

  const canChart =
    recommendation.type !== "table" && recommendation.type !== "big-number";
  const canBigNumber = recommendation.type === "big-number";

  const handleExportExcel = useCallback(async () => {
    setExporting("excel");
    try {
      await exportToExcel(headers, rows);
    } finally {
      setExporting(null);
    }
  }, [headers, rows]);

  const handleExportPDF = useCallback(async () => {
    setExporting("pdf");
    try {
      await exportToPDF(
        headers,
        rows,
        generatedSQL ? `Query: ${generatedSQL.slice(0, 100)}` : "Query Results"
      );
    } finally {
      setExporting(null);
    }
  }, [headers, rows, generatedSQL]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-white px-4 py-2">
      {/* View toggle */}
      <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-0.5">
        <ViewTab
          label="Table"
          view="table"
          activeView={activeView}
          onClick={() => onViewChange("table")}
        />
        {canBigNumber && (
          <ViewTab
            label="Summary"
            view="big-number"
            activeView={activeView}
            onClick={() => onViewChange("big-number")}
          />
        )}
        {canChart && (
          <>
            <ViewTab
              label="Bar"
              view="bar"
              activeView={activeView}
              onClick={() => onViewChange("bar")}
            />
            <ViewTab
              label="Line"
              view="line"
              activeView={activeView}
              onClick={() => onViewChange("line")}
            />
            <ViewTab
              label="Pie"
              view="pie"
              activeView={activeView}
              onClick={() => onViewChange("pie")}
            />
          </>
        )}
      </div>

      {/* Right side: row count + remember + export buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-500">
          {rowCount} row{rowCount !== 1 ? "s" : ""}
        </span>
        {onRemember && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRemember}
            disabled={isRemembered || isRemembering}
            className={cn(
              isRemembered && "border-green-300 text-green-600"
            )}
          >
            {isRemembered ? "Saved" : isRemembering ? "Saving..." : "Remember"}
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportExcel}
          disabled={exporting !== null || rows.length === 0}
        >
          {exporting === "excel" ? "..." : "Excel"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportPDF}
          disabled={exporting !== null || rows.length === 0}
        >
          {exporting === "pdf" ? "..." : "PDF"}
        </Button>
      </div>
    </div>
  );
}
