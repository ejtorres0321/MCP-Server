"use server";

import { auth } from "@/lib/auth";
import { getMcpClient } from "@/lib/mcp-client";

interface McpResult {
  success: boolean;
  data?: string;
  error?: string;
}

interface McpContentItem {
  type: string;
  text?: string;
}

function extractText(content: unknown): string {
  if (!Array.isArray(content)) return String(content ?? "");
  return (content as McpContentItem[])
    .filter((c) => c.type === "text" && typeof c.text === "string")
    .map((c) => c.text!)
    .join("\n");
}

async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id || !session.user.mfaVerified || !session.user.isApproved) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function listMcpTables(): Promise<McpResult> {
  try {
    await requireAuth();
    const client = await getMcpClient();

    const result = await client.callTool({
      name: "list_tables",
      arguments: {},
    });

    return { success: true, data: extractText(result.content) };
  } catch (error) {
    console.error("[MCP] listTables error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to list tables",
    };
  }
}

export async function describeMcpTable(tableName: string): Promise<McpResult> {
  try {
    await requireAuth();
    const client = await getMcpClient();

    const result = await client.callTool({
      name: "describe_table",
      arguments: { table_name: tableName },
    });

    return { success: true, data: extractText(result.content) };
  } catch (error) {
    console.error("[MCP] describeTable error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to describe table",
    };
  }
}

export async function executeMcpQuery(sql: string): Promise<McpResult> {
  try {
    await requireAuth();
    const client = await getMcpClient();

    const result = await client.callTool({
      name: "query_database",
      arguments: { sql },
    });

    return { success: true, data: extractText(result.content) };
  } catch (error) {
    console.error("[MCP] executeQuery error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to execute query",
    };
  }
}
