# Handoff — per-user quizzes, gates, grades + optional board exam

**Date:** 2026-06-06
**Status:** brainstorming (design not yet locked)
**Prereq state:** the WROOM guide teaching-layer merge train is fully landed on `main` (#36 quiz-gate, #41 req-gate-by-level, plus copy/diagram fixes). `tsc` clean, no open PRs.

## Goal (from the user)

> "Move to a per-user system, then we can track grades and progress. Each board should have an optional exam."

Three intertwined asks:
1. **Per-user progress** — a learner's position in a build is *theirs*, tracked individually.
2. **Grades** — quiz/exam scores are recorded per user and roll up into a progress/transcript view.
3. **Optional board exam** — each board (project) can have a board-level exam, in addition to the existing per-stage comprehension quizzes.

## As-is system (verified 2026-06-06)

The whole gate/quiz machinery is **per-revision and shared** — there is no learner-progress concept in the schema today.

- **`Project`** (`prisma/schema.prisma:79`) — a curriculum board (WROOM breakout, etc.). Has `createdById` (the author), `level` (L1/L2/L3), `track`. These are shared templates, **not** per-learner instances.
- **`Revision`** (`:105`) — belongs to a Project; carries a single `currentStage` (the 9-stage `Stage` enum). Has `frozenById` (audit only). **No `userId`.** Advancing a stage *mutates this shared row.*
- **`QuizPass`** (`:715`) — keyed `@@unique([revisionId, stage])`. One row per (revision, stage). `score`/`total` "kept for record-keeping only." **Not per-user** — whoever passes opens the gate for all.
- **Gate engine** — `STAGES[stage].exitGate(ctx)` in `src/lib/stages.ts` is the single authoritative predicate (UI footer, stage tracker, `advanceStage` action all consume it). `withQuizGate` ANDs `quizPasses.has(stage)` into every stage's gate. `GateContext` is loaded per-revision by `loadGateContext` (`src/lib/load-gate-context.ts`), which builds `quizPasses: Set<Stage>` from `QuizPass` rows.
- **`recordQuizPass`** (`src/lib/actions/quiz.ts`) — client-scored, soft (cheatable by design), upserts the per-revision row.
- **No models for:** enrollment, attempt, user-progress, exam, grade. `User` (`:13`) relates only to *authoring* (projectsCreated, guidesCreated, …), never to *learning*.

## The architectural fork this creates

Per-user progress can't just be "add `userId` to `QuizPass`." The gate engine currently answers **"is this revision past stage X?"** by reading the shared `Revision.currentStage`. A per-user system has to answer **"is *this learner* past stage X on this board?"** — which means a learner's stage position has to live somewhere *other* than the shared revision (the shared revision is the canonical reference build; many learners progress through it independently).

Open design questions (to resolve in brainstorming, before any code):
- **Audience/scale** — single-operator (me) vs many self-serve learners vs cohorts-with-instructor. Determines whether we need a full enrollment/roster model or just per-user progress columns.
- **Progress carrier** — a new `Enrollment`/`Attempt` row per (user, project) that holds the learner's `currentStage` + gate state, leaving `Revision` as the shared canonical build? Or per-user revisions?
- **Gate identity** — `GateContext` / `exitGate` / `advanceStage` need to become user-aware (who is asking). How invasive is that across the ~20 gate tests?
- **Exam shape** — what an "optional" exam *does*: pure credential/grade (no gating), unlocks a mastery badge / next board, or a harder final assessment. Server-scored (the per-stage quizzes are deliberately client-scored/soft — an exam that yields a *grade* probably wants server scoring).
- **Grades model** — what a "grade" is (per-quiz %, per-board aggregate, transcript), and where it surfaces.

## Constraints (standing)

- NEVER `prisma migrate dev` against shared Neon — hand-author migration SQL, `prisma migrate deploy`.
- Full `tsc` + full vitest after any schema change (enum/column changes break enum-mirror maps + fixtures in ways the task's own checks miss).
- The seed fixture (`esp32-sensor-breakout`, `level = null`) is depended on by ~23 integration tests — don't break it.
- Commit trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

## Next step

Brainstorming Phase 1 (understanding): lock audience/scale + exam role, then propose 2–3 architectures (enrollment-row vs per-user-revision vs hybrid) with trade-offs. Design doc lands in `docs/plans/2026-06-06-per-user-progress-design.md`.
