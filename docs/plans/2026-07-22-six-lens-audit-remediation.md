# Six-Lens Audit Remediation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remediate the 40 findings from the 2026-07-22 nine-agent audit (learner-UX, architecture, growth, authoring-pipeline, security, failure-mode, telemetry, a11y, perf) in ten independent PR-sized phases.

**Architecture:** Each phase is one branch → one PR → squash-merge (main is PR-only, `guard` + Vercel required). Phases are ordered by urgency (Neon cost first, L1.02 launch blockers second) but are mutually independent unless a dependency is called out. Every fix follows the repo's existing patterns: `use cache` + tag invalidation for reads, server actions with `requireUser`/`requireAdmin`, vitest for logic, hand-authored SQL + `migrate deploy` for schema.

**Tech Stack:** Next.js App Router (Cache Components/PPR), Prisma + Postgres (local dev / Neon prod), Auth.js, Stripe, Resend, PostHog, Upstash, Vitest.

---

## Ground rules for the executor (repo law, do not skip)

- **Branch off `main`. Never merge without Josh's explicit go-ahead** ([[no-auto-merge-batch-commits]]). Batch review fixes as commits on the open PR.
- `pnpm` runs via **PowerShell**, not Bash. Dev server: `Start-Process -WindowStyle Hidden` if needed detached.
- **Schema changes:** hand-author SQL, `pnpm db:migrate` (LOCAL) first, full `pnpm tsc --noEmit` + full `pnpm test` after (enum-mirror maps break silently). Prod migration is **Josh's to run** (I cannot write prod): hand him `$env:DATABASE_URL=$PROD_DATABASE_URL; $env:DIRECT_URL=$PROD_DIRECT_URL; pnpm db:migrate:prod` and stop.
- **Caching laws** (`src/lib/cache-profile.ts`, `cache-invalidate.ts`): bound every cached fn taking a route param against a known-slug set; never add a `cacheTag` without an invalidator; `updateTag`, NOT `revalidateTag`; a prerendered shell cannot read session/DB; vitest cannot catch cache bugs — verify with a real `next build`.
- **UI copy:** no em-dashes in rendered glyphs. Token-only color. Verify both themes.
- **Line numbers in this plan are audit evidence from 2026-07-22.** Always Read the cited file before editing; re-locate the code if lines have drifted.
- After each phase: `pnpm tsc --noEmit` + `pnpm test` green before opening the PR.

---

# PHASE 1 — Neon cost: cache the crawled guide surface (PR `perf/guide-read-cache`)

**Why first:** sitemapped guide URLs (9/project) are fully dynamic and DB-backed; crawler traffic defeats Neon scale-to-zero. Estimated ~182 CU-h/mo vs the 100 CU-h free budget. This is live money.

### Task 1.1: Session id on the JWT (kills a query on ~every authed request)

**Files:**
- Modify: `src/auth.ts` (session callback, ~:265-270)
- Test: `src/auth.callbacks.test.ts` (create if absent; follow the existing auth test file's mocking pattern — Grep `session` in `src/*.test.ts` first)

**Step 1:** Read `src/auth.ts` session + jwt callbacks. Write a failing unit test: the session callback output has `session.user.id === token.sub`.
**Step 2:** Run it, confirm FAIL.
**Step 3:** In the session callback, add `if (session.user && token.sub) session.user.id = token.sub;` beside the existing `role` copy. Extend the `next-auth` module augmentation (Grep `declare module "next-auth"`) so `user.id: string` types cleanly.
**Step 4:** Test passes. `pnpm tsc --noEmit` clean.
**Step 5:** Commit `perf(auth): expose user id on the session JWT`.

### Task 1.2: Consume the session id where only the id is needed

**Files:**
- Modify: `src/lib/actions/logbook.ts` (`currentUserId`, ~:37), `src/app/(chrome)/review/page.tsx:33`, `src/app/(chrome)/logbook/page.tsx:45`, `src/app/(chrome)/account/page.tsx:27` (Grep `findUnique({ where: { email` for the full 11-file list; convert the ones that only need `id`)

**Step 1:** For each site: replace the `db.user.findUnique({ where: { email } })` id-lookup with `session.user.id`. Keep the email lookup where the code needs other columns not on the token.
**Step 2:** `pnpm test` (logbook + review action tests must stay green).
**Step 3:** Commit `perf: use session user id instead of per-request email lookup`.

### Task 1.3: Cache the user-independent guide-card read

**Files:**
- Create: `src/lib/guide/cached-guide-read.ts`
- Modify: `src/app/(chrome)/projects/[slug]/[revLabel]/guide/[stage]/page.tsx` (body ~:207-381 + `generateMetadata` ~:117-129), `src/app/(chrome)/projects/[slug]/[revLabel]/guide/page.tsx`
- Modify: `src/lib/cache-invalidate.ts` (document the tag reuse)

**Step 1:** Read both guide pages end to end, plus `src/lib/skill-tree.ts:40-60` (the shipped `use cache` pattern) and `src/lib/cache-profile.ts`.
**Step 2:** Build `cachedGuideCard(slug, revLabel, stage)` and `cachedGuideHub(slug, revLabel)` in the new module:
- `"use cache"` + `cacheLife(ONE_HOUR)` + `cacheTag(TAG_PROJECTS)` (already invalidated by `invalidateProjectGraph`; add per-project tag only if a bounded helper already exists).
- **Bound the key:** first line resolves `slug` against the already-cached known-project-slug set (Grep `knownProjectSlugs`); return null for garbage so crawlers can't mint entries.
- Contents: project row (public columns), published revision, guide card row(s), parsed blocks, BOM/diagram data — everything the anonymous render needs. NO session, NO entitlement, NO enrollment.
**Step 3:** Rewire `generateMetadata` and the page body to share these calls (this also collapses the duplicate project x2 / card x3 queries). Keep auth/entitlement/paywall/learner overlay exactly where it is, reading on top of the cached data.
**Step 4:** Wrap the remaining per-request project/card reads that must stay dynamic in React `cache()` so metadata + body dedupe.
**Step 5:** `pnpm build` MUST be the verification (vitest cannot see cache bugs). Then run the prod build locally (`AUTH_TRUST_HOST=1`, port 3100) with the Prisma query log: anonymous hit of a guide stage should show ~0 queries on the second request; signed-in learner path unchanged. Use `/sitemap-images.xml` as the uncached control (known 5 q/render).
**Step 6:** Verify paywall: a signed-out request for a PREMIUM stage still gets the wall, not content (the wall check must run in the dynamic overlay BEFORE rendering cached content).
**Step 7:** Commit `perf(guide): cache the anonymous guide read path (crawler wake fix)`.

### Task 1.4: Riders (each its own commit)

1. **Lazy PostHog + autocapture off** — `src/components/PostHogProvider.tsx`: move to `const posthog = (await import("posthog-js")).default` inside the init effect; add `autocapture: false` to init (explicit events already cover the funnel). Verify: `pnpm build` and check first-load JS of `/library` drops (~55 KB). Commit `perf: lazy-load posthog-js and disable autocapture`.
2. **KaTeX CSS out of root layout** — `src/app/layout.tsx:4` import moves to the guide/library segment layout that renders math (find the nearest shared layout above GuideBlocks usage). Verify a guide page still renders math styled; `/account` no longer ships katex css. Commit `perf: scope katex css to math-rendering routes`.
3. **/learn query dedup** — `src/app/(chrome)/learn/page.tsx:29,46,53-55`: select `project.id` in the first enrollment query, derive `enrolledProjectIds` from it, pass loaded enrollments into `learnerBoardAvailability` instead of its own re-query. Run existing /learn tests. Commit `perf(learn): drop duplicate enrollment and project scans`.

---

# PHASE 2 — L1.02 launch unblockers (PR `feat/second-course-publishability`)

**Why:** three hard blockers + two silent-corruption traps stand between "guide authored" and "L1.02 live". Authoring is THE gating business thread.

### Task 2.1: Quiz-less stage must not strand the learner (round-1 finding)

**Files:**
- Modify: `src/lib/gate-spec.ts:55-57`, `src/lib/learner-gates.ts:48-50`
- Test: `src/lib/learner-gates.test.ts` (or gate-spec test file — Grep first)

**Step 1:** Failing test: a stage whose card has no quiz block → `learnerExitGate` does NOT block on quiz.
**Step 2:** Thread a `cardHasQuiz: boolean` into the gate evaluation (the UI already computes it — Grep `cardHasQuiz` in `LearnerGate.tsx`); treat quiz-required as `spec.quiz && cardHasQuiz`.
**Step 3:** Tests pass, including existing gate tests (L1.01 behavior unchanged: every card has a quiz).
**Step 4:** Commit `fix(gates): quiz gate auto-satisfies when a card ships without a quiz`.

### Task 2.2: Per-course artifact gates (non-fab boards)

**Files:**
- Modify: `src/lib/gate-spec.ts:39-57` (signature), `src/lib/learner-gates.ts:29-37`, callers (Grep `gateSpec(`)
- Test: same files' tests

**Step 1:** Failing test: a project with `requiresStripboard` (or a new `hasFab: false` derivation — read how `requiresStripboard` flows through `compose.ts` first and reuse it, YAGNI on new columns) → `gateSpec` returns `artifact: null` for SCHEMATIC/DRC_GERBER.
**Step 2:** Change `gateSpec(stage)` → `gateSpec(stage, projectFlags)`; ERC/DRC artifact requirements apply only to fab boards.
**Step 3:** All existing gate + learner-gate tests green (L1.01 = fab, unchanged).
**Step 4:** Commit `feat(gates): artifact gates keyed to the project's fab profile`.

### Task 2.3: Publish button (the missing go-live lever)

**Files:**
- Modify: `src/app/(chrome)/projects/[slug]/[revLabel]/guide/page.tsx` (beside `<ReadinessPanel>` ~:726)
- Create: `src/components/admin/PublishRevisionButton.tsx` (client, calls the existing `setPublishedRevision` server action `src/lib/actions/projects.ts:108`)
- Test: extend `src/lib/actions/projects.test.ts` if the action lacks a "publishes + readiness-gate refuses" case (it has a test — read it first)

**Step 1:** Read `setPublishedRevision` fully: it already enforces the readiness bar and calls `invalidateProjectGraph()` — the button is a thin trigger, admin-gated by the action itself (`requireAdmin` — verify, add if absent WITH a failing test first).
**Step 2:** Build the button: confirm dialog ("Publish {label}? Opens enrollment + goes in the sitemap."), pending state, renders the action's error message on refusal (readiness failures are the UX).
**Step 3:** Manual verify on local dev: publish a draft revision of a seeded project; /courses reflects it without waiting an hour (tag bust fired).
**Step 4:** Commit `feat(admin): publish-revision button on the guide hub`.

### Task 2.4: Readiness must use the per-block parser

**Files:**
- Modify: `src/lib/lesson-readiness.ts`, `src/lib/actions/projects.ts:77` (and guide hub `:678` + `complete/page.tsx:120` — Grep `guideContentBlocksSchema.safeParse` and migrate every all-or-nothing call on the readiness path)
- Modify: `src/components/admin/ReadinessPanel` (surface dropped-block counts — locate via Grep `ReadinessPanel`)
- Test: `src/lib/lesson-readiness.test.ts`

**Step 1:** Failing test: a card whose `contentBlocks` holds 5 good blocks + 1 malformed → readiness sees the 5 (not 0) AND reports `droppedBlocks: 1` as a publishable-tier failure.
**Step 2:** Swap `guideContentBlocksSchema.safeParse(...).data ?? []` for `parseGuideBlocks` (`src/lib/guide-blocks-parse.ts:39`) on the readiness/publish path; add a `malformedBlocks` check to the publishable tier.
**Step 3:** ReadinessPanel renders the new failure line ("STAGE: N malformed blocks").
**Step 4:** Tests green. Commit `fix(readiness): per-block parse with malformed-block publish gate`.

### Task 2.5: Stackup override forced at publish

**Files:**
- Modify: `src/lib/kicad/project.ts:111-123`
- Test: `src/lib/kicad/project.test.ts` (create if absent)

**Step 1:** Failing test: `boardConfigFor(slug)` for a slug not in `BOARD_CONFIG_OVERRIDES` throws (or returns a tagged default the readiness check rejects) when the project is published.
**Step 2:** Minimal: export the override map's keys; add a publishable-tier readiness check "project has an explicit board config entry" (reuses Task 2.4's plumbing). This forces the 2-vs-4-layer decision at publish time instead of silently exporting 2-layer.
**Step 3:** Add the L1.01 test fixture case. Commit `fix(kicad): explicit board config required to publish`.

### Task 2.6: Generic exam seeding

**Files:**
- Create: `scripts/seed-exam.ts` (generalizes `scripts/seed-l101-exam.ts`; takes `<slug> <bank.json>` args, validates ≥10 questions, correctIndex in range, section labels, refuses non-local DB unless run through `pnpm db:prod`)
- Create: `docs/boards/_exam-bank-template.json` (shape doc: 18 questions, options, correctIndex, section)

**Step 1:** Read `scripts/seed-l101-exam.ts` + `prisma/seed.ts:444` for the exact upsert shape.
**Step 2:** Write the script; idempotent upsert on `projectId`; print a summary table; hard-fail on validation.
**Step 3:** Verify locally: seed a dummy bank onto a local test project, run readiness, see the exam check pass.
**Step 4:** Commit `feat(scripts): generic per-course exam seeder + bank template`. (Full admin exam editor: deferred, YAGNI until course 3.)

### Task 2.7: getExam entitlement gate (security MEDIUM)

**Files:**
- Modify: `src/lib/actions/exam.ts:44-64`
- Test: `src/lib/actions/exam.test.ts`

**Step 1:** Failing test: signed-in user with no enrollment/entitlement on a PREMIUM project → `getExam` returns null; entitled user still gets the stripped bank.
**Step 2:** After `requireUser()`, resolve the project's access tier; for premium, require `hasProjectEntitlement(db, user.id, projectId)` OR an existing enrollment (mirror the guide page's check at `guide/[stage]/page.tsx:264`).
**Step 3:** Tests green (answer-key stripping test still passes). Commit `fix(exam): entitlement gate on premium exam banks`.

---

# PHASE 3 — Email correctness before any campaign (PR `fix/lifecycle-email-reliability`)

### Task 3.1: Lifecycle send-then-claim

**Files:**
- Modify: `src/lib/lifecycle-send.ts:43-85`
- Test: `src/lib/lifecycle-send.test.ts`

**Step 1:** Read the module + its test. Failing test: Resend responds non-OK → NO `LifecycleSend` claim row remains → the same user is retried next tick. Second failing test: duplicate-send protection still holds (claim exists → skip).
**Step 2:** Invert: attempt the send first; write the claim row only after a 2xx. Accept the crash window (sent-but-unclaimed → at most one duplicate email); document that trade in a comment. Alternative if the test reveals races: keep claim-first but DELETE the claim in the `!res.ok` branch.
**Step 3:** Surface failures: the cron route (`src/app/api/cron/lifecycle/route.ts:196-203`) already collects `errors[]`; add a server `capture("lifecycle_send_failed", …)` per error so it lands in PostHog rather than an unread JSON body.
**Step 4:** Tests green. Commit `fix(lifecycle): failed sends retry instead of burning the once-only claim`.

### Task 3.2: Dunning email survives the webhook claim

**Files:**
- Modify: `src/app/api/stripe/webhook/route.ts:491-517`, `src/lib/subscription-dunning.ts:39-53`
- Test: webhook route test (Grep `payment_failed` in tests)

**Step 1:** Read the handler + `claimAndWrite`. Failing test: `invoice.payment_failed` where the send throws → a durable record exists that the send is still owed (e.g. a `dunningEmailPending` marker written in the claim txn, cleared on send success), and the next lifecycle cron tick retries it.
**Step 2:** Implement the pending-marker (a nullable timestamp column on Subscription is the cheapest durable slot — that is a LOCAL migration first; if avoiding schema this sprint, reuse the `LifecycleSend` ledger with a `payment_failed:<invoiceId>` key and let Task 3.1's retry semantics carry it).
**Step 3:** `capture("dunning_send_failed")` in the catch. Tests green. Commit `fix(dunning): payment-failed email is durable against send failure`.

### Task 3.3: Money-email CTAs

**Files:**
- Modify: `src/app/api/cron/lifecycle/route.ts:62-67`, `src/lib/lifecycle-emails.ts:272-332`

**Step 1:** `passUrl`/`upgradeUrl` → `${base}/pricing`. `l101Url` → resolve from the entry project's `publishedRevision.label` (one query in `contextFor`), never the literal `v1`.
**Step 2:** Remove hardcoded "$299" from email copy: either interpolate the current catalog price into the template context or reword to price-free copy ("See current pricing"). Price-free is safer (emails outlive price changes) — prefer it.
**Step 3:** Snapshot/unit tests for the builders updated. Commit `fix(lifecycle): emails point at the buy surface and drop hardcoded price/label`.

### Task 3.4: Waitlist launch-notify sequence

**Files:**
- Modify: `src/lib/lifecycle-triggers.ts`, `src/lib/lifecycle-emails.ts`, `src/app/api/cron/lifecycle/route.ts:127-139`
- Test: `src/lib/lifecycle-triggers.test.ts`

**Step 1:** Read how `LifecycleSend` keys sends (likely userId) — anonymous waitlist rows have none. Design note: key this sequence's ledger entries by EMAIL (`waitlist-launch:<email>`), consent basis = the waitlist opt-in itself.
**Step 2:** Failing test: a `waitlistSignup` row for course X + course X now published → audience includes that email exactly once; already-sent → excluded.
**Step 3:** New trigger `waitlistLaunchAudience()`: waitlist rows whose course has a `publishedRevisionId`, minus sent ledger. New email template (plain, house voice, unsubscribe line). Wire into the cron's sequence list.
**Step 4:** Tests green. Commit `feat(lifecycle): waitlist launch notification honors the "we'll email you" promise`.

### Task 3.5: PostHog identity stitching

**Files:**
- Modify: `src/components/PostHogProvider.tsx` (or a tiny new client component mounted in the chrome layout with the server-provided user id)

**Step 1:** Read how the provider mounts and whether a session hook is available client-side. Pass `userId` (or null) down from the chrome layout server component.
**Step 2:** In an effect: `if (userId && posthog.get_distinct_id() !== userId) posthog.identify(userId);` and on transition to signed-out, `posthog.reset()`.
**Step 3:** Manual verify (local, PostHog debug): anon pageview → sign in → events merge onto the user id.
**Step 4:** Commit `fix(analytics): identify/reset so the funnel stitches anon to user`.

### Task 3.6: Server-event distinct_id + PII strip

**Files:**
- Modify: `src/lib/analytics.ts:57-65`, `src/auth.ts:281-283`, `src/lib/actions/waitlist.ts:69`, `src/lib/actions/pass-waitlist.ts:44`

**Step 1:** Replace the `"anonymous-server"` constant with a per-event `crypto.randomUUID()` fallback (unique persons, no artificial mega-user). Drop raw `email` from all event props (the DB keeps the address; analytics does not need it). Where dedup matters, send a salted hash.
**Step 2:** `pnpm test`; Grep `email` in analytics call sites to confirm none remain in props.
**Step 3:** Commit `fix(analytics): unique anonymous distinct ids + strip email PII from event props`.

---

# PHASE 4 — Review-deck ignition + funnel last-mile (PR `feat/retention-funnel-wiring`)

### Task 4.1: Review discoverability

**Files:**
- Modify: `src/components/UserMenu.tsx:183-202` (add "Review" item with due-count badge), `src/app/(chrome)/logbook/page.tsx` (nudge stays), `src/app/(chrome)/review/page.tsx:76-81` + `src/components/review/ReviewDeck.tsx:42-47` (exits → `/logbook`, not `/courses`)

**Step 1:** `dueReviewCount` already exists (`src/lib/logbook/review-load.ts`) — surface it in UserMenu (server-fetched, zero renders as no badge).
**Step 2:** Both deck exits → `/logbook`. Empty-state copy explains HOW items arrive ("miss a quiz question once and it comes back here").
**Step 3:** Commit `feat(review): nav entry with due badge + exits return to the logbook`.

### Task 4.2: Miss-moment feedback

**Files:**
- Modify: `src/components/guide/QuizBlock.tsx:327-342`
- Test: QuizBlock test (Grep existing)

**Step 1:** On first wrong pick of a review-eligible question, render one quiet line under the verdict: `Saved to your review deck` linking `/review`. Token colors, both themes, no em-dash.
**Step 2:** Commit `feat(quiz): tell the learner a missed question was banked for review`.

### Task 4.3: Review-due lifecycle nudge

**Files:**
- Modify: `src/lib/lifecycle-triggers.ts`, `src/lib/lifecycle-emails.ts`, cron route

**Step 1:** Depends on Phase 3 landing first (send-then-claim). New audience: users with `dueReviewCount >= 3` and no review-nudge send in 7 days (weekly cap, not daily — respect inboxes). Failing test first.
**Step 2:** Template: "N cards are due" + `/review` link. Wire sequence. Commit `feat(lifecycle): weekly review-due nudge`.

### Task 4.4: Funnel last-mile links (one commit each)

1. **/welcome CTA** → `/learn/l1-01-wroom-breakout` (has EnrollButton) — `src/app/(chrome)/welcome/page.tsx:18,63-68`. Also default `onboardingGoal` for the welcome path (or render the one-question survey inline) so Library personalization converges.
2. **Enroll CTA on the guide hub** for signed-in non-enrolled — reuse `EnrollButton` (`src/app/(chrome)/learn/[slug]/page.tsx:231` shows the wiring).
3. **Guide quiz sign-in nudge for anon:** build the signed-out `logbook` prop on the guide card page (mirror `library/[slug]/page.tsx:170-176`) so QuizBlock renders "Sign in to log XP".
4. **Tool pages:** add a "Used in these builds" section on `tools/[slug]` from a reverse `relatedCourses` lookup + a Library cross-link; add L1.02 to `relatedCourses` arrays when it publishes.
5. **Field-guide capture on lesson pages:** render the cluster's `FieldGuideDownload` on `library/[slug]/page.tsx` (lesson already knows its cluster).
6. **Completion-page upsell:** "Go further" block on `learn/[slug]/complete/page.tsx` linking `/pricing` (pre-launch: `PassWaitlistForm`).
7. **Pricing telemetry:** call `trackPricingViewed()` from a mount effect on `/pricing`; `trackCtaClicked` in `PassButtons.tsx` handlers.
8. **Pricing FAQPage JSON-LD:** copy the `faqLd` pattern from `courses/[slug]/page.tsx:249-263`.

Verify each in the browser (both themes). Batch commits on the PR.

---

# PHASE 5 — Billing numbers Josh reads (PR `fix/billing-reporting-truth`)

### Task 5.1: `livemode` column

**Files:**
- Migration: `prisma/migrations/<ts>_billing_livemode/migration.sql` (hand-authored: `ALTER TABLE "Purchase" ADD COLUMN "livemode" BOOLEAN NOT NULL DEFAULT true;` same for Subscription, Invoice; default true = existing rows were live)
- Modify: `prisma/schema.prisma`, `src/app/api/stripe/webhook/route.ts` (stamp `event.livemode` on every write)
- Test: webhook tests assert livemode persisted

**Step 1:** Failing test → migration LOCAL (`pnpm db:migrate`) → `prisma generate` → restart dev → implement → full `tsc` + full `vitest` (schema-change law).
**Step 2:** Hand Josh the prod-migration command (permission wall). PR notes must flag: prod migration required before merge deploy.
**Step 3:** Commit `feat(billing): persist stripe livemode on purchase/subscription/invoice`.

### Task 5.2: Reporting correctness

**Files:**
- Modify: `src/lib/billing-metrics.ts` (+ its page `src/app/(chrome)/admin/billing/page.tsx`)
- Test: `src/lib/billing-metrics.test.ts`

Failing tests first, then:
1. Filter every metric to `livemode = true`.
2. Group revenue sums by `currency`; render per-currency lines (no FX conversion — YAGNI until a second currency actually appears; the grouping makes it visible instead of silently wrong).
3. MRR from each subscription's actual stored price + interval (annual ÷ 12), not the current catalog price.
4. Refund/dispute denominators: payments-inclusive (purchases + paid invoices).

Commit `fix(billing): live-mode, per-currency, subscriber-priced reporting`.

### Task 5.3: XP ledger reconciliation guard

**Files:**
- Modify: `src/lib/actions/admin-logbook.ts:138-153` (`adminSetLevel` writes an AdminAudit row + an adjusting marker), Create: `scripts/reconcile-xp.ts` (report-only: users where `xpTotal != SUM(XpEvent)`)

Commit `fix(xp): auditable level overrides + reconciliation script`.

---

# PHASE 6 — Observability floor (PR `feat/error-observability`)

### Task 6.1: Error boundaries

**Files:**
- Create: `src/app/global-error.tsx`, `src/app/(chrome)/error.tsx`

Branded fallback (tokens, both themes): "Something failed on our side. Retry?" + reset button. No DB/session reads (must render when everything is down). Verify by throwing in a dev page. Commit `feat(errors): branded error boundaries`.

### Task 6.2: Critical catches → telemetry

**Files:**
- Modify: the worst console-only sites: `src/app/api/stripe/webhook/route.ts:222-224,257-259` (paid session, null amount, grant without Purchase row — this one also gets an admin email via the existing `alertAbuse`-style path, it is a revenue-audit hole), `src/lib/subscription-dunning.ts:46,49`, `src/lib/abuse-limit.ts:154,164`, `src/lib/logbook/guide-awards.ts:220` + `lesson-awards.ts:80`, `scripts`-adjacent cron `refresh-availability.ts:138-142`

Pattern: keep the console line, add `capture("server_error", { site, detail })`. Sentry itself: propose to Josh as a follow-up decision (new vendor + env), not in this PR. Commit `feat(errors): critical catch blocks emit telemetry`.

### Task 6.3: Small hardening riders

1. Timing-safe CRON_SECRET compare (both cron routes) — copy the `timingSafeEqual` shape from `src/lib/certificate-token.ts:40`.
2. `joinPassWaitlist` gets the same `ipCheckFor` guard as `joinWaitlist` (`src/lib/actions/waitlist.ts:31-36`).
3. `pageRef` validated against known routes before feedback XP (`src/lib/actions/feedback.ts:32-35`).
4. DigiKey fetches get 5s AbortControllers (`src/lib/digikey.ts` x3) — copy `turnstile.ts:45-46`; timeout counts as `failed`.
5. `ReviewDeck` payload drops `answerDisplay` (server already returns correctness — `review/page.tsx:51`, `ReviewDeck.tsx:23,54`).

Failing test where logic changes (2,3,5); commit separately.

---

# PHASE 7 — A11y bundle (PR `fix/a11y-assessment-loop`)

### Task 7.1: One-attribute blocker
`src/components/XpTick.tsx:28-33`: remove `aria-hidden` from the persistent marker span so the `role="status"` region announces. Commit immediately.

### Task 7.2: Assessment verdicts + focus
- `QuizBlock.tsx:306-341` + `ReviewDeck.tsx:108-127`: wrap verdict lines in `role="status"`; stop disabling the focused button (use `aria-disabled` + click guard) or move focus to the verdict/Next control on grade.
- `ReviewDeck.tsx:72-77`: `next()` moves focus to the new card's heading.

### Task 7.3: gray-3 demotion sweep
Promote meaning-bearing/interactive `text-gray-3` to `text-muted`: `QuizBlock.tsx:355`, `SignInForms.tsx:74,265,314`, `KitBlock.tsx:128`, `IslandRail.tsx:31,291`, `globals.css:368,375` (`.pc-num`/`.pc-abbr`), calculator hints, library eyebrow, placeholders. Verify both themes visually. (Darkening the token itself: Josh design decision, offer but don't do.)

### Task 7.4: Remaining mediums
- `ModelViewer.tsx:166`: gate auto-spin on `matchMedia("(prefers-reduced-motion: reduce)")`; add `role="img"` + `aria-label={partName}` on the mount div.
- Focus rings: `IslandRail.tsx:260,303` outline replacement (2px `--color-gold-light`); add `.qzh-opt:focus-visible` rule in globals.css.
- `Fanfare.tsx:69-70`: pause on `focus-within` as well as hover.
- `CaptureLauncher.tsx:145,157`: `text-red-400` → token; status line gets `role="status"`.
- `globals.css:556`: `.qzh-opt[data-st="bad"]` hardcoded `#7a4a48` → token with a light override, ≥4.5:1.
- `role="group"` + label on `.qzh-opts` (QuizBlock, GoalSurvey); `role="alert"` on GoalSurvey error span; drop the duplicate label on `#si-email`; `aria-label` on desktop rail buttons.

Batch commits; verify with keyboard + a screen reader pass (Narrator is on the machine).

---

# PHASE 8 — Architecture riders (PR `refactor/review-quiz-consolidation`)

1. **QuizItem create-only:** `src/lib/logbook/review-seed.ts:27-31` upsert `update: {}`; content propagation moves to the authoring save path. Failing test: second answer does not rewrite the row.
2. **Single quiz loader:** extract `loadStageQuiz(enrollmentId, stage)` consumed by BOTH `src/lib/actions/quiz.ts:42-58` and `src/lib/logbook/guide-awards.ts:152-177`. Tests assert both paths see identical questions/keys.
3. **Atomic review advance + award:** fold `reviewSchedule.updateMany` + XP insert + user increment into one transaction wrapped in `withTxRetry` (`guide-awards.ts:309-334`, `award.ts:30`).
4. **seedReviewItem:** wrap both upserts in one `$transaction`; failures → `capture()`, not console (`review-seed.ts:27-43`).
5. **Revision-independent untagged review keys:** key on `project:stage:idOrHash` without revLabel (`question-key.ts:19-25`); write the backfill note; schedule `scripts/prune-review-items.ts` in `vercel.json` crons.
6. **Stage enum sync:** test asserting `STAGE_VALUES` ≡ `Object.values(Stage)`; type `STAGE_CLEAR_XP_BY_STAGE` as `Record<Stage, number>` (drop the silent `?? 20`).
7. **XpEvent index:** LOCAL migration `@@index([userId, source, refId])` → hand Josh prod command.
8. **DB test coverage:** recordReviewAnswer race (two concurrent answers → one award), wrong-answer step-down, leech suspension.

---

# PHASE 9 — Media/egress riders (PR `perf/r2-direct-serve`) — needs Josh input

R2 public custom domain is an infra decision (DNS + R2 settings). Propose; if approved:
- Serve `/api/shot`, `/api/part-model`, `/api/avatar` assets from the R2 domain; keep the routes as fallbacks.
- Minimum-without-DNS: avatar route `Cache-Control` → `immutable` (the `?v` buster already handles change) and drop its per-request `db.user.findUnique`.
- Author-hub query collapse (220-query render): load gate context ONCE per revision, evaluate all 8 stages in memory (`guide-completion.ts` + `guide-progress.ts:46-57`).

---

# PHASE 10 — Consent/compliance (PR `feat/analytics-consent`) — needs Josh decision

Blocked on the CMP/affiliate legal thread (already an open owner item). When Josh picks a consent mechanism:
- Gate `posthog.init` behind the consent signal; default opted-out for EU (geo via existing Vercel headers).
- Until then, Phase 3 Task 3.6 (PII strip) is the shippable part — already done there.
- Root redirect: `redirect()` → `permanentRedirect()` in `src/app/(chrome)/page.tsx:154-156` (tiny SEO rider, can land in any phase).

---

## Execution order + dependency graph

```
Phase 1 (Neon cost)          — independent, FIRST
Phase 2 (L1.02 blockers)     — independent
Phase 3 (email correctness)  — independent; Phase 4.3 depends on it
Phase 4 (retention/funnel)   — 4.3 after Phase 3; rest independent
Phase 5 (billing truth)      — prod migration = Josh
Phase 6 (observability)      — independent
Phase 7 (a11y)               — independent
Phase 8 (arch riders)        — prod migration (index) = Josh
Phase 9 (R2)                 — Josh infra decision
Phase 10 (consent)           — Josh legal decision
```

Every phase: `pnpm tsc --noEmit` + `pnpm test` green, PR opened, **stop and wait for Josh** before merge ([[no-auto-merge-batch-commits]], [[no-merge-verify-local-first]]).
