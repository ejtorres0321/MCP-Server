import { config } from 'dotenv';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { z } from 'zod';

// Look for .env in the monorepo root (two levels up from packages/mcp-server)
const rootEnvPath = resolve(process.cwd(), '../../.env');
const localEnvPath = resolve(process.cwd(), '.env');

if (existsSync(rootEnvPath)) {
  config({ path: rootEnvPath });
} else if (existsSync(localEnvPath)) {
  config({ path: localEnvPath });
} else {
  config();
}

const envSchema = z.object({
  DB_HOST: z.string().min(1, 'DB_HOST is required'),
  DB_PORT: z.coerce.number().default(3306),
  DB_USER: z.string().min(1, 'DB_USER is required'),
  DB_PASSWORD: z.string().min(1, 'DB_PASSWORD is required'),
  DB_NAME: z.string().min(1, 'DB_NAME is required'),
  DB_CONNECTION_LIMIT: z.coerce.number().default(10),
  DB_SSL: z.string().transform((v) => v === 'true').default('true'),

  SSH_ENABLED: z.string().transform((v) => v === 'true').default('false'),
  SSH_HOST: z.string().default(''),
  SSH_PORT: z.coerce.number().default(22),
  SSH_USER: z.string().default(''),
  SSH_KEY_PATH: z.string().default(''),
  SSH_KEY_PASSPHRASE: z.string().default(''),
  SSH_LOCAL_PORT: z.coerce.number().default(13306),

  MCP_SERVER_PORT: z.coerce.number().default(3100),
  MCP_SERVER_HOST: z.string().default('0.0.0.0'),
  MCP_SERVER_NAME: z.string().default('manuelsolis-db-server'),
  MCP_SERVER_VERSION: z.string().default('1.0.0'),

  MAX_QUERY_ROWS: z.coerce.number().default(1000),
  QUERY_TIMEOUT_MS: z.coerce.number().default(30000),

  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  AUDIT_LOG_ENABLED: z.string().transform((v) => v === 'true').default('true'),

  CORS_ORIGIN: z.string().default('http://localhost:3000'),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    const formatted = Object.entries(errors)
      .map(([key, msgs]) => `  ${key}: ${(msgs as string[]).join(', ')}`)
      .join('\n');
    throw new Error(`Environment validation failed:\n${formatted}`);
  }
  return result.data;
}

export const env = loadEnv();
