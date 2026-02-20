import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const MCP_SERVER_URL = process.env.MCP_SERVER_URL || "http://localhost:3100/mcp";

interface McpClientCache {
  client: Client | null;
  transport: StreamableHTTPClientTransport | null;
}

declare global {
  // eslint-disable-next-line no-var
  var mcpClientCache: McpClientCache | undefined;
}

const cached: McpClientCache = global.mcpClientCache ?? { client: null, transport: null };

if (!global.mcpClientCache) {
  global.mcpClientCache = cached;
}

async function createClient(): Promise<Client> {
  const transport = new StreamableHTTPClientTransport(new URL(MCP_SERVER_URL));

  const client = new Client({
    name: "manuelsolis-web-client",
    version: "1.0.0",
  });

  await client.connect(transport);

  cached.client = client;
  cached.transport = transport;

  console.log("[MCP Client] Connected to MCP server at", MCP_SERVER_URL);

  return client;
}

export async function getMcpClient(): Promise<Client> {
  if (cached.client) {
    try {
      // Test the connection with a ping to detect stale sessions
      await cached.client.ping();
      return cached.client;
    } catch {
      // Stale session — close and reconnect
      console.log("[MCP Client] Stale session detected, reconnecting...");
      await closeMcpClient();
    }
  }

  return createClient();
}

export async function closeMcpClient(): Promise<void> {
  try {
    if (cached.transport) {
      await cached.transport.close();
    }
  } catch {
    // Ignore close errors on stale transport
  }
  cached.client = null;
  cached.transport = null;
}
