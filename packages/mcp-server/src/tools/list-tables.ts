import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { executeQuery } from '../db/query-executor.js';
import { env } from '../config/env.js';
import { handleToolError } from '../middleware/error-handler.js';
import { auditLog } from '../middleware/audit-logger.js';

export function registerListTablesTool(server: McpServer): void {
  server.tool(
    'list_tables',
    'List all tables in the database with their type, approximate row count, and description.',
    {},
    async () => {
      const sql = `
        SELECT TABLE_NAME, TABLE_TYPE, TABLE_ROWS, TABLE_COMMENT
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = ?
        ORDER BY TABLE_NAME
      `;

      try {
        const result = await executeQuery(sql, [env.DB_NAME]);
        await auditLog('list_tables', sql, result.rowCount, result.executionTimeMs);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              database: env.DB_NAME,
              tableCount: result.rowCount,
              tables: result.rows,
            }, null, 2),
          }],
        };
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
