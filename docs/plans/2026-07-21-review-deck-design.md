# Cross-session review deck: design (step 4, deferred build)

Status: design only, 2026-07-21 (revised after a 3-lens validation pass). No schema
migration in this pass. This is the concrete shape for build-order step 4 in
`docs/plans/2026-07-21-inline-formative-checks-authoring-spec.md`. Build is gated on
a real prerequisite (see "Build trigger"), not started.

## Bottom line

Build a spaced, interleaved review deck that resurfaces MCQ a learner has already
seen, at expanding intervals, prioritising the ones they missed. It is the biggest
retention lever in the plan and the system's largest blind spot. BUT a validation
pass surfaced a load-bearing constraint the first draft missed: **the schedule
cannot key on `questionKey` as it exists today.** `questionKey` is a hash of the
question TEXT scoped to a REVISION, so a routine copy-edit or a revision bump
silently destroys the per-item history this feature exists to accumulate. The
identity fix (a stable question id + an item registry) is the real step-4 gate, and
it moves the registry from "later" to "first". Everything else below is a sound v1
once identity is fixed.

## The identity problem (read before anything else)

The whole feature keys per-item durable state on `questionKey`. That key is NOT a
stable concept identity:

- With no authored `id`, `questionKey = <prefix>#h<sha256(question.q)[:8]>`
  (`src/lib/logbook/question-key.ts:11-13`). Editing the question TEXT mints a NEW
  key. The file's own header says it: "editing a question's text without an id
  makes it a new question." That is correct for the XP ledger (a reworded question
  is a new XP item) and fatal for an SRS schedule (a typo fix must not reset the
  interval). The 69 existing lessons carry NO authored ids, so they are all on the
  text-hash path.
- The key hashes only `question.q`, not `options`/`answer`. So editing a distractor
  or flipping the correct-answer index does NOT change the key: the schedule row
  survives but now points at semantically different content, graded against a new
  answer under the old identity. Silent content drift.
- Guide keys are prefixed by `guideKey(project, rev, stage)` =
  `guide:<project>:<rev>:<stage>` (`question-key.ts:19-25`). The same logical
  question under revision `v1` and `v2` has DIFFERENT keys, and `Enrollment` snapshots
  a `revisionId` at enroll time. A learner advancing to a new published revision gets
  fresh unseen copies of every carried-over question, and the whole `v1` schedule
  orphans. Review is per-revision, not per-concept.

Consequence: as designed on the raw key, routine content edits and normal revision
lifecycle silently corrupt the history the deck is built to accumulate. This is not
a crash; it is invisible data loss plus spurious resurfacing.

Fix (this is DECISION #1, ahead of the migration):

- **Mandate a stable authored `id` on any reviewable question**, enforced at the
  save boundary and `lesson-readiness` (the parent spec lists `id` as optional; for
  reviewable items it becomes required). Backfill stable ids into the existing
  lessons and guide cards BEFORE any bootstrap.
- **Decide per-revision vs per-concept identity.** If the review key must survive a
  revision bump (the whole point of "re-test the SAME idea over time"), it has to be
  a revision-independent concept id, not the raw `guideKey`-prefixed key. If
  per-revision is accepted for v1, state it and quantify the loss; do not let it be
  discovered in production.
- The natural home for the stable id and the text/options is a `QuizItem` registry
  (below), which is why the registry moves to FIRST, not deferred.

## Why (and the honest caveat)

Spaced and distributed retrieval outperform massed practice for durable retention
(spacing effect, Cepeda et al. 2006). The current system tests each idea once,
inside its stage, then never again. A review deck is where the compounding happens.

Caveat, stated plainly: this is deferred on purpose, and the build trigger below was
also corrected by the validation pass (engagement telemetry is the wrong gate).
Citations here are named from memory, not web-verified; verify before any
learner-facing copy ships, per the otd-content-writing citation rule.

## The data reality (what exists, what is missing)

Verified against the schema. What you CAN reconstruct per user today:

- Answers by academy-day: `XpEvent` (`refId = questionKey`, `earnedOn @db.Date`,
  `source = STAGE_QUIZ_CORRECT`). CORRECTION from the first draft: since step 3 this
  fires on the first answer of the day whether right or wrong, so `source =
  STAGE_QUIZ_CORRECT` now means "answered", NOT "answered correctly". The source name
  is a misnomer post-step-3.
- Misses by day: `QuizLock` (`userId, questionKey, lockedOn @db.Date`), written on a
  wrong first pick, pruned only on an admin XP reset (and that prune filters library
  slugs, so guide/stage locks effectively never prune).

Deriving correctness for the bootstrap: because the XpEvent no longer distinguishes
right from wrong, correctness must be derived by LEFT-JOINING `QuizLock`. Correct on
day D = an `XpEvent` for (questionKey, earnedOn=D) with NO `QuizLock` for
(questionKey, lockedOn=D). A later miss = a `QuizLock` with lockedOn > D. The days
line up because both use the same academy-day (`economy.ts`). A naive backfill that
reads `source = STAGE_QUIZ_CORRECT` as "correct" would seed every MISSED item at the
long interval, defeating the "prioritise misses" goal.

What is MISSING and must be built:

- **No schedule state** (no per-item interval / due / lapse column). This is the new
  model.
- **No queryable question bank** and **no stable id.** Items live in
  `GuideCard.contentBlocks` JSON; there is no `Question`/`QuizItem` table. See the
  identity problem above.
- **Only MCQ.** Check yourself / traceList / doSteps persist nothing, so the deck can
  only resurface MCQ. Acceptable v1 scope, not a permanent limit, but see the
  recognition-vs-recall note under scheduling.

So the existing tables can BOOTSTRAP an initial schedule but cannot DRIVE one.

## Proposed shape

### 1. Item registry FIRST (not live-scan)

The first draft recommended live-scan-with-cache and deferred the registry. The
validation pass flips this: the registry is where the stable `id` (identity fix) is
enforced, so it is the foundation, not an optimization.

A `QuizItem` table keyed by a STABLE question id: `{ id (stable authored),
questionKey (current, for history join), projectSlug, revLabel, stage, q, options,
answer, updatedAt }`, synced wherever `contentBlocks` is written (the `editGuideCard`
save boundary, `materializeGuide`, the seed scripts). This gives O(1) resolution and
is the enforcement point for "reviewable questions must have a stable id".

Note the reverse-lookup is cheaper than the first draft feared: the key is
STRUCTURED (`guide:<project>:<rev>:<stage>#suffix`), so a due key parses straight to
one `GuideCard` (`@@unique([guideId, stage])`), no global scan. But parsing is
fragile (a `:` or `#` in a revision label breaks it, and `Revision.label` is free
text), which is another reason to resolve through the registry rather than by parsing
keys at read time. `quizQuestions` type-drops `options` (returns `{id?, q, answer}`),
so rendering an MCQ needs the full block via `parseGuideBlocks`, not that helper.

### 2. Scheduling model (the one new table)

Proposed model, NOT yet migrated. Corrections from validation folded in:

```
model ReviewSchedule {
  id           String   @id @default(cuid())
  userId       String
  itemId       String   // the STABLE question id, not the raw questionKey
  dueOn        DateTime @db.Date
  intervalDays Int      @default(1)
  lapses       Int      @default(0)
  suspended    Boolean  @default(false)
  lastSeenOn   DateTime @db.Date
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([userId, itemId])
  @@index([userId, dueOn])
}
```

- Add the required back-relation `reviewSchedules ReviewSchedule[]` to `User`
  (Prisma needs both sides; the first-draft model omitted it and would not compile).
- Algorithm v1: fixed expanding intervals `1 -> 3 -> 7 -> 21 -> 60`, plus:
  - **Jitter.** Add +/- ~15% fuzz to each computed interval so items seeded/answered
    on the same day do not march in lockstep and pile up on the same future day
    (the bootstrap seeds a batch, so day 7 would otherwise spike and recur).
  - **Lapse = step down, not reset to 1.** A single miss on a mature item should not
    throw away the whole ladder (interval over-reset amplifies MCQ noise and burns
    the daily cap). Drop one-to-two rungs, or `interval = max(1, round(prev * 0.4))`.
    Wire the `lapses` counter (currently dead data) to leech handling: repeated
    lapses set `suspended = true` rather than re-drilling forever.
  - **Graduate the ceiling.** Past 60 days, either keep expanding (x ~2.5 into
    months) or mark the item graduated/retired so best-known items stop consuming the
    daily queue permanently.
- Bootstrap: a one-time, RE-RUN-GUARDED backfill seeds a row per (user, itemId) from
  history via the correctness derivation above. Seed a missed item due-soon
  (interval 1). Seed a correctly-answered item CONSERVATIVELY at interval 3 (not 7):
  a single correct MCQ can be a lucky 1-in-4 guess, and a 7-day disappearance is a
  false-confidence window; seed longer only where multiple correct days corroborate.

### 3. What feeds the deck

Questions the user has SEEN (has an XpEvent or QuizLock for the item) whose
`dueOn <= today` and not suspended, ordered overdue-first, MISSES prioritised
explicitly, then shuffled across stages/projects. Cap the daily session (e.g. 15)
with an explicit overflow rule: excess rolls to the next day, and a returning
learner with a large backlog drains at the cap with oldest-first, no unbounded wall.

Honest naming: shuffling across unrelated stages is DE-MASSING, not the Rohrer &
Taylor interleaving mechanism (which juxtaposes CONFUSABLE types so the learner
practices discriminating). The substrate carries no concept/skill tags to place
confusable items adjacent, so call it de-massing; true interleaving needs a concept
tag on items, absent everywhere today.

Recognition caveat: v1 buys spacing-of-RECOGNITION (MCQ), the smaller half of the
available gains; recall formats retain more. Also **shuffle option order every
review** so repeated exposure trains the concept, not the answer's position
(response learning). Cheap, and it should be in v1 even within MCQ-only scope.

### 4. Surface + the review write path

- A dedicated `/review` route, signed-in-gated (`ReviewSchedule.userId` is required;
  anon has no schedule). A "N due" nudge on the course hub / logbook is the entry.
- Reusing `QuizBlock` is more than a drop-in: it has NO callback/`onAnswer` prop and
  internally calls `recordStageQuizAnswer`/`recordQuizAnswer` from `fireAnswer`, gated
  on `lb.mode`. A review context has no enrollment/stage. Plan for extracting the
  single-question grade-as-you-go widget (pure client state) or adding a
  `mode: "review"` branch, not a free reuse.
- **The review answer needs its own server action** (the first draft left this a
  hole: its only schedule-write hook lived inside the XP path, which review does not
  call). Specify a `recordReviewAnswer(itemId, pick)` that: re-scores the pick against
  the registry's stored answer (server-authoritative, mirroring `recordQuizPass`),
  advances/steps the schedule in ONE transaction, is idempotent per (user, item, day),
  uses `academyDate` for "today" so it agrees with the ledger it bootstrapped from,
  and checks ownership.

### 5. XP interaction (reconsidered)

The first draft made the deck fully XP-NEUTRAL. The validation pass flagged this as
repeating the step-3 mistake: making the highest-leverage tool the ONLY reward-silent
one, inside an already-gamified economy, signals "this does not count" and steers
learners to the paid activity (fresh quizzes) over the unpaid one (review).

v1 stance: the deck is NOT reward-silent. Ship at minimum a non-XP progress signal
(due-count cleared, a review streak) so the habit-forming moment has feedback.
Preferred: a small, capped, diminishing `REVIEW_CORRECT` award, first-correct-per-due
-cycle only (the same per-day anti-farm shape used elsewhere). That needs a new
`XpSource` enum value (Prisma enum migration, full tsc + vitest per the schema-change
rule); if that is deferred, the non-XP progress signal is the floor, not zero
feedback.

## Build trigger (corrected)

The first draft gated the build on step-2 ENGAGEMENT telemetry. That is the wrong
proxy and circular: within-stage check use can be low precisely BECAUSE the check is
a consequence-free one-shot, and the review deck is what creates the consequence, so
gating the fix on the symptom can kill the intervention. Also engagement is a
population average while retention benefit is per-learner.

Corrected gate: the real prerequisite is SEEN-ITEM INVENTORY (enough learners have
enough resolvable, stable-id items to seed schedules), plus the identity fix landed.
Pair the launch with a RETENTION-OUTCOME read (return rate, and re-test accuracy on
reviewed vs not-reviewed items), so you measure the thing the tool exists to move,
not a stand-in that does not predict it.

## Decisions to confirm before migrating

1. **Identity (the gate).** Mandate a stable authored `id` on reviewable questions +
   backfill; and decide per-revision vs per-concept review identity. Build the
   `QuizItem` registry as the enforcement point. This is decision #1.
2. Scheduling: fixed expanding intervals with jitter, step-down lapse, and a graduate
   ceiling (recommended v1) vs SM-2 (not recommended for v1).
3. Surface: dedicated `/review` route (recommended) + a hub nudge; accept the
   `QuizBlock` extraction/refactor.
4. XP: a small `REVIEW_CORRECT` award (needs an enum migration) vs a non-XP progress
   signal (the floor). NOT fully reward-silent.
5. The migrations (`QuizItem` registry, `ReviewSchedule`, optional `REVIEW_CORRECT`
   enum) follow the local-first flow (`pnpm db:migrate` local, verify, then
   `db:migrate:prod`), hand-authored SQL, `migrate deploy`. Not done in this pass.

## Under-specified items the build must cover

- Orphan rows on delete: `XpEvent`/`QuizLock`/`ReviewSchedule` FK only to `User`
  (cascade). Deleting a Project/Revision/GuideCard leaves string-keyed rows whose item
  can never resolve. Specify a cleanup path (the registry sync is the natural place).
- Two content sources: resolution must handle guide keys (-> `GuideCard`) AND library
  keys (-> `MiniLesson`), not guide only.
- Key-parse fragility: a delimiter char in a free-text `Revision.label` breaks
  naive key parsing; resolve through the registry, not by parsing keys at read time.
- Cap overflow, backlog/catch-up policy, and bootstrap re-run idempotency (above).
- Anonymous users: `/review` and the nudge are signed-in-only.

## Not in scope for v1

Non-MCQ review (other formats persist nothing), SM-2 / FSRS adaptation, concept-level
interleaving (needs concept tags, absent), cross-user difficulty stats. All are
follow-ons once the v1 deck exists and the retention-outcome read justifies them.
