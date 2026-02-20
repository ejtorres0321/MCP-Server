import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

export async function auditLog(
  toolName: string,
  query: string,
  rowCount: number,
  executionTimeMs: number,
): Promise<void> {
  if (!env.AUDIT_LOG_ENABLED) return;

  const truncatedQuery = query.length > 500 ? `${query.slice(0, 500)}...` : query;

  logger.info('AUDIT', {
    toolName,
    query: truncatedQuery,
    rowCount,
    executionTimeMs,
    timestamp: new Date().toISOString(),
  });
}
