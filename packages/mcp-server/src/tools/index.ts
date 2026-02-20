import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerListTablesTool } from './list-tables.js';
import { registerDescribeTableTool } from './describe-table.js';
import { registerQueryDatabaseTool } from './query-database.js';

export function registerAllTools(server: McpServer): void {
  registerListTablesTool(server);
  registerDescribeTableTool(server);
  registerQueryDatabaseTool(server);
}
