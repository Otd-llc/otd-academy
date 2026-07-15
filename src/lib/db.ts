import { PrismaClient } from "@prisma/client";
import { makeAdapter } from "@/lib/db-adapter";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function makeClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  // The adapter is chosen by URL: node-postgres for a local dev Postgres, the
  // Neon serverless adapter for a Neon host (the Neon driver speaks WebSocket to
  // Neon's proxy and cannot reach a plain local Postgres). See @/lib/db-adapter.
  const adapter = makeAdapter(url);
  return new PrismaClient({
    adapter,
    log: ["query", "error", "warn"],
  });
}

export const db = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
