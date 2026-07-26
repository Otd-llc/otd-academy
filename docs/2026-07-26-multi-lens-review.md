# Multi-lens project review — OTD Academy

Assessment date: **2026-07-26**. Nine lenses: security/authz, data & Prisma, performance
& rendering, testing & CI, architecture, reliability & ops, UX/a11y, dependencies &
tooling, and the board-authoring domain — plus the previously-unowned surfaces
(`mcp/parts-server`, `capture-app`, the consent/analytics path) and a drift measurement
against `docs/tech-debt-register.md`.

Method: direct source reads, fanned out across lenses and then **adversarially
re-verified** — each finding was re-checked by a reader whose job was to refute it.
Findings that did not survive were dropped. Every item below is marked with its
verification state:

- **[V]** — verified against the source during this review (by me or a refutation pass).
- **[R]** — reported and survived refutation, but not independently re-read a third time.

`node_modules` was absent, so nothing here rests on a live `build` / `lint` / `tsc` run.
Severity: **P0** stop-and-fix · **P1** act soon · **P2** schedule · **P3** watch.

---

## Headline

This is a well-engineered codebase and the review should be read in that light. The
Stripe grant path, the auth route gate, the abuse-defense locus, the caching law, and CI
are all better than what a project this age usually carries. Almost nothing here is
sloppy code.

The weaknesses cluster into three shapes:

1. **The documentation layer has drifted out from under the code**, and because this repo
   is deliberately agent-driven, its docs are executable instructions. Two agent-facing
   documents now contradict each other about which database is production (P0-1), and the
   repo's single hardest safety rule points at a skill that does not exist (P0-2).
2. **Gates that exist are not wired up.** `pnpm lint` was triaged clean and never added to
   CI; the `mcp/parts-server` safety tests are never executed by `pnpm test`; prod
   migrations have no guard while their two sibling prod paths both do.
3. **Cache invalidation and copy-forward have gaps that silently show users wrong data** —
   a BOM whose prices vanish, a public guide serving a stale parts list for an hour, a
   learner told "Not quite" when they were right.

There is no error tracking anywhere, which is what turns each of the above from an
incident into a silent one.

---

## What is genuinely strong — do not "improve" these

Recorded explicitly because several are subtle enough to be mistaken for problems.

- **The Stripe webhook** (`src/app/api/stripe/webhook/route.ts`) is exemplary: idempotency
  double-layered (a `ProcessedStripeEvent` claim on the event id as `@id`, plus an `upsert`
  on the grant's natural unique), with the claim and the grant in **one** `$transaction` so
  a crash rolls back both and Stripe's retry re-runs the whole event. Telemetry fires after
  commit, deliberately outside the transaction. The parts that look redundant are the parts
  doing the work. **[V]**
- **The route gate's fail-open is already closed.** `src/proxy.ts` delegates to
  `resolveRouteGate(req.auth, pathname)`, which keys on `req.auth?.user`, not `!req.auth`,
  so an Auth.js truthy *error object* reads as signed-out. Pure and unit-tested. **[V]**
- **Server-action authorization is systematic**: 130 `requireAdmin` + 51 `requireUser` call
  sites across 58 modules. Every `*-form.ts` wrapper delegates to a guarded action
  (spot-checked: all seven delegate; `boards.ts` calls `requireAdmin()` in each export). The
  deliberately-public ones carry written rationale. **[V]**
- **Environment validation** (`src/env.ts`) via `@t3-oss/env-nextjs` + Zod, required-vs-optional
  reasoned per variable. **[V]**
- **CI does real work**: `tsc --noEmit`, `prisma validate`, a migrate step that retries
  through a cold Neon branch wake, a seed, a `next build` against a *real* database
  (necessary under `cacheComponents`), a headless-Chromium diagram-freshness gate, and the
  full vitest suite. **[V]**
- **Type discipline**: 22 total `any` / `as any` / `@ts-ignore` / `@ts-expect-error` across
  ~133k LOC with `strict: true`. Error handling is *not* a systemic problem — there are
  exactly **3** empty catch blocks, all fire-and-forget analytics. **[V]**
- **Accessibility groundwork is real**: 106 `prefers-reduced-motion` sites; the honeycombs
  use real `<Link>` with `aria-label` and `aria-current="step"`. `PartGlanceModal` is a
  correctly-named native `<dialog>`. **[V]**
- **The caching law is coherent** — `use cache` + explicit `cacheTag`, with a documented
  key-bounding rule. The gaps below are missing *calls*, not a broken design. **[V]**
- **Comment discipline.** Nearly every non-obvious decision records *why*, including the
  failure it prevents. This is the main reason the codebase is navigable at 931 files, and
  it is what made this review possible.

---

## P0 — stop and fix

### P0-1 · Two agent-facing documents disagree about which database is production **[V]**

`CLAUDE.md`'s **first** load-bearing fact:

> `.env.local` `DATABASE_URL` is **LOCAL** (Postgres 17 … database `foundry_dev`) — **since
> 2026-07-15; it used to be PROD.**

`.claude/skills/adding-parts/SKILL.md:15`, the only codified authoring pipeline:

> The library is global and **lives in PROD** (`.env.local` `DATABASE_URL`).

Its mandatory boilerplate (line ~99) is `loadEnv({ path: ".env.local" }); // PROD — order
matters`. **Eight committed board scripts repeat the stale claim verbatim** —
`build-l102/l104/l105-revision-bom.ts`, `seed-l104/l105-parts.ts`,
`attest-l102/l104/l105-dv.ts` — each announcing `// PROD write`.

The scripts are not wrong to run; they are wrong about **where they land**. Since
2026-07-15 they write `foundry_dev` while printing "PROD write" and exiting 0.

**Impact.** `l1-02`, `l1-04`, `l1-05` and `l2-01` are mid-pipeline with committed
`bom.csv` files. The next board taken part-ready gets its parts, BOM lines, and
`DESIGN_VALIDATION` attestations written to local while the operator — or an agent
following the skill — reports success. Nothing errors, the scripts are idempotent, and
the discrepancy surfaces only when the public catalog or a learner-facing BOM turns out
empty.

→ Fix `SKILL.md` and the eight script headers to say LOCAL, and route genuine prod writes
through the escape hatch that already exists and already has a guard: `pnpm db:prod
<script.ts>`. **Effort: S.**

### P0-2 · The mandatory validation gate points at a skill that does not exist **[V]**

`CLAUDE.md` opens with a section headed **"Board design — validation gate (MANDATORY)"**.
`SKILL.md` reinforces it twice: *"Pairs with the board-design-validation skill (which gates
part creation) — read that FIRST"* and *"A board is not part-ready until its `design.md`
passes the **board-design-validation** …"*.

`find . -name SKILL.md` returns **exactly one file** — `adding-parts` itself. There is no
`board-design-validation` skill.

The protocol *document* (`docs/boards/_protocol.md`) does exist and is good. But the
instruction an agent is given names a **skill**, and an agent that goes looking finds
nothing — at which point the most natural recovery is to proceed. The repo's single
hardest rule, the one standing between a design and a hardware purchase, degrades to a
no-op exactly when it is being followed literally.

→ Either create the skill, or change both references to point at
`docs/boards/_protocol.md` by path. **Effort: S.** This is the cheapest high-consequence
fix in the review.

### P0-3 · `db:migrate:prod` is the only unguarded prod path, and prod migrations are fully manual **[V]**

The guard asymmetry is stark:

| Path | Guard |
| --- | --- |
| `scripts/with-prod-db.ts` | Prints `*** TARGET: PRODUCTION ***` + hostname; blocks on typing `prod` |
| `scripts/db-pull-prod.ps1` | Hard-throws `REFUSING: DATABASE_URL host is '…', not local` |
| **`db:migrate:prod`** | **`prisma migrate deploy && pnpm test:pool:refresh` — prints nothing, asks nothing, asserts nothing** |

It inherits `.env.local`, which is **LOCAL**. Omit the inline `$env:DATABASE_URL=…` swap
and it migrates local, exits 0, then successfully refreshes the (separately-configured,
Neon) test pool — **a fully green run against the wrong database**. `CLAUDE.md` names this
exact scenario "the worst failure mode here"; the mitigation shipped was a sentence of
documentation, not a guard.

Nothing else applies prod migrations: `"build"` is `prisma generate && next build`,
`vercel.json` has only `crons`, and CI migrates the ci-test branch only.

**Impact.** A forgotten or misdirected migration leaves prod's schema behind; every page
touching the new column 500s. With no error tracking and ~4 requests/day of deployed
traffic, prod can serve 500s on a whole feature for days, and the person who notices is a
customer.

→ Wrap it in a `scripts/migrate-prod.ts` that reuses `with-prod-db.ts`'s shape: assert the
target host is **not** local, print it, require confirmation. **Effort: M.**

### P0-4 · Nothing reports production errors **[V]**

No Sentry or equivalent anywhere in `package.json` or `src/`. Across all of `src/`: 20
`console.*` calls total, 3 `console.error` across every server action and API route
combined.

This is the multiplier on every other finding. It is sharpest exactly where the code is
most careful: the Stripe webhook correctly lets non-P2002 errors propagate so Stripe
retries — but if the cause is a code bug, Stripe retries for three days, gives up, and **a
real purchase is lost with no signal to anyone**.

→ Add `@sentry/nextjs` or a Vercel log drain with alerts. Minimum viable: alert on non-2xx
from `/api/stripe/webhook` and `/api/cron/*`. **Effort: S.** Highest value-per-hour item
in the review.

---

## P1 — act soon

### P1-1 · `createRevision`'s BOM copy-forward silently drops all pricing **[V]**

`src/lib/actions/revisions.ts:74-81` maps exactly six fields:

```ts
sourceBomLines.map((src) => ({
  revisionId: rev.id, partId: src.partId, refDes: src.refDes,
  quantity: src.quantity, notes: src.notes, createdById: user.id,
}))
```

`BomLine` also has `altMpn`, `altManufacturer` and `unitPriceCents`
(`prisma/schema.prisma:1035-1037`) — all added *after* the copy-forward was written (the
schema comments mark them WS1 and WS3), and none carried across.

`bomCost` (`src/lib/bom-cost.ts:18-19`) computes
`totalCents = Σ quantity * (unitPriceCents ?? 0)` and counts `unitPriceCents == null` as
unpriced. So a revision created by copy-forward reads **$0.00 total, every line unpriced,
`overTarget: false`** — the board appears to cost nothing and to be comfortably under
target.

→ Add the three fields. Better: destructure-and-omit
(`const { id, revisionId, createdAt, updatedAt, createdById, ...carry } = src`) so the next
`BomLine` column is carried by default. **Effort: S.**

### P1-2 · BOM writes never invalidate the cached public guide **[V]**

`src/lib/actions/bom-lines.ts` calls only `revalidatePath('/projects/{slug}/{revLabel}')`
(lines 68, 100, 125, 220). The public guide read
(`src/lib/guide/cached-guide-read.ts`) is `use cache` tagged
`TAG_PROJECTS, guideContentTag(slug)`, and at line 233-235 it resolves `bomTable` blocks
from the revision's BOM rows.

So add, re-price, delete, or CSV-re-import a BOM line on a published revision and
signed-out/learner traffic keeps seeing the **previous parts list — wrong parts, refdes and
quantities — for up to an hour**. The admin's own view *is* revalidated, so the divergence
is invisible to the one person who could catch it.

→ Call `invalidateGuideContent` alongside each `revalidatePath`; `loadRevisionRouteContext`
already returns `projectSlug`. **Effort: S.**

Same class, smaller blast radius: `PartAsset` uploads/deletes flip `/parts` catalog
membership but never fire `TAG_PARTS` **[R]**, and `/sitemap.xml` emits every `/parts/{id}`
URL without a `TAG_PARTS` tag **[R]**.

### P1-3 · The MCP server's safety tests are never executed — and one would fail **[V]**

`vitest.config.ts:44-53` builds its file list from `readdirSync("src", …)`. The three test
files under `mcp/parts-server/__tests__/` are therefore **never discovered by `pnpm test`**.

Worse, `source-guards.test.ts:18` asserts no MCP file imports the read-write DB client via:

```js
not.toMatch(/(?:from|import|require)\s*\(?\s*["'][^"']*lib\/db/)
```

That pattern is unanchored, and `client.ts:2` is
`import { makeAdapter } from "../../src/lib/db-adapter";` — `lib/db` matches the prefix of
`lib/db-adapter`. **The test would fail today if it ran**, and the natural fix (loosening
the regex) risks weakening the real guard.

So every stated safety property of the MCP server is unverified: the no-`lib/db` guard, the
no-stdout-writes guard (a stray `console.log` corrupts the MCP protocol stream), the env
resolver, and the answer-contract formatter. The read-only-role "cannot-write" proof is
separately env-gated off in CI. `mcp/parts-server/README.md` §8 nevertheless calls all four
suites "Green and verified".

→ Scan `mcp` as well as `src` in `allTestFiles()`; anchor the regex with a closing quote
(`lib\/db["']`); correct the README. **Effort: S.**

### P1-4 · `ReviewDeck` tells a learner "Not quite" when the *save* failed **[V, confirmed by refutation pass]**

`src/components/review/ReviewDeck.tsx:71-91` commits UI state before awaiting, with no
`else` and no `try/catch`:

```ts
firedRef.current = true;
setPickedDisplay(displayIdx);          // `answered` is now true
const res = await recordReviewAnswer({...});
if (res && "ok" in res && res.ok) { ...setAnswerDisplay(disp)... }
```

The verdict is `const correct = answered && pickedDisplay === answerDisplay` — with
`answerDisplay` still `null`, `correct` is **false**. `recordReviewAnswer` has three
non-success exits (`{ ok: false, needsAuth: true }` when the session is gone, a Zod throw,
and `if (!schedule) return { ok: false }`), all landing in the same silent branch.

**A learner whose session expired picks the right answer and is told they were wrong** —
announced through the `role="status"` region as authoritative feedback. No XP, no SRS
advance, and `firedRef` blocks retry. This is the one surface whose entire job is telling
someone whether they were right.

→ Track a third state; never render `answerDisplay === null` as a verdict. **Effort: S.**

### P1-5 · External calls have no timeouts **[R]**

- **Stripe** (`src/lib/stripe.ts:29`) sets no `timeout`, inheriting the SDK's **80s**
  default — longer than the serverless function budget — on every checkout and Pass action.
- **R2/S3** (`src/lib/r2.ts:25-32`) has no request timeout and no call site passes an
  `abortSignal`; a slow R2 pins a function invocation per request across 23 call sites,
  including the public asset proxies.

→ `timeout: 8000, maxNetworkRetries: 2` on Stripe; a `NodeHttpHandler` with connection and
request timeouts on the S3 client (one change covers all 23 sites). **Effort: S each.**

### P1-6 · `pnpm lint` is not in CI **[V]**

`eslint.config.mjs` is configured, `pnpm lint` exists, and register item A1 records the
baseline as triaged to **0 errors / 15 warnings** with the note "→ Ready to add to the CI
required checks." `ci.yml` has no lint step. The triage work is unprotected and will
re-accumulate. **Effort: S** — one line.

### P1-7 · The tech-debt register is stale in both directions **[V]**

`docs/tech-debt-register.md` is dated 2026-06-28. Measured today:

| Register item | Then | Now |
| --- | --- | --- |
| A6 `GuideBlocks.tsx` | 1463 LOC | **1979** (+35%) |
| A6 `BlockEditor.tsx` | 1242 LOC | **1710** (+38%) |
| A10 remote branches | 10 | **41** |
| "8 `any`, 2 `@ts-ignore`" | 10 | **22** escapes |
| Repo size | 648 ts/tsx, 172 tests | **931** ts/tsx, **231** tests |

Two P1s are now wrong the *other* way — a register that overstates open risk gets ignored
as fast as one that understates it:

- **A5** ("production-DB coupling", `needs maintainer`) was **resolved 2026-07-15**. Still
  listed open.
- **A2** ("`main` is completely unprotected") is **resolved** — `main` now reports
  `protected: true`. Still listed open.

Only **A7** is still live exactly as described (`prisma/schema.prisma:857-859` carries both
`category PartCategory?` and `categoryRef`).

Every number in that table is mechanically derivable.

→ Generate the metrics (`scripts/tech-debt-scan.ts`); keep the prose for judgement calls —
A12's "this is deliberate, stop trying to fix it" is genuinely valuable and cannot be
generated. **Effort: M.**

Related, unverified and worth a two-minute check: `protected: true` only says *a rule
exists*. Confirm `CI` and `classification-guard` are actually **required status checks**,
or CI can still merge red — which was A2's real concern.

---

## P2 — schedule

### Correctness and data

- **`recordEnrollmentProof` does create-then-delete outside a transaction** **[R]**
  (`src/lib/actions/enrollment.ts:504-541`). Two concurrent submits delete each other's
  artifact, leaving the learner with **no proof and their R2 objects gone** — and it can
  let a learner past the authoritative DRC_GERBER gate on a superseded report. Three
  sibling actions in the same file already use `withTxRetry` + Serializable; this one
  doesn't. **Effort: S.**
- **The ERC/DRC proof gate accepts any text file containing "DRC" or "ERC"** **[R]**
  (`src/lib/kicad/drc-report.ts:44-57`). It tests for the *absence* of failure rather than
  the presence of a valid report. → Require a recognized report header/summary line.
  **Effort: S.**
- **The sourcing watchdog only inspects frozen BOMs** **[R]**
  (`src/lib/active-bom-sourcing.ts:33-38`) — and every board in the authoring pipeline is
  deliberately unfrozen, so the parts most likely to go EOL mid-design are exactly the ones
  it never checks. **Effort: S.**
- **Lifecycle cron: three unguarded tail stages** **[R]**
  (`src/app/api/cron/lifecycle/route.ts:186-237`) — the waitlist promise, dunning drain and
  review nudges run last with no try/catch and are the first casualties of any earlier
  slowness. The sibling `refresh-availability` route already has the right shape to copy.
  Separately, its Resend throttle counter resets per sequence, so a full tick can fire ~200
  sends with no pause (one-line fix: hoist `batched`). **Effort: S.**
- **Both crons report failure only into an HTTP 200 body** **[R]** that the code itself
  notes is discarded. A cron that runs and silently accomplishes nothing is indistinguishable
  from a healthy one. → A `CronRun` row per tick, plus a non-2xx on material incompleteness.
  **Effort: M.**
- **`pnpm db:prod --yes` detection scans forwarded script args** **[R]**
  (`scripts/with-prod-db.ts:22-24`) — a target script's own `--yes` flag silently skips the
  production confirmation prompt. Split argv at `--` before parsing. **Effort: S.**
- **`XpEvent` has no `(userId, createdAt)` index** **[V]**. The Logbook's "recent 20" is
  `where: { userId }, orderBy: { createdAt: desc }, take: 20`; the existing composite is
  `(userId, source, refId)` (added for the firstEver guard) and does not serve the sort. Note
  `@@index([userId])` is *already* redundant against that composite. **Effort: S.**
- **~11 provably dead or redundant indexes** **[R]** — duplicates of a composite unique's
  leading column, one exact duplicate of a unique, and columns no query filters. Not urgent
  at this scale; the point is that the pattern is still being added by new migrations.
  **Effort: M.**

### Security and privacy

- **Server-side PostHog capture bypasses the c15t consent gate** **[R]**
  (`src/lib/analytics.ts:53-69`). A visitor who declines the measurement banner still has
  `signed_up`, `checkout_started`, `purchase_completed` and `email_captured` sent to
  PostHog keyed by their user id, and `IdentitySync` merges them onto the same person. The
  banner does not do what it appears to do — a compliance question, not just a bug.
  **Effort: M.**
- **Premium deliverables download without an entitlement check** **[R]**
  (`src/lib/actions/learner-resources.ts:49-90`). The shared resolver authenticates but does
  not authorize. Latent today — it bites the day the first PREMIUM board gets a published
  revision with a gerber/BOM artifact. `exam.ts:58-66` has the gate to copy verbatim.
  **Effort: S.**
- **The capture app logs the live token to a plaintext file in `~/Downloads`** **[R]**
  (`capture-app/main.js:374`) — a 4-hour, replayable, unbound write capability over a
  published lesson block, in a commonly-synced folder. → Redact before logging; consider
  making the token single-use. **Effort: S.**
- **`mcp/parts-server/env.ts:14-18` asserts "never the owner" by comparing against
  `DATABASE_URL` only** **[R]**, while `DIRECT_URL`, `PROD_DATABASE_URL` and
  `PROD_DIRECT_URL` all sit in the same `.env.local`. → Assert on the *username* being the
  read-only role. **Effort: S.**
- **The MCP untrusted-data fence is escapable** **[R]** via an unsanitized
  `citation`/`sourceNote` (`mcp/parts-server/format.ts:68-71`) — `data` is JSON-escaped but
  the citation is interpolated raw, and citations are typically pasted from datasheet PDFs.
  **Effort: S.**
- **`submitExam` has no attempt cap and returns the exact score** **[R]**
  (`src/lib/actions/exam.ts:98-147`) — the answer key is recoverable by iterated submission.
  **Effort: S.**
- **`getDownloadUrl` presigns any artifact by id with no object scoping** **[R]**
  (`src/lib/actions/uploads.ts:366-396`). Not a live exposure — no current surface hands it
  an arbitrary id — but confidentiality of learner proof uploads currently rests on cuid2
  entropy rather than an ownership predicate. **Effort: M.**
- **`kicad-search.ts` is un-authed and un-rate-limited** **[V]** — Zod-bounded and public
  data, but an unmetered DB-touching endpoint where its neighbour `waitlist.ts` does limit.
  **Effort: S.**

### Performance

- **Every route blocks first paint on a 3-hop Google Fonts chain** **[R]** — two remote
  `@import`s at the top of `src/app/globals.css` (lines 1 and 8), no `preconnect`. An
  `@import` in the head CSS is render-blocking and serialized. → Move all four families to
  `next/font/google`. **Effort: S**, and it is the single largest first-paint win available.
- **`/library` ships all 95 diagram modules to render one** **[R]** — `ResumeDiagram`
  imports the eager `DIAGRAM_COMPONENTS` registry, pulling ~500 KB of source into the client
  bundle. → A lazy per-entry registry via `next/dynamic`. **Effort: M.**
- **`/embed/[slug]`, an iframe widget for third-party sites, inherits the whole root-layout
  provider stack** **[R]** including consent providers. → Push providers down into
  `(chrome)/layout.tsx`. **Effort: M.**
- **`/library` issues the same two logbook queries twice per signed-in render** in a 5-deep
  sequential chain **[R]**, and **ten page-level lookups re-read the user row** that
  `currentAccount()` already request-memoized **[R]**. → Widen `CurrentAccount` to carry
  `role`; wrap the logbook reads in React `cache()`. **Effort: S–M.**

### Architecture and testing

- **The guide subsystem is the size hotspot** **[V]**: `GuideBlocks.tsx` (1979),
  `BlockEditor.tsx` (1710), `guide/page.tsx` (905), `guide/[stage]/page.tsx` (829). On
  churn the available history is shallow (50 commits) so treat it as directional:
  `GuideBlocks.tsx` ties `globals.css` as most-touched in `src/` (10 each) and the guide
  *area* accounts for 25 file-touches, more than any other. By `fix(...)` scope the leader
  is actually **KiCad** (5) ahead of guide (3) — the guide case rests on size and area
  churn, not defect count. → Split into a per-block-type registry; that is also the seam
  `BlockEditor` needs, so one split pays for both and makes per-block tests possible.
  **Effort: L**, best value-to-risk refactor in the repo.
- **Zero E2E tests, though the infrastructure is already paid for** **[V]**. Playwright is
  installed and CI already boots the app for the diagram gate. Nothing exercises sign-in,
  checkout → webhook → entitlement → access, or the paywall. Coverage is 194 test files
  under `src/lib` versus **8 for 172 `"use client"` files**. **Effort: M.**
- **Lesson content is stored as executable TypeScript** **[V]**.
  `scripts/rewrite-wroom-guide.ts` (2071) and `seed-wroom-guide-content.ts` (1592) are the
  two largest TS files in the repo. Worth being precise, because the obvious reading is
  wrong: these are *not* duplicated application logic — the first imports **nothing** from
  `src/lib` and the second only two `import type`s. They are ~3.6k lines of **lesson content
  as code literals**: eslint-ignored, appliable only by hand-running a script, not
  reviewable as prose, and subject to the one-hour cache wait. → Move lesson bodies to
  content files validated by the existing `contentBlockSchema`, with a thin idempotent
  importer. **Effort: L** — the change that most improves the rate at which correct lessons
  can be produced.

### Accessibility

- **Every icon button is two tab stops, the first a role-less nameless `<span>`** **[V,
  confirmed]** (`src/components/IconButton.tsx:42-58`, and `SaveButton`,
  `MarkBringupCompleteButton`, `ChecklistEditor.tsx:348`). → `tabIndex={disabled ? 0 : -1}`
  on the wrapper. **Effort: S.**
- **109 `<label>` elements neither wrap their control nor carry `htmlFor`** **[R, severity
  adjusted]** across 27 files. The refutation pass established that ~100 of these are
  **admin/bench editors, not learner-facing** — so this is an internal-tooling defect, worth
  fixing mechanically rather than urgently. → Add `eslint-plugin-jsx-a11y` with
  `label-has-associated-control` as a warning to get the true list. **Effort: L.**
- **No `not-found.tsx` anywhere** **[R, severity adjusted]** — 49 `notFound()` calls across
  26 files render Next's default, outside `ChromeLayout` (no header, footer or nav). The
  refutation pass correctly downgraded this: the root layout still runs, so theme tokens and
  backdrop apply, and many call sites are admin routes rather than visitor typos. Still one
  file to fix. **Effort: S.**
- **Three native `<dialog>` modals have no accessible name** **[V, confirmed]** —
  `CreatePartDialog`, `NewChecklistDialog`, `BulkMeasurementsDialog`. `PartGlanceModal`
  already does it right; copy that. **Effort: S.**
- **`ZoomableImage` lightbox never moves focus** **[R, partially corrected]** — the claim
  that Tab escapes into page content behind it was *refuted* (the overlay is the next DOM
  sibling), but focus is genuinely never moved on open or restored on close. **Effort: M.**
- **The media-capture pipeline never writes alt text** **[R, partially corrected]** —
  `BlockEditor`'s `MediaEditor` *does* render a properly associated Alt field, so the gap is
  the capture path specifically, not the editor. **Effort: M.**

---

## P3 — watch

- **Branch sprawl quadrupled** **[V]** — A10 flagged 10 remote branches; there are now
  **41**, nearly all merged, including `fix/proxy-auth-fail-open` (whose merge is what makes
  the CLAUDE.md bullet below stale). → Prune; enable auto-delete-on-merge.
- **`CLAUDE.md`'s proxy bullet is stale** **[V]** — it still says *"the latent fail-open …
  gating on `req.auth?.user` is the fix"*, but that fix shipped. Second stale entry in a file
  explicitly framed as load-bearing facts. Its own header says "verify before relying on
  them", which is an admission these want to be **tests**: a unit test asserting
  `resolveRouteGate` rejects an error-shaped auth object would make the bullet
  self-maintaining.
- **`_template/design.md` never absorbed the ID-namespace convention** friction F6 assigned
  to it **[R]**, so `K#`/`RK#` ids collide across boards.
- **`populate-curriculum-dag.ts` will revert four boards' hand-corrected
  `requiresStripboard` flag** **[R]** — the script's literals contradict the design docs and
  the live DB.
- **The KiCad export ships no `.kicad_dru`** **[R]**, leaving the fab-DRU step a manual
  download-and-rename chore in the guide.
- **`/api/capture` buffers the full body before the size check and returns raw internal
  error text** **[R]**; **`/api/avatar` interpolates its raw path param into an R2 key**
  while its sibling `/api/shot` validates **[R]**. Hygiene, no demonstrable exfiltration.
- **`docs/plans/` has 90 documents and no index** **[V]** (122 md files, 11 MB; 62 added in
  June alone). `CLAUDE.md` cites plans by filename, which only helps if you know they exist.
- **Zero `next/image` usage** **[V]** — 5 raw `<img>`. Low impact now; will grow with
  media-heavy lessons.
- **`scripts/` is typechecked but not linted** **[V]** — `tsconfig.json` includes `**/*.ts`;
  `eslint.config.mjs` ignores `scripts/`. Given `scripts/` now holds the repo's largest
  files, worth revisiting.

---

## The highest-leverage thing on this list

Not a bug: **six of the validation protocol's audits are mechanically checkable, the
verifiers were already written, and every one of them is a throwaway** **[R]** —
`attest-l104-dv.ts`, `attest-l105-dv.ts`, `build-l104-revision-bom.ts`,
`seed-l103-parts.ts` and friends are per-board one-off scripts, several gitignored.

The pattern is already proven board-by-board; what is missing is that it was never
generalized. → One committed, board-parameterized `pnpm board:check <slug>` that reads
`docs/boards/<slug>/design.md` + `bom.csv` + the DB and emits a pass/fail table. It needs
no new infrastructure, converts the honour-system attestations into machine proofs where
they can be, and is the one change that makes the authoring loop scale past a single
author. **Effort: M.**

---

## Suggested order

1. **P0-2** (point the gate at a real path) and **P0-1** (fix the LOCAL/PROD lie) — hours,
   and they are actively misleading every agent run.
2. **P0-4** (error tracking) and **P1-6** (lint in CI) — hours, and they make everything
   after this observable.
3. **P1-1**, **P1-2**, **P1-4** — three small fixes that stop users being shown wrong data.
4. **P0-3** (migration guard), **P1-3** (MCP tests), **P1-5** (timeouts).
5. Then the P2 correctness cluster, then the fonts win, then the structural work
   (`board:check`, the guide split, content-as-data).

---

## Corrections made during this review

Included because the same over-claims are easy to reach from a quick scan, and two of them
were mine.

- A regex first suggested **55 empty `catch` blocks**. The real number is **3**, all
  fire-and-forget analytics in `SignInForms.tsx`. Error handling is not a systemic problem.
- The large seed scripts initially looked like duplicated domain logic. They share **no**
  runtime code with `src/lib`. The real issue is content-as-code, a different problem with a
  different fix.
- Apparent N+1 patterns are almost entirely in test files; the one production instance
  (`src/lib/waitlist-notify.ts:147`) is a cron batch job where per-row iteration is fine.
- An early draft claimed the guide subsystem led recent `fix(...)` commits. It does not —
  KiCad does, 5 to 3.
- **An early draft carried register item A2 forward as an open P1 ("`main` is completely
  unprotected"). It is not — `main` reports `protected: true`.** Taking a stale register at
  face value is precisely the failure mode P1-7 is about, and it happened during this
  review.
- The refutation pass downgraded three a11y findings (the 404, the labels, the lightbox
  focus trap) and corrected one analytics claim (`FeedbackBox` *does* handle returned
  failures). Those corrections are reflected above rather than the original claims.
