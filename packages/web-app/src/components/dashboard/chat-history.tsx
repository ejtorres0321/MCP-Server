"use client";

import { useEffect, useRef } from "react";
import { useDashboard } from "@/context/dashboard-context";
import { ChatMessage } from "./chat-message";

function ChatIcon({ className }: { className?: string }) {
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
        d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155"
      />
    </svg>
  );
}

export function ChatHistory() {
  const { state, selectMessage, rememberMessage } = useDashboard();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.messages.length, state.isLoading]);

  if (state.messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-4 text-center">
        <ChatIcon className="mb-3 h-10 w-10 text-gray-300" />
        <h3 className="text-sm font-medium text-gray-700">
          Database Console
        </h3>
        <p className="mt-1 text-xs text-gray-500">
          Ask a question about the database in Spanish or English.
        </p>
        <div className="mt-4 space-y-1.5 text-xs text-gray-400">
          <p>&quot;How many cases were signed yesterday?&quot;</p>
          <p>&quot;How many leads did we receive this week?&quot;</p>
          <p>&quot;Show me the top 10 offices by cases&quot;</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {state.messages.map((msg) => (
        <ChatMessage
          key={msg.id}
          message={msg}
          isSelected={state.selectedMessageId === msg.id}
          onSelect={() => selectMessage(msg.id)}
          onRemember={rememberMessage}
          isRemembered={state.rememberedMessageIds.has(msg.id)}
          isRemembering={state.rememberingMessageIds.has(msg.id)}
        />
      ))}
      <div ref={scrollRef} />
    </div>
  );
}
