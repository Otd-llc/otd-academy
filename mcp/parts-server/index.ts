// Foundry parts MCP server — stdio entry point.
//
// IRON RULE: stdout is the MCP protocol channel. Nothing may write to stdout
// except the transport — dotenv is `quiet`, Prisma logging is `[]` (client.ts),
// and every diagnostic goes to stderr via console.error.
//
// Deliberately does NOT import src/lib/db.ts or src/env.ts — it owns its
// read-only client and asserts its own env (env.ts).
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { makeReadOnlyClient } from "./client";
import { resolvePartsDbUrl } from "./env";
import { buildServer } from "./server";

async function main(): Promise<void> {
  const url = resolvePartsDbUrl();
  const client = makeReadOnlyClient(url);
  const server = buildServer(client);
  await server.connect(new StdioServerTransport());
  console.error("[foundry-parts] MCP server ready (stdio).");
}

main().catch((err) => {
  console.error("[foundry-parts] fatal:", err);
  process.exit(1);
});
