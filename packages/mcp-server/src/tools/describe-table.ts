import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { executeQuery } from '../db/query-executor.js';
import { env } from '../config/env.js';
import { handleToolError } from '../middleware/error-handler.js';
import { auditLog } from '../middleware/audit-logger.js';

const VALID_TABLE_NAME = /^[a-zA-Z0-9_]+$/;

export function registerDescribeTableTool(server: McpServer): void {
  server.tool(
    'describe_table',
    'Describe the columns, data types, keys, and indexes of a specific database table.',
    {
      table_name: z.string().describe('The name of the table to describe'),
    },
    async ({ table_name }) => {
      if (!VALID_TABLE_NAME.test(table_name)) {
        return {
          isError: true,
          content: [{ type: 'text', text: 'Invalid table name. Only alphanumeric characters and underscores are allowed.' }],
        };
      }

      try {
        const columnsSql = `
          SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY,
                 COLUMN_DEFAULT, EXTRA, COLUMN_COMMENT, ORDINAL_POSITION
          FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
          ORDER BY ORDINAL_POSITION
        `;

        const indexesSql = `
          SELECT INDEX_NAME, COLUMN_NAME, NON_UNIQUE, INDEX_TYPE
          FROM information_schema.STATISTICS
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
          ORDER BY INDEX_NAME, SEQ_IN_INDEX
        `;

        const [columns, indexes] = await Promise.all([
          executeQuery(columnsSql, [env.DB_NAME, table_name]),
          executeQuery(indexesSql, [env.DB_NAME, table_name]),
        ]);

        if (columns.rowCount === 0) {
          return {
            isError: true,
            content: [{ type: 'text', text: `Table '${table_name}' not found in database '${env.DB_NAME}'.` }],
          };
        }

        await auditLog('describe_table', `DESCRIBE ${table_name}`, columns.rowCount, columns.executionTimeMs);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              table: table_name,
              database: env.DB_NAME,
              columnCount: columns.rowCount,
              columns: columns.rows,
              indexes: indexes.rows,
            }, null, 2),
          }],
        };
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
