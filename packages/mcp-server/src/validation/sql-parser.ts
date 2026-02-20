import NodeSqlParser from 'node-sql-parser';
import type { AST } from 'node-sql-parser';

const { Parser } = NodeSqlParser;
const parser = new Parser();
const MYSQL_OPTIONS = { database: 'MySQL' } as const;

export function parseSQL(sql: string): AST | AST[] {
  return parser.astify(sql, MYSQL_OPTIONS);
}

export function getStatementType(ast: AST): string {
  return ast.type?.toLowerCase() ?? 'unknown';
}

export function getReferencedTables(ast: AST): string[] {
  const tables: string[] = [];

  if (ast.type === 'select' && ast.from) {
    const fromClause = Array.isArray(ast.from) ? ast.from : [ast.from];
    for (const source of fromClause) {
      if (source && typeof source === 'object' && 'table' in source && typeof source.table === 'string') {
        tables.push(source.table);
      }
    }
  }

  return tables;
}

export function sqlContainsDangerousKeywords(sql: string): string | null {
  const patterns: [RegExp, string][] = [
    [/\b(INSERT)\b/i, 'INSERT'],
    [/\b(UPDATE)\b/i, 'UPDATE'],
    [/\b(DELETE)\b/i, 'DELETE'],
    [/\b(DROP)\b/i, 'DROP'],
    [/\b(ALTER)\b/i, 'ALTER'],
    [/\b(TRUNCATE)\b/i, 'TRUNCATE'],
    [/\b(CREATE)\b/i, 'CREATE'],
    [/\b(GRANT)\b/i, 'GRANT'],
    [/\b(REVOKE)\b/i, 'REVOKE'],
    [/\b(EXEC|EXECUTE)\b/i, 'EXEC/EXECUTE'],
    [/\b(CALL)\b/i, 'CALL'],
    [/\bINTO\s+(OUTFILE|DUMPFILE)\b/i, 'INTO OUTFILE/DUMPFILE'],
    [/\bLOAD_FILE\b/i, 'LOAD_FILE'],
    [/\bSLEEP\s*\(/i, 'SLEEP()'],
    [/\bBENCHMARK\s*\(/i, 'BENCHMARK()'],
  ];

  for (const [pattern, name] of patterns) {
    if (pattern.test(sql)) {
      return name;
    }
  }

  return null;
}
