// Vitest global setup — loads .env.local so DB-touching tests get real
// DATABASE_URL / DIRECT_URL. .env.local is the authoritative env file
// (no root .env), matching prisma.config.ts.
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
