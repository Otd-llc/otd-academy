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

- **A11 · The build-guide hub's completed hexes used the honey slab (`done`).** The gold
  WASH landed on `/courses` in #367 but was `.sk-lean`-scoped, so the hub (#368) kept a
  solid gold plate under its stage artwork and a printed BOM sheet or schematic page
  read muddy on it. Now unscoped: both combs wash their completed face.
  **The trap, recorded because it will recur on any surface that adopts the wash:** the
  shipped `.gh-node.done` ink is DARK, sized for the slab, and every rung of it has to
  move — title → ivory, chip → gold-on-deep-space, **and the LEAD → muted**. The lead is
  the one that could not surface on `/courses` at all, because `.sk-lean` hides
  `.gh-lead`; it only appears on the hub, which shows a tagline under every title. The
  pre-measure shells (`.gh-hex`, `.gh-3d .gh-top`) carry the honey fill too and were
  flashing a gold slab under the artwork on first paint.

- **A12 · `/learn` renders board art on a different camera from the combs (`accept` —
  maintainer decision 2026-07-25).** Both honeycombs use tilt 45 / spin 25
  (`board-posters/comb/`); the `/learn` ladder + board hero stay on tilt 45 / spin 45
  (`board-posters/`). **Not debt: the two cameras are kept deliberately for visual
  diversity between surfaces.** Anyone tempted to "fix" the inconsistency should stop —
  and note that the ladder's frame-breaking layout was tuned to the old silhouette, so
  unifying would cost a re-render plus a composition pass anyway. Rebuild flags for the
  comb camera are in `src/lib/guide-stage-art.ts`.

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

- **C1 · Duplicated / diverged design system (`decision needed`).** The shared design language is
  reimplemented in parallel and has already **diverged** (not identical copies): `PageHeader`
  (academy 207 LOC vs apex 103 — apex uses ASCII regexes for its pre-ES6 tsconfig, academy unicode),
  `BrandMark` (29 vs 17), the title-alternation engine (`FUNCTION_WORDS` / `highlightTitle`),
  elevation tokens, and a large slice of `globals.css` (`.glass-*` / `.bench-hero` / footer).
  Truly-shareable surface is small (~150 LOC of logic + token CSS) but not identical.

  **Mechanisms (the decision):**
  - **(A) Manage the duplication** — reconcile the few divergences, keep parallel copies, add a
    parity checklist (optionally a CI diff-test on the shared files). Cheapest; fits the small surface.
  - **(B) Published `@otd/brand` package** (private, GitHub Packages) — both repos `pnpm add` it.
    Correct long-term *iff* the design language spreads across more OTD surfaces (apex, academy,
    bioscale-viz, future). Cost: publish/version CI + reconciling the divergences (incl. the
    ASCII/unicode regex split) + both repos consuming & rebuilding on every change.
  - **(C) Monorepo** — rejected: the apps deploy on different stacks (academy Vercel+Neon, apex
    CF Pages) and the migration cost dwarfs the ~150-LOC benefit.

  **Recommendation:** **(A) now** — the surface is too small + diverged to justify (B)'s overhead.
  Move to (B) only when ≥3 OTD surfaces must share components, or the shared set grows materially.
  **Maintainer decision:** how far will the OTD design system spread? Small/stable → (A); growing
  across the ecosystem → start (B).

---

## Healthy (explicitly not debt)
Modern stack (Next 16 / React 19 / Prisma 7 / Zod 4), real CI (tsc/build/migrate/vitest), 172
test files, **0 skipped or `.only` tests**, near-zero app-code `console.log`, no check-disabling
`next.config` flags, strict-match BOM import, and the board-design validation gate.
