"use client";

import { useMemo } from "react";
import { useDashboard } from "@/context/dashboard-context";
import { parseQueryData } from "@/lib/parse-query-data";
import { recommendVisualization } from "@/lib/visualization";
import { ResultsToolbar } from "./results-toolbar";
import { DataTable } from "./data-table";
import { DataChart } from "./data-chart";
import { DataHeatmap } from "./data-heatmap";
import { BigNumberCard } from "./big-number-card";

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
      />
    </svg>
  );
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
      />
    </svg>
  );
}

function ChatBubbleIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"
      />
    </svg>
  );
}

export function ResultsPanel() {
  const { state, setView, rememberMessage } = useDashboard();

  const selectedMessage = useMemo(
    () => state.messages.find((m) => m.id === state.selectedMessageId),
    [state.messages, state.selectedMessageId]
  );

  const parsed = useMemo(() => {
    if (!selectedMessage?.data) return null;
    return parseQueryData(selectedMessage.data);
  }, [selectedMessage?.data]);

  const recommendation = useMemo(() => {
    if (!parsed) return null;
    return recommendVisualization(parsed);
  }, [parsed]);

  // Empty state
  if (!selectedMessage) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-gray-50 text-center">
        <ChartIcon className="mb-3 h-12 w-12 text-gray-300" />
        <h3 className="text-sm font-medium text-gray-600">
          Query Results
        </h3>
        <p className="mt-1 text-xs text-gray-400">
          Results will appear here when you run a query.
        </p>
      </div>
    );
  }

  // Error state
  if (selectedMessage.error && !selectedMessage.data) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-gray-50 px-8 text-center">
        <WarningIcon className="mb-3 h-10 w-10 text-amber-400" />
        <h3 className="text-sm font-medium text-destructive">
          Query Error
        </h3>
        <p className="mt-2 max-w-md text-xs text-gray-600">
          {selectedMessage.error}
        </p>
        {selectedMessage.generatedSQL && (
          <pre className="mt-4 max-w-lg overflow-auto rounded-lg bg-gray-100 p-3 text-left text-[11px] text-gray-700">
            {selectedMessage.generatedSQL}
          </pre>
        )}
      </div>
    );
  }

  // Text-only response (AI answered without querying the database)
  if (selectedMessage.aiMessage && !selectedMessage.data && !selectedMessage.error) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-gray-50 px-8 text-center">
        <ChatBubbleIcon className="mb-3 h-10 w-10 text-gray-300" />
        <p className="max-w-md whitespace-pre-line text-sm text-gray-700">
          {selectedMessage.aiMessage}
        </p>
      </div>
    );
  }

  // No data parsed
  if (!parsed || !recommendation) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Could not process the data</p>
      </div>
    );
  }

  const { headers, rows, rowCount } = parsed;

  return (
    <div className="flex h-full flex-col bg-gray-50">
      {/* AI Analysis Banner */}
      {selectedMessage.aiMessage && (
        <div className="border-b border-blue-200 bg-blue-50 px-4 py-2">
          <p className="whitespace-pre-line text-sm text-gray-700">
            {selectedMessage.aiMessage}
          </p>
        </div>
      )}

      {/* Toolbar */}
      <ResultsToolbar
        recommendation={recommendation}
        activeView={state.activeView}
        onViewChange={setView}
        headers={headers}
        rows={rows}
        rowCount={rowCount}
        generatedSQL={selectedMessage.generatedSQL}
        onRemember={
          selectedMessage.data && selectedMessage.generatedSQL
            ? () => rememberMessage(selectedMessage.id)
            : undefined
        }
        isRemembered={state.rememberedMessageIds.has(selectedMessage.id)}
        isRemembering={state.rememberingMessageIds.has(selectedMessage.id)}
      />

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {state.activeView === "table" && (
          <DataTable headers={headers} rows={rows} rowCount={rowCount} />
        )}

        {state.activeView === "big-number" &&
          rowCount === 1 &&
          headers.length >= 1 && (
            <div className="flex h-full items-center justify-center">
              <BigNumberCard
                label={headers[0]}
                value={rows[0][headers[0]] as string | number}
              />
            </div>
          )}

        {state.activeView === "heatmap" && (
          <DataHeatmap data={rows} headers={headers} />
        )}

        {(state.activeView === "bar" ||
          state.activeView === "line" ||
          state.activeView === "pie") &&
          recommendation.xKey &&
          recommendation.yKey && (
            <DataChart
              type={state.activeView}
              data={rows}
              xKey={recommendation.xKey}
              yKey={recommendation.yKey}
            />
          )}

        {/* Fallback: if chart view but no recommendation keys, show table */}
        {(state.activeView === "bar" ||
          state.activeView === "line" ||
          state.activeView === "pie") &&
          (!recommendation.xKey || !recommendation.yKey) && (
            <DataTable headers={headers} rows={rows} rowCount={rowCount} />
          )}
      </div>

      {/* SQL preview at bottom */}
      {selectedMessage.generatedSQL && (
        <div className="border-t border-gray-200 bg-white px-4 py-2">
          <details className="group">
            <summary className="cursor-pointer text-xs font-medium text-gray-500 hover:text-gray-700">
              Generated SQL
            </summary>
            <pre className="mt-1 overflow-auto rounded bg-gray-50 p-2 text-[11px] text-gray-600">
              {selectedMessage.generatedSQL}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
