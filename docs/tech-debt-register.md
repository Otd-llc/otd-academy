# Tech-debt register — OTD Academy + Apex

Assessment date: **2026-06-28**. Method: static scan (markers, type-safety escapes,
debug code, test gaps, size, deps) across both repos + `pnpm audit` + branch-protection
check. Not a vuln pen-test; not a per-file deep read.

Severity: **P1** act soon · **P2** schedule · **P3** watch.
Status: `open` · `in progress` · `accept/monitor` · `needs maintainer` (infra/settings/decision).

---

## Academy — `project-foundry` (648 ts/tsx, 172 test files, CI present)

### P1

- **A1 · Linting (`done` — tooling wired; error backlog `open`).** Was: no `lint` script,
  no config, no `eslint` dep — 648 files unlinted. **Now: ESLint 9 + `eslint-config-next` 16 +
  a flat `eslint.config.mjs` + a `pnpm lint` script** (and `unrs-resolver: true` in
  `pnpm-workspace.yaml` so the build-gate doesn't block `pnpm lint`). `scripts/` ignored for
  the app baseline. Initial baseline was 33 errors / 6 warnings; **triaged to 0 errors /
  15 warnings — `pnpm lint` now exits 0:**
  - `react-hooks/set-state-in-effect` -> `warn` (prop->state sync; advisory perf, not a bug).
  - `react/no-unescaped-entities` -> `off` (literal apostrophes/quotes render fine).
  - `react/jsx-no-comment-textnodes` -> `off` (the `// LINK SENT` / `// {heading}` code-comment
    eyebrow motif is rendered text, not a forgotten comment).
  - Fixed 2 malformed `--`-vs-em-dash `eslint-disable` comments, and 1 intentional `ref.current`
    read (inline-disabled with its existing justification).
  Remaining 15 are warnings (mostly `set-state-in-effect` + a few a11y/`no-img-element`).
  → **Ready to add to the CI required checks** (lint exits 0); chip away at the warnings over time.

- **A2 · `main` is completely unprotected (`needs maintainer`).** `GET …/branches/main/protection`
  → 404 "Branch not protected." No required checks, no required review, direct pushes allowed.
  → **Enable branch protection** on `main`: require PR + the CI checks (tsc / build / vitest)
  to pass. (Note: CI `build` currently can merge red — this is the root cause.)

- **A3 · Dependency CVEs (`mostly fixed`).** Was 2 high / 7 moderate / 1 low. Added overrides in
  `pnpm-workspace.yaml` (`hono ≥4.12.25`, `@hono/node-server ≥1.19.13`, `esbuild ≥0.28.1`,
  `postcss ≥8.5.10`) and regenerated the lockfile (pnpm 11 only applies workspace overrides on a
  full re-resolve, not an incremental install). **Now down to 1 high / 1 moderate — both `vite`
  (dev-only, the vitest transform server).** The `hono` **high** (CORS reflect via the MCP path)
  is resolved. tsc + lint green; frozen-install consistent.
  - Remaining vite: a `vite ≥8.0.16` override won't take — vitest 4.1.7 pins vite's resolution to
    8.0.14, so pnpm can't upgrade it without breaking the runner. Dev-only (no vite server runs in
    prod). → Accept; revisit on the next vitest upgrade.

- **A4 · `next-auth@5.0.0-beta.31` (`accept/monitor`).** Security-critical auth on a beta.
  Auth.js v5 is still beta upstream, so this is "pin + watch," not a quick fix. Version is
  already pinned. → Track for v5 stable; keep the verified-email auto-link guard + the
  dangerous-link flag intact (removing either re-opens account-takeover).

- **A5 · Production-DB coupling (`needs maintainer`/decision).** `.env.local DATABASE_URL`
  = PROD, so `pnpm db:seed` and the large seed/rewrite scripts mutate production directly;
  the test suite falls back to PROD if `.env.test.local` is missing. One stray script run
  corrupts prod. → Options: a refuse-on-prod guard (env flag) on destructive scripts, a
  staging branch for content authoring, and guaranteeing `.env.test.local` in every dev/CI
  env. Decision needed (the current flow relies on writing prod directly).

### P2

- **A6 · Oversized components.** `src/components/guide/GuideBlocks.tsx` (1463 LOC),
  `BlockEditor.tsx` (1242). Hard to test/reason about. → Split by block type / extract subcomponents.
- **A7 · Schema dual source of truth.** Part `category` enum retained as a bridge alongside
  `categoryRef`. → Finish the migration, drop the enum, read only `categoryRef`.
- **A8 · Silent guide-content failure.** `contentBlocks` safeParse → renders a blank card on
  any parse error, plus a 200-block cap. Authoring breaks invisibly. → Surface parse errors in
  the editor; make the cap explicit/configurable.
- **A9 · Legacy redirect path.** `src/lib/legacy-foundry-redirect.ts` 308s old `/projects/foundry-*`
  slugs. → Sunset once that traffic is gone (check analytics).
- **A10 · Branch sprawl.** 14 local / 10 remote branches. → Prune merged/dead branches.

### P3
- 8 `any`, 2 `@ts-ignore` — minor; ESLint (A1) will surface these.
- 26 `TODO/FIXME` — mostly intentional authoring-stub markers (the lesson-readiness gate keys
  off the literal "TODO"); benign, but worth an occasional sweep.
- 398 `console.log` — **all in `scripts/`** (CLI output); app code (`src/app|components|lib`) = 0. Not debt.
- Test suite is clean: **0 skipped/`.only` tests** (the earlier "136" was Prisma/script `.skip()` noise).

---

## Apex — `otd-site-deploy` (24 ts/tsx, small marketing site)

### P2
- **X1 · Near-zero test coverage.** 1 test file for 24 sources; `BriefingForm` (the lead-capture
  conversion path) is untested. → Add tests for the form submit + any redirect/middleware logic.

### P3
- **X2 · 1 moderate CVE** (`postcss` via `next`). A `postcss` override already exists in
  package.json but audit still flags the next-bundled path. → Verify the override covers it / bump.
- **X3 · `lint` script present but no `eslint` devDep** — `next lint` likely won't run. → Add the
  dep or drop the script.
- Otherwise healthy: current minimal deps (Next 16 / React 19 / resend), 1 `any`, no markers.

---

## Cross-cutting

- **C1 · Duplicated design system (`open`).** `PageHeader` + the bench-hero alternation engine,
  footer, elevation tokens, and `BrandMark` are hand-ported between the two repos → they drift
  every time one is touched (re-synced manually more than once already). → Extract a shared
  package, or accept manual sync with a written parity checklist.

---

## Healthy (explicitly not debt)
Modern stack (Next 16 / React 19 / Prisma 7 / Zod 4), real CI (tsc/build/migrate/vitest), 172
test files, **0 skipped or `.only` tests**, near-zero app-code `console.log`, no check-disabling
`next.config` flags, strict-match BOM import, and the board-design validation gate.
