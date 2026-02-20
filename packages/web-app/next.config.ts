import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["mongoose", "bcryptjs"],
  devIndicators: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  // Keep connections alive for long-running server actions (MCP queries can take 30s+)
  httpAgentOptions: {
    keepAlive: true,
  },
};

export default nextConfig;
