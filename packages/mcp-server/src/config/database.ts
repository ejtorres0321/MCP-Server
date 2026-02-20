import type { PoolOptions } from 'mysql2/promise';
import type { Env } from './env.js';
import type { TunnelInfo } from '../db/ssh-tunnel.js';

export function createPoolConfig(config: Env, tunnelInfo?: TunnelInfo): PoolOptions {
  const host = tunnelInfo ? tunnelInfo.localHost : config.DB_HOST;
  const port = tunnelInfo ? tunnelInfo.localPort : config.DB_PORT;
  const useSsl = tunnelInfo ? false : config.DB_SSL;

  return {
    host,
    port,
    user: config.DB_USER,
    password: config.DB_PASSWORD,
    database: config.DB_NAME,
    waitForConnections: true,
    connectionLimit: config.DB_CONNECTION_LIMIT,
    queueLimit: 0,
    connectTimeout: 10000,
    timezone: '+00:00',
    charset: 'utf8mb4',
    ...(useSsl ? { ssl: { rejectUnauthorized: true } } : {}),
  };
}
