export type UserRole = "user" | "admin";

export interface IUser {
  _id: string;
  email: string;
  password: string;
  name: string;
  role: UserRole;
  isApproved: boolean;
  approvedAt?: Date;
  approvedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMfaCode {
  _id: string;
  userId: string;
  code: string; // bcrypt hash
  expiresAt: Date;
  usedAt?: Date;
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface McpToolResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

// ── Conversation Types ────────────────────────────────────────────────

export interface ConversationMessage {
  id: string;
  timestamp: Date;
  prompt: string;
  aiMessage?: string;
  generatedSQL?: string;
  data?: string;
  error?: string;
  tier?: 1 | 2;
  executionTimeMs?: number;
}

// ── Remembered Query Types ───────────────────────────────────────────

export type QueryCategory =
  | "funnel"
  | "billing"
  | "cases"
  | "leads"
  | "clients"
  | "staff"
  | "courts"
  | "general";

export interface IRememberedQuery {
  _id: string;
  naturalLanguage: string;
  generatedSQL: string;
  tables: string[];
  joins: string[];
  category: QueryCategory;
  rememberedBy: string;
  rememberedByName: string;
  tier: 1 | 2;
  createdAt: Date;
  updatedAt: Date;
}

// ── Parsed Result Types ───────────────────────────────────────────────

export interface ParsedQueryResult {
  headers: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

// ── Visualization Types ───────────────────────────────────────────────

export type VisualizationType = "table" | "bar" | "line" | "pie" | "big-number";

export interface VisualizationRecommendation {
  type: VisualizationType;
  xKey?: string;
  yKey?: string;
  reason: string;
}

// ── Dashboard State ───────────────────────────────────────────────────

export interface DashboardState {
  messages: ConversationMessage[];
  selectedMessageId: string | null;
  isLoading: boolean;
  activeView: VisualizationType;
  rememberedMessageIds: Set<string>;
  rememberingMessageIds: Set<string>;
}
