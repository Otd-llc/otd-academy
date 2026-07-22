# Cross-session review deck: design (step 4, deferred build)

Status: design only, 2026-07-21 (revised twice, after two 3-lens validation
passes). No schema migration in this pass. This is the concrete shape for
build-order step 4 in
`docs/plans/2026-07-21-inline-formative-checks-authoring-spec.md`. Build is gated on
a real prerequisite (see "Build trigger"), not started.

## Bottom line

Build a spaced review deck that resurfaces MCQ a learner has already seen, at
expanding intervals, prioritising the ones they miss GOING FORWARD. Two validation
passes drove the design to a simpler, safer shape than the first two drafts:

- **Do NOT bootstrap from historical XP/lock rows. Start schedules fresh from
  launch.** The bootstrap required migrating the whole XP-ledger key space and, worse,
  was self-defeating (the identity fix it depended on changed the very keys it
  joined on). Starting forward deletes that entire paradox at the cost of a
  head-start that is nearly worthless today (thin seen-item inventory).
- **The one remaining hard problem is identity:** the review system needs a stable,
  revision-independent, globally-unique item id that survives a text edit and a
  revision bump. `questionKey` is none of those. Solve THAT and the rest is a
  straightforward v1.

## The identity problem (the core constraint)

The deck keys per-item durable state (interval, due date, lapses) on a question's
identity. `questionKey` cannot be that identity:

- With no authored `id`, `questionKey = <prefix>#h<sha256(question.q)[:8]>`
  (`src/lib/logbook/question-key.ts:11-13`). Editing the question TEXT mints a new
  key. Correct for the XP ledger (a reworded question is a new XP item), fatal for a
  schedule (a typo fix must not reset the interval).
- The key hashes only `question.q`, not `options`/`answer`, so editing a distractor
  or the answer index does NOT change the key; the schedule survives but points at
  drifted content.
- The key is prefixed by `guideKey(project, rev, stage)` (`question-key.ts:19-25`),
  so the same question under `v1` and `v2` has different keys. A stable authored `id`
  only fills the SUFFIX; the revision stays in the prefix. So an id alone fixes
  text-edit orphaning WITHIN a revision but NOT cross-revision orphaning. Do not
  conflate the two.

What the review identity must be (DECISION #1): a `reviewItemId` that is

- revision-independent (does not embed `revLabel`), so a concept survives a revision
  bump,
- globally unique (a bare authored `id` is only unique within a card, `guide.ts:216`,
  so scope it, e.g. `<projectSlug>:<stage>:<authored-id>` or a dedicated minted id),
- authored and stable (mandated on any reviewable question, enforced at the save
  boundary and `lesson-readiness`), and
- carried in the SEED SCRIPTS, not only the live DB row. The `scripts/_l101-*.ts`
  content scripts are the source of truth and currently write no quiz ids; a re-run
  of a script that lacks the id would strip it and re-mint identity. The id must live
  in the script.

Relationship to `questionKey` and the live XP ledger: `questionKey` uses the same
authored `id` field (`question-key.ts:11`), so ADDING an id to an existing question
also changes its live `questionKey`, which the XP dedupe / firstEver / QuizLock read.
Two ways to avoid disturbing the shipped economy:

- (a) Give the review system its OWN identifier decoupled from `questionKey` (a
  separate authored field, or a minted id stored in the registry), leaving
  `questionKey` untouched. Preferred: the review deck should not perturb the XP
  ledger at all.
- (b) Accept a one-time re-key when ids are added. This is bounded: the stage GATE is
  safe (a `QuizPass` is keyed `(enrollmentId, stage)`, not `questionKey`, at
  `schema.prisma:1224`, so passing a stage survives any key change), and learners who
  already passed/completed still repop rather than full-rate re-inflate. But it still
  churns per-pick XP history, so (a) is cleaner.

Because we START FRESH (no history bootstrap), there is no requirement to migrate old
`XpEvent.refId` / `QuizLock.questionKey` rows at all. That is the main reason
start-fresh is the right call: it turns a gnarly atomic ledger migration into a
go-forward-only concern.

## Why (and the honest caveat)

Spaced, distributed retrieval outperforms massed practice for durable retention
(spacing effect, Cepeda et al. 2006). The current system tests each idea once, inside
its stage, then never again. A review deck is where the compounding happens.

Caveat: deferred on purpose, and the build trigger below was corrected by validation
(engagement telemetry is the wrong gate). Citations named from memory, not
web-verified; verify before any learner-facing copy ships (otd-content-writing
citation rule).

## The data reality (why start-fresh, not bootstrap)

What exists today: `XpEvent` (`refId = questionKey`, `earnedOn @db.Date`,
`source = STAGE_QUIZ_CORRECT`, which since step 3 means "answered", right or wrong)
and `QuizLock` (`userId, questionKey, lockedOn @db.Date`, a wrong first pick). In
principle correctness is reconstructable (an `XpEvent` for a day with no `QuizLock`
for that day), and a bootstrap COULD seed initial schedules from it.

Why we do NOT: the bootstrap keys on `questionKey`, but the identity fix re-keys
questions, so a bootstrap that ran after the id backfill would find no history and
seed every missed item as "correct" (the exact anti-goal). Making it work would need
an atomic old-key to new-key migration of `XpEvent.refId`, `XpEvent.dedupeKey` (the
key is embedded, `economy.ts:119-120`), and `QuizLock.questionKey` (a PK component).
That is a high-risk migration of a near-empty table for a head-start worth little at
current scale. Start fresh: the first POST-LAUNCH encounter of a reviewable item
creates its `ReviewSchedule` row. No history read, no re-keying, no correctness join.

Still MISSING and to be built: the schedule state (new model), the stable
`reviewItemId` + a registry (identity fix), and the review answer path. Only-MCQ
remains a v1 scope limit (other formats persist nothing).

## Proposed shape

### 1. Item registry (the identity enforcement point)

A `QuizItem` registry keyed by the stable `reviewItemId`:
`{ reviewItemId (PK), projectSlug, stage, q, options, answer, updatedAt }` (no
`revLabel` if identity is revision-independent; carry it only if per-revision is
chosen). Synced wherever a QUIZ block's `contentBlocks` is written: the
`editGuideCard` save boundary and `materializeGuide` (`src/lib/actions/guides.ts`),
and the seed scripts. Note `writeGuideBlockMedia` (`src/lib/guide-block-write.ts`)
also writes `contentBlocks` but only rewrites image/video `src`/caption and hard-
rejects non-media blocks, so it can never touch a quiz item and does not need a sync
hook. The registry gives O(1) resolution by `reviewItemId` and is where "reviewable
questions must have a stable id" is enforced. No historical-key column is needed
because we do not bootstrap from history.

Resolution note: a guide `questionKey` is structured
(`guide:<project>:<rev>:<stage>#suffix`) and resolves to one `GuideCard` via
`Project.slug` -> the case-insensitive `revision_project_label_ci` index -> `Guide`
-> `GuideCard @@unique([guideId, stage])` (a 3-hop traversal; `guideId` is not in the
key). The registry makes this moot for the deck by storing `q`/`options`/`answer`
directly. (Correction to an earlier draft: `Revision.label` cannot carry `:` or `#`
in normal use (`createRevisionSchema` enforces `/^[A-Za-z0-9 .-]+$/`,
`src/lib/schemas/revision.ts`), so key-parse fragility is a seed-only edge, not a
live hazard.)

### 2. Scheduling model (the one new table)

Proposed model, NOT yet migrated:

```
model ReviewSchedule {
  id           String   @id @default(cuid())
  userId       String
  reviewItemId String
  dueOn        DateTime @db.Date
  intervalDays Int      @default(1)
  lapses       Int      @default(0)
  suspended    Boolean  @default(false)
  awardedForDueOn DateTime? @db.Date  // anti-farm: at most one review award per due cycle
  lastSeenOn   DateTime @db.Date
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([userId, reviewItemId])
  @@index([userId, dueOn])
}
```

Add the required back-relation `reviewSchedules ReviewSchedule[]` to `User` (Prisma
needs both sides). Algorithm v1: fixed expanding intervals `1 -> 3 -> 7 -> 21 -> 60`,
plus:

- **Jitter**: +/- ~15% on each computed interval so a batch does not march in
  lockstep and pile up on one future day.
- **Lapse = step down, not reset to 1**: a single miss drops one-to-two rungs
  (`interval = max(1, round(prev * 0.4))`), not the whole ladder. Wire the `lapses`
  counter (otherwise dead data) to leech handling: repeated lapses set `suspended =
  true` instead of re-drilling forever.
- **Graduate the ceiling**: past 60 days keep expanding (x ~2.5) or mark graduated so
  best-known items stop consuming the daily queue.
- **Creation is forward-only** (start-fresh): the first post-launch answer of a
  reviewable item upserts its row (`dueOn = day + first interval`). No history seed.

### 3. What feeds the deck

Items the user has answered at least once post-launch, `dueOn <= today`, not
suspended, ordered overdue-first with MISSES prioritised, then shuffled across
stages/projects. Cap the daily session (e.g. 15) with an explicit overflow rule:
excess rolls forward, a backlog drains oldest-first at the cap, no unbounded wall.

Honest naming: cross-stage shuffling is DE-MASSING, not the Rohrer & Taylor
interleaving mechanism (which juxtaposes CONFUSABLE types); the substrate has no
concept tags to place confusable items adjacent, so call it de-massing. Recognition
caveat: v1 buys spacing-of-RECOGNITION (MCQ), the smaller half of the gains. **Shuffle
option order every review** so repeated exposure trains the concept, not the answer's
position (response learning). Include this in v1.

### 4. Surface + the review write path

- A dedicated `/review` route, signed-in-gated (anon has no schedule). A "N due"
  nudge on the course hub / logbook is the entry.
- `QuizBlock` is not a free reuse: it has no callback/`onAnswer` prop and internally
  calls `recordStageQuizAnswer`/`recordQuizAnswer` from `fireAnswer`, gated on
  `lb.mode`, and is architected as N-questions-from-one-card. Plan to extract the
  single-question grade-as-you-go widget (pure client state) or add a `mode:"review"`
  branch. Adding an `id` field inside a question does NOT affect the shipped
  parse-resilience / capture `blockIndex` work (block count/order unchanged).
- A dedicated `recordReviewAnswer(reviewItemId, pick)` action: re-scores the pick
  against the registry's stored answer (server-authoritative, mirroring
  `recordQuizPass`), advances/steps the schedule in ONE transaction, uses
  `academyDate` (America/Chicago, `economy.ts`) for "today" so day math is
  consistent, checks ownership, and is idempotent.

### 5. XP interaction (reconsidered, with the anti-farm made real)

Do NOT make the deck reward-silent (that repeats the step-3 mistake: the
highest-leverage tool as the only unrewarded one). Floor: a non-XP progress signal
(due-count cleared, a streak). Preferred: a small, capped, diminishing
`REVIEW_CORRECT` award, at most once per DUE CYCLE.

Anti-farm correction: "once per due cycle" is NOT expressible with the existing
per-DAY dedupe key (`SOURCE:userId:key:academyDay`, `economy.ts:106-127`): a
still-due item could be farmed once each calendar day. Gate the award on the
schedule's `awardedForDueOn` column (above): award only when `awardedForDueOn <
dueOn`, then set it. `REVIEW_CORRECT` is a new `XpSource` enum value (Prisma enum
migration, full tsc + vitest per the schema-change rule); if deferred, ship the
non-XP progress signal, never zero feedback.

## Build trigger (corrected)

Not engagement telemetry (the wrong proxy: within-stage check use can be low BECAUSE
the check is consequence-free, and the deck is what adds the consequence). The real
prerequisites: (a) the identity fix landed (stable `reviewItemId` + registry + seed-
script ids), and (b) enough content and returning learners that a forward-built deck
accumulates due items worth surfacing. Pair the launch with a RETENTION-OUTCOME read
(return rate, re-test accuracy on reviewed vs not), the thing the tool exists to
move, not a stand-in that does not predict it.

## Decisions to confirm before migrating

1. **Identity (the gate).** Define `reviewItemId` (revision-independent, globally
   unique), mandate it on reviewable questions, put it in the seed scripts, and decide
   whether it is decoupled from `questionKey` (preferred, leaves the XP ledger
   untouched) or reuses the authored `id` (accepts a one-time live re-key). Build the
   `QuizItem` registry as the enforcement point.
2. **Start fresh, no history bootstrap** (recommended) vs migrate the ledger key space
   to seed from history (high-risk, low current value). This design assumes start
   fresh.
3. Scheduling: fixed intervals + jitter + step-down lapse + graduate ceiling
   (recommended v1) vs SM-2 (not for v1).
4. Surface: `/review` route + hub nudge; accept the `QuizBlock` extraction.
5. XP: small `REVIEW_CORRECT` award gated on `awardedForDueOn` (needs an enum
   migration) vs a non-XP progress signal (the floor). Not reward-silent.
6. The migrations (`QuizItem`, `ReviewSchedule`, optional `REVIEW_CORRECT`) follow the
   local-first flow (`pnpm db:migrate` local, verify, then `db:migrate:prod`), hand-
   authored SQL, `migrate deploy`. Not done in this pass.

## Under-specified items the build must cover

- Orphan rows on delete: `ReviewSchedule` FKs only to `User` (cascade). Deleting a
  Project/Revision/GuideCard leaves rows whose `reviewItemId` can never resolve; the
  registry sync is the natural cleanup point.
- Two content sources: resolution/registry must cover guide items AND library
  (`MiniLesson`) items, not guide only.
- Cap overflow, backlog/catch-up drain policy (above), and the `awardedForDueOn`
  anti-farm state (above).
- Anonymous users: `/review` and the nudge are signed-in-only.

## Not in scope for v1

Non-MCQ review (other formats persist nothing), SM-2 / FSRS adaptation, concept-level
interleaving (needs concept tags, absent), a history bootstrap, cross-user difficulty
stats. All are follow-ons once v1 exists and the retention-outcome read justifies
them.
