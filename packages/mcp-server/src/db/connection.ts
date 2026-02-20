import mysql from 'mysql2/promise';
import type { Pool, PoolOptions } from 'mysql2/promise';
import { logger } from '../utils/logger.js';

let pool: Pool | null = null;

export async function initializePool(config: PoolOptions): Promise<void> {
  pool = mysql.createPool(config);

  const connection = await pool.getConnection();
  try {
    await connection.ping();
    logger.info('Database connection verified');
  } finally {
    connection.release();
  }
}

export function getPool(): Pool {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initializePool() first.');
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database pool closed');
  }
}
