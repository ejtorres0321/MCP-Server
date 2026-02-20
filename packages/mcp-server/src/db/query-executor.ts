import type { FieldPacket } from 'mysql2/promise';
import { getPool } from './connection.js';
import { env } from '../config/env.js';
import type { QueryResult } from '../types/index.js';

export async function executeQuery(
  sql: string,
  params?: unknown[],
): Promise<QueryResult> {
  const pool = getPool();
  const connection = await pool.getConnection();
  const start = Date.now();

  try {
    // Use query() instead of execute() because SET SESSION with a prepared
    // statement parameter causes "Incorrect argument type" on some MySQL versions.
    // The value is server-controlled (from env), not user input.
    await connection.query(
      `SET SESSION MAX_EXECUTION_TIME = ${Number(env.QUERY_TIMEOUT_MS)}`,
    );

    const [rows, fields] = await connection.execute(sql, params);

    return {
      rows: rows as Record<string, unknown>[],
      fields: fields as FieldPacket[],
      rowCount: (rows as unknown[]).length,
      executionTimeMs: Date.now() - start,
    };
  } finally {
    connection.release();
  }
}
