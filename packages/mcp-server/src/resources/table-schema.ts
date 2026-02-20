import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { executeQuery } from '../db/query-executor.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const VALID_TABLE_NAME = /^[a-zA-Z0-9_]+$/;

export function registerTableSchemaResource(server: McpServer): void {
  server.resource(
    'table-schema',
    new ResourceTemplate('schema://tables/{tableName}', {
      list: async () => {
        try {
          const result = await executeQuery(
            'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME',
            [env.DB_NAME],
          );

          return {
            resources: result.rows.map((row) => ({
              uri: `schema://tables/${row.TABLE_NAME as string}`,
              name: `${row.TABLE_NAME as string} schema`,
              mimeType: 'application/json' as const,
            })),
          };
        } catch (error) {
          logger.error('Failed to list table resources', { error });
          return { resources: [] };
        }
      },
    }),
    { mimeType: 'application/json', description: 'Database table schema information' },
    async (uri, { tableName }) => {
      const name = String(tableName);

      if (!VALID_TABLE_NAME.test(name)) {
        throw new Error('Invalid table name');
      }

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
        executeQuery(columnsSql, [env.DB_NAME, name]),
        executeQuery(indexesSql, [env.DB_NAME, name]),
      ]);

      return {
        contents: [{
          uri: uri.href,
          mimeType: 'application/json' as const,
          text: JSON.stringify({
            tableName: name,
            database: env.DB_NAME,
            columns: columns.rows,
            indexes: indexes.rows,
          }, null, 2),
        }],
      };
    },
  );
}
