import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { executeQuery } from '../db/query-executor.js';
import { validateQuery } from '../validation/query-validator.js';
import { handleToolError } from '../middleware/error-handler.js';
import { auditLog } from '../middleware/audit-logger.js';

export function registerQueryDatabaseTool(server: McpServer): void {
  server.tool(
    'query_database',
    'Execute a read-only SQL SELECT query against the database. Only SELECT statements are allowed. Use ? placeholders for parameterized values.',
    {
      sql: z.string().describe('SQL SELECT query to execute'),
      params: z
        .array(z.union([z.string(), z.number(), z.boolean(), z.null()]))
        .optional()
        .describe('Parameter values for ? placeholders in the query'),
    },
    async ({ sql, params }) => {
      const validation = validateQuery(sql);
      if (!validation.valid) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Query rejected: ${validation.error}` }],
        };
      }

      try {
        const result = await executeQuery(validation.sanitizedSQL!, params);
        await auditLog('query_database', sql, result.rowCount, result.executionTimeMs);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              rowCount: result.rowCount,
              executionTimeMs: result.executionTimeMs,
              rows: result.rows,
            }, null, 2),
          }],
        };
      } catch (error) {
        return handleToolError(error);
      }
    },
  );
}
