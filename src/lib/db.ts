import { PrismaClient } from "@prisma/client";
import { makeAdapter } from "@/lib/db-adapter";
import { deriveLessonMeta } from "@/lib/library/derived";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Inject MiniLesson's DERIVED columns into any write payload that carries
// contentBlocks. Returns `data` untouched when contentBlocks is absent, so a
// title-only edit never disturbs them (and never resets them to the defaults).
function withDerived<T>(data: T): T {
  if (!data || typeof data !== "object") return data;
  const d = data as Record<string, unknown>;
  if (!("contentBlocks" in d)) return data;
  return { ...d, ...deriveLessonMeta(d.contentBlocks) } as T;
}

function makeClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  // The adapter is chosen by URL: node-postgres for a local dev Postgres, the
  // Neon serverless adapter for a Neon host (the Neon driver speaks WebSocket to
  // Neon's proxy and cannot reach a plain local Postgres). See @/lib/db-adapter.
  const adapter = makeAdapter(url);
  const base = new PrismaClient({
    adapter,
    log: ["query", "error", "warn"],
  });

  // MiniLesson.readingMinutes/questionCount/diagramSrc are DERIVED from
  // contentBlocks. Recompute them HERE -- the one choke point every writer
  // already funnels through (the admin actions, prisma/seed.ts, and ~164
  // `await import("@/lib/db")` call sites across scripts/) -- so a seed script
  // that has not been written yet cannot forget to update them and let the
  // columns rot.
  //
  // Covers create/update/upsert only. `updateMany` and raw SQL bypass this;
  // there are none against MiniLesson today, and the drift guardrail
  // (src/lib/__tests__/library-derived-drift.test.ts) is what catches it if that
  // ever changes. See docs/plans/2026-07-15-library-derived-columns.md.
  //
  // The cast is safe: a QUERY extension does not alter model types, so every
  // call site keeps its existing types and the new columns come from the schema.
  return base.$extends({
    query: {
      miniLesson: {
        create({ args, query }) {
          args.data = withDerived(args.data);
          return query(args);
        },
        update({ args, query }) {
          args.data = withDerived(args.data);
          return query(args);
        },
        upsert({ args, query }) {
          args.create = withDerived(args.create);
          args.update = withDerived(args.update);
          return query(args);
        },
      },
    },
  }) as unknown as PrismaClient;
}

export const db = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
