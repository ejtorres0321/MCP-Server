"use client";

import type { ConversationMessage } from "@/types";
import { parseQueryData } from "@/lib/parse-query-data";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  message: ConversationMessage;
  isSelected: boolean;
  onSelect: () => void;
  onRemember?: (messageId: string) => void;
  isRemembered?: boolean;
  isRemembering?: boolean;
}

function BookmarkIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M10 2c-1.716 0-3.408.106-5.07.31C3.806 2.45 3 3.414 3 4.517V17.25a.75.75 0 0 0 1.075.676L10 15.082l5.925 2.844A.75.75 0 0 0 17 17.25V4.517c0-1.103-.806-2.068-1.93-2.207A41.403 41.403 0 0 0 10 2Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function ChatMessage({
  message,
  isSelected,
  onSelect,
  onRemember,
  isRemembered,
  isRemembering,
}: ChatMessageProps) {
  const hasData = !!message.data;
  const hasError = !!message.error;
  const hasAiMessage = !!message.aiMessage;
  const isComplete = hasData || hasError || hasAiMessage;

  // Parse data for preview
  let preview = "";
  if (hasData) {
    const parsed = parseQueryData(message.data!);
    if (parsed.rowCount === 1 && parsed.headers.length === 1) {
      preview = String(parsed.rows[0][parsed.headers[0]] ?? "");
    } else {
      preview = `${parsed.rowCount} row${parsed.rowCount !== 1 ? "s" : ""}`;
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect();
    }
  };

  return (
    <div className="space-y-2 px-3 py-2">
      {/* User bubble */}
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-white">
          {message.prompt}
        </div>
      </div>

      {/* AI response bubble — uses div with role=button to avoid nested <button> */}
      {isComplete && (
        <div className="flex justify-start">
          <div
            role="button"
            tabIndex={0}
            onClick={onSelect}
            onKeyDown={handleKeyDown}
            className={cn(
              "max-w-[85%] cursor-pointer rounded-2xl rounded-bl-sm border px-3 py-2 text-left text-sm transition-colors",
              isSelected
                ? "border-accent bg-blue-50"
                : "border-gray-200 bg-gray-50 hover:bg-gray-100"
            )}
          >
            {hasError ? (
              <p className="text-destructive">{message.error}</p>
            ) : (
              <>
                {/* AI text message */}
                {hasAiMessage && (
                  <p className="whitespace-pre-line text-gray-800">
                    {message.aiMessage}
                  </p>
                )}
                {/* Data preview (row count / single value) */}
                {hasData && (
                  <p
                    className={cn(
                      "font-medium text-gray-900",
                      hasAiMessage && "mt-1 text-xs text-gray-500"
                    )}
                  >
                    {preview}
                  </p>
                )}
                {/* SQL preview */}
                {message.generatedSQL && (
                  <p className="mt-1 truncate font-mono text-[11px] text-gray-500">
                    {message.generatedSQL.slice(0, 80)}
                    {(message.generatedSQL.length ?? 0) > 80 ? "..." : ""}
                  </p>
                )}
              </>
            )}
            <div className="mt-1 flex items-center gap-2 text-[10px] text-gray-400">
              {message.executionTimeMs && (
                <span>{(message.executionTimeMs / 1000).toFixed(1)}s</span>
              )}
              {message.tier && <span>Tier {message.tier}</span>}
              {hasData && message.generatedSQL && onRemember && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isRemembered && !isRemembering) onRemember(message.id);
                  }}
                  disabled={isRemembered || isRemembering}
                  className={cn(
                    "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium transition-colors",
                    isRemembered
                      ? "text-green-600"
                      : isRemembering
                        ? "text-gray-400"
                        : "text-gray-500 hover:text-accent"
                  )}
                >
                  <BookmarkIcon className="h-3 w-3" />
                  {isRemembered ? "Saved" : isRemembering ? "Saving..." : "Remember"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Loading state */}
      {!isComplete && (
        <div className="flex justify-start">
          <div className="rounded-2xl rounded-bl-sm border border-gray-200 bg-gray-50 px-3 py-2">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
              Analyzing...
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
