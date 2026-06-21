// Shared test-env loader for vitest.config.ts (main thread) and vitest.setup.ts
// (workers). Loads .env.local for service creds, then — CRUCIALLY — if a
// dedicated test database is configured, points DATABASE_URL/DIRECT_URL at it so
// the suite runs against an ISOLATED Neon branch and NEVER mutates prod.
//
// Precedence: real process.env (e.g. CI-set TEST_DATABASE_URL) > .env.test.local
// > .env.local. dotenv never overrides already-set vars, so we apply the test-DB
// swap explicitly, last.
import { config as loadEnv } from "dotenv";

export function loadTestEnv(): void {
  loadEnv({ path: ".env.local" });
  loadEnv({ path: ".env.test.local" });

  const testUrl = process.env.TEST_DATABASE_URL;
  if (testUrl) {
    process.env.DATABASE_URL = testUrl;
    process.env.DIRECT_URL = process.env.TEST_DIRECT_URL ?? testUrl;
  }
}
