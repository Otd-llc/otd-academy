# Course XP (Logbook Phase 2) — design

**Status:** design, 2026-07-11. Owner-locked the scope (all four earn events) and
directed "design first, build later." Builds ON the shipped Phase 1 Logbook
(branch `feat/logbook-xp`): same ledger, same award engine, same dedupe/idempotency,
same patch/rating model. This is the **course (build-guide) half** of the XP system;
Phase 1 covered the public `/library`.

**Scope (owner-locked 2026-07-11):** XP for the build-guide courses
(`/projects/<slug>/<revLabel>/guide`), four earn events:
1. **Per-stage quiz answers** (the guide-card checkpoint quizzes)
2. **Stage clear** (passing a stage's exit gate + advancing)
3. **Final exam pass** (the course exam)
4. **Course complete + rating** (certificate issued → a course RATING badge)

Amounts are a **starting economy — tune on-screen** (the Phase 1 discipline).

---

## 1. Principle — REUSE Phase 1, don't rebuild

Everything routes through the primitives already shipped in `src/lib/logbook/`:

- **Ledger:** `XpEvent` (append-only, unique `dedupeKey`). No new table.
- **Engine:** `awardXp()` (idempotent, updates cached `User.xpTotal/level`,
  detects level-ups in-transaction). Reused verbatim.
- **Badges:** `BadgeEarned` + `earnBadge()` (permanent, grandfathered).
- **Economy:** extend `src/lib/logbook/economy.ts` with course amounts + course
  `dedupe.*` keys. No second economy module.
- **Loaders/UI:** reuse `XpTick` (with the owner-picked animation), `getLogbook`,
  the `/verify` flair, the milestone email, the six PostHog events.

**New schema (one migration):** four `XpSource` enum values via
`ALTER TYPE "XpSource" ADD VALUE` (Postgres; the Phase-1.5 checkride note already
flagged this pattern — enum-add migrations run outside a txn, `migrate deploy`
handles it). No new columns.

```
ALTER TYPE "XpSource" ADD VALUE 'STAGE_QUIZ_CORRECT';
ALTER TYPE "XpSource" ADD VALUE 'STAGE_CLEAR';
ALTER TYPE "XpSource" ADD VALUE 'COURSE_EXAM_PASS';
ALTER TYPE "XpSource" ADD VALUE 'COURSE_COMPLETE';
```

Mirror the enum in `prisma/schema.prisma` and run the FULL tsc + FULL vitest after
`prisma generate` (the enum-mirror rule, memory `schema-change-tsc-check`).

## 2. The award map (starting economy)

| Event | Hook (server-authoritative) | Amount (tunable) | Cadence | dedupeKey |
|---|---|---|---|---|
| `STAGE_QUIZ_CORRECT` (first ever) | `recordQuizPass` re-score (`src/lib/actions/quiz.ts`) | +5 | once/full | `STAGE_QUIZ:<uid>:<guideKey>#<qId>:<day>` |
| `STAGE_QUIZ_CORRECT` (repop) | same | +2 | daily | same (day rolls) |
| `STAGE_CLEAR` | the stage exit-gate / advance path (`src/lib/actions/enrollment.ts` + `learner-gates`) | +20 | once/stage | `STAGE_CLEAR:<uid>:<slug>:<stage>` |
| `COURSE_EXAM_PASS` | `submitExam` on `passed:true` (`src/lib/actions/exam.ts`, writes `ExamResult`) | +150 | once/course | `COURSE_EXAM:<uid>:<slug>` |
| `COURSE_COMPLETE` (+ rating badge) | certificate issuance (`src/lib/actions/certificate.ts` / `certificate-record.ts`) | +300 | once, grandfathered | `COURSE_COMPLETE:<uid>:<slug>` |

- **Stage-clear (+20) vs the sum of a stage's quiz XP:** keep stage-clear a flat,
  once-ever award so re-grinding a stage's quizzes (daily repop) can never
  out-earn actually *advancing*. Same first-full / repop-reduced logic as the
  library keeps the daily loop without letting practice dominate.
- **The exam + completion awards are once-ever** (dedupe has no day) — the durable
  milestones, like `CLUSTER_COMPLETE`/`LIBRARY_COMPLETE` in Phase 1.

## 3. Stable question keys for guide quizzes (the load-bearing detail)

Library quiz keys are `<lessonSlug>#<qId|hash>` (Phase 1, `question-key.ts`). Guide
quizzes are per **(project, revision, stage)**, so they need a guide-scoped slug:

```
guideKey = `guide:<projectSlug>:<revLabel>:<stage>`
questionKey(guideKey, question)   // reuse the existing helper unchanged
```

This keeps every quiz key globally unique + stable across the whole ledger, so the
instrumentation view (fail rates) folds guide questions in for free (same
`refId` scheme, just a different prefix). Computed SERVER-SIDE in the guide page /
`recordQuizPass` (node:crypto stays off the client — the Phase 1 rule).

## 4. Integrity (same model as Phase 1 §3)

- **Server owns every award.** `recordQuizPass` already re-scores submitted picks
  against the card's real keys — the XP award rides that existing validation, so a
  fabricated POST still can't mint XP.
- **Stage clear** keys off the REAL exit gate (`learner-gates` / the enrollment
  advance), never a client claim.
- **Exam pass** keys off `ExamResult.passed` (server-written), **completion** off
  certificate issuance (server-authoritative). None trust the client.
- **Idempotent** on `dedupeKey`; **anon can't earn** (all four require an
  Enrollment). **Unlock-not-spend** stays — XP only rises.

## 5. Ratings — the course flair (aligns with Phase 1.5 checkrides)

- Course completion grants a **`course:<slug>` RATING badge** (`meta.asOfRevision`),
  the exam-backed, employer-meaningful flair — the course analog of the cluster
  **checkride ratings** (Phase 1.5). Roadmap-visible as a locked teaser per course;
  earned = permanent, grandfathered (a re-published revision never revokes it).
- **WINGS / top-milestone reconciliation:** once BOTH cluster checkride-ratings
  (Phase 1.5) and course ratings exist, define the top milestone over the union.
  Out of scope here; note it so it isn't lost.
- Ratings headline the certificate / `/verify` line over completion patches (the
  Phase 1 flair already surfaces level + patches; extend it to name course ratings).

## 6. Surfaces (reuse Phase 1 components)

1. **Guide card quiz** — the `+XP` tick (reuse `XpTick` + the owner-picked
   animation) on a correct first pick; the guide `QuizBlock` gets the same
   `logbook` prop the library one already takes. **This is the fix for the owner's
   "no XP in course quizzes" report** — the component supports it, the guide page
   just never passed the prop.
2. **Stage clear** — a quiet `+20 XP · stage cleared` line at the advance moment
   (the existing advance UI), no modal.
3. **Exam pass / course complete** — fold into the existing **Lesson Complete /
   certificate screen** (#123–129) + the `/verify` flair (course rating line).
4. **Logbook page** — add a **Courses** section (per-course progress + ratings)
   beside the library clusters in `getLogbook`.
5. **Admin instrumentation** — guide-quiz fail rates appear automatically (same
   ledger + `refId` prefix); the per-lesson reset extends to a per-guide reset.

## 7. Grandfathering (the moat keeps growing)

Same as Phase 1 §7. `course:<slug>` ratings are permanent, stamped
`meta.asOfRevision`. Adding a stage or a new course never revokes an earned rating.
Live progress recomputes against the current revision; earned flair does not.

## 8. Open tuning (owner, on-screen — not blockers)

Amounts + the stage-clear-vs-quiz-sum balance; whether stage-clear is flat (+20) or
`readMin`-scaled; the level curve past FL6 once course XP inflates totals; rating
naming (`course:<slug>` label). Tune once it's live.

## 9. Explicitly OUT of this phase

- **Writing-box / proof-submission XP** (the design's original Phase-2 list named
  it). Deferrable — the proof surface is lower-signal and higher-abuse than the
  four locked events. Revisit after these land.
- **Board-photo gallery** ("winners circle") — separate Phase-2 track.
- **SRS review queue / shareable Logbook page** — v1.5 fast-follows, unchanged.

## 10. Build sequencing (see the implementation plan)

Schema (enum) → economy (course amounts/keys) → guide question keys → the four
award hooks (quiz, stage-clear, exam, complete+rating) each TDD + idempotent →
guide `QuizBlock` wiring → Logbook Courses section → `/verify` course flair →
analytics/email → verification. Reuses the Phase 1 test patterns (throwaway
user + throwaway enrollment/rows; inject the clock; never touch real curriculum
rows beyond the seed fixture).

Build off `feat/logbook-xp` (or a fresh branch off it) in the worktree; batch
commits; **no merge without the owner's explicit go-ahead**
([[no-auto-merge-batch-commits]]).
