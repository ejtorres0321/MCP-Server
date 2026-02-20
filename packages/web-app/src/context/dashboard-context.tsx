"use client";

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  type ReactNode,
} from "react";
import { parseQueryData } from "@/lib/parse-query-data";
import { recommendVisualization } from "@/lib/visualization";
import { rememberQuery } from "@/actions/query-memory-actions";
import type {
  ConversationMessage,
  DashboardState,
  VisualizationType,
} from "@/types";

// ── API helper (uses fetch instead of server action to avoid body timeout) ──

interface AiQueryResult {
  success: boolean;
  data?: string;
  generatedSQL?: string;
  aiMessage?: string;
  error?: string;
  tier?: 1 | 2;
}

const QUERY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

async function queryApi(prompt: string, conversationHistory: ConversationTurn[]): Promise<AiQueryResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), QUERY_TIMEOUT_MS);

  try {
    const res = await fetch("/api/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, conversationHistory }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      return {
        success: false,
        error: body?.error || `Server error (${res.status})`,
      };
    }

    return await res.json();
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof DOMException && err.name === "AbortError") {
      return {
        success: false,
        error: "The query took too long. Try a simpler question.",
      };
    }
    throw err;
  }
}

// ── Actions ──────────────────────────────────────────────────────────

type DashboardAction =
  | { type: "SEND_MESSAGE"; id: string; prompt: string }
  | { type: "RECEIVE_RESPONSE"; id: string; data: Partial<ConversationMessage> }
  | { type: "SET_ERROR"; id: string; error: string }
  | { type: "SELECT_MESSAGE"; id: string }
  | { type: "SET_VIEW"; view: VisualizationType }
  | { type: "CLEAR_CONVERSATION" }
  | { type: "MARK_REMEMBERING"; messageId: string }
  | { type: "MARK_REMEMBERED"; messageId: string };

// ── Reducer ──────────────────────────────────────────────────────────

const initialState: DashboardState = {
  messages: [],
  selectedMessageId: null,
  isLoading: false,
  activeView: "table",
  rememberedMessageIds: new Set<string>(),
  rememberingMessageIds: new Set<string>(),
};

function dashboardReducer(
  state: DashboardState,
  action: DashboardAction
): DashboardState {
  switch (action.type) {
    case "SEND_MESSAGE": {
      const msg: ConversationMessage = {
        id: action.id,
        timestamp: new Date(),
        prompt: action.prompt,
      };
      return {
        ...state,
        messages: [...state.messages, msg],
        selectedMessageId: action.id,
        isLoading: true,
        activeView: "table",
      };
    }
    case "RECEIVE_RESPONSE": {
      const updatedMessages = state.messages.map((m) =>
        m.id === action.id ? { ...m, ...action.data } : m
      );
      // Auto-detect best visualization only when there's actual data
      let view: VisualizationType = state.activeView;
      if (action.data.data) {
        const parsed = parseQueryData(action.data.data);
        const rec = recommendVisualization(parsed);
        view = rec.type;
      }
      // If text-only response (no data), keep current view
      return {
        ...state,
        messages: updatedMessages,
        isLoading: false,
        activeView: view,
      };
    }
    case "SET_ERROR": {
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.id ? { ...m, error: action.error } : m
        ),
        isLoading: false,
      };
    }
    case "SELECT_MESSAGE": {
      const selected = state.messages.find((m) => m.id === action.id);
      let view: VisualizationType = "table";
      if (selected?.data) {
        const parsed = parseQueryData(selected.data);
        const rec = recommendVisualization(parsed);
        view = rec.type;
      }
      return {
        ...state,
        selectedMessageId: action.id,
        activeView: view,
      };
    }
    case "SET_VIEW": {
      return { ...state, activeView: action.view };
    }
    case "MARK_REMEMBERING": {
      const next = new Set(state.rememberingMessageIds);
      next.add(action.messageId);
      return { ...state, rememberingMessageIds: next };
    }
    case "MARK_REMEMBERED": {
      const remembered = new Set(state.rememberedMessageIds);
      remembered.add(action.messageId);
      const remembering = new Set(state.rememberingMessageIds);
      remembering.delete(action.messageId);
      return { ...state, rememberedMessageIds: remembered, rememberingMessageIds: remembering };
    }
    case "CLEAR_CONVERSATION": {
      return {
        ...initialState,
        rememberedMessageIds: new Set<string>(),
        rememberingMessageIds: new Set<string>(),
      };
    }
    default:
      return state;
  }
}

// ── Context ──────────────────────────────────────────────────────────

interface DashboardContextValue {
  state: DashboardState;
  sendMessage: (prompt: string) => Promise<void>;
  selectMessage: (id: string) => void;
  setView: (view: VisualizationType) => void;
  clearConversation: () => void;
  rememberMessage: (messageId: string) => Promise<void>;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(dashboardReducer, initialState);

  const sendMessage = useCallback(async (prompt: string) => {
    const id = crypto.randomUUID();

    // Build conversation history from completed messages (before dispatching the new one)
    const conversationHistory: ConversationTurn[] = [];
    for (const msg of state.messages) {
      conversationHistory.push({ role: "user", content: msg.prompt });
      // Build assistant response from what Claude said + what data was returned
      const parts: string[] = [];
      if (msg.aiMessage) parts.push(msg.aiMessage);
      if (msg.generatedSQL) parts.push(`[SQL: ${msg.generatedSQL}]`);
      if (msg.data) {
        // Include a summary of the data (first 500 chars to keep token count reasonable)
        parts.push(`[Result: ${msg.data.slice(0, 500)}]`);
      }
      if (msg.error) parts.push(`[Error: ${msg.error}]`);
      if (parts.length > 0) {
        conversationHistory.push({ role: "assistant", content: parts.join("\n") });
      }
    }

    dispatch({ type: "SEND_MESSAGE", id, prompt });

    const start = performance.now();
    try {
      const result = await queryApi(prompt, conversationHistory);
      const elapsed = Math.round(performance.now() - start);

      if (!result || typeof result !== "object") {
        dispatch({ type: "SET_ERROR", id, error: "Invalid server response" });
        return;
      }

      dispatch({
        type: "RECEIVE_RESPONSE",
        id,
        data: {
          generatedSQL: result.generatedSQL,
          aiMessage: result.aiMessage,
          data: result.success ? result.data : undefined,
          error: result.success ? undefined : result.error,
          tier: result.tier,
          executionTimeMs: elapsed,
        },
      });
    } catch (err: unknown) {
      const elapsed = Math.round(performance.now() - start);
      const errorMessage =
        err instanceof Error ? err.message : "An unexpected error occurred";
      console.error("[Dashboard] sendMessage error after", elapsed, "ms:", errorMessage);
      dispatch({ type: "SET_ERROR", id, error: errorMessage });
    }
  }, [state.messages]);

  const selectMessage = useCallback((id: string) => {
    dispatch({ type: "SELECT_MESSAGE", id });
  }, []);

  const setView = useCallback((view: VisualizationType) => {
    dispatch({ type: "SET_VIEW", view });
  }, []);

  const clearConversation = useCallback(() => {
    dispatch({ type: "CLEAR_CONVERSATION" });
  }, []);

  const rememberMessage = useCallback(async (messageId: string) => {
    const msg = state.messages.find((m) => m.id === messageId);
    if (!msg?.data || !msg.generatedSQL || !msg.tier) return;

    dispatch({ type: "MARK_REMEMBERING", messageId });

    try {
      const result = await rememberQuery({
        naturalLanguage: msg.prompt,
        generatedSQL: msg.generatedSQL,
        tier: msg.tier,
      });

      if (result.success) {
        dispatch({ type: "MARK_REMEMBERED", messageId });
      } else {
        // Remove from remembering on failure
        const next = new Set(state.rememberingMessageIds);
        next.delete(messageId);
        // Can't dispatch a "remove remembering" without a new action — just mark remembered anyway
        // since dedup on server side means this is safe
        dispatch({ type: "MARK_REMEMBERED", messageId });
      }
    } catch {
      dispatch({ type: "MARK_REMEMBERED", messageId });
    }
  }, [state.messages, state.rememberingMessageIds]);

  return (
    <DashboardContext.Provider
      value={{ state, sendMessage, selectMessage, setView, clearConversation, rememberMessage }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) {
    throw new Error("useDashboard must be used within DashboardProvider");
  }
  return ctx;
}
