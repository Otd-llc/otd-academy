# CLAUDE.md — repo instructions for AI agents

Instructions for any AI agent (Claude Code or otherwise) working in this repo.

## Board design — validation gate (MANDATORY)

This repo's curriculum boards live in `docs/boards/<slug>/design.md`. Their lifecycle
`DESIGN_VALIDATION` checklist items are **honest human attestations**, not machine
proofs — so the design must be *proven* before any hardware commitment.

**Before you create a board's parts in the library, import/edit its BOM, or create or
advance its revision — or when you start or substantially edit any
`docs/boards/*/design.md` — you MUST:**

1. Read **`docs/boards/_protocol.md`** (the Recursive Board-Design Validation Protocol).
2. Run it, or at minimum **surface it to the user and get their go-ahead** before
   proceeding.

There is a `board-design-validation` skill, but it ships in the **`otd-skills` plugin**
(`Otd-llc/otd-skills`) — it is *not* in this repo, so `find . -name SKILL.md` will not
find it and an agent without that plugin installed has no such skill. Its own first
instruction is to read `docs/boards/_protocol.md`. **`docs/boards/_protocol.md` is the
source of truth; always cite it by path**, so the gate holds whether or not the plugin is
present.

**A board is NOT part-ready** until its design has passed the protocol: **≥ 10
recursive audit passes, a "dry" pass (zero new material findings), every applicable
audit clean, and the board's `validation-log.md` complete.** Do not create parts, BOM
lines, or revisions before then. New boards start from `docs/boards/_template/`
(which carries the gate banner + a `validation-log.md` scaffold).

## A few load-bearing facts (verify before relying on them)

- **`.env.local` `DATABASE_URL` is LOCAL** (Postgres 17 Windows service
  `postgresql-x64-17`, database `foundry_dev`) — **since 2026-07-15; it used to be PROD.**
  `next dev`, `pnpm db:seed`, and every `scripts/*.ts` hit local, so they are **safe by
  default**. **PROD is `PROD_DATABASE_URL` / `PROD_DIRECT_URL`**, reachable only via:
  - `pnpm db:prod <script.ts>` — swaps the env, prints the host, makes you type `prod`
  - `pnpm db:migrate:prod` — swaps the env itself, prints the host, makes you type `prod`
  - `pnpm db:pull-prod` — dumps PROD read-only, restores into local (refuses to run
    unless `DATABASE_URL` is localhost). **Hydrate/refresh local with this.**

  The adapter is chosen by URL (`src/lib/db-adapter.ts`): a localhost URL uses
  node-postgres, a Neon URL uses `@neondatabase/serverless`. The Neon driver speaks
  WebSocket to Neon's proxy and **cannot** reach a local Postgres, so never assume a
  bare URL swap is enough. Note the drivers differ subtly — e.g. `$queryRaw` on a
  Postgres `name` column deserializes under node-postgres but **fails** under Neon
  (cast to `::text`).

  *Why:* dev traffic against prod Neon burned 4.73 GB of the 5 GB account egress and
  70% of the 100 CU-h/project compute by mid-July 2026, while the deployed site served
  4 requests/day. See `docs/plans/2026-07-15-dev-off-prod-local-postgres.md`.
- **Tests run against an isolated Neon branch pool, NOT prod** (since 2026-06-21).
  `.env.test.local` (gitignored) supplies `TEST_DATABASE_POOL`; `pnpm test` parallelizes
  by leasing a branch per DB-test file (`vitest.env.ts`), so concurrent runs are safe and
  the suite is ~80s (was ~13 min). **If `.env.test.local` is absent, tests fall back to
  whatever `.env.local` sets — which is LOCAL `foundry_dev` since 2026-07-15, not prod.**
  (This bullet used to warn that the fallback was PROD; that was true only while
  `.env.local` pointed at prod. Keep `.env.test.local` present anyway — without it the DB
  tests lose per-file branch isolation and serialize.) The pool branches are persistent clones and drift behind
  prod after a migration; `pnpm test:pool:refresh` re-applies migrations to each (and
  `pnpm db:migrate:prod` does it for you — **`pnpm db:migrate` no longer does**, since it
  now targets local, where a pool refresh would be meaningless). The pool stays on **Neon**
  deliberately: it is ~16 CU-h and 0.44 GB, and the per-file branch isolation is worth
  keeping. A vitest guardrail (`vitest.global-setup.ts`)
  fast-fails with one clear message if the pool is behind, instead of hundreds of
  cryptic "column (not available)" errors. New DB-backed tests can use throwaway rows or
  freely mutate the seed fixture (each file has its own branch clone).
- **`pnpm` runs via PowerShell, not the Bash tool.** Migrations are hand-authored and run
  `prisma migrate deploy` (**never** `migrate dev`). Since 2026-07-15 the command is split:
  - **`pnpm db:migrate`** → applies to **LOCAL** `foundry_dev`. Test it here first.
  - **`pnpm db:migrate:prod`** → applies to **PROD** *and* refreshes the test pool (the
    pool branches clone prod, so they drift after a prod migration). **No inline env
    needed any more** — it runs `scripts/migrate-prod.ts`, which reads `PROD_*` from
    `.env.local` itself, **refuses** if that host is local, prints the target host, and
    makes you type `prod`. Just:
    ```powershell
    pnpm db:migrate:prod
    ```
    *This used to be a bare `prisma migrate deploy` that inherited `.env.local` (LOCAL),
    so forgetting the inline swap migrated local, exited 0, then refreshed the Neon test
    pool — a fully green run against the wrong database. The swap now happens inside the
    script, so there is no longer an inline step to forget.*

  Restart `next dev` after `prisma generate`.
- **BOM CSV import is strict-match** on `(manufacturer, mpn)` against the curated
  parts library — unmatched rows are reported, never auto-created. Create new parts
  *before* importing. One CSV row per part (merge shared refDes; `refDes` count must
  equal `quantity`).
- **Seeding Library content to PROD does NOT appear immediately — expect up to 1 hour.**
  Since Cache Components landed, the public read path (`src/lib/library/load.ts`) is
  `use cache` with a 1-hour window, tagged `mini-lessons` / `mini-lesson-<slug>`. Admin
  edits through `src/lib/actions/mini-lesson.ts` fire `revalidateTag`, so **those are
  live on the next request**. A `scripts/*seed*.ts` write cannot: it runs outside a
  request context, where `revalidateTag` is unavailable. So a seeded change waits out
  the hour.

  This also affects `/sitemap.xml`, which is tagged `mini-lessons` for the same reason.

  To force it sooner: touch the lesson once through `/admin/library` (fires the tags),
  or redeploy (the build id is part of every cache key, so a deploy drops the whole
  cache). If this becomes a routine annoyance, the fix is a `CRON_SECRET`-guarded
  `POST /api/revalidate` the seed scripts call after writing — considered and
  deliberately deferred, not overlooked.
- **A local `next start` needs `AUTH_TRUST_HOST=1`, or the route auth gate is silently OFF.**
  Auth.js rejects an untrusted host in production mode, and on rejection `auth()` resolves to a
  truthy **error object** rather than `null`. `src/proxy.ts` gates on `!req.auth`, so that error
  reads as "signed in" and every non-public route serves to anonymous requests — `/account` and
  `/admin/students` return 200 instead of `307 → /sign-in`. Real prod is trusted by Vercel
  (`VERCEL=1`) and `next dev` trusts localhost, so this bites ONLY local prod-build measurement —
  where it will quietly invalidate anything you conclude about signed-out behaviour. (The latent
  fail-open itself is real but not live; gating on `req.auth?.user` is the fix.)
- **Signup abuse defense (magic-link send) — the ONE locus + its throw contract.** Turnstile +
  honeypot/dwell + the per-email/global rate limiter all live in the Resend provider's
  `sendVerificationRequest` (`src/auth.ts`), which reads the forwarded fields via **`await
  request.json()`** (NOT `formData()` — `@auth/core`'s `toRequest` leaves a stale
  `x-www-form-urlencoded` content-type). A denial there **throws a plain `Error`** → surfaces as
  `?error=Configuration`; NEVER an `AuthError` (that 500s) and NEVER an early return (that is a
  silent "sent"). The **IP-only pre-check** in the `signIn` callback (gated to `provider ===
  "resend" && verificationRequest`, so OAuth is untouched) instead **RETURNS `RATE_LIMITED_REDIRECT`**
  — a callback throw becomes `AccessDenied` → 500 under the server-action `raw` path. Every send
  surface (sign-in form, B1 resend, lead-magnet modal) sends via a **server action** (in-process
  `Auth(req)`); the raw `POST /api/auth/signin/*` is 404'd. All denial points are gated by ONE
  `defenseEnabled()` — Vercel **Edge Config** store `otd-academy-flags`, fail-safe ON; flip its
  `defenseEnabled` key to `false` to disable at runtime with no redeploy (`vercel edge-config
  update otd-academy-flags --patch …`). The `Ratelimit`/`Redis` instances live in a **plain**
  module (`src/lib/abuse-limit.ts`), never `"use server"`. Local dev is keyless (KV/Turnstile
  unset) → every layer no-ops. Design + build:
  `docs/plans/2026-07-16-signup-abuse-defense-{design,implementation}.md`.
- **Authored lesson content lives ONLY in the production database, and its backup is a
  SEPARATE PRIVATE REPO.** `GuideCard.contentBlocks`, `MiniLesson.contentBlocks` and
  `Exam.questions` are not in git, and Neon's free plan keeps only a short history window
  (~6h), so anything authored yesterday has no provider-side recovery path.

  - `pnpm content:export` / `pnpm content:check` (`scripts/export-content.ts`) mirror the
    content tables to a deterministic, PII-free JSON tree. **It writes OUTSIDE this repo**
    — `CONTENT_ARCHIVE_DIR`, defaulting to `../otd-content-archive/content` — because this
    repo is PUBLIC and the corpus is the priced curriculum plus every exam **answer key**,
    which gate the `/verify` certificates. A `/content/` gitignore entry exists as
    belt-and-braces; the default target is the real protection.
  - `scripts/import-content.ts` restores it. **Dry run is the default**; `--write` applies.
    Projects are never created (they carry pricing and curriculum edges the archive lacks);
    revisions match case-insensitively; `createdById` resolves to an admin on the target.
  - A **daily workflow in the private `Otd-llc/otd-content-archive`** refreshes the prod
    mirror. It lives there, not here, so the prod URL is never an Actions secret on a public
    repo. It checks this repo out at the **`content-export-v1` tag**, so **if you change
    any file that workflow runs, you must bump that tag or the schedule silently keeps
    running the old code.** Nothing warns you. That is now **four** files, not one:
    `scripts/export-content.ts`, `src/lib/__tests__/content-archive-guards.test.ts`, and
    its two dependencies `src/lib/gate-quiz.ts` + `src/lib/quiz-spread.ts`.
  - **The content guards are green-by-absence HERE and only mean something THERE.**
    `content-archive-guards.test.ts` is `test.runIf(HAVE_ARCHIVE)` against the private
    archive, which this public repo's CI has no copy of — so all three tests SKIP and the
    run is green having checked nothing (measured: `success: true, numPassedTests: 0,
    numPendingTests: 3`). Three L1.01 gate quizzes were passable with one letter until
    2026-08-20 while this file sat green. The run that counts is the archive's own daily
    workflow, which exports prod, commits the mirror, runs this file against it, and then
    **fails the job if any test skipped**. Do not read a green run here as evidence about
    answer keys. Do not "fix" it by checking the archive out here either: this repo is
    PUBLIC, so that would put every exam answer key one workflow edit from exfiltration
    and would still skip on fork PRs, which get no secrets.
  - The archive carries **two** trees: `content/` mirrors prod, `local-snapshot/` mirrors
    the dev DB. Neither is a superset — L2.01's authored guide and its 18-question exam
    exist only on local, held back pending a safety review. `local-snapshot/` retires when
    L2.01 ships.
  - The restore is **exercised**, not assumed (drill recorded in the archive's README).
    Re-run that drill after any change to either script.
- **Branch off `main`.** Don't merge without the maintainer's explicit go-ahead.
