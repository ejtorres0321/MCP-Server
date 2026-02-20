"use client";

import { useState, useRef, useCallback } from "react";
import { useDashboard } from "@/context/dashboard-context";
import { Spinner } from "@/components/ui/spinner";

export function ChatInput() {
  const { sendMessage, state } = useDashboard();
  const [prompt, setPrompt] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(async () => {
    const trimmed = prompt.trim();
    if (!trimmed || state.isLoading) return;
    setPrompt("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    await sendMessage(trimmed);
  }, [prompt, state.isLoading, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter to submit, Shift+Enter for newline
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
    // Auto-grow textarea
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };

  const canSubmit = prompt.trim().length > 0 && !state.isLoading;

  return (
    <div className="border-t border-gray-200 bg-white px-3 pb-3 pt-2">
      <div className="flex items-end gap-2 rounded-2xl border border-gray-300 bg-gray-50 px-3 py-2 transition-colors focus-within:border-accent focus-within:bg-white focus-within:ring-1 focus-within:ring-accent">
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question..."
          disabled={state.isLoading}
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none disabled:cursor-not-allowed disabled:opacity-60"
        />
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent text-white transition-colors hover:bg-accent/90 disabled:bg-gray-300 disabled:text-gray-500"
          aria-label="Send message"
        >
          {state.isLoading ? (
            <Spinner className="h-4 w-4" />
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
            >
              <path d="M3.105 2.29a.75.75 0 0 0-.826.95l1.414 4.925A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086L2.28 16.76a.75.75 0 0 0 .826.95l15.002-6.5a.75.75 0 0 0 0-1.42L3.105 2.29Z" />
            </svg>
          )}
        </button>
      </div>
      <p className="mt-1 text-center text-[10px] text-gray-400">
        Shift + Enter for new line
      </p>
    </div>
  );
}
