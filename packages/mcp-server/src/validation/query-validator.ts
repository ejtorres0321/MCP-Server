import type { AST } from 'node-sql-parser';
import { parseSQL, getStatementType, sqlContainsDangerousKeywords } from './sql-parser.js';
import { env } from '../config/env.js';
import type { ValidationResult } from '../types/index.js';

const MAX_QUERY_LENGTH = 10000;

function stripComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--[^\n]*/g, '')
    .replace(/#[^\n]*/g, '');
}

function hasMultipleStatements(sql: string): boolean {
  const stripped = sql.replace(/'[^']*'/g, '').replace(/"[^"]*"/g, '');
  return stripped.includes(';');
}

function ensureLimit(sql: string, ast: AST): string {
  if (ast.type === 'select' && !ast.limit) {
    return `${sql.replace(/\s*$/, '')} LIMIT ${env.MAX_QUERY_ROWS}`;
  }
  return sql;
}

export function validateQuery(sql: string): ValidationResult {
  const trimmed = sql.trim();

  if (!trimmed) {
    return { valid: false, error: 'Query cannot be empty' };
  }

  if (trimmed.length > MAX_QUERY_LENGTH) {
    return { valid: false, error: `Query exceeds maximum length of ${MAX_QUERY_LENGTH} characters` };
  }

  if (hasMultipleStatements(trimmed)) {
    return { valid: false, error: 'Multiple statements are not allowed' };
  }

  const cleaned = stripComments(trimmed);

  const dangerousKeyword = sqlContainsDangerousKeywords(cleaned);
  if (dangerousKeyword) {
    return { valid: false, error: `Forbidden keyword detected: ${dangerousKeyword}` };
  }

  let ast: AST;
  try {
    const parsed = parseSQL(cleaned);
    ast = Array.isArray(parsed) ? parsed[0] : parsed;
  } catch {
    return { valid: false, error: 'Failed to parse SQL query. Please check the syntax.' };
  }

  const stmtType = getStatementType(ast);
  if (stmtType !== 'select') {
    return { valid: false, error: `Only SELECT queries are allowed. Got: ${stmtType.toUpperCase()}` };
  }

  const sanitizedSQL = ensureLimit(cleaned, ast);

  return { valid: true, sanitizedSQL };
}
