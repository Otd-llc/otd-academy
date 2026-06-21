// Vitest worker setup — loads .env.local for service creds and swaps in the
// isolated test database (TEST_DATABASE_URL) when configured, so DB-touching
// tests never mutate prod. See vitest.env.ts for precedence.
import { loadTestEnv } from "./vitest.env";

loadTestEnv();
