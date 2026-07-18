# Course XP: graduated stage awards, mini-quizzes, and an admin learner-preview

**Status:** DRAFT handoff for development. Not started. No code changes yet.
**Author context:** written 2026-07-18 from a live trace of the Logbook XP system.
**Branch note:** author-side scratch/analysis lives on `docs/caching-system`; the
implementation should branch off `main` per repo convention.

## Why

Three findings from tracing the course (build-guide) XP path end to end:

1. **Admins never see course quiz XP — by design, and it reads as "broken."**
   `guideCardView("ADMIN")` returns the **author view**
   (`isLearnerView: false`, [`src/lib/guide-view.ts:19`](../../src/lib/guide-view.ts)).
   Course quiz XP (`courseLogbook`) is built **only** when `learnerQuizContext`
   exists, which requires `view.isLearnerView` **and** an enrollment
   ([`guide/[stage]/page.tsx:610,684`](../../src/app/(chrome)/projects/[slug]/[revLabel]/guide/[stage]/page.tsx)).
   So a signed-in admin gets **no `logbook` prop** on `QuizBlock`, and
   `fireAnswer` early-returns ([`QuizBlock.tsx:159`](../../src/components/guide/QuizBlock.tsx)).
   The engine is correct; the owner simply can't observe it as themselves. WI-3
   fixes observability.

2. **The per-stage award is flat.** Clearing any stage pays a single
   `STAGE_CLEAR_XP = 20` ([`economy.ts:20`](../../src/lib/logbook/economy.ts)),
   fired on advance ([`enrollment.ts:259-277`](../../src/lib/actions/enrollment.ts)).
   Reading REQUIREMENTS and clicking advance pays the same as a DRC-clean layout.
   WI-1 graduates it by effort.

3. **Mini-quizzes are half-supported.** Per-question XP already works across
   *any* number of quiz blocks in a card (`quizQuestions` flattens all quiz
   blocks, [`lesson-content.ts:17`](../../src/lib/logbook/lesson-content.ts)), so
   section mini-quizzes would award correctly today. But the **stage gate**
   (`recordQuizPass`) scores against the **first** quiz block only
   ([`quiz.ts:70`](../../src/lib/actions/quiz.ts)). Add mid-lesson mini-quizzes and
   the first one silently becomes the gate. WI-2 decouples the gate.

## Shared map (read before touching anything)

| Concern | File |
| --- | --- |
| XP amounts / curve / dedupe keys (the one tunable module) | `src/lib/logbook/economy.ts` |
| The single XP write path (idempotent on dedupeKey; `XpSource` is a **Prisma enum**) | `src/lib/logbook/award.ts` |
| Course award fns (`recordStageClear`, `recordStageQuizAnswer`, `recordCourseExamPass/Complete`) | `src/lib/logbook/guide-awards.ts` |
| STAGE_CLEAR hook (on advance) | `src/lib/actions/enrollment.ts:259` |
| Stage-gate quiz pass (server re-scores) | `src/lib/actions/quiz.ts` |
| Per-pick quiz award | `src/lib/logbook/guide-awards.ts:99` (`recordStageQuizAnswer`) |
| Quiz block render + XP wiring | `src/components/guide/QuizBlock.tsx`, dispatch in `src/components/guide/GuideBlocks.tsx:1227` |
| Course logbook + learner context builder | `src/app/(chrome)/projects/[slug]/[revLabel]/guide/[stage]/page.tsx:543,610,684` |
| Author-vs-learner view | `src/lib/guide-view.ts` |
| Award side effects (PostHog + milestone email) | `src/lib/logbook/after-award.ts` |
| Enums (`XpSource`, `Stage`, `ArtifactSubkind`) | `prisma/schema.prisma:18,514,555` |
| Quiz content-block schema | `src/lib/schemas/guide.ts:153` |

Current earn-able XP per course: per-question quiz (5 first / 2 repop, daily,
anti-farm locked) + `STAGE_CLEAR` 20/stage + `COURSE_EXAM_PASS` 150 +
`COURSE_COMPLETE` 300.

---

## WI-1 — Graduated stage awards

**Goal:** the harder, verifiable stages pay more than the read stages. The exit
gate for design stages already *requires* the proof artifact (ERC=0, DRC=0,
attestation) to advance, so a graduated `STAGE_CLEAR` already ties bigger XP to
producing verified work. Ship that first; a proof-tied variant is an optional
Phase 2.

### Phase 1 — graduate `STAGE_CLEAR` by from-stage (no migration)

Cheapest high-value change. No schema, no new `XpSource`.

1. **`economy.ts`** — replace the scalar with a per-stage table + accessor:
   ```ts
   export const STAGE_CLEAR_XP_BY_STAGE: Record<string, number> = {
     REQUIREMENTS: 10,
     BOM_SOURCING: 15,
     SCHEMATIC: 40,   // ERC=0 gate
     LAYOUT: 60,      // DRC=0 + attestation — hardest
     DRC_GERBER: 25,
     ORDERING: 30,    // the leap to physical
     ASSEMBLY: 40,
     BRINGUP: 60,     // "it works" payoff
   };
   export const stageClearXp = (stage: string) =>
     STAGE_CLEAR_XP_BY_STAGE[stage] ?? 20; // 20 = legacy fallback
   ```
   Keep the old `STAGE_CLEAR_XP` export as a deprecated alias (= 20) until every
   reference is migrated, or delete it and fix the two call sites.
2. **`guide-awards.ts` `recordStageClear`** — amount comes from `stageClearXp(stage)`
   instead of the constant. Return the amount (or have the caller read it) so the
   hook can surface the right number.
3. **`enrollment.ts:261-273`** — the `afterAward` call currently hardcodes
   `xp: STAGE_CLEAR_XP`. Change it to the awarded amount
   (`stageClearXp(outcome.fromStage)`, or thread it back from `recordStageClear`).
   **This is a real bug magnet:** if `recordStageClear` graduates but the hook
   still passes the flat 20 to `afterAward`, the PostHog `xp_earned` amount and any
   toast will disagree with the ledger. Change both together.
4. **Fanfare/toast** — the advance flow should surface the stage-clear XP the same
   way library awards do (verify whether a toast currently fires on STAGE_CLEAR;
   if not, wire `fanfare({ kind: "xp", ... })` on the client after a successful
   advance). Owner wants the award visible, not just ledgered.

**Tests:** extend `guide-awards.test.ts` (`recordStageClear`) to assert the
per-stage amount and idempotency per stage. Add a case that a stage absent from
the table falls back to 20.

**Ladder note:** graduated totals rise from 160 → ~280 stage-clear XP per course.
The FL ladder (`LEVELS`, FL2=50 … FL12=7000) is tunable in the same module; a
quick rebalance pass is worth doing once amounts settle so a single course doesn't
over- or under-shoot the intended rank progression.

### Phase 2 (optional) — proof-tied milestone awards

Only if XP should land **at proof submission** (before advancing) or reward the
*verified result* distinctly from *advancing*. Higher cost:

- New `XpSource` enum values (e.g. `ERC_CLEAN`, `DRC_CLEAN`, `BRINGUP_DONE`) →
  **Prisma enum migration** (hand-authored, `migrate deploy`; see CLAUDE.md — test
  on LOCAL via `pnpm db:migrate` first, prod via `pnpm db:migrate:prod`).
- New award fns + hooks at the artifact-validation site (a validated `ERC_REPORT`
  / `DRC_REPORT` landing with `valid === true`) and at the board `BROUGHT_UP`
  status transition. Dedupe once-ever per (enrollment, subkind).
- Decide whether these **replace** the graduated `STAGE_CLEAR` for those stages or
  **stack** with it (recommend replace, to avoid double-paying the same milestone).

**Recommendation:** ship Phase 1 now; treat Phase 2 as a follow-up only if the
team wants proof-time rewards. Phase 1 already gets the "hard stages pay more"
outcome because the gates require the proofs.

---

## WI-2 — `gate` flag + mini-quiz support

**Goal:** allow multiple quiz blocks per card (short section checks + one
end-of-stage gate) without the gate accidentally binding to the first block.

Per-pick XP already works for all quiz blocks (no change). Only the gate needs
decoupling.

1. **Schema — `src/lib/schemas/guide.ts:153` quiz block** — add an optional flag:
   ```ts
   gate: z.boolean().optional(), // marks THE stage-gate quiz; others are practice checks
   ```
   No DB migration — `contentBlocks` is JSON validated by zod. Update
   `guide-block-defaults.ts` + `BlockEditor.tsx` quiz editor to expose it (a single
   "This quiz is the stage gate" checkbox).
2. **Server — `src/lib/actions/quiz.ts:70`** — select the gate block by flag, with a
   back-compat fallback so existing single-quiz cards keep working:
   ```ts
   const quizzes = parsed.data.filter((b) => b.type === "quiz");
   const quizBlock = quizzes.find((b) => b.type === "quiz" && b.gate) ?? quizzes[0];
   ```
   Everything else in `recordQuizPass` stays (still re-scores server-side against
   the chosen block's keys).
3. **Dispatch — `GuideBlocks.tsx:1227`** — pass `context` (the gate context) **only
   to the gate quiz block**; non-gate quizzes get `context: undefined` so they
   record no pass (they still get the `logbook` prop for per-pick XP). Determine
   "am I the gate block" the same way the server does (flagged block, else the first
   quiz block in the card). This needs the block's index/flag available in the
   dispatch; thread a small `isGateQuiz` boolean computed once per card.
4. **`QuizBlock.tsx`** — no logic change needed if `context` is only supplied to the
   gate block: the `recordQuizPass` effect ([:117](../../src/components/guide/QuizBlock.tsx))
   already no-ops without `context`. Confirm the non-gate blocks still render the
   per-question XP ticks (they will — that path keys off `logbook`, not `context`).
5. **Gate requirement sanity** — `learner-gates.ts` ANDs `quizPasses.has(stage)`
   for stages that have a quiz gate. Confirm a card with mini-quizzes **and** a
   flagged gate still resolves to exactly one gate; and that a card with mini-quizzes
   but **no** flagged gate falls back to first-quiz (document this so authors know to
   flag).

**Content follow-up (data, not code):** author section mini-quizzes (1–2 Qs each)
via the usual direct-Prisma content scripts, and mark the end-of-stage quiz
`gate: true`. Keep mini-quizzes short — retrieval practice, not a test wall.

**Anti-farm is already handled** (state it so no one re-invents it): first correct
pick = 5, repops = 2, a wrong first pick locks that question for the academy day
(+0), and `firstEver` keys off the durable `QuizPass`/prior-event gate so an XP
reset re-enables practice at repop rate, never full re-inflation
([`guide-awards.ts:160-183`](../../src/lib/logbook/guide-awards.ts)).

**Tests:** unit `recordQuizPass` — flagged gate chosen over first block; fallback
to first when unflagged; a mini-quiz submission (wrong length vs the gate block)
does not open the gate. Component: a card with two quiz blocks records a pass only
from the gate block, and both blocks award per-pick XP.

---

## WI-3 — Admin "preview as learner" (observability)

**Goal:** let an admin see the learner overlay + XP/fanfare land, instead of
always getting author view.

**Approach:** an admin-only, opt-in **view downgrade**. Simplest form: a query
param (e.g. `?as=learner`) honored **only** when `session.user.role === "ADMIN"`,
that forces `guideCardView` to the learner branch for that request.

- **`guide-view.ts`** — add an explicit override param:
  `guideCardView(role, { previewAsLearner }: { previewAsLearner?: boolean })`.
  When `previewAsLearner && role === "ADMIN"` → return the learner view
  (`isAuthorView: false, isLearnerView: true`). Never allow a non-admin to reach
  author view through any param (the override only ever **downgrades**).
- **`guide/[stage]/page.tsx:543`** — read the param (admin-gated) and pass it in.
  Everything downstream (learner overlay, `courseLogbook`, gate footer hidden)
  flips automatically because it all keys off `view`.
- **UI** — a small admin-only toggle in the guide chrome ("View as learner")
  that adds/removes the param, so it's discoverable and obviously a preview.

**Caveats to call out for the dev:**
- To actually *earn* XP the admin must be **enrolled** (course XP is
  enrollment-scoped). Enrollment is open registration, so the admin can enroll on
  the board; XP then lands **on the admin's own account**.
- That pollutes the admin's real XP/rank. Provide/point to the reset path
  (`src/lib/logbook/reset.ts` + the per-learner admin tooling, `MANUAL_ADJUST`).
  **Cleaner alternative for true end-to-end QA: a dedicated non-admin burner
  enrolled account** — recommend this in the PR description as the canonical test
  path, with the preview toggle as the quick eyeball.
- Security: this is the sensitive one. The override must be **role-checked
  server-side**, downgrade-only, and must not expose author tooling or author-only
  data to anyone. Add a `guide-view.test.ts` case: a non-admin with
  `previewAsLearner: true` (or the param spoofed) still gets learner view and never
  author view.

---

## Sequencing

1. **WI-1 Phase 1** (graduated STAGE_CLEAR) — self-contained, no migration, ships
   the biggest felt improvement. Do first.
2. **WI-3** (learner preview) — small, unblocks the owner verifying 1 and 2.
3. **WI-2** (gate flag) — enables the mini-quiz content work; do before authoring
   any mini-quizzes.
4. **WI-1 Phase 2** (proof-tied awards) — optional, only if proof-time rewards are
   wanted; carries an enum migration.

## Out of scope / explicitly deferred

- Rebalancing the FL ladder (`LEVELS`) — worth a pass after WI-1 amounts settle,
  but not required to ship.
- Hiding answer keys from the client payload (a pre-existing, separate low-value
  follow-up noted in `quiz.ts`).
- Authoring the actual mini-quiz content (data work, after WI-2 lands).
- Library (mini-lesson) quiz XP — already works; untouched here.

## Acceptance

- An enrolled non-admin (or admin via WI-3 preview + enrollment) earns per-stage
  XP that **differs by stage** and matches the ledger, toast, and PostHog amount.
- A course card with section mini-quizzes + one `gate: true` quiz: per-pick XP on
  all; the stage gate opens only on the flagged quiz.
- Admins can flip to learner view and watch XP/fanfare land; no path lets a
  non-admin reach author view.
