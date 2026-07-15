import { PrismaClient } from "@prisma/client";
import { makeAdapter } from "../../src/lib/db-adapter";

// Lazy read-only Prisma client for the MCP server. The adapter is picked by URL
// (node-postgres for a local dev Postgres, @neondatabase/serverless for a Neon
// host — the latter builds its Pool on first connect, tolerating Neon
// scale-to-zero). Mirrors src/lib/db.ts's adapter setup but is a SEPARATE client
// bound to the read-only role URL — this module deliberately does NOT import
// src/lib/db.ts. (db-adapter is safe to share: it builds no client and reads no
// env, so importing it cannot leak the read-write client in here.)
//
// `log: []` is CRITICAL: MCP speaks over stdout, so the client must NEVER emit
// query logs there (it would corrupt the protocol stream).
export function makeReadOnlyClient(url: string): PrismaClient {
  const adapter = makeAdapter(url);
  return new PrismaClient({ adapter, log: [] });
}
