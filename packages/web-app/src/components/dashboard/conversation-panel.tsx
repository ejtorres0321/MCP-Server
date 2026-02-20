"use client";

import { useDashboard } from "@/context/dashboard-context";
import { ChatHistory } from "./chat-history";
import { ChatInput } from "./chat-input";

export function ConversationPanel() {
  const { state, clearConversation } = useDashboard();

  return (
    <div className="flex h-full flex-col border-r border-gray-200 bg-white">
      {/* Header with clear button */}
      {state.messages.length > 0 && (
        <div className="flex items-center justify-end border-b border-gray-100 px-3 py-1.5">
          <button
            onClick={clearConversation}
            className="text-xs text-gray-400 transition-colors hover:text-destructive"
          >
            Clear
          </button>
        </div>
      )}
      {/* Chat history — scrollable */}
      <div className="flex-1 overflow-y-auto">
        <ChatHistory />
      </div>
      {/* Input — pinned at bottom */}
      <ChatInput />
    </div>
  );
}
