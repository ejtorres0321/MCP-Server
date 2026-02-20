import type { FieldPacket } from 'mysql2/promise';

export interface QueryResult {
  rows: Record<string, unknown>[];
  fields: FieldPacket[];
  rowCount: number;
  executionTimeMs: number;
}

export interface ValidationResult {
  valid: boolean;
  sanitizedSQL?: string;
  error?: string;
}

export interface AuditLogEntry {
  timestamp: string;
  toolName: string;
  query: string;
  rowCount: number;
  executionTimeMs: number;
  sessionId?: string;
}

export interface TableInfo {
  TABLE_NAME: string;
  TABLE_TYPE: string;
  TABLE_ROWS: number | null;
  TABLE_COMMENT: string;
}

export interface ColumnInfo {
  COLUMN_NAME: string;
  DATA_TYPE: string;
  IS_NULLABLE: string;
  COLUMN_KEY: string;
  COLUMN_DEFAULT: string | null;
  EXTRA: string;
  COLUMN_COMMENT: string;
  ORDINAL_POSITION: number;
}

export interface IndexInfo {
  INDEX_NAME: string;
  COLUMN_NAME: string;
  NON_UNIQUE: number;
  INDEX_TYPE: string;
}
