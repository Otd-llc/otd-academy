// Setup for the "unit" project — test files that do NOT touch the real database
// (no `@/lib/db` import, or they vi.mock it). They need service env but NOT a
// branch lease, so they never consume a pool slot. See vitest.env.ts.
import { loadBaseEnv } from "./vitest.env";

loadBaseEnv();
