import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { env } from './config/env.js';
import { registerAllTools } from './tools/index.js';
import { registerAllResources } from './resources/index.js';

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: env.MCP_SERVER_NAME,
    version: env.MCP_SERVER_VERSION,
  });

  registerAllTools(server);
  registerAllResources(server);

  return server;
}
