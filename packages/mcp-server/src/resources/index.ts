import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTableSchemaResource } from './table-schema.js';

export function registerAllResources(server: McpServer): void {
  registerTableSchemaResource(server);
}
