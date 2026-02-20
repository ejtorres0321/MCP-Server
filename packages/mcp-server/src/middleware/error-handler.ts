import { logger } from '../utils/logger.js';

export function handleToolError(error: unknown): { isError: true; content: { type: 'text'; text: string }[] } {
  const err = error instanceof Error ? error : new Error(String(error));

  logger.error('Tool execution error', {
    message: err.message,
    stack: err.stack,
  });

  let userMessage = 'An unexpected error occurred. Please try again.';

  if (err.message.includes('ETIMEDOUT') || err.message.includes('ECONNREFUSED')) {
    userMessage = 'Database connection failed. Please try again later.';
  } else if (err.message.includes('MAX_EXECUTION_TIME')) {
    userMessage = 'Query timed out. Try a simpler or more specific query.';
  } else if (err.message.includes('ER_PARSE_ERROR')) {
    userMessage = 'SQL syntax error. Please check your query.';
  } else if (err.message.includes('ER_ACCESS_DENIED_ERROR')) {
    userMessage = 'Database access denied.';
  }

  return {
    isError: true,
    content: [{ type: 'text', text: userMessage }],
  };
}
