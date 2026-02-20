# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Immigration law firm data intelligence system. A pnpm monorepo with two packages:

- **`packages/mcp-server`** — Express.js backend implementing the Model Context Protocol (MCP) over HTTP. Provides read-only SQL query tools against a MySQL database (AWS RDS via SSH tunnel).
- **`packages/web-app`** — Next.js 15 frontend with AI-powered natural language → SQL querying. Users ask questions in plain English; Claude Haiku generates SQL, executes it via MCP tools, and returns results.

## Commands

```bash
pnpm install          # Install all workspace dependencies
pnpm dev              # MCP server dev mode (tsx watch, port 3100)
pnpm dev:web          # Web app dev mode (Next.js, port 3000)
pnpm dev:all          # Both servers in parallel
pnpm build            # Compile mcp-server (tsc → dist/)
pnpm build:web        # Build web app (next build)
pnpm start            # Run compiled mcp-server
pnpm start:web        # Run web app production
pnpm test             # Run mcp-server tests (vitest)
pnpm seed             # Seed web-app MongoDB
```

## Architecture

### MCP Server (`packages/mcp-server`)

HTTP endpoint at `POST /mcp` using `StreamableHTTPServerTransport`. Exposes three MCP tools:

1. **list_tables** — Lists all database tables with row counts
2. **describe_table** — Returns columns, types, keys, indexes for a table
3. **query_database** — Executes parameterized SELECT queries (read-only)

Also exposes MCP resources at `schema://tables/{tableName}`.

**Query validation pipeline** (`src/validation/`): SQL is parsed via `node-sql-parser` AST, checked for dangerous keywords (INSERT/UPDATE/DELETE/DROP/ALTER/etc.), limited to single statements, stripped of comments, and auto-capped with `LIMIT 1000`. All queries use `?` parameter binding.

**Database connection** (`src/db/`): MySQL2 pool with optional SSH tunnel (`ssh2`) for AWS RDS access. Tunnel transparently replaces host:port in pool config. Graceful shutdown closes pool + tunnel on SIGINT/SIGTERM.

**Config** (`src/config/env.ts`): Zod-validated environment variables loaded from root `.env`.

### Web App (`packages/web-app`)

Next.js 15 App Router with React 19. Path alias: `@/*` → `src/*`.

**Auth flow** (NextAuth 5 + JWT, 8-hour sessions):
Register → Login → MFA (email OTP via Mailtrap) → Admin approval → Dashboard access.
Middleware at `src/middleware.ts` enforces auth/MFA/approval/role checks per route.

**User management**: Mongoose (MongoDB) stores users and MFA codes — separate from the firm's MySQL database.

**AI query system** (`src/actions/ai-query-action.ts`): 2-tier fallback architecture:
- **Tier 1**: Claude Haiku with core schema (27 most-used tables) for fast/cheap queries
- **Tier 2**: Falls back to full schema (30+ tables) if Tier 1 signals `NEED_FULL_SCHEMA` or produces a SQL error

The AI returns XML with `<message>` and `<sql>` tags. The action parses the XML, validates the SQL is SELECT-only, executes via MCP client, and returns results.

**Business rules** are embedded as constants in `ai-query-action.ts` — signed cases = cases with paid invoices (join chain: cases → services → invoices → receipts), INTAKE filtering (exclude `services.number LIKE '%INTAKE%'`), sales funnel metrics, BOS URL generation, polymorphic relationships (tasks/comments/documents use `parent_type` + `parent_id`).

**Database schema reference** at `src/data/db-schema.ts` — complete 30-table schema with columns, relationships, and business context used as AI prompt context.

**MCP client** (`src/lib/mcp-client.ts`): Cached globally with periodic ping for stale session detection and auto-reconnect. Connects to MCP server URL from env.

## Environment Setup

- Root `.env` — Database credentials, SSH tunnel config, MCP server settings (see `.env.example`)
- `packages/web-app/.env.local` — MCP_SERVER_URL, MONGODB_URI, NEXTAUTH_SECRET, ANTHROPIC_API_KEY, MAILTRAP_TOKEN (see `.env.local.example`)

## Key Conventions

- TypeScript strict mode everywhere, base config in `tsconfig.base.json`
- Zod for all validation (env vars, query params, form inputs)
- Winston for logging in mcp-server (`src/utils/logger.ts`)
- All MCP tool calls are audit-logged (`src/middleware/audit-logger.ts`)
- The MySQL database is strictly read-only from this application — never generate write queries
