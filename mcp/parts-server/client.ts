import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

// Lazy read-only Prisma client for the MCP server. PrismaNeon builds the
// @neondatabase/serverless Pool internally on first connect, tolerating Neon
// scale-to-zero (the first query wakes the compute). Mirrors src/lib/db.ts's
// adapter setup but is a SEPARATE client bound to the read-only role URL — this
// module deliberately does NOT import src/lib/db.ts.
//
// `log: []` is CRITICAL: MCP speaks over stdout, so the client must NEVER emit
// query logs there (it would corrupt the protocol stream).
export function makeReadOnlyClient(url: string): PrismaClient {
  const adapter = new PrismaNeon({ connectionString: url });
  return new PrismaClient({ adapter, log: [] });
}
