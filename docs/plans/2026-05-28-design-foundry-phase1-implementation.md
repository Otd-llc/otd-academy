# Project Foundry — Phase 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Build the Phase 1 spine of Project Foundry — a 9-stage hardware-engineering project workflow with Builds, Boards, Checklists, Measurements, gate enforcement, R2-backed artifacts, and Google-allowlist auth — deployable to Vercel + Neon, ready for the two-user team to start managing real PCB projects.

**Architecture:** Next.js 15 App Router with TypeScript. Prisma over Neon Postgres (pooled `DATABASE_URL` + direct `DIRECT_URL`). Auth.js v5 + Google OIDC + JWT sessions + email allowlist. Server Actions for all mutations, Zod validation at every entry, `Serializable` transactions for stage transitions. Cloudflare R2 for file artifacts (presigned PUT/GET, no proxy). Tailwind + shadcn/ui on a dark, command-center theme. All state machine logic in TypeScript config (`lib/stages.ts`); five raw-migration CHECK constraints + four raw-migration unique indexes back the schema invariants Prisma can't express.

**Tech Stack:** Next.js 15, TypeScript, Prisma 5, Postgres (Neon), Auth.js v5 (`next-auth@5` + `@auth/prisma-adapter`), Tailwind CSS, shadcn/ui, `@t3-oss/env-nextjs` + Zod, `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`, Vitest, pnpm.

**Source of truth:** [docs/plans/2026-05-27-design-foundry-phase1-design.md](docs/plans/2026-05-27-design-foundry-phase1-design.md). When this plan says "copy from §X" or "per §X," go read §X. Don't redesign on the fly.

---

## Conventions

- **Package manager:** `pnpm` throughout.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`, `docs:`, `refactor:`). One commit per task unless the task explicitly bundles.
- **Tests:** Vitest for unit + integration; Playwright deferred to M10 polish. Database tests run against a Neon branch (`pnpm test:db`) or local Docker Postgres for fast iteration.
- **Imports:** Path alias `@/` → `src/`.
- **File naming:** kebab-case for files, PascalCase for React components, camelCase for functions/variables.
- **No emojis in code, comments, or output.** Doc files only if explicitly requested.
- **When stuck:** read the design doc section the task references. Don't guess at intent.

---

# Phase 0 — Repo Bootstrap (M1)

Goal: a deployed, empty-but-typed Next.js app talking to Neon, CI green, ready to receive schema in Phase 1.

### Task 0.1: Init Next.js project

**Files:**
- Create: working directory contents (Next.js generates `package.json`, `tsconfig.json`, `next.config.js`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, etc.)

**Step 1:** Run from `c:/zzz/design-foundry`:

```bash
pnpm create next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*" --no-eslint --use-pnpm
```

Answer "No" to Turbopack prompt (Phase 1 stability over speed).

**Step 2:** Verify dev server boots:

```bash
pnpm dev
```

Expected: `▲ Next.js 15.x.x - Local: http://localhost:3000` and the page renders.

**Step 3:** Stop the server (`Ctrl+C`). Commit:

```bash
git init
git add .
git commit -m "chore: initialize next.js 15 project with typescript, tailwind, app router"
```

### Task 0.2: Install runtime + dev dependencies

**Files:**
- Modify: `package.json`

**Step 1:** Install runtime deps:

```bash
pnpm add prisma @prisma/client zod @t3-oss/env-nextjs next-auth@beta @auth/prisma-adapter @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

(Auth.js v5 is published as `next-auth@beta` as of writing; pin to a specific 5.x once stable releases land.)

**Step 2:** Install dev deps:

```bash
pnpm add -D vitest @vitest/ui tsx
```

**Step 3:** Verify:

```bash
pnpm list --depth=0
```

Expected: all named packages present. Commit:

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add runtime and test dependencies"
```

### Task 0.3: Configure `next.config.js` for server actions

**Files:**
- Modify: `next.config.js`

**Step 1:** Replace contents with:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  serverActions: {
    allowedOrigins: process.env.VERCEL_URL
      ? [process.env.VERCEL_URL, "localhost:3000"]
      : ["localhost:3000"],
  },
};

module.exports = nextConfig;
```

**Step 2:** Verify dev server still boots: `pnpm dev`, hit `http://localhost:3000`, confirm 200. Stop. Commit:

```bash
git add next.config.js
git commit -m "chore: configure serverActions.allowedOrigins"
```

### Task 0.4: Create `env.ts` with Zod validation

**Files:**
- Create: `src/env.ts`
- Create: `.env.local` (gitignored)
- Modify: `.gitignore` (verify `.env.local` is listed)

**Step 1:** Write `src/env.ts`:

```ts
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    DIRECT_URL: z.string().url(),
    AUTH_SECRET: z.string().min(32),
    AUTH_GOOGLE_ID: z.string().min(1),
    AUTH_GOOGLE_SECRET: z.string().min(1),
    ALLOWED_EMAILS: z.string().min(1),
    R2_ENABLED: z.coerce.boolean().default(false),
    R2_ACCOUNT_ID: z.string().optional(),
    R2_BUCKET: z.string().optional(),
    R2_ACCESS_KEY_ID: z.string().optional(),
    R2_SECRET_ACCESS_KEY: z.string().optional(),
  },
  client: {},
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID,
    AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET,
    ALLOWED_EMAILS: process.env.ALLOWED_EMAILS,
    R2_ENABLED: process.env.R2_ENABLED,
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
    R2_BUCKET: process.env.R2_BUCKET,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
  },
});
```

**Step 2:** Create `.env.local` with placeholders (do not commit):

```
DATABASE_URL="postgresql://user:pass@host/db?pgbouncer=true"
DIRECT_URL="postgresql://user:pass@host/db"
AUTH_SECRET="generate-with-openssl-rand-base64-32"
AUTH_GOOGLE_ID="from-google-cloud-console"
AUTH_GOOGLE_SECRET="from-google-cloud-console"
ALLOWED_EMAILS="me@example.com,partner@example.com"
R2_ENABLED="false"
```

**Step 3:** Verify `.gitignore` includes `.env*.local`. Add if missing.

**Step 4:** Verify env.ts type-checks: `pnpm tsc --noEmit`. Expected: 0 errors. Commit:

```bash
git add src/env.ts .gitignore
git commit -m "feat: validate env vars at boot with @t3-oss/env-nextjs"
```

### Task 0.5: Provision Neon project

**Manual steps (no code):**

1. Create a Neon project at `https://console.neon.tech`. Region: closest to you.
2. Note the **pooled** connection string (with `?pgbouncer=true&connect_timeout=15`) — this is `DATABASE_URL`.
3. Note the **direct** connection string (without pooler) — this is `DIRECT_URL`.
4. Paste both into `.env.local`.
5. Enable Neon database branching (default on).

**Step 1 (verification):** Test connection:

```bash
pnpm dlx prisma db execute --url "$DATABASE_URL" --stdin <<< "SELECT 1;"
```

Expected: succeeds without error. No commit (no code changed).

### Task 0.6: Provision Google OAuth credentials

**Manual steps:**

1. Google Cloud Console → APIs & Services → Credentials → Create OAuth 2.0 Client ID.
2. Application type: Web application.
3. Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google` and your eventual Vercel prod URL `https://<project>.vercel.app/api/auth/callback/google`.
4. Copy Client ID → `AUTH_GOOGLE_ID`; Client Secret → `AUTH_GOOGLE_SECRET`.
5. Generate `AUTH_SECRET`: `openssl rand -base64 32` → paste into `.env.local`.

**Step 1 (verification):** `pnpm tsc --noEmit` and `pnpm dev` start cleanly (env.ts won't throw). No commit.

### Task 0.7: Set up CI (GitHub Actions)

**Files:**
- Create: `.github/workflows/ci.yml`

**Step 1:** Write:

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm tsc --noEmit
      - run: pnpm prisma validate
      - run: pnpm next build
        env:
          DATABASE_URL: postgresql://stub:stub@stub/stub
          DIRECT_URL: postgresql://stub:stub@stub/stub
          AUTH_SECRET: "stub-secret-32-chars-long-padding-x"
          AUTH_GOOGLE_ID: stub
          AUTH_GOOGLE_SECRET: stub
          ALLOWED_EMAILS: "stub@stub"
          R2_ENABLED: "false"
      - run: pnpm vitest run
        env:
          DATABASE_URL: ${{ secrets.NEON_TEST_DATABASE_URL }}
          DIRECT_URL: ${{ secrets.NEON_TEST_DIRECT_URL }}
```

**Step 2:** Add Vitest config: create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    testTimeout: 30_000,
  },
  resolve: { alias: { "@": "/src" } },
});
```

**Step 3:** Add a passing smoke test: `src/lib/__tests__/smoke.test.ts`:

```ts
import { expect, test } from "vitest";

test("vitest runs", () => {
  expect(1 + 1).toBe(2);
});
```

**Step 4:** Run: `pnpm vitest run`. Expected: 1 passed. Commit:

```bash
git add .github/workflows/ci.yml vitest.config.ts src/lib/__tests__/smoke.test.ts
git commit -m "ci: github actions runs tsc, prisma validate, next build, vitest"
```

### Task 0.8: Provision Vercel project + connect to Neon

**Manual steps:**

1. Push the repo to GitHub (create a private repo, `git push -u origin main`).
2. `vercel.com` → New Project → Import the GitHub repo.
3. Set env vars in Vercel project settings (paste from `.env.local`).
4. Deploy. Confirm the placeholder page loads at the assigned Vercel URL.

**Step 1 (verification):** Visit the Vercel URL; expect Next.js placeholder. No commit.

### Task 0.9: M1 checkpoint

**Verify all of:**
- `pnpm dev` boots; `http://localhost:3000` renders.
- `pnpm tsc --noEmit` returns 0 errors.
- `pnpm prisma validate` exits 0 (will error on missing schema; OK to skip until Task 1.1).
- `pnpm next build` succeeds locally.
- `pnpm vitest run` passes.
- GitHub Actions CI green on the initial push.
- Vercel deployment green.

Tag the milestone: `git tag M1 && git push --tags`.

---

# Phase 1 — Schema + CHECK Constraints + Indexes (M2a)

Goal: the Prisma schema from design §4.2 lives in `prisma/schema.prisma`; all five CHECK constraints + four raw-migration unique indexes are in versioned migration files; Vitest negative-insert tests prove each fires.

### Task 1.1: Prisma init + datasource

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/db.ts`

**Step 1:** Run `pnpm prisma init --datasource-provider postgresql`. Confirm `prisma/schema.prisma` is created.

**Step 2:** Replace `prisma/schema.prisma` contents with the **header** only:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

generator client { provider = "prisma-client-js" }
```

**Step 3:** Create the Prisma client singleton at `src/lib/db.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({ log: ["query", "error", "warn"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

**Step 4:** Verify: `pnpm prisma validate`. Expected: "Prisma schema loaded from prisma/schema.prisma". Commit:

```bash
git add prisma/schema.prisma src/lib/db.ts
git commit -m "feat(schema): prisma init with neon pooled+direct urls"
```

### Task 1.2: Add all Prisma models from design §4.2

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1:** Append the full schema body from design doc §4.2 (everything from the Auth.js adapter models through Erratum). Don't paraphrase; copy verbatim including the `// Raw migration:` comments.

**Step 2:** Run `pnpm prisma validate`. Fix any syntax issues until it passes.

**Step 3:** Run `pnpm prisma format`. Commit:

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add all models per design §4.2"
```

### Task 1.3: Generate initial migration

**Files:**
- Create: `prisma/migrations/<timestamp>_init/migration.sql`

**Step 1:** Run:

```bash
pnpm prisma migrate dev --name init --create-only
```

Expected: a new migration directory under `prisma/migrations/` with a `migration.sql` generated by Prisma.

**Step 2:** Inspect the SQL. It will NOT contain the raw-migration CHECKs or functional unique indexes yet (Prisma can't generate them). That's expected.

**Step 3:** Apply: `pnpm prisma migrate dev`. Expected: migration applied; "Already in sync."

**Step 4:** Commit:

```bash
git add prisma/migrations
git commit -m "feat(schema): initial migration"
```

### Task 1.4: Add raw-migration CHECK #1 — Artifact owner XOR

**Files:**
- Create: `prisma/migrations/<new-timestamp>_artifact_owner_xor/migration.sql`
- Create: `src/lib/__tests__/check-artifact-owner-xor.test.ts`

**Step 1: Write the failing test:**

```ts
import { expect, test } from "vitest";
import { db } from "@/lib/db";

test("CHECK artifact_owner_xor: both revisionId and buildId null is rejected", async () => {
  await expect(
    db.$executeRawUnsafe(`
      INSERT INTO "Artifact" (id, stage, kind, title, "createdBy", "createdAt")
      VALUES ('test1', 'REQUIREMENTS', 'NOTE', 'x', 'fake-user', NOW());
    `),
  ).rejects.toThrow(/artifact_owner_xor|check/i);
});

test("CHECK artifact_owner_xor: both revisionId and buildId set is rejected", async () => {
  // assumes seeded test user, revision, and build (set up in Task 2.x)
  // placeholder — will be wired after seed exists. For now, skip.
});
```

**Step 2:** Run `pnpm vitest run check-artifact-owner-xor`. Expected: FAIL ("relation/constraint does not exist" or similar — the CHECK isn't there yet).

**Step 3:** Create migration directory: `mkdir -p prisma/migrations/$(date -u +%Y%m%d%H%M%S)_artifact_owner_xor`. Write `migration.sql`:

```sql
ALTER TABLE "Artifact"
ADD CONSTRAINT artifact_owner_xor CHECK (
  ("revisionId" IS NOT NULL AND "buildId" IS NULL)
  OR ("revisionId" IS NULL AND "buildId" IS NOT NULL)
);
```

**Step 4:** Apply: `pnpm prisma migrate dev`. Expected: migration applied successfully.

**Step 5:** Re-run test: `pnpm vitest run check-artifact-owner-xor`. Expected: PASS.

**Step 6:** Commit:

```bash
git add prisma/migrations src/lib/__tests__/check-artifact-owner-xor.test.ts
git commit -m "feat(schema): CHECK artifact_owner_xor with negative-insert test"
```

### Task 1.5: Add raw-migration CHECK #2 — Artifact payload XOR

**Files:**
- Create: `prisma/migrations/<new-timestamp>_artifact_payload_xor/migration.sql`
- Create: `src/lib/__tests__/check-artifact-payload-xor.test.ts`

**Step 1:** Test (write first, expect FAIL):

```ts
import { expect, test } from "vitest";
import { db } from "@/lib/db";

test("CHECK artifact_kind_payload_xor: FILE with noteBody set is rejected", async () => {
  await expect(
    db.$executeRawUnsafe(`
      INSERT INTO "Artifact" (id, "revisionId", stage, kind, title, "fileKey", "noteBody", "createdBy", "createdAt")
      VALUES ('test2', 'fake-rev', 'REQUIREMENTS', 'FILE', 'x', 'k', 'body', 'fake-user', NOW());
    `),
  ).rejects.toThrow(/artifact_kind_payload_xor|check/i);
});
```

**Step 2:** Verify FAIL.

**Step 3:** Migration SQL:

```sql
ALTER TABLE "Artifact"
ADD CONSTRAINT artifact_kind_payload_xor CHECK (
  (kind = 'FILE' AND "fileKey" IS NOT NULL AND "noteBody" IS NULL AND "linkUrl" IS NULL)
  OR (kind = 'NOTE' AND "noteBody" IS NOT NULL AND "fileKey" IS NULL AND "linkUrl" IS NULL)
  OR (kind = 'LINK' AND "linkUrl" IS NOT NULL AND "fileKey" IS NULL AND "noteBody" IS NULL)
);
```

**Step 4:** Apply, verify test passes, commit:

```bash
git add prisma/migrations src/lib/__tests__/check-artifact-payload-xor.test.ts
git commit -m "feat(schema): CHECK artifact_kind_payload_xor with negative-insert test"
```

### Task 1.6: Add raw-migration CHECK #3 — Checklist owner XOR

**Files:**
- Create: `prisma/migrations/<new-timestamp>_checklist_owner_xor/migration.sql`
- Create: `src/lib/__tests__/check-checklist-owner-xor.test.ts`

Follow the pattern of Task 1.4 (test fails → write CHECK → test passes → commit).

**Migration SQL:**

```sql
ALTER TABLE "Checklist"
ADD CONSTRAINT checklist_owner_xor CHECK (
  ("buildId" IS NOT NULL AND "boardId" IS NULL)
  OR ("buildId" IS NULL AND "boardId" IS NOT NULL)
);
```

Commit: `feat(schema): CHECK checklist_owner_xor with negative-insert test`.

### Task 1.7: Add raw-migration CHECK #4 — BomLine refDes count

**Files:**
- Create: `prisma/migrations/<new-timestamp>_bomline_refdes_count/migration.sql`
- Create: `src/lib/__tests__/check-bomline-refdes-count.test.ts`

Follow the pattern. Test inserts a BomLine where `refDes = "C1,C2,C3"` and `quantity = 4` (deliberately wrong); expect rejection.

**Migration SQL:**

```sql
ALTER TABLE "BomLine"
ADD CONSTRAINT bomline_refdes_count CHECK (
  array_length(string_to_array("refDes", ','), 1) = "quantity"
);
```

Commit: `feat(schema): CHECK bomline_refdes_count with negative-insert test`.

### Task 1.8: Add raw-migration CHECK #5 — Board silkscreen format

**Files:**
- Create: `src/lib/constants.ts` (for the shared `SILKSCREEN_HASH_RE`)
- Create: `prisma/migrations/<new-timestamp>_board_silkscreen_format/migration.sql`
- Create: `src/lib/__tests__/check-board-silkscreen-format.test.ts`

**Step 1:** `src/lib/constants.ts`:

```ts
export const SILKSCREEN_HASH_RE = /^g?[0-9a-f]{7,40}$/i;
```

**Step 2:** Test:

```ts
test("CHECK board_silkscreen_format: 'NOT_A_HASH' rejected", async () => {
  await expect(
    db.$executeRawUnsafe(`
      INSERT INTO "Board" (id, "buildId", serial, "silkscreenHash", status, "createdAt", "updatedAt")
      VALUES ('test3', 'fake-build', 'b01', 'NOT_A_HASH', 'BARE', NOW(), NOW());
    `),
  ).rejects.toThrow(/board_silkscreen_format|check/i);
});
```

**Step 3:** Migration SQL:

```sql
ALTER TABLE "Board"
ADD CONSTRAINT board_silkscreen_format CHECK (
  "silkscreenHash" IS NULL OR "silkscreenHash" ~* '^g?[0-9a-f]{7,40}$'
);
```

**Step 4:** Apply, verify, commit: `feat(schema): CHECK board_silkscreen_format with shared SILKSCREEN_HASH_RE`.

### Task 1.9: Add functional unique index #1 — Revision label CI

**Files:**
- Create: `prisma/migrations/<new-timestamp>_revision_project_label_ci/migration.sql`
- Create: `src/lib/__tests__/index-revision-label-ci.test.ts`

**Step 1:** Test inserts a Revision with `label = "V1"`, then attempts a second with `label = "v1"` (same project); expects rejection.

**Step 2:** Migration SQL:

```sql
CREATE UNIQUE INDEX revision_project_label_ci
ON "Revision" ("projectId", lower("label"));
```

**Step 3:** Apply, verify, commit: `feat(schema): functional unique index revision_project_label_ci`.

### Task 1.10: Add functional unique indexes #2 + #3 — Build label CI + Board serial CI

**Files:**
- Create: `prisma/migrations/<new-timestamp>_build_revision_label_ci/migration.sql`
- Create: `prisma/migrations/<new-timestamp>_board_build_serial_ci/migration.sql`
- Create: tests

**Migration SQL #2:**

```sql
CREATE UNIQUE INDEX build_revision_label_ci
ON "Build" ("revisionId", lower("label"));
```

**Migration SQL #3:**

```sql
CREATE UNIQUE INDEX board_build_serial_ci
ON "Board" ("buildId", lower("serial"));
```

Commit: `feat(schema): functional unique indexes for build label and board serial`.

### Task 1.11: Add partial unique index #4 — `build_one_unfrozen_per_revision`

**Files:**
- Create: `prisma/migrations/<new-timestamp>_build_one_unfrozen_per_revision/migration.sql`
- Create: `src/lib/__tests__/index-build-one-unfrozen.test.ts`

**Step 1:** Test:

```ts
test("partial unique build_one_unfrozen_per_revision: 2nd unfrozen Build rejected", async () => {
  // create rev + 2 unfrozen builds; expect 2nd to fail
});
```

**Step 2:** Migration SQL:

```sql
CREATE UNIQUE INDEX build_one_unfrozen_per_revision
ON "Build" ("revisionId")
WHERE "frozenAt" IS NULL;
```

**Step 3:** Apply, verify, commit: `feat(schema): partial unique index enforces one unfrozen Build per Revision`.

### Task 1.12: Add concurrent-insert test for the partial unique index

**Files:**
- Create: `src/lib/__tests__/index-build-one-unfrozen-concurrent.test.ts`

**Step 1:** Test fires two `INSERT INTO Build` statements via separate `db.$transaction` calls in parallel; one must reject.

**Step 2:** Verify it passes, commit: `test(schema): concurrent insert test for partial unique index`.

### Task 1.13: M2a checkpoint

**Verify:**
- All five CHECK constraint tests pass.
- All four unique-index tests pass.
- `pnpm prisma migrate status` clean.
- `pnpm vitest run` green.
- `pnpm tsc --noEmit` clean.

Tag: `git tag M2a && git push --tags`.

---

# Phase 2 — Seed Fixture (M2b)

Goal: A `pnpm db:seed` command produces the demoable "ESP32 sensor breakout" v1 at BRINGUP with BUILD-001, 5 Boards, measurements on B01, a `BRINGUP_COMPLETE` artifact, and a consistent transition log — by writing rows directly, bypassing live gates.

### Task 2.1: Wire `prisma db seed`

**Files:**
- Modify: `package.json` (add `prisma.seed` script)
- Create: `prisma/seed.ts`

**Step 1:** `package.json` additions:

```json
{
  "prisma": { "seed": "tsx prisma/seed.ts" },
  "scripts": { "db:seed": "prisma db seed" }
}
```

**Step 2:** `prisma/seed.ts` stub:

```ts
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  console.log("seed: starting");
  // populated in subsequent tasks
  console.log("seed: complete");
}

main().finally(() => db.$disconnect());
```

**Step 3:** Run: `pnpm db:seed`. Expected: prints lines, exits 0. Commit:

```bash
git add prisma/seed.ts package.json
git commit -m "chore(seed): wire prisma db seed with tsx"
```

### Task 2.2: Seed test user + project + revision

**Files:**
- Modify: `prisma/seed.ts`

**Step 1:** Add to `main()`:

```ts
await db.$transaction(async (tx) => {
  const user = await tx.user.upsert({
    where: { email: "seed@example.com" },
    update: {},
    create: { email: "seed@example.com", name: "Seed User" },
  });

  const project = await tx.project.upsert({
    where: { slug: "esp32-sensor-breakout" },
    update: {},
    create: {
      slug: "esp32-sensor-breakout",
      name: "ESP32 sensor breakout",
      description: "Reference ESP32-S3 breakout with I2C sensor headers.",
      createdById: user.id,
    },
  });

  const revision = await tx.revision.upsert({
    where: { projectId_label: { projectId: project.id, label: "v1" } },
    update: {},
    create: {
      projectId: project.id,
      label: "v1",
      currentStage: "BRINGUP",
      schematicCommit: "g1ebc1cc",
      layoutCommit: "gb170ddb",
    },
  });
});
```

**Step 2:** Run `pnpm db:seed`. Verify with `pnpm prisma studio` → Project + Revision visible. Commit: `feat(seed): user, project, revision at BRINGUP`.

### Task 2.3: Seed BomLine + Parts

**Files:**
- Modify: `prisma/seed.ts`

**Step 1:** Add three sample parts (ESP32-S3, MCP73831, BME280) with `lifecycle: "ACTIVE"`, valid datasheet URLs. Add BomLines linking them to the revision with refDes matching quantity (e.g., `refDes: "U1"`, `quantity: 1`).

**Step 2:** Verify, commit: `feat(seed): parts library + revision BOM`.

### Task 2.4: Seed Build + Boards

**Files:**
- Modify: `prisma/seed.ts`

**Step 1:** Insert `BUILD-001` (`boardCount: 5`, `orderedAt: now - 10 days`, `receivedAt: now - 5 days`, `assemblyStartedAt: now - 4 days`, `pcbOrderRef: "OSH-1234"`, `partsOrderRef: "DK-5678"`).

**Step 2:** Insert 5 Boards (`B01`..`B05`), all `status: "ASSEMBLED"`, `silkscreenHash: "g1ebc1cc"`.

**Step 3:** Verify, commit: `feat(seed): BUILD-001 with 5 ASSEMBLED boards`.

### Task 2.5: Seed Build-scoped artifacts (PCB_ORDER, PARTS_ORDER, BRINGUP_LOG, BRINGUP_COMPLETE)

**Files:**
- Modify: `prisma/seed.ts`

**Step 1:** Insert four artifacts on the Build with the appropriate subkinds and NOTE bodies. `BRINGUP_COMPLETE` body: `"Bring-up complete: B01-B04 BROUGHT_UP, B05 QUARANTINED (failed power rail). Marked complete by seed."`

**Step 2:** Verify, commit: `feat(seed): build-scoped order, bringup log, and bringup-complete artifacts`.

### Task 2.6: Seed Measurements on B01

**Files:**
- Modify: `prisma/seed.ts`

**Step 1:** Insert ~6 sample Measurements on B01 (Step 0c TP1-TP6 = `OL`, Step 0d VBUS-GND = `1.8 MΩ`, Step 12 +5V-GND = `12.4 kΩ` with `result: "OBSERVED"`).

**Step 2:** Verify, commit: `feat(seed): sample measurements on B01`.

### Task 2.7: Seed StageTransitions (INIT + 7 ADVANCE) consistent with `currentStage = BRINGUP`

**Files:**
- Modify: `prisma/seed.ts`

**Step 1:** Insert 8 transitions: INIT → REQUIREMENTS, then ADVANCE rows REQUIREMENTS→SCHEMATIC, SCHEMATIC→BOM_SOURCING, ..., ASSEMBLY→BRINGUP. Each with `gateSnapshot: { v: 1, kind: "gate", result: { ok: true }, ts: <iso> }` for the ADVANCEs and `kind: "init"` for INIT.

**Step 2:** Verify the rev's transition log renders coherently (in `prisma studio`). Commit: `feat(seed): full transition log INIT + ADVANCE×7`.

### Task 2.8: M2b checkpoint

**Verify:**
- `pnpm db:seed` runs clean from a fresh `prisma migrate reset --force`.
- `prisma studio` shows the seeded data.
- All Vitest tests still green.

Tag: `git tag M2b && git push --tags`.

---

# Phase 3 — Auth (M3)

Goal: Google OAuth via Auth.js v5, JWT strategy, allowlist re-checked on every JWT refresh, route protection middleware, sign-in/reject pages.

### Task 3.1: Auth.js v5 setup

**Files:**
- Create: `src/auth.ts`

**Step 1:** Write:

```ts
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import { env } from "@/env";

const allowlist = new Set(
  env.ALLOWED_EMAILS.split(",").map((s) => s.trim().toLowerCase()),
);

export const { auth, handlers, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  providers: [Google({ clientId: env.AUTH_GOOGLE_ID, clientSecret: env.AUTH_GOOGLE_SECRET })],
  session: { strategy: "jwt", maxAge: 86_400 },
  jwt: { maxAge: 3_600 },
  callbacks: {
    async signIn({ profile, account }) {
      if (account?.provider !== "google") return false;
      if (!profile?.email || !profile.email_verified) return false;
      return allowlist.has(profile.email.toLowerCase());
    },
    async jwt({ token }) {
      if (!token.email || !allowlist.has(token.email.toLowerCase())) {
        throw new Error("Email no longer allowlisted");
      }
      return token;
    },
  },
  pages: { signIn: "/sign-in" },
});
```

**Step 2:** `pnpm tsc --noEmit`. Commit: `feat(auth): auth.js v5 with google oidc + jwt + allowlist`.

### Task 3.2: API route handler

**Files:**
- Create: `src/app/api/auth/[...nextauth]/route.ts`

**Step 1:**

```ts
export { GET, POST } from "@/auth";
```

Wait — `handlers` from `auth.ts` is the right export. Update:

```ts
import { handlers } from "@/auth";
export const { GET, POST } = handlers;
```

**Step 2:** Verify `pnpm dev` boots without error. Commit: `feat(auth): /api/auth/[...nextauth] route handler`.

### Task 3.3: Middleware for route protection

**Files:**
- Create: `src/middleware.ts`

**Step 1:**

```ts
export { auth as middleware } from "@/auth";

export const config = {
  matcher: ["/((?!api/auth|sign-in|_next/static|_next/image|favicon.ico).*)"],
};
```

**Step 2:** Test: visit `http://localhost:3000/` while signed out → expect redirect to `/sign-in`. Commit: `feat(auth): middleware redirects unauthenticated to /sign-in`.

### Task 3.4: Sign-in page

**Files:**
- Create: `src/app/sign-in/page.tsx`

**Step 1:** Server component that renders a button; clicking submits a form that calls `signIn("google")` via a server action.

```tsx
import { signIn } from "@/auth";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-deep-space">
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/" });
        }}
      >
        <button type="submit" className="rounded border border-panel-border bg-navy-dark px-6 py-3 font-mono text-command-gold">
          SIGN IN WITH GOOGLE
        </button>
      </form>
    </main>
  );
}
```

**Step 2:** Test live: visit `/sign-in`, click button, Google flow, redirect. Commit: `feat(auth): sign-in page`.

### Task 3.5: Reject screen for non-allowlisted users

**Files:**
- Modify: `src/app/sign-in/page.tsx` (handle `?error=AccessDenied`)

**Step 1:** Auth.js redirects rejected signIn to `/sign-in?error=AccessDenied`. Render an `alert-red` Space Mono banner:

```tsx
import { signIn } from "@/auth";

export default function SignInPage({ searchParams }: { searchParams: { error?: string } }) {
  const denied = searchParams.error === "AccessDenied";
  return (
    <main className="flex min-h-screen items-center justify-center bg-deep-space">
      <div className="max-w-md text-center">
        {denied && (
          <p className="mb-4 border-l-4 border-alert-red bg-navy-dark px-4 py-3 font-mono text-sm font-bold text-alert-red">
            ACCESS DENIED — this email is not on the allowlist.
          </p>
        )}
        {/* sign-in form as before */}
      </div>
    </main>
  );
}
```

**Step 2:** Test with a non-allowlisted Google account → expect the banner. Commit: `feat(auth): reject screen for non-allowlisted emails`.

### Task 3.6: Tailwind theme tokens (so the sign-in page colors resolve)

**Files:**
- Modify: `tailwind.config.ts` (or `.js`)
- Modify: `src/app/globals.css` (add Google Font @imports for Bebas Neue, Space Mono, Lora)

**Step 1:** Extend Tailwind theme with the design §8.1 colors:

```ts
theme: {
  extend: {
    colors: {
      "deep-space": "#08090D",
      "navy-dark": "#1F2438",
      "panel-border": "#3A3F50",
      "command-gold": "#C8963E",
      "signal-blue": "#4A8FFF",
      "link-muted": "#C8C8C8",
      "muted": "#AAAAAA",
      "alert-red": "#EF5350",
      "status-green": "#66BB6A",
    },
    fontFamily: {
      display: ["'Bebas Neue'", "sans-serif"],
      mono: ["'Space Mono'", "monospace"],
      serif: ["'Lora'", "serif"],
    },
  },
}
```

**Step 2:** `globals.css` adds:

```css
@import url("https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&family=Lora:wght@400;500&display=swap");

body {
  background-color: theme("colors.deep-space");
  color: theme("colors.muted");
}
```

**Step 3:** Verify the sign-in page renders in the right colors. Commit: `feat(theme): apply design system color tokens and google fonts`.

### Task 3.7: M3 checkpoint

**Verify:** sign in with an allowlisted Google email succeeds → lands at `/`. Sign in with a non-allowlisted email rejects with the banner. Remove the email from `ALLOWED_EMAILS` and wait 1h+ → user's next request fails the `jwt` callback. Tag: `git tag M3 && git push --tags`.

---

# Phase 4 — Project CRUD (M4)

Goal: Create, list, view, edit, archive projects via server actions. Audit fields written. Zod validates input.

### Task 4.1: Project schemas + helpers

**Files:**
- Create: `src/lib/schemas/project.ts`
- Create: `src/lib/auth-helpers.ts`

**Step 1:** `project.ts`:

```ts
import { z } from "zod";

export const createProjectSchema = z.object({
  slug: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  repoUrl: z.string().url().optional().nullable(),
  targetCost: z.coerce.number().nonnegative().optional().nullable(),
});

export const editProjectSchema = createProjectSchema.partial().extend({ id: z.string().cuid() });
```

**Step 2:** `auth-helpers.ts`:

```ts
import { auth } from "@/auth";

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");
  // session.user has email; resolve to User row
  const { db } = await import("@/lib/db");
  const user = await db.user.findUniqueOrThrow({ where: { email: session.user.email } });
  return user;
}
```

**Step 3:** Commit: `feat(projects): zod schemas + requireUser helper`.

### Task 4.2: Project CRUD server actions

**Files:**
- Create: `src/lib/actions/projects.ts`

**Step 1:**

```ts
"use server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { createProjectSchema, editProjectSchema } from "@/lib/schemas/project";
import { revalidatePath } from "next/cache";

export async function createProject(input: unknown) {
  const data = createProjectSchema.parse(input);
  const user = await requireUser();
  const project = await db.project.create({ data: { ...data, createdById: user.id } });
  revalidatePath("/");
  return project;
}

export async function editProject(input: unknown) {
  const { id, ...data } = editProjectSchema.parse(input);
  await requireUser();
  await db.project.update({ where: { id }, data });
  revalidatePath("/");
  revalidatePath(`/projects/${data.slug ?? ""}`);
}

export async function archiveProject(id: string) {
  await requireUser();
  await db.project.update({ where: { id }, data: { archivedAt: new Date() } });
  revalidatePath("/");
}

export async function unarchiveProject(id: string) {
  await requireUser();
  await db.project.update({ where: { id }, data: { archivedAt: null } });
  revalidatePath("/");
}
```

**Step 2:** Test (Vitest, with a seeded user):

```ts
test("createProject: rejects malformed slug", async () => {
  await expect(createProject({ slug: "Has Spaces", name: "x" })).rejects.toThrow(/regex/);
});

test("createProject: writes createdBy", async () => {
  // mock requireUser; assert project.createdById matches
});
```

**Step 3:** Verify tests pass, commit: `feat(projects): server actions with zod validation + audit`.

### Task 4.3: Project list page (`/`)

**Files:**
- Create: `src/app/page.tsx`

**Step 1:** Server component fetches projects (optionally including archived via `?archived=1`); renders a manifest-style table.

```tsx
import { db } from "@/lib/db";
import Link from "next/link";

export default async function HomePage({ searchParams }: { searchParams: { archived?: string } }) {
  const showArchived = searchParams.archived === "1";
  const projects = await db.project.findMany({
    where: showArchived ? {} : { archivedAt: null },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="font-display text-4xl tracking-wider text-white">PROJECT FOUNDRY</h1>
      <table className="mt-8 w-full border-collapse font-mono text-sm">
        <thead>
          <tr className="border-b border-panel-border text-muted">
            <th className="py-2 text-left">NAME</th>
            <th className="py-2 text-left">SLUG</th>
            <th className="py-2 text-left">UPDATED</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr key={p.id} className="border-b border-panel-border">
              <td className="py-2"><Link href={`/projects/${p.slug}`} className="text-command-gold">{p.name}</Link></td>
              <td className="py-2 text-muted">{p.slug}</td>
              <td className="py-2 text-muted">{p.updatedAt.toISOString().slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
```

**Step 2:** Visit `/` while signed in; expect the seeded project rendered. Commit: `feat(projects): list page at /`.

### Task 4.4: Project create form (`/projects/new`)

**Files:**
- Create: `src/app/projects/new/page.tsx`

**Step 1:** Form submits to the `createProject` server action with `useFormState` to surface validation errors.

**Step 2:** Test the flow live. Commit: `feat(projects): create form`.

### Task 4.5: Project detail (`/projects/[slug]`) with edit + archive

**Files:**
- Create: `src/app/projects/[slug]/page.tsx`

**Step 1:** Detail page shows project metadata, repoUrl (clickable), and a placeholder Revisions list. Edit-in-place for `name`/`description`/`targetCost`/`repoUrl`. Archive button.

**Step 2:** Commit: `feat(projects): detail page with inline edit and archive`.

### Task 4.6: M4 checkpoint

**Verify:** end-to-end project lifecycle works in a live session. Vitest green. Tag `M4`.

---

# Phase 5 — Revision CRUD (M5a)

Goal: Create revisions with copy-forward; view rev page with header strip + empty Builds/Artifacts panes; inline Part create modal from BomLine editor.

### Task 5.1: `createRevision` server action

**Files:**
- Create: `src/lib/actions/revisions.ts`
- Create: `src/lib/schemas/revision.ts`

**Step 1:** Schema: `{ projectId, label, copyForwardFromRevisionId? }`. Action runs inside `db.$transaction`:

1. `requireUser`, `assertNotFrozen(parent project)` — projects don't freeze, so skip.
2. Insert Revision row.
3. Insert INIT `StageTransition` for the new rev.
4. If `copyForwardFromRevisionId`: copy `BomLine` rows + revision-scoped `Artifact` rows (new ids; same `fileKey` for FILE artifacts).
5. **Do not** copy Builds or build-scoped artifacts.

**Step 2:** Test: copy-forward preserves BOM lines and revision artifacts, no builds. Commit: `feat(revisions): create + copy-forward server action`.

### Task 5.2: Revision detail page (`/projects/[slug]/[revLabel]`)

**Files:**
- Create: `src/app/projects/[slug]/[revLabel]/page.tsx`

**Step 1:** Server component fetches revision + transitions + errata + builds. Renders the **header strip + tracker placeholder + two-column grid** per design §9.1 — Builds pane (empty for now), Artifacts pane (empty), Transitions log (renders from seed), Errata list (empty).

**Step 2:** Stage tracker remains a stub (replaced in Phase 7). Commit: `feat(revisions): detail page scaffold per §9.1`.

### Task 5.3: Revision header strip — commit pinning

**Files:**
- Modify: `src/app/projects/[slug]/[revLabel]/page.tsx`
- Create: `src/lib/actions/revisions.ts` (extend with `setSchematicCommit`, `setLayoutCommit`)

**Step 1:** Add inline-save inputs for `schematicCommit` and `layoutCommit`. Server actions assert not frozen. Use the `SILKSCREEN_HASH_RE` constant for client-side Zod (commits are git SHAs — same shape).

**Step 2:** Commit: `feat(revisions): inline commit-SHA edit on header strip`.

### Task 5.4: BomLine CRUD (in-page editor on revision detail)

**Files:**
- Create: `src/lib/actions/bom-lines.ts`
- Create: `src/lib/schemas/bom-line.ts`
- Modify: revision detail to render the editor when `currentStage === "BOM_SOURCING"`

**Step 1:** Schema enforces `refDes.split(",").length === quantity` at the Zod layer too (matches the CHECK).

**Step 2:** Action wraps `assertNotFrozen + assertBomNotFrozen`.

**Step 3:** Commit: `feat(bom): create/edit/delete BomLines with refdes-count validation`.

### Task 5.5: Inline "Create new Part" modal from BomLine editor

**Files:**
- Create: `src/lib/actions/parts.ts`
- Create: `src/lib/schemas/part.ts`
- Create: `src/app/parts/new/page.tsx` (full-page version)
- Modify: revision detail to launch a `<dialog>` or modal component that calls the same action.

**Step 1:** Action enforces `@@unique([manufacturer, mpn])` via Zod refinement on top of DB constraint (so duplicate inserts return a clean error message).

**Step 2:** Commit: `feat(parts): inline create-part modal reachable from bom editor`.

### Task 5.6: M5a checkpoint

**Verify:** create a new rev via copy-forward from the seed; commits editable; BomLine CRUD works; inline Part create works. Tag `M5a`.

---

# Phase 6 — Build CRUD (M5b)

Goal: Create Build under a Revision (with the partial-unique-index safety net); creating past ORDERING regresses with one transition row; Build detail page renders header + empty panes.

### Task 6.1: `createBuild` server action

**Files:**
- Create: `src/lib/actions/builds.ts`
- Create: `src/lib/schemas/build.ts`

**Step 1:** Action per design §5.3 `createBuild`:

```ts
"use server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { createBuildSchema } from "@/lib/schemas/build";
import { Stage } from "@prisma/client";

const stageOrder = [
  "REQUIREMENTS","SCHEMATIC","BOM_SOURCING","LAYOUT","DRC_GERBER",
  "ORDERING","ASSEMBLY","BRINGUP","REVISION",
] as const satisfies readonly Stage[];

export async function createBuild(input: unknown) {
  const data = createBuildSchema.parse(input);
  const user = await requireUser();

  return db.$transaction(async (tx) => {
    const rev = await tx.revision.findUniqueOrThrow({ where: { id: data.revisionId } });
    if (rev.frozenAt) throw new Error("Revision is frozen.");

    const stageIdx = stageOrder.indexOf(rev.currentStage);
    const orderingIdx = stageOrder.indexOf("ORDERING");
    if (stageIdx < orderingIdx - 1) throw new Error("Cannot create Build before DRC_GERBER.");
    if (rev.currentStage === "REVISION") throw new Error("Revision is at terminal stage.");

    const existingUnfrozen = await tx.build.findFirst({
      where: { revisionId: rev.id, frozenAt: null },
    });
    if (existingUnfrozen) throw new Error("An unfrozen Build already exists; freeze or finish it first.");

    if (stageIdx > orderingIdx) {
      await tx.revision.update({
        where: { id: rev.id },
        data: { currentStage: "ORDERING", currentStageEnteredAt: new Date() },
      });
      await tx.stageTransition.create({
        data: {
          revisionId: rev.id,
          fromStage: rev.currentStage,
          toStage: "ORDERING",
          direction: "REGRESS",
          notes: `New Build ${data.label} created`,
          gateSnapshot: { v: 1, kind: "regress", reason: `New Build ${data.label} created`, ts: new Date().toISOString() },
          transitionedBy: user.id,
        },
      });
    }

    return tx.build.create({
      data: {
        revisionId: rev.id,
        label: data.label,
        boardCount: data.boardCount,
        createdById: user.id,
      },
    });
  }, { isolationLevel: "Serializable" });
}
```

**Step 2:** Tests: create succeeds in DRC_GERBER (no regress); create past ORDERING writes single regress row; second unfrozen Build rejected (both by action and by DB index).

**Step 3:** Commit: `feat(builds): createBuild action with serializable tx and one-row regress`.

### Task 6.2: Build detail page (`/.../builds/[buildLabel]`)

**Files:**
- Create: `src/app/projects/[slug]/[revLabel]/builds/[buildLabel]/page.tsx`

**Step 1:** Header strip per design §9.2 (label, boardCount, parent link, editable order refs + dates, read-only `frozenAt`). Mark-bring-up-complete button rendered as a stub (`disabled`) for now — wired in M8a. Two-column grid: Boards table (empty), Build artifacts pane (empty), Build checklists pane (empty).

**Step 2:** Commit: `feat(builds): detail page scaffold per §9.2`.

### Task 6.3: Build header edit actions (`editBuild`)

**Files:**
- Modify: `src/lib/actions/builds.ts`

**Step 1:** Inline-save server action for `pcbOrderRef`, `partsOrderRef`, `orderedAt`, `receivedAt`, `assemblyStartedAt`. Guarded by `assertNotFrozen(rev)` + `assertBuildNotFrozen(build)`.

**Step 2:** Implement the freeze-assert helpers in `src/lib/assertions.ts`:

```ts
import type { PrismaTx } from "./db-types";

export async function assertNotFrozen(tx: PrismaTx, revisionId: string) {
  const rev = await tx.revision.findUniqueOrThrow({ where: { id: revisionId } });
  if (rev.frozenAt) throw new Error("Revision is frozen.");
}

export async function assertBomNotFrozen(tx: PrismaTx, revisionId: string) {
  const rev = await tx.revision.findUniqueOrThrow({ where: { id: revisionId } });
  if (rev.bomFrozenAt) throw new Error("BOM is frozen.");
}

export async function assertBuildNotFrozen(tx: PrismaTx, buildOrId: string | { buildId: string }) {
  const id = typeof buildOrId === "string" ? buildOrId : buildOrId.buildId;
  const build = await tx.build.findUniqueOrThrow({ where: { id } });
  if (build.frozenAt) throw new Error("Build is frozen.");
}
```

`PrismaTx` is a typedef for the inner tx parameter — define in `src/lib/db-types.ts`:

```ts
import type { Prisma } from "@prisma/client";
export type PrismaTx = Omit<Prisma.TransactionClient, "$connect" | "$disconnect">;
```

**Step 3:** Tests + commit: `feat(builds): edit actions with assertNotFrozen and assertBuildNotFrozen helpers`.

### Task 6.4: M5b checkpoint

**Verify:** create BUILD-001 on a fresh revision works; cannot create BUILD-002 while BUILD-001 is unfrozen; creating from BRINGUP regresses with one transition row. Tag `M5b`.

---

# Phase 7 — Stage Tracker (Read-Only, M6)

Goal: The 9-stage tracker renders the seeded rev's state with all four treatments (active / completed / blocked / future). Overflow rule works at three viewport widths.

### Task 7.1: `lib/stages.ts` — STAGES config

**Files:**
- Create: `src/lib/stages.ts`

**Step 1:** Implement the full `STAGES` record per design §5.2. Include the `FAILED_BOARD_MSG` helper, the `STAGE_ORDER` array, all nine StageDef entries with `revisionAllowedArtifactSubkinds`, `buildAllowedArtifactSubkinds`, `entryHints`, and `exitGate` (for stages that have one).

**Step 2:** Test (Vitest) each stage's gate against canned `GateContext` inputs:

```ts
test("ASSEMBLY gate: blocked when no boards", () => {
  const result = STAGES.ASSEMBLY.exitGate!({
    revision: { id: "x", currentStage: "ASSEMBLY", schematicCommit: null, layoutCommit: null },
    bomLines: [],
    artifacts: [],
    activeBuild: { id: "b", revisionId: "x", label: "BUILD-001", /* ... */ boards: [], artifacts: [], checklists: [] } as any,
  });
  expect(result).toMatchObject({ ok: false, reasons: expect.arrayContaining([expect.stringMatching(/no Board rows/)]) });
});

test("ASSEMBLY gate: FAILED message matches canonical wording", () => {
  // ...
});
```

**Step 3:** Commit: `feat(stages): full STAGES config + gate function tests`.

### Task 7.2: Stage tracker component

**Files:**
- Create: `src/components/StageTracker.tsx`

**Step 1:** Server component fetches the active Build with its boards/artifacts/checklists when needed (only for stages 6-8). Renders the 9-slot bar with:
- Active: filled `command-gold`.
- Completed (`order < active`): outlined `command-gold`.
- Blocked: outlined `alert-red` + first reason inline (Space Mono).
- Future: outlined `muted`.

Apply the overflow rule via Tailwind responsive classes:
- `min-w-[100px]` per slot at full size
- Hide full label below `lg:`, show stage number only with `title=` for hover tooltip
- Below `sm:`, set `overflow-x-auto` on the band; `whitespace-nowrap` on the row; never `flex-wrap`

**Step 2:** Mount in revision detail page above the two-column grid.

**Step 3:** Test the three viewport widths visually (≥1100px, 700-1099px, <700px). Commit: `feat(tracker): 9-slot horizontal tracker with overflow rules`.

### Task 7.3: Build-aware gate context loader

**Files:**
- Create: `src/lib/load-gate-context.ts`

**Step 1:**

```ts
export async function loadGateContext(tx: PrismaTx, revisionId: string): Promise<GateContext> {
  const revision = await tx.revision.findUniqueOrThrow({
    where: { id: revisionId },
    select: { id: true, currentStage: true, schematicCommit: true, layoutCommit: true },
  });
  const bomLines = await tx.bomLine.findMany({
    where: { revisionId },
    include: { part: true },
  });
  const artifacts = await tx.artifact.findMany({
    where: { revisionId, stage: revision.currentStage },
  });
  const activeBuild = await tx.build.findFirst({
    where: { revisionId, frozenAt: null },
    orderBy: { createdAt: "desc" },
    include: { boards: true, artifacts: true, checklists: { include: { items: true } } },
  });
  return { revision, bomLines, artifacts, activeBuild };
}
```

**Step 2:** Use it from the tracker to populate gate state. Commit: `feat(gates): loadGateContext for read-side gate eval`.

### Task 7.4: M6 checkpoint

**Verify:** tracker on the seeded rev displays BRINGUP as active with all gate reasons (one BRINGUP_LOG present, BRINGUP_COMPLETE missing if seed hasn't included it, boards' statuses, etc.). Tag `M6`.

---

# Phase 8 — Advance / Regress (M7)

Goal: `advanceStage` + `regressStage` server actions with Serializable + conditional UPDATE + INIT/REGRESS transition writes; all assertion helpers wired at the call sites listed in design §5.3.

### Task 8.1: `advanceStage`

**Files:**
- Create: `src/lib/actions/stages.ts`

**Step 1:** Implement per design §5.3 with the conditional UPDATE pattern. Use `tx.$executeRawUnsafe` with `WHERE ... AND "currentStage" = $expected` and check the row count.

**Step 2:** Test:
- Successful advance writes a transition row, updates `currentStage`, sets `bomFrozenAt` on entry to LAYOUT, sets `frozenAt` + `frozenById` + cascades to Build on entry to REVISION.
- Concurrent submit (simulated via two parallel calls): one succeeds, one is rejected with "stale state".
- Gate failure rejects with `reasons` returned to the client.

**Step 3:** Commit: `feat(stages): advanceStage server action with serializable tx`.

### Task 8.2: `regressStage`

**Files:**
- Modify: `src/lib/actions/stages.ts`

**Step 1:** Per design §5.3 — `reason` required; clears `bomFrozenAt` when `fromStage === LAYOUT` and `toStage === BOM_SOURCING`; preserves it on other regress paths.

**Step 2:** Tests for both clear and preserve cases. Commit: `feat(stages): regressStage with bomFrozenAt clear-on-out-of-LAYOUT rule`.

### Task 8.3: Wire tracker buttons

**Files:**
- Modify: `src/components/StageTracker.tsx`
- Modify: `src/app/projects/[slug]/[revLabel]/page.tsx`

**Step 1:** "Advance" and "Regress" buttons in the header strip submit to the server actions. Regress button opens a modal collecting the required `reason`.

**Step 2:** End-to-end test: advance BOM_SOURCING → LAYOUT in a fresh rev, observe `bomFrozenAt` set; attempt BomLine edit (rejected); regress → BomLine edit succeeds.

**Step 3:** Commit: `feat(tracker): advance/regress buttons wired with reason modal`.

### Task 8.4: Build freeze cascade on REVISION entry

**Files:**
- Modify: `src/lib/actions/stages.ts`

**Step 1:** In `advanceStage` when `toStage === "REVISION"`, the same tx also `UPDATE Build SET frozenAt = NOW() WHERE id = $activeBuildId`.

**Step 2:** Test: seeded BUILD-001 with all boards BROUGHT_UP + BRINGUP_COMPLETE → advance to REVISION → both Revision.frozenAt and Build.frozenAt set in the same tx.

**Step 3:** Commit: `feat(freeze): cascade revision freeze to active build`.

### Task 8.5: Transitions-log rendering with from→to spread

**Files:**
- Create: `src/components/TransitionsLog.tsx`
- Modify: revision detail page to mount it

**Step 1:** Render each row per design §9.1: INIT = "Revision created"; ADVANCE = "Advanced: FROM → TO"; REGRESS = "FROM → TO: reason". Multi-stage skip regress (createBuild) renders naturally.

**Step 2:** Commit: `feat(transitions): log component renders init/advance/regress with from-to spread`.

### Task 8.6: M7 checkpoint

**Verify:** End-to-end demo on the seeded rev: walk BRINGUP → REVISION; both freezes fire; transition log renders correctly; concurrent-advance test passes. Tag `M7`.

---

# Phase 9 — Artifacts: Note + Link + Subkind Picker + Mark Bring-Up Complete (M8a)

Goal: Per-stage list of revision-scoped artifacts; note/link create with sanitized markdown; subkind picker scoped per stage; revision-header commit pinning already done in Phase 5; "Mark bring-up complete" button on Build page with disabled-when-pending behavior and tooltip truncation.

### Task 9.1: `ARTIFACT_SUBKIND_OWNER` map

**Files:**
- Create: `src/lib/artifacts.ts`

**Step 1:**

```ts
import type { ArtifactSubkind } from "@prisma/client";

export type ArtifactOwnerKind = "revision" | "build" | "either";

export const ARTIFACT_SUBKIND_OWNER: Readonly<Record<ArtifactSubkind, ArtifactOwnerKind>> = {
  GENERIC: "either",
  REQUIREMENTS_DOC: "revision",
  SCHEMATIC_FILE: "revision",
  BOM_EXPORT: "revision",
  LAYOUT_FILE: "revision",
  DRC_REPORT: "revision",
  GERBER_ZIP: "revision",
  ASSEMBLY_PROCEDURE: "revision",
  BENCH_PROCEDURE: "revision",
  PCB_ORDER: "build",
  PARTS_ORDER: "build",
  BRINGUP_LOG: "build",
  BRINGUP_COMPLETE: "build",
};

export function ownerMatches(subkind: ArtifactSubkind, ownerKind: "revision" | "build"): boolean {
  const expected = ARTIFACT_SUBKIND_OWNER[subkind];
  return expected === "either" || expected === ownerKind;
}
```

**Step 2:** Tests for `ownerMatches` exhaustively cover all subkinds. Commit: `feat(artifacts): typed subkind→owner mapping and validator`.

### Task 9.2: Artifact create/edit/delete server actions (NOTE + LINK only — FILE comes in Phase 10)

**Files:**
- Create: `src/lib/actions/artifacts.ts`
- Create: `src/lib/schemas/artifact.ts`

**Step 1:** `createArtifact` accepts `owner: { kind: "revision" | "build", id }` + `stage` + `subkind` + `kind` + payload. Cross-checks `ownerMatches`. Asserts freeze. Inserts.

**Step 2:** Sanitize note markdown with `rehype-sanitize` (or DOMPurify on render). Commit: `feat(artifacts): server actions for note + link with owner cross-check`.

### Task 9.3: Artifact picker component

**Files:**
- Create: `src/components/ArtifactPicker.tsx`

**Step 1:** Form with subkind dropdown scoped to `STAGES[stage].revisionAllowedArtifactSubkinds` or `buildAllowedArtifactSubkinds` depending on owner context. Kind radio (NOTE / LINK). Title input. Conditional payload field (markdown textarea for NOTE, URL input for LINK).

**Step 2:** Mount on revision detail (Artifacts pane) and Build detail (Build artifacts pane). Commit: `feat(artifacts): per-stage picker mounted on rev and build pages`.

### Task 9.4: "Mark bring-up complete" button + server action

**Files:**
- Create: `src/lib/actions/bringup.ts`

**Step 1:**

```ts
"use server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";

export async function markBringupComplete(buildId: string) {
  const user = await requireUser();
  return db.$transaction(async (tx) => {
    const build = await tx.build.findUniqueOrThrow({ where: { id: buildId }, include: { boards: true, revision: true } });
    if (build.frozenAt) throw new Error("Build is frozen.");
    if (build.revision.frozenAt) throw new Error("Revision is frozen.");
    const blocking = build.boards.filter((b) => !["BROUGHT_UP", "QUARANTINED"].includes(b.status));
    if (blocking.length > 0) {
      const sample = blocking.slice(0, 5).map((b) => b.serial).join(", ");
      const more = blocking.length > 5 ? ` …and ${blocking.length - 5} more` : "";
      throw new Error(`Blocked by boards not BROUGHT_UP or QUARANTINED: ${sample}${more}`);
    }
    const existing = await tx.artifact.findFirst({
      where: { buildId, subkind: "BRINGUP_COMPLETE" },
    });
    if (existing) throw new Error("Already marked complete.");
    return tx.artifact.create({
      data: {
        buildId,
        stage: "BRINGUP",
        kind: "NOTE",
        subkind: "BRINGUP_COMPLETE",
        title: "Bring-up complete",
        noteBody: "User-confirmed bring-up complete. Advancing to REVISION will freeze the rev.",
        createdBy: user.id,
      },
    });
  }, { isolationLevel: "Serializable" });
}
```

**Step 2:** Mount the button on the Build detail header strip with disabled-state + tooltip listing up to 5 blocking boards (`title=` attr).

**Step 3:** Test: clicking with pending boards → server rejects with truncated message; clicking with all BROUGHT_UP → inserts the artifact. Commit: `feat(bringup): mark-complete button with tooltip truncation`.

### Task 9.5: M8a checkpoint

**Verify:** end-to-end on a fresh rev: walk ASSEMBLY → BRINGUP → mark complete → advance to REVISION. Tag `M8a`.

---

# Phase 10 — Artifact Files via R2 (M8b)

Goal: R2 bucket + IAM provisioned; presigned PUT + GET work; server HEAD-checks size; cross-check on `subkind` ↔ `owner.kind` runs at upload AND record-row.

### Task 10.1: Provision R2 bucket + token

**Manual:**
1. Cloudflare dashboard → R2 → Create bucket (e.g., `foundry-prod`).
2. R2 API tokens → Create token with `Object Read & Write` on this bucket.
3. Set Vercel env: `R2_ENABLED=true`, `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`.

### Task 10.2: R2 client + key helpers

**Files:**
- Create: `src/lib/r2.ts`

**Step 1:**

```ts
import { S3Client } from "@aws-sdk/client-s3";
import { env } from "@/env";

export const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID!,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
  },
});

export function slug(filename: string): string {
  return filename.toLowerCase().replace(/[^a-z0-9.-]+/g, "-").replace(/^-|-$/g, "") || "file";
}

export function artifactKey(owner: { kind: "revision" | "build"; id: string }, stage: string, cuid: string, filename: string): string {
  const folder = owner.kind === "revision" ? "revisions" : "builds";
  return `${folder}/${owner.id}/${stage}/${cuid}-${slug(filename)}`;
}
```

**Step 2:** Commit: `feat(r2): client + key path helpers`.

### Task 10.3: `createUploadUrl` server action

**Files:**
- Create: `src/lib/actions/uploads.ts`

**Step 1:** Per design §7 upload flow. Zod-validates input. Calls `ownerMatches(subkind, owner.kind)`. Generates presigned PUT URL via `@aws-sdk/s3-request-presigner` with `expiresIn: 900` and `ChecksumAlgorithm: "SHA256"` (the Content-Length condition lives in the signing input). Returns `{ uploadUrl, key, uploadToken }` where `uploadToken` is a short-lived signed value carrying the metadata so `recordArtifact` can verify intent.

**Step 2:** Commit: `feat(uploads): createUploadUrl with subkind cross-check and 15-min TTL`.

### Task 10.4: Client upload + `recordArtifact`

**Files:**
- Modify: `src/components/ArtifactPicker.tsx` (add FILE branch)
- Modify: `src/lib/actions/artifacts.ts` (add `recordArtifact`)

**Step 1:** When kind = FILE: client requests `createUploadUrl`, PUTs bytes to the returned URL, then calls `recordArtifact(uploadToken, ...)`.

**Step 2:** `recordArtifact`:
1. Decode + verify `uploadToken`.
2. Re-run `ownerMatches` (defense-in-depth).
3. `HeadObject` the R2 key; reject + `DeleteObject` if `ContentLength > sizeBytes`.
4. Insert `Artifact` row with the verified `fileKey`, `fileMime`, `fileBytes`.

**Step 3:** Commit: `feat(uploads): record-artifact with HEAD verify and oversize rejection`.

### Task 10.5: `getDownloadUrl` server action + client download

**Files:**
- Modify: `src/lib/actions/artifacts.ts`

**Step 1:** Returns presigned GET URL with `expiresIn: 300`. Mount as the click target for FILE artifacts in the picker list.

**Step 2:** Commit: `feat(uploads): getDownloadUrl with 5-min TTL`.

### Task 10.6: M8b checkpoint

**Verify:** Upload a 5 MB PDF as a SCHEMATIC_FILE on the seeded rev. Download via the presigned URL. Attempt to upload a SCHEMATIC_FILE with `owner.kind = "build"` — rejected. Tag `M8b`.

---

# Phase 11 — Errata Pane (M8c)

Goal: Errata CRUD on the revision page (allowed post-freeze); same-project constraint on `addressedByRevisionId`.

### Task 11.1: Erratum schemas + actions

**Files:**
- Create: `src/lib/actions/errata.ts`
- Create: `src/lib/schemas/erratum.ts`

**Step 1:** Schemas: `createErratumSchema`, `editErratumSchema`. Actions skip `assertNotFrozen` (errata are the post-freeze write path). On `linkErratumToRevision`, validate target rev's `projectId` matches the source rev's `projectId`.

**Step 2:** Tests for cross-project rejection. Commit: `feat(errata): server actions with same-project constraint`.

### Task 11.2: Errata pane component

**Files:**
- Create: `src/components/ErrataPane.tsx`
- Modify: revision detail page to mount it bottom-right

**Step 1:** List view with severity pills (`alert-red` BLOCKER, `command-gold` MAJOR, `muted` MINOR). Create/edit/delete inline. Address-link picker.

**Step 2:** Commit: `feat(errata): pane mounted on revision detail per §9.1`.

### Task 11.3: Errata create page (`/.../errata/new`)

**Files:**
- Create: `src/app/projects/[slug]/[revLabel]/errata/new/page.tsx`

**Step 1:** Full-page form for cases where inline create is awkward.

**Step 2:** Commit: `feat(errata): full-page create form`.

### Task 11.4: M8c checkpoint

**Verify:** Create errata on the seeded (frozen-via-M7) revision. Confirm linking to a same-project rev works, cross-project link rejected. Tag `M8c`.

---

# Phase 12 — Boards CRUD + Status + Silkscreen (M9a)

Goal: Register boards; status dropdown with `assertBuildNotFrozen`; per-build boards table with pills per design §8.3.

### Task 12.1: `createBoard` + `editBoard` actions

**Files:**
- Create: `src/lib/actions/boards.ts`
- Create: `src/lib/schemas/board.ts`

**Step 1:** Schema validates `silkscreenHash` via `SILKSCREEN_HASH_RE`. Actions wrap `assertNotFrozen(rev)` + `assertBuildNotFrozen(build)`.

**Step 2:** Tests. Commit: `feat(boards): create/edit actions with shared silkscreen regex`.

### Task 12.2: Register-board page (`/.../boards/new`)

**Files:**
- Create: `src/app/projects/[slug]/[revLabel]/builds/[buildLabel]/boards/new/page.tsx`

**Step 1:** Form: serial, optional silkscreenHash. On submit → redirect to Build detail.

**Step 2:** Commit: `feat(boards): register-board page`.

### Task 12.3: Boards table on Build detail

**Files:**
- Create: `src/components/BoardsTable.tsx`
- Modify: Build detail page to mount it (left column, 2/3 width)

**Step 1:** Rows: serial, silkscreenHash (Space Mono), status pill (per §8.3 — `navy-dark` chip, status-colored text, `alert-red` border for QUARANTINED), last-touched. Click row → board detail.

**Step 2:** Commit: `feat(boards): table with status pills per §8.3`.

### Task 12.4: Board detail page (`/.../boards/[serial]`) — header strip

**Files:**
- Create: `src/app/projects/[slug]/[revLabel]/builds/[buildLabel]/boards/[serial]/page.tsx`

**Step 1:** Header per design §9.3: Build label + serial; editable silkscreenHash + status dropdown + notes textarea; subject to `assertBuildNotFrozen`. Right column placeholder for board checklists (filled in M9b). Left column placeholder for measurements log (filled in M9c).

**Step 2:** Commit: `feat(boards): detail page header strip`.

### Task 12.5: M9a checkpoint

**Verify:** Register a board, change its status through the full BoardStatus enum, watch pill colors match §8.3. Tag `M9a`.

---

# Phase 13 — Checklists (M9b)

Goal: Build- and Board-scoped Checklists with typed subkind; items add/edit/reorder/tick; ASSEMBLY gate reads POST_ASSEMBLY_CONTINUITY.

### Task 13.1: Checklist + ChecklistItem actions

**Files:**
- Create: `src/lib/actions/checklists.ts`
- Create: `src/lib/schemas/checklist.ts`

**Step 1:** `createChecklist` accepts owner XOR (build OR board) + subkind + stage + title. `editChecklist`. `addChecklistItem` / `editChecklistItem` (toggle `checked` + write `completedAt`/`completedById`) / `reorderChecklistItems` (atomic ordinal swap inside a tx). All guarded by `assertNotFrozen` + `assertBuildNotFrozen` (resolve board.buildId for board-scoped).

**Step 2:** Tests including the gate-relevant case: ASSEMBLY's `POST_ASSEMBLY_CONTINUITY` check finds the Checklist by subkind, not title.

**Step 3:** Commit: `feat(checklists): full CRUD with typed subkind and gate-relevant matching`.

### Task 13.2: Checklists pane on Build detail (bottom-right column)

**Files:**
- Create: `src/components/BuildChecklistsPane.tsx`

**Step 1:** Lists Build-scoped Checklists with subkind tags; "New checklist" launches modal with subkind selector restricted to Build-scope subkinds (EQUIPMENT_PREFLIGHT, POST_ASSEMBLY_CONTINUITY, POLARITY_VERIFICATION, GENERIC).

**Step 2:** Commit: `feat(checklists): build-scoped pane with subkind selector`.

### Task 13.3: Checklists pane on Board detail (right column)

**Files:**
- Create: `src/components/BoardChecklistsPane.tsx`

**Step 1:** Lists Board-scoped Checklists; "New checklist" subkind options: SCREENING_STEP_0, ASSEMBLY_STEPS, GENERIC.

**Step 2:** Commit: `feat(checklists): board-scoped pane`.

### Task 13.4: Checklist detail page or inline editor

**Files:**
- Create: `src/components/ChecklistEditor.tsx`

**Step 1:** Renders the item list with: ordinal, label, expected, actual, checkbox. Tick action writes `completedAt` + `completedById`. Drag-to-reorder updates `ordinal` via the reorder action.

**Step 2:** Commit: `feat(checklists): item editor with reorder and completion stamping`.

### Task 13.5: ASSEMBLY gate end-to-end test

**Files:**
- Create: `src/lib/__tests__/gate-assembly-e2e.test.ts`

**Step 1:** Seed a rev at ASSEMBLY with a BUILD and 1 ASSEMBLED Board. Without a `POST_ASSEMBLY_CONTINUITY` Checklist → gate blocked with "No POST_ASSEMBLY_CONTINUITY Checklist". Create one with unchecked items → "has unchecked items". Tick all items → gate passes; `advanceStage` succeeds.

**Step 2:** Commit: `test(gates): assembly-gate end-to-end exercise`.

### Task 13.6: M9b checkpoint

**Verify:** Create an EQUIPMENT_PREFLIGHT Checklist on BUILD-001 (exercises Build XOR). Create a SCREENING_STEP_0 Checklist on B01 (exercises Board XOR). Tag `M9b`.

---

# Phase 14 — Measurements (M9c)

Goal: Per-board Measurements with bulk paste-tabbed entry; board detail renders grouped by (stage, step).

### Task 14.1: Measurement actions

**Files:**
- Create: `src/lib/actions/measurements.ts`
- Create: `src/lib/schemas/measurement.ts`

**Step 1:** Schema: `boardId`, `stage`, `step`, `expectedValue?`, `actualValue`, `unit?`, `result` (enum, default `PEND`), `notes?`. Actions wrap `assertNotFrozen` + `assertBuildNotFrozen` (resolved from `board.buildId`).

**Step 2:** Bulk add: `addMeasurementsBulk({ boardId, rows: [{ stage, step, expectedValue, actualValue, unit, result }] })` runs as a single tx.

**Step 3:** Commit: `feat(measurements): single + bulk CRUD per-board`.

### Task 14.2: Measurements log on Board detail (left column, 2/3 width)

**Files:**
- Create: `src/components/MeasurementsLog.tsx`

**Step 1:** Groups rows by stage then step; renders result pill (`PASS` green, `FAIL` red, `OBSERVED` muted, `PEND` muted). Bulk-add form: textarea where each tab-separated line becomes a row (preview before submit).

**Step 2:** Commit: `feat(measurements): grouped log + bulk paste-tabbed entry`.

### Task 14.3: M9c checkpoint

**Verify:** Add 5 measurements to B01 via single-add; add 10 more via bulk paste; observe grouping in the log. Tag `M9c`.

---

# Phase 15 — Polish (M10)

Goal: empty/loading/error states per design §9.4; sign-out menu; basic responsive styling; dashboard refinements; visual verification against the TB-1-POWER bench console.

### Task 15.1: Empty states across all list views

**Files:**
- Modify: project list, parts list, artifacts pane, errata pane, transitions log, builds pane, boards table, measurements log, checklists list

**Step 1:** Replace empty-array renders with a one-line Space-Mono placeholder (`NO PROJECTS — CREATE ONE TO BEGIN.`, `NO ARTIFACTS AT THIS STAGE.`, etc.).

**Step 2:** Commit: `feat(polish): empty-state placeholders across list views`.

### Task 15.2: Loading + error patterns

**Files:**
- Create: `src/components/InlineBanner.tsx`
- Modify: every form that calls a server action to disable the submit + render "WORKING…" inline; wrap with `InlineBanner` for `alert-red` errors.

**Step 1:** `InlineBanner` enforces the §9.4 spec: Space Mono ≥14px bold, `alert-red` text on `navy-dark` chip.

**Step 2:** Commit: `feat(polish): inline working/error banners`.

### Task 15.3: Sign-out menu

**Files:**
- Create: `src/components/UserMenu.tsx`
- Modify: root layout to render it in the top-right

**Step 1:** Dropdown shows email; "Sign out" submits to `signOut()` server action.

**Step 2:** Commit: `feat(polish): user menu with sign-out`.

### Task 15.4: Dashboard refinements

**Files:**
- Modify: `src/app/page.tsx`

**Step 1:** Add a "Current state" column showing each project's most-recent revision and its current stage badge. Sort by last activity.

**Step 2:** Commit: `feat(polish): dashboard shows current-state per project`.

### Task 15.5: Basic responsive styling

**Files:**
- Modify: all list views and detail pages

**Step 1:** Verify rendering at 1280px, 1024px, 768px. Hide non-essential columns at narrow widths. Tracker overflow rule already covered.

**Step 2:** Commit: `feat(polish): responsive styling pass`.

### Task 15.6: Visual verification against TB-1-POWER bench console

**Manual:**
1. Open `c:/zzz/otd/hardware/schematic/test-boards/TB-1-POWER/docs/bench/index.html` in a browser side-by-side with the foundry dev server.
2. Confirm color palette, typography stack, accent-bar usage, and Space-Mono metadata feel render consistent.
3. Note any discrepancies in `docs/visual-notes.md` for Phase 2 attention.

### Task 15.7: M10 checkpoint + Phase 1 ship

**Verify:** All milestones tagged, CI green on `main`, Vercel prod deploy green, seeded data renders correctly on prod. Tag: `git tag phase-1-complete`.

---

## Cross-cutting reminders

- **Run `pnpm tsc --noEmit` after every task.** Type errors compound; catch them at the source.
- **Run the relevant Vitest test file before committing.** Don't rely on "I'll catch it in CI."
- **Never skip the failing-test step.** Per `superpowers:test-driven-development`, the red→green transition is the only proof the test actually exercises the code.
- **For UI work, run `pnpm dev` and visually verify in the browser.** Type-checking and unit tests don't catch CSS regressions.
- **Read the design doc when in doubt.** Don't redesign on the fly — surface confusion as a question.

---

## Plan complete — execution options

Plan saved to [docs/plans/2026-05-28-design-foundry-phase1-implementation.md](docs/plans/2026-05-28-design-foundry-phase1-implementation.md). Two execution options:

**1. Subagent-Driven (this session)** — I dispatch a fresh subagent per task and review between tasks. Fast iteration but stays in this conversation.

**2. Parallel Session (separate)** — open a new session in this directory and have it use `superpowers:executing-plans` to batch-execute with checkpoints.

Which approach?
