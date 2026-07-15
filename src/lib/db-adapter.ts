// Picks the Prisma driver adapter from the connection URL.
//
// WHY: PrismaNeon wraps @neondatabase/serverless, which reaches Neon over a
// WebSocket proxy derived from the hostname — it CANNOT talk to a plain local
// Postgres on :5432. Dev runs against a local Postgres 17 service, so a local
// URL needs node-postgres instead. Neon URLs (prod, and the vitest branch pool)
// keep the Neon adapter, unchanged.
//
// See docs/plans/2026-07-15-dev-off-prod-local-postgres.md.
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * True for a Postgres on this machine.
 *
 * Parses the URL and compares the hostname EXACTLY — substring matching would
 * pick the local-only driver for a host like `localhost.evil.example.com`.
 * An unparseable URL returns false: assume REMOTE, so a malformed URL fails at
 * connect rather than silently choosing a driver that cannot reach it.
 */
export function isLocalDbUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
  } catch {
    return false;
  }
}

export function makeAdapter(url: string) {
  return isLocalDbUrl(url)
    ? new PrismaPg({ connectionString: url })
    : new PrismaNeon({ connectionString: url });
}
