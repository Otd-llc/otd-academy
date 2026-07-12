# Course XP (Logbook Phase 2) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: use superpowers:executing-plans to run this
> task-by-task. **READ FIRST:** `docs/plans/2026-07-11-course-xp-phase2-design.md`
> (the locked design) and the Phase 1 plan
> `docs/plans/2026-07-11-logbook-xp-implementation.md` (the primitives this reuses).

**Goal:** Add XP to the build-guide courses — the four owner-locked earn events
(per-stage quiz, stage clear, final exam pass, course complete + rating) — on top
of the shipped Phase 1 Logbook, reusing its ledger/engine/dedupe/badges.

**Prereq:** Phase 1 (`feat/logbook-xp`) is merged or this branches off it. All of
`src/lib/logbook/` (economy, award, dedupe, badge, load, question-key,
lesson-content, patches, notify) already exists — REUSE it.

**Repo ground rules that WILL bite you (same as Phase 1):**
- `.env.local` `DATABASE_URL` is **PROD**; migrations are hand-authored SQL +
  `pnpm db:migrate` (never `migrate dev`). After `prisma generate`: FULL tsc +
  FULL vitest (enum-mirror maps break silently, memory `schema-change-tsc-check`).
- **Enum-add migration caveat:** `ALTER TYPE ... ADD VALUE` cannot run inside a
  transaction block in Postgres. Put the four `ADD VALUE` lines in their own
  migration file with NO other statements; `migrate deploy` applies them fine.
- `"use server"` files export ONLY async functions.
- DB tests: throwaway user + **throwaway Enrollment/Project/Revision/Guide rows**
  you create and clean up; never depend on real curriculum rows beyond the seed
  fixture. Inject `now` (never real time).
- Run from `C:\zzz\pf-logbook` (PowerShell): `pnpm exec vitest run <path>`,
  `pnpm exec tsc --noEmit`. Dev server: `Start-Process node -ArgumentList
  "node_modules/next/dist/bin/next","dev","-p","3000"` (port 3000 — the registered
  OAuth callback; `:3006` is NOT registered, sign-in breaks there). Use localhost.
- UI follows otd-frontend-design (token colors, hairlines, Saira numerals, no
  em-dashes). Reuse `XpTick` with the owner-picked animation.

---

## Task 1: Schema — XpSource enum additions

**Files:** `prisma/schema.prisma` (add 4 enum values), new migration
`prisma/migrations/<ts>_course_xp/migration.sql` (ONLY the ADD VALUE lines).

```sql
ALTER TYPE "XpSource" ADD VALUE 'STAGE_QUIZ_CORRECT';
ALTER TYPE "XpSource" ADD VALUE 'STAGE_CLEAR';
ALTER TYPE "XpSource" ADD VALUE 'COURSE_EXAM_PASS';
ALTER TYPE "XpSource" ADD VALUE 'COURSE_COMPLETE';
```

Mirror in the `enum XpSource` block. Run `pnpm db:migrate` → `prisma generate` →
FULL tsc → FULL vitest (green). Commit `feat(logbook): course XP enum values`.

## Task 2: Economy — course amounts, dedupe keys, guideKey

**Files:** modify `src/lib/logbook/economy.ts`; test `economy.test.ts` (add cases).

Add constants (`STAGE_CLEAR_XP=20`, `COURSE_EXAM_XP=150`, `COURSE_COMPLETE_XP=300`;
stage quiz reuses `XP.QUIZ_FULL/QUIZ_REPOP`). Add `dedupe.stageQuiz`,
`dedupe.stageClear`, `dedupe.courseExam`, `dedupe.courseComplete` mirroring the
Phase 1 forms (daily key embeds `academyDay`; once-ever keys don't). Add a pure
`guideKey(projectSlug, revLabel, stage)` → `guide:<slug>:<rev>:<stage>`. TDD the
keys + guideKey exactly like Phase 1 Task 3. Commit.

## Task 3: Guide question keys

**Files:** `src/lib/logbook/lesson-content.ts` already exports `lessonQuestionKeys`;
add `guideQuestionKeys(projectSlug, revLabel, stage, contentBlocks)` that builds
the guideKey then reuses `questionKey`. Test it. Commit.

## Task 4: Stage-quiz award (server-validated, repop)

**Files:** modify `src/lib/actions/quiz.ts` (`recordQuizPass`); reuse the Phase 1
`awardXp` + `dedupe.stageQuiz`. Create a small core
`src/lib/logbook/guide-awards.ts` (`awardStageQuiz({guideKey, questionKey, pick},
userId, now)`) mirroring `recordQuizAnswer` (first-full/repop off a durable
"stage cleared" or prior-award guard), DB-tested with a throwaway guide row.
`recordQuizPass` calls it per newly-correct question. Return the awarded xp so the
client tick shows the SERVER amount. Commit
`feat(logbook): stage-quiz XP (server-validated, repop)`.

## Task 5: Stage-clear award

**Files:** identify the exact advance/exit-gate function in
`src/lib/actions/enrollment.ts` (+ `src/lib/learner-gates.ts`); on a genuine
stage clear, `awardXp(STAGE_CLEAR, STAGE_CLEAR_XP, refId=<slug>:<stage>,
dedupe.stageClear)`. Once-ever. DB test: clear a stage twice → one award.
Commit `feat(logbook): stage-clear XP`.

## Task 6: Final-exam-pass award

**Files:** modify `src/lib/actions/exam.ts` (`submitExam`); on `ExamResult.passed`,
`awardXp(COURSE_EXAM_PASS, COURSE_EXAM_XP, refId=<slug>, dedupe.courseExam)`.
Once-ever (a re-pass no-ops). DB test. Commit `feat(logbook): final-exam-pass XP`.

## Task 7: Course-complete + rating badge

**Files:** modify `src/lib/actions/certificate.ts` / `certificate-record.ts`; on
issuance, `awardXp(COURSE_COMPLETE, COURSE_COMPLETE_XP, dedupe.courseComplete)` +
`earnBadge(userId, 'course:<slug>', { asOfRevision })`. Add `course:<slug>` to the
patch catalog (`src/lib/logbook/patches.ts`) as a roadmap RATING. DB test:
issuance grants once; re-issue no-ops. Commit `feat(logbook): course-complete XP + rating`.

## Task 8: Guide QuizBlock wiring

**Files:** the guide page that renders `<GuideBlocks>` for a course
(`src/app/projects/[slug]/[revLabel]/guide/...`) — pass the SAME `logbook` prop the
library page passes (Task 10 of Phase 1), with `guideKey`-based question keys
computed server-side. `QuizBlock`/`GuideBlocks` already accept it (Phase 1). The
signed-in tick + completion line light up with NO component change. tsc → manual
E2E on :3000 (enroll, answer a stage quiz → tick; clear a stage → line). Commit
`feat(logbook): course quiz XP tick wiring`.

## Task 9: Logbook page — Courses section

**Files:** extend `src/lib/logbook/load.ts` `getLogbook` with per-course progress +
ratings; add a "Courses" section to `src/app/logbook/page.tsx` beside the clusters.
TDD the loader with throwaway rows. Commit `feat(logbook): Logbook courses section`.

## Task 10: /verify course-rating flair

**Files:** `src/app/verify/page.tsx` — extend the Phase 1 flair to name course
ratings (`course:<slug>` badges) alongside level + patch count. Commit.

## Task 11: Analytics + milestone email

**Files:** the four hooks emit the existing server PostHog events
(`xp_earned`/`patch_earned`/`level_up`) via `capture(...)`; course ratings + level
crossings trigger `notifyLogbookMilestone` (already consent-gated). No new event
names (design §10b keeps the six). Commit.

## Task 12: Final verification

`pnpm exec tsc --noEmit` → 0. `pnpm exec vitest run` → FULL green. Manual E2E on
:3000 (signed-in, enrolled): answer a stage quiz (+5 tick) → clear a stage (+20) →
pass the exam (+150) → complete the course (+300 + course rating) → `/logbook`
Courses section + `/verify` flair reflect it. Screenshot dark + light. Commit
`feat(logbook): course XP E2E verification`. **STOP — hand the owner the local URLs;
no merge without explicit go-ahead.**

---

## Validation log (2026-07-11)

Lenses (inline, serially): coherence, feasibility, scope-guardian.

| Round | Material | Notes |
|---|---|---|
| 1 | 3 | enum-add can't run in a txn (own migration file); stage-clear must key off the REAL gate not a client claim; guideKey scheme pinned so instrumentation folds in for free |
| 2 | 1 | `first-full/repop` for stage quiz needs a durable "stage cleared/attempted" guard so an admin reset can't re-inflate (mirror Phase 1 firstEver-off-completion) |
| 3 | 0 | DRY — hooks verified to exist (quiz.ts / enrollment.ts / exam.ts / certificate.ts); amounts flagged tunable; writing-box + gallery explicitly deferred |

**Exact hook functions the executor MUST confirm before wiring** (grep, don't
assume): the advance/exit-gate fn in `enrollment.ts` + `learner-gates.ts` (Task 5),
`submitExam`'s pass path in `exam.ts` (Task 6), and the issuance fn in
`certificate.ts`/`certificate-record.ts` (Task 7).
