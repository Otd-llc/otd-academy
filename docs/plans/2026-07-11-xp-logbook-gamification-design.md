# Logbook — XP, patches, progression + lesson feedback (design)

**Status:** design, validated with Josh 2026-07-11 (two brainstorm rounds). Not
yet greenlit to build. **Name of the system = "Logbook"** (also the account area).
**Scope:** a progression layer over the Library (Phase 1); course/guide XP + the
board-photo gallery are Phase 2. Server-authoritative XP, **unlock-not-spend**, on
the OTD console/aerospace brand. **No forum** — the only user surface is an
auth-gated per-page **feedback box** that routes to admin.

---

## 1. Why (and the dual purpose)

Josh (the user) went through all 69 Library lessons and felt the gap: no way to
track or reward progress. This adds that. **Second, first-class purpose: it's an
instrumentation layer** — the XP ledger + quiz-fail rates + feedback are a
content-quality dashboard that directly feeds the **E-E-A-T depth** work (the SEO
moat's next lever). Engagement *and* a prioritized list of what content to fix.

Brand guard: framed as a **pilot's Logbook / mission progress**, never an RPG.
Vocabulary = hybrid: keep **XP** as the unit; everything else pilot/maker idiom
(Logbook, patches, ratings, wings, flight-level), **never** security-state words
(no clearance / service-record / classified).

## 2. Decisions (locked)

| Decision | Choice |
|---|---|
| v1 scope | **Full** — durable completions + server-validated quiz XP + **daily repop** (reduced practice rate) + wrong-answer lock + **stay-current** recency |
| Economy | **Unlock, not spend** — XP only rises; thresholds *grant* perks |
| Forum | **None** — replaced by the feedback box |
| Feedback reward | **Token on submit** (once/page, daily-capped) + a bonus when admin marks *useful* |
| Rewards catalog | Status only: **Logbook flair + rank title** + **certificate / `/verify` flair**. No paid-tier tie, no physical fulfillment, no access-gating |
| Stay-current | **Status only** — a warm "current through <date>" badge that greys out on lapse; **no XP penalty, no lost progress** |
| Patch visibility | **Hybrid** — roadmap patches (cluster/wings) show as locked teasers; skill/easter-egg patches hidden until earned |
| Logbook privacy | **Private** — the public flex is the certificate / `/verify` only (shareable Logbook page = fast-follow) |
| Monetization tie | **Not now** — status-only (nothing's buyable until a course revision publishes anyway) |
| Timezone | Repop keyed to **academy-local** midnight (one fixed TZ, not per-user) |

## 3. Integrity model (shapes everything)

- **Server is the source of truth for all XP.** Client calls an endpoint; the
  server validates + records. localStorage only drives the *animation*, never the
  *balance* ([[localstorage-user-scope]]).
- **Quiz XP is validated server-side** — the award endpoint re-checks the submitted
  answer index against the lesson's own contentBlocks. Honest limit: the correct
  answer is in the page content, so a determined user *could* read it — fine,
  because XP is unlock-only (cheating just levels yourself up, breaks nothing). The
  goal is **"can't accidentally farm + idempotent,"** not "cheat-proof." The
  wrong-answer lock is the real protection against guess-farming.
- **Idempotent awards** — every award carries a unique `dedupeKey`; repeats no-op
  (retries/double-clicks/races safe).
- **Stable question IDs (load-bearing).** Quiz questions today are positional array
  items with no identity; keying the ledger/locks on `slug#index` silently corrupts
  on any reorder/insert. **Add a stable `id` to quiz questions in the content
  model** (backfill the 69 lessons once; fall back to a hash of the question text
  for unmigrated rows). All `questionId` references below mean this stable id.
- **Feedback stays client-instant; the award call is async.** Do NOT move quiz
  scoring to the server — the tap → right/wrong + explain loop stays client-side
  (no added latency). The server POST is award-only, fired async; the UI shows the
  `+XP` tick optimistically and silently reconciles if the server says
  locked/duplicate/wrong. A failed award fades the tick; it never blocks the lesson.
- **Anon work never converts.** A signed-out reader's quiz-taking is invisible to
  the server; replaying client-claimed awards after sign-up would be the client
  asserting XP. Rule: pre-sign-in work doesn't count, and the UI says so UP FRONT —
  the signed-out lesson page shows a quiet "sign in to log XP" affordance where the
  tick would be. That affordance is also the point: **the Logbook is a signup
  driver for the anon SEO traffic**, converting readers to accounts before effort
  is spent, not confiscating it after.

## 4. Data model

```
model XpEvent {                     // append-only ledger; total XP = sum(amount)
  id         String   @id @default(cuid())
  userId     String
  source     XpSource
  amount     Int
  refId      String?               // lesson slug / questionId / clusterKey / feedbackId
  earnedOn   DateTime @db.Date     // the repop day for daily sources
  dedupeKey  String   @unique      // e.g. "QUIZ_CORRECT:<uid>:<slug>#<qId>:<yyyy-mm-dd>"
  createdAt  DateTime @default(now())
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
}

model LessonCompletion {           // durable milestone, ONCE per user+lesson
  userId      String
  lessonSlug  String
  completedAt DateTime @default(now())
  @@id([userId, lessonSlug])
}

model QuizLock {                   // wrong answer → this question's XP locked till repop
  userId     String
  questionId String                // "<slug>#<index>"
  lockedOn   DateTime @db.Date
  @@id([userId, questionId, lockedOn])
}

model BadgeEarned {                // patches/ratings/wings — earned = permanent (grandfathered)
  userId    String
  badgeKey  String                 // "cluster:fundamentals", "wings:all-library@69", "skill:first-try:eeg-bci"
  earnedAt  DateTime @default(now())
  meta      Json?                  // e.g. { asOfLessonCount: 69 }
  @@id([userId, badgeKey])
}

model LessonFeedback {
  id        String   @id @default(cuid())
  userId    String
  pageRef   String                 // "library/ohms-law" (P2: "guide/l1-01/REQUIREMENTS")
  body      String
  status    FeedbackStatus @default(NEW)   // NEW | USEFUL | DISMISSED
  createdAt DateTime @default(now())
  @@index([status])
}
```

Cache `User.xpTotal`, `User.level`, `User.currentThrough` (date), and
`User.logbookIntroSeenAt` for cheap reads; all recomputable from the ledger.

## 5. XP award map — Phase 1 (Library)

Amounts are a **starting economy — tune on-screen.**

| Source | Amount | Cadence | dedupeKey basis |
|---|---|---|---|
| `QUIZ_CORRECT` (first ever for that question) | +5 | once (full rate) | user + questionId + day |
| `QUIZ_CORRECT` (repop, already done before) | +2 | **daily** (reduced practice rate) | user + questionId + day |
| `LESSON_COMPLETE` (first ever) | `readMin × 3` | once (full) | user + slug + day |
| `LESSON_COMPLETE` (repop) | `readMin × 1` | **daily** (reduced) | user + slug + day |
| `CLUSTER_COMPLETE` | +100 (+patch) | once, grandfathered | user + clusterKey |
| `LIBRARY_COMPLETE` | +500 (+wings) | once, grandfathered | user + "all-library" |
| `FEEDBACK_SUBMIT` | +2 | once/page, **capped ~3/day** | user + pageRef |
| `FEEDBACK_USEFUL` | +25 (+"Shipped It" patch) | once/feedback | feedbackId |

- **First-full / repop-reduced** solves two things at once: the daily loop stays
  (a reason to return) but re-grinding the shortest lesson can't dominate rank. The
  award endpoint checks "any prior `QUIZ_CORRECT` for this question?" → reduced, else
  full.
- **Durable vs daily:** the FIRST completion writes `LessonCompletion` (drives
  progress + cluster/library milestones + patches, once). The daily practice XP is
  separate and re-earnable.
- **Wrong answer** → write a `QuizLock` for today; that question's `QUIZ_CORRECT` is
  blocked until repop. UI greys the question's XP once locked. Kills guess-farming.
- **Gating:** `LESSON_COMPLETE` fires only when every question is answered
  (right or wrong) — no skipping to the bonus.

## 6. Repop, stay-current, admin

- **Repop is free** — the `earnedOn` date in the daily dedupeKey rolls at
  **academy-local** midnight; the lesson's practice XP is re-earnable, no cron wipe.
- **Stay-current (status only):** `User.currentThrough` = last active day + a window
  (~14 days, tunable). While `now ≤ currentThrough` you're "current" (a warm badge,
  "current through Jul 25"). On lapse it just greys out — **no XP penalty, no lost
  progress, no red counter.** Positive framing, not a nag.
- **Admin "reset lesson XP"** — delete a user's (or all users') date-scoped
  `QUIZ_CORRECT`/`LESSON_COMPLETE`/`QuizLock` for a lesson, re-enabling it (testing/
  corrections). In the existing admin surface.

## 7. Grandfathering (the moat keeps growing — 12 → 69 → 100+)

- **Earned patches are permanent**, timestamped with the milestone size
  (`meta.asOfLessonCount`). Adding a cluster or a 13th Fundamentals lesson **never
  revokes** an earned patch/wings.
- **Live progress reflects current content** — a user who "finished all" then sees a
  new cluster shows incomplete again (re-openable), but keeps the old WINGS. If we
  want, a later milestone tier ("all-library v2") can be defined; not required for v1.
- **Deleted/edited questions:** the append-only ledger is untouched (XP is real +
  earned). Only live *derivation* (progress %, completion) recomputes against the
  current content set. Nothing retroactively subtracts XP.

## 8. Levels, patches, unlocks

- **Level ladder** = a flight-training progression (aspirational, non-government):
  `FL1 Ground School → FL2 First Solo → FL3 Cross-Country → FL4 Instrument →
  FL5 Commercial → FL6 Flight Instructor` (extend later). **Front-loaded curve**
  (fast early levels for early dopamine, slowing toward the top). XP-per-level = a
  tuning table.
- **Patches (Phase 1):**
  - *Roadmap (shown as locked teasers):* one per cluster (6) + **WINGS** for all-69.
  - *Skill/easter-egg (hidden until earned):* **"First Flight"** (your very first
    lesson completion — the cold-start win, earned within minutes), "First-Try" (a
    cluster with zero wrong answers), "Cross-Discipline" (a lesson from all 6
    clusters), "Shipped It" (your feedback marked useful).
  - Patch art is a **brand surface**: embroidered mission-patch / instrument-decal
    language, not flat game badges — gets its own design-sandbox round (like the
    diagrams) before build-out.
- **Unlock rewards (status only):**
  - **Logbook flair + rank title** — avatar frame options, rank title, the patch
    wall; in the Logbook + the account menu.
  - **Certificate / `/verify` flair** — level + earned patches surface on the
    shareable certificate + public `/verify` page (the one public flex; #123–129).

## 9. Surfaces (Phase 1)

1. **One-time intro** — first signed-in entry to `/library`: a single dismissible
   panel (`User.logbookIntroSeenAt`), deep-space + gold hairline (not a game popup):
   "reading lessons + passing quizzes logs XP toward your Logbook; XP earns ratings
   + patches." Ties to the existing onboarding (`/start`, #255) — frames progress
   toward **their stated goal** (see §10).
2. **`/library` index** — per-cluster completion in each cluster header (a gold ring
   or `8 / 12`) + per-row `earned / total XP` (today) + a compact Logbook summary
   (level, total XP, next-rating progress, "current" badge) in the header meta-strip.
   Folds into the redesign we just shipped ([[library-index-v3-redesign]]).
3. **Lesson page** — correct answer → an unobtrusive `+5 XP` tick: gold flash,
   **visual-only (no audio — this audience will hate a chime)**, reduced-motion
   respected, with an **`aria-live` announcement** so it isn't sight-only. Lesson
   finish → a quiet "lesson logged +N XP" line. No modal, no confetti. Signed-out:
   the tick slot renders the "sign in to log XP" affordance (§3).
4. **Feedback box** — collapsible, above the footer, mostly collapsed. **Private**
   (routes to admin, NOT a public thread). Auth-gated: no account → a "sign in to
   suggest an improvement" prompt. Submit → `FEEDBACK_SUBMIT` (capped); admin marks
   USEFUL → `FEEDBACK_USEFUL` + "Shipped It" patch. Library lessons in P1; guide
   cards in P2.
5. **Logbook (account route)** — private: total XP, level + title, next-rating
   progress, "current" status, per-cluster completion, the patch wall (hybrid
   visibility), a feed of recent XP events. Under the account menu.
6. **Admin — instrumentation view** (first-class, not a side effect): per-question
   correct/incorrect rate, per-lesson completion/abandon, feedback per page + status.
   The prioritized "what content to fix" list → feeds E-E-A-T depth.

## 10. Reuse + integrations

Per-user progress + Enrollment/grades/exams (#43) · read-time on every lesson (#293,
feeds the completion bonus) · quiz blocks (client scorer → add a server validate
endpoint) · the onboarding goal survey (`/start`, #255 — anchor XP to *their* goal)
· lifecycle email (#190/#249 — a warm "you earned your Fundamentals rating" nudge on
milestone) · certificate + `/verify` (#123–129, the public flex) · admin surface +
the `/library` redesign.

## 10b. Analytics (baseline only — no users yet, so no flag/AB apparatus)

Emit PostHog events on the existing pipeline (#189): `xp_earned`, `patch_earned`,
`level_up`, `logbook_intro_seen`, `feedback_submitted`, `signin_to_log_clicked`.
Nearly free, and the baseline is already recording when real traffic arrives.

## 11. Notifications

Earned a patch or a new level → a light lifecycle-email touch ("you earned your
Fundamentals rating") on the existing pipeline — a warm re-engagement reason, not a
nag. In-app: the tick/line at earn time.

## 12. Fast-follow + Phase 2 (explicitly out of v1)

- **SRS review queue** — repop resurfaces missed/stale questions (turns the daily
  grind into real spaced-repetition retention). v1.5.
- **Shareable Logbook page** — opt-in public progress page (organic marketing). v1.5.
- **Phase 2:** course/guide XP (stage-advance, writing-box, per-stage quiz,
  stage-clear, final, course-complete rating), the **board-photo gallery** ("winners
  circle" — R2 + admin-approve + a "Builder" patch), feedback on guide cards.

## 13. Open tuning (not blockers)

XP amounts + the level-XP curve + the currency window — tune on-screen once it's
live (a numbers sandbox pass). Patch art/names; rank titles beyond FL6.

## 14. Build sequencing (when greenlit)

1. Schema + XP ledger + award endpoints (idempotent) + server quiz-validate +
   wrong-lock + repop logic. **Unit-test award/dedupe/repop/grandfather hard** (pure
   where possible).
2. Level/patch derivation (+ grandfathering) + the Logbook route.
3. `/library` + lesson UI (progress rings, X/Y XP, +XP tick, completion line, intro
   panel, goal-tie).
4. Feedback box + admin triage + the instrumentation view.
5. Cert/`verify` flair + milestone email.
6. Tune the economy on-screen.

**Plan-level notes (so the implementation plan doesn't lose them):**
- **Level-up detection** lives in the award endpoint (compare pre/post totals,
  emit the level-up event for the UI moment + lifecycle email) — never client-side.
- **Schema discipline:** hand-authored migration → `pnpm db:migrate` (refreshes the
  test pool) → FULL tsc + FULL vitest ([[schema-change-tsc-check]]).
- `LessonFeedback` needs `onDelete` handling for user deletion (XpEvent already
  cascades); XP joins any data-export story.
- Admin reset is destructive → confirm dialog + explicit per-user/all-users scope.
- **Test the repop/midnight boundary with an injected clock**, never real time.
- `/library` progress reads = **one batched query** (Set of completed slugs +
  today's events), never 69 lookups; page is already per-request (`force-dynamic`).
- Ledger growth (~100s rows/day/active user) is fine at this scale with the
  `userId` index — note "rollup later if hot," don't build it now.

Build off `main` in a worktree; batch commits; no auto-merge ([[no-auto-merge-batch-commits]]).
