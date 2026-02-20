import express from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { env } from './config/env.js';
import { createPoolConfig } from './config/database.js';
import { initializePool, closePool } from './db/connection.js';
import { createSshTunnel, closeSshTunnel, type TunnelInfo } from './db/ssh-tunnel.js';
import { createMcpServer } from './server.js';
import { logger } from './utils/logger.js';

const app = express();
app.use(express.json());
app.use(cors({ origin: env.CORS_ORIGIN }));

const transports: Record<string, StreamableHTTPServerTransport> = {};

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', server: env.MCP_SERVER_NAME, version: env.MCP_SERVER_VERSION });
});

app.post('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  let transport: StreamableHTTPServerTransport;

  if (sessionId && transports[sessionId]) {
    transport = transports[sessionId];
  } else if (!sessionId && isInitializeRequest(req.body)) {
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sid) => {
        transports[sid] = transport;
        logger.info(`MCP session initialized: ${sid}`);
      },
    });

    transport.onclose = () => {
      const sid = transport.sessionId;
      if (sid && transports[sid]) {
        delete transports[sid];
        logger.info(`MCP session closed: ${sid}`);
      }
    };

    const server = createMcpServer();
    await server.connect(transport);
  } else {
    res.status(400).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Bad Request: missing session ID or not an initialize request' },
      id: null,
    });
    return;
  }

  await transport.handleRequest(req, res, req.body);
});

app.get('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (!sessionId || !transports[sessionId]) {
    res.status(400).json({ error: 'Invalid or missing session ID' });
    return;
  }
  await transports[sessionId].handleRequest(req, res);
});

app.delete('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (!sessionId || !transports[sessionId]) {
    res.status(400).json({ error: 'Invalid or missing session ID' });
    return;
  }
  await transports[sessionId].handleRequest(req, res);
});

async function main() {
  try {
    let tunnelInfo: TunnelInfo | undefined;
    if (env.SSH_ENABLED) {
      logger.info('Establishing SSH tunnel...');
      tunnelInfo = await createSshTunnel(env);
      logger.info('SSH tunnel established successfully', {
        localPort: tunnelInfo.localPort,
        remoteHost: env.DB_HOST,
      });
    }

    const poolConfig = createPoolConfig(env, tunnelInfo);
    await initializePool(poolConfig);
    logger.info('Database pool initialized successfully');

    app.listen(env.MCP_SERVER_PORT, env.MCP_SERVER_HOST, () => {
      logger.info(`MCP server listening on http://${env.MCP_SERVER_HOST}:${env.MCP_SERVER_PORT}`);
      logger.info(`Health check: http://localhost:${env.MCP_SERVER_PORT}/health`);
      logger.info(`MCP endpoint: http://localhost:${env.MCP_SERVER_PORT}/mcp`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

const shutdown = async () => {
  logger.info('Shutting down...');
  for (const [sid, transport] of Object.entries(transports)) {
    try {
      await transport.close();
    } catch {
      logger.warn(`Failed to close transport for session ${sid}`);
    }
  }
  await closePool();
  if (env.SSH_ENABLED) {
    await closeSshTunnel();
    logger.info('SSH tunnel closed');
  }
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

main();
