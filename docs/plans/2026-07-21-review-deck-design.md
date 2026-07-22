# Cross-session review deck: design (step 4, deferred build)

Status: design only, 2026-07-21. No schema migration in this pass. This is the
concrete shape for build-order step 4 in
`docs/plans/2026-07-21-inline-formative-checks-authoring-spec.md`. Build is gated on
step-2 telemetry showing the checks are used enough to justify it (see "Build
trigger").

## Bottom line

Build a spaced, interleaved review deck that resurfaces questions a learner has
already seen, at expanding intervals, prioritising the ones they missed. It is the
biggest retention lever in the plan and the system's largest blind spot (every
check today is within-stage). It needs one new Prisma model and an item lookup, so
it is a real project, not an increment. Recommended shape below; the load-bearing
decisions are flagged for sign-off before any migration.

## Why (and the honest caveat)

Spaced and interleaved retrieval outperform massed practice for durable retention
(spacing effect, Cepeda et al. 2006; interleaving, Rohrer & Taylor 2007). The
current system tests each idea once, inside its stage, then never again. A review
deck is where the compounding happens.

Caveat, stated plainly: this is deferred on purpose. Step 2 telemetry exists so we
learn whether learners engage the checks at all before spending L-effort here.
Building the deck before that data is the blind investment the spec warns against.
(Citations named from memory, not web-verified; verify before any learner-facing
copy ships, per the otd-content-writing citation rule.)

## The data reality (what exists, what is missing)

Verified against the schema. What you CAN reconstruct per user today:

- Correct/attempted answers by academy-day: `XpEvent` (`refId = questionKey`,
  `earnedOn @db.Date`, `source = STAGE_QUIZ_CORRECT`). Since step 3, this fires on
  the first answer of the day whether right or wrong, so it now records
  "answered", not only "answered correctly".
- First-wrong-of-day misses: `QuizLock` (`userId, questionKey, lockedOn @db.Date`),
  pruned only on an admin XP reset, so miss-history accumulates.

What is MISSING and must be built:

- **No schedule state.** There is no per-item interval / due / ease column. You
  cannot compute "due today" from an event log. This is the new model.
- **No queryable question bank.** Quiz items live inside `GuideCard.contentBlocks`
  JSON; there is no `Question` table. `questionKey` is a content-derived hash
  (`guideKey(project, rev, stage)` + the question), stable across renders, but it
  does not carry the question text/options. Showing a review question means
  resolving `questionKey` back to its `q`/`options`/`answer`.
- **Only MCQ.** The three higher-ranked formats (Check yourself, `traceList`,
  `doSteps`) persist nothing, so a review deck on this substrate can only resurface
  MCQ. That is an acceptable v1 scope, not a permanent limit.

So the existing tables can BOOTSTRAP an initial schedule (seed due-dates from
miss/answer history) but cannot DRIVE one. The grain of truth in "the substrate is
partly there" is exactly the bootstrap, nothing more.

## Proposed shape

### 1. Item lookup (questionKey to question)

DECISION NEEDED. Two ways:

- **Live scan (cheap bootstrap).** On review, load the relevant guide cards'
  `contentBlocks`, run `quizQuestions` + `guideQuestionKeys`
  (`src/lib/logbook/lesson-content.ts`) to build a `key -> question` map, cache it
  (`use cache`, tagged, invalidated on card save). No new write-path surface. Slow
  if content is large; fine at current scale.
- **Item registry (the target).** A `QuizItem` table (`questionKey` PK,
  `projectSlug`, `stage`, `q`, `options`, `answer`, `updatedAt`), synced wherever
  `contentBlocks` is written (the `editGuideCard` save boundary, `materializeGuide`,
  the seed scripts). Queryable and fast; costs a sync hook at each write path.

Recommendation: ship the live-scan-with-cache first (no schema, no sync), and
promote to a registry only if the scan cost or query needs justify it. The review
deck's own queries are per-user and small; the expensive part is the reverse
lookup, which caching absorbs.

### 2. Scheduling model (the one new table)

DECISION NEEDED (this is the migration). Proposed model, NOT yet migrated:

```
model ReviewSchedule {
  id           String   @id @default(cuid())
  userId       String
  questionKey  String
  dueOn        DateTime @db.Date
  intervalDays Int      @default(1)
  lapses       Int      @default(0)
  lastSeenOn   DateTime @db.Date
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([userId, questionKey])
  @@index([userId, dueOn])
}
```

Algorithm v1: fixed expanding intervals, not SM-2. On a correct review answer,
advance `intervalDays` along `1 -> 3 -> 7 -> 21 -> 60` and set `dueOn = day +
interval`. On a miss, reset `intervalDays` to 1, increment `lapses`, set `dueOn`
to the next day. Simple, legible, good enough; SM-2 ease factors are a later
refinement once there is usage data to tune against.

Bootstrap: a one-time backfill seeds a `ReviewSchedule` row from history. A
questionKey with a `QuizLock` (missed) seeds due soon (interval 1); a questionKey
with a correct `XpEvent` and no later miss seeds at a longer interval (e.g. 7). New
answers upsert a schedule row going forward (a hook in `recordStageQuizAnswer`).

### 3. What feeds the deck

Questions the user has SEEN (has an `XpEvent` or `QuizLock` for the key), whose
`dueOn <= today`, ordered by `dueOn` then interleaved across stages/projects rather
than blocked by lesson. Cap the daily session (e.g. 15 due items) so the deck never
walls the learner.

### 4. Surface

DECISION NEEDED. Recommendation: a dedicated `/review` route that reuses
`QuizBlock`'s grade-as-you-go interaction, plus a "N due" nudge on the course hub /
logbook as the entry point. The route is the home; the nudge is discovery.

### 5. XP interaction

Recommendation: keep v1 review XP-NEUTRAL (no `STAGE_QUIZ_CORRECT` award on a
review answer). Reasons: it avoids inflating the ladder, avoids a new farm surface,
and avoids an enum migration. A dedicated `REVIEW_CORRECT` `XpSource` with its own
small award is a deliberate later step (mirrors the deferred Check-yourself award).
Review updates the schedule; it does not pay XP in v1.

## Build trigger

Start the build when step-2 telemetry (`formative_check_engaged`) shows the checks
are engaged by a meaningful fraction of stage views over a few weeks. If learners
do not use the within-stage checks, a spaced deck of the same items will not save
them, and the L-effort is better spent elsewhere. Define the exact threshold when
the first telemetry lands; do not hard-code a guess now.

## Decisions to confirm before migrating

1. Item lookup: live-scan-with-cache first (recommended) or go straight to a
   `QuizItem` registry.
2. Scheduling: fixed expanding intervals (recommended v1) or SM-2 from the start.
3. Surface: dedicated `/review` route (recommended) or a hub-embedded widget only.
4. XP: review XP-neutral (recommended v1) or a new `REVIEW_CORRECT` source now.
5. The migration itself (`ReviewSchedule`) follows the local-first flow
   (`pnpm db:migrate` local, verify, then `db:migrate:prod`), hand-authored SQL,
   `migrate deploy`. Not done in this pass.

## Not in scope for v1

Non-MCQ review (Check yourself / traceList / doSteps persist nothing), SM-2 ease
tuning, cross-user difficulty stats, and any review-XP economy. All are follow-ons
once the v1 deck exists and telemetry justifies them.
