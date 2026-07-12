# Logbook (XP + patches + feedback) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build Phase 1 of the Logbook — a server-authoritative XP/patch progression
layer over the 69-lesson public Library, plus the per-page feedback channel and the
admin instrumentation view.

**Architecture:** Append-only `XpEvent` ledger with unique dedupe keys (idempotent
awards, daily "repop" via date-scoped keys), durable `LessonCompletion` milestones
driving cluster/library patches, and server actions that re-validate quiz answers
against the lesson's own contentBlocks. Client keeps instant quiz feedback; award
calls are async + optimistic. Level/patches derive from the ledger.

**Tech Stack:** Next.js 16 App Router + server actions, Prisma 7 / Neon Postgres
(hand-authored SQL migrations), vitest (per-file Neon branch pool), Tailwind v4
tokens (OTD console aesthetic).

**READ FIRST:** `docs/plans/2026-07-11-xp-logbook-gamification-design.md` — the
validated design. Every decision (vocabulary, amounts, grandfathering, integrity
model) is there; this plan implements it. Also read `CLAUDE.md` (repo rules).

**Repo ground rules that WILL bite you:**
- `.env.local` `DATABASE_URL` is **PROD**. Migrations: hand-write SQL under
  `prisma/migrations/<timestamp>_<name>/migration.sql`, then `pnpm db:migrate`
  (runs `migrate deploy` + refreshes the test pool). Never `migrate dev`.
- After `prisma generate`: full tsc + **full** vitest (enum-mirror maps break
  silently — see memory `schema-change-tsc-check`). Restart `next dev`.
- `"use server"` files export **only async functions** (a type re-export crashes at
  runtime and tsc won't catch it).
- Tests run against the Neon branch pool (`.env.test.local` present in this
  worktree). DB tests use throwaway rows (create + cleanup); never depend on real
  curriculum rows beyond the seed fixture.
- Run commands from `C:\zzz\pf-logbook` (PowerShell): `pnpm exec vitest run <path>`,
  `pnpm exec tsc --noEmit` (if pnpm balks with a modules-dir purge error, fall back
  to `node node_modules/vitest/vitest.mjs run <path>` / `node
  node_modules/typescript/lib/tsc.js --noEmit`). Dev server: `Start-Process node
  -ArgumentList "node_modules/next/dist/bin/next","dev","-p","3006" -WindowStyle
  Hidden` (harness-backgrounded servers die; use localhost, never 127.0.0.1).
- Interactive-transaction precedent: `src/lib/actions/pass.ts` uses
  `db.$transaction(async (tx) => …)` — mirror that pattern.
- UI follows the otd-frontend-design skill: token colors only, hairlines not filled
  cards, Saira numerals, mono eyebrows, no em-dashes anywhere rendered.

---

## Task 1: Schema + migration

**Files:**
- Modify: `prisma/schema.prisma` (new models + enums + User fields)
- Create: `prisma/migrations/20260711120000_logbook/migration.sql`

**Step 1: Add to `prisma/schema.prisma`**

New enums (top-level, near the other enums):

```prisma
enum XpSource {
  QUIZ_CORRECT
  LESSON_COMPLETE
  CLUSTER_COMPLETE
  LIBRARY_COMPLETE
  FEEDBACK_SUBMIT
  FEEDBACK_USEFUL
}

enum FeedbackStatus {
  NEW
  USEFUL
  DISMISSED
}
```

New models:

```prisma
// Append-only XP ledger (the Logbook's source of truth). Total XP = sum(amount);
// User.xpTotal/level are cached mirrors updated in the same transaction as each
// insert. dedupeKey is the idempotency guard: daily sources embed the academy-day
// date, once-ever sources don't. NEVER update or delete rows outside the admin
// reset (design §6).
model XpEvent {
  id        String   @id @default(cuid())
  userId    String
  source    XpSource
  amount    Int
  refId     String? // lesson slug / questionKey / clusterKey / feedbackId
  earnedOn  DateTime @db.Date
  dedupeKey String   @unique
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([source, refId])
}

// Durable once-ever lesson completion (drives progress + cluster/library patches).
// Distinct from the daily LESSON_COMPLETE practice XP (design §5).
model LessonCompletion {
  userId      String
  lessonSlug  String
  completedAt DateTime @default(now())
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([userId, lessonSlug])
}

// A wrong first pick on a question locks its XP until the next academy day
// (anti guess-farming, design §5).
model QuizLock {
  userId      String
  questionKey String // stable question id (see Task 2)
  lockedOn    DateTime @db.Date
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([userId, questionKey, lockedOn])
}

// Patches / ratings / wings. Earned = permanent (grandfathered, design §7);
// meta records the milestone size (e.g. { asOfLessonCount: 69 }).
model BadgeEarned {
  userId   String
  badgeKey String
  earnedAt DateTime @default(now())
  meta     Json?
  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([userId, badgeKey])
}

// Per-page lesson feedback (the no-forum channel, design §9.4). Routes to admin;
// USEFUL pays the bonus + the Shipped It patch.
model LessonFeedback {
  id        String         @id @default(cuid())
  userId    String
  pageRef   String // e.g. "library/ohms-law"
  body      String
  status    FeedbackStatus @default(NEW)
  createdAt DateTime       @default(now())
  user      User           @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([status])
  @@index([userId, pageRef])
}
```

User additions (inside `model User`, near the onboarding fields, plus the four
relation arrays at the bottom with the other relations):

```prisma
  // Logbook (XP progression) cached mirrors — recomputable from the XpEvent
  // ledger; updated transactionally with each award. currentThrough = the
  // stay-current window end (status only, design §6). logbookIntroSeenAt = the
  // one-time /library intro panel flag.
  xpTotal            Int       @default(0)
  level              Int       @default(1)
  currentThrough     DateTime? @db.Date
  logbookIntroSeenAt DateTime?

  xpEvents          XpEvent[]
  lessonCompletions LessonCompletion[]
  quizLocks         QuizLock[]
  badges            BadgeEarned[]
  lessonFeedback    LessonFeedback[]
```

**Step 2: Hand-write the migration SQL**

`prisma/migrations/20260711120000_logbook/migration.sql`:

```sql
-- Logbook: XP ledger + milestones + locks + badges + feedback (design 2026-07-11)

CREATE TYPE "XpSource" AS ENUM ('QUIZ_CORRECT','LESSON_COMPLETE','CLUSTER_COMPLETE','LIBRARY_COMPLETE','FEEDBACK_SUBMIT','FEEDBACK_USEFUL');
CREATE TYPE "FeedbackStatus" AS ENUM ('NEW','USEFUL','DISMISSED');

ALTER TABLE "User"
  ADD COLUMN "xpTotal" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "level" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "currentThrough" DATE,
  ADD COLUMN "logbookIntroSeenAt" TIMESTAMP(3);

CREATE TABLE "XpEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "source" "XpSource" NOT NULL,
  "amount" INTEGER NOT NULL,
  "refId" TEXT,
  "earnedOn" DATE NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "XpEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "XpEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "XpEvent_dedupeKey_key" ON "XpEvent"("dedupeKey");
CREATE INDEX "XpEvent_userId_idx" ON "XpEvent"("userId");
CREATE INDEX "XpEvent_source_refId_idx" ON "XpEvent"("source", "refId");

CREATE TABLE "LessonCompletion" (
  "userId" TEXT NOT NULL,
  "lessonSlug" TEXT NOT NULL,
  "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LessonCompletion_pkey" PRIMARY KEY ("userId","lessonSlug"),
  CONSTRAINT "LessonCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "QuizLock" (
  "userId" TEXT NOT NULL,
  "questionKey" TEXT NOT NULL,
  "lockedOn" DATE NOT NULL,
  CONSTRAINT "QuizLock_pkey" PRIMARY KEY ("userId","questionKey","lockedOn"),
  CONSTRAINT "QuizLock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "BadgeEarned" (
  "userId" TEXT NOT NULL,
  "badgeKey" TEXT NOT NULL,
  "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "meta" JSONB,
  CONSTRAINT "BadgeEarned_pkey" PRIMARY KEY ("userId","badgeKey"),
  CONSTRAINT "BadgeEarned_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "LessonFeedback" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "pageRef" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "status" "FeedbackStatus" NOT NULL DEFAULT 'NEW',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LessonFeedback_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LessonFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "LessonFeedback_status_idx" ON "LessonFeedback"("status");
CREATE INDEX "LessonFeedback_userId_pageRef_idx" ON "LessonFeedback"("userId","pageRef");
```

**Step 3: Apply + regenerate**

Run: `pnpm db:migrate` (applies to PROD + refreshes the test pool), then
`pnpm exec prisma generate`.
Expected: migration applied, client generated, `test:pool:refresh` completes.

**Step 4: Full typecheck + full test suite** (the schema-change rule)

Run: `pnpm exec tsc --noEmit` then `pnpm exec vitest run`
Expected: 0 errors; whole suite green (~1558 tests, ~2 min).

**Step 5: Commit**

```bash
git add prisma/
git commit -m "feat(logbook): schema — XP ledger, completions, locks, badges, feedback"
```

---

## Task 2: Stable question keys

Quiz questions are positional array items with no identity; the ledger/locks need a
stable key that survives reorder/insert (design §3). Optional `id` on the schema +
a hash fallback for existing content — no backfill needed (an edited question text
= a new question, which matches the grandfathering semantics).

**Files:**
- Modify: `src/lib/schemas/guide.ts` (quiz question object, ~line 152)
- Create: `src/lib/logbook/question-key.ts`
- Test: `src/lib/logbook/question-key.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { questionKey } from "@/lib/logbook/question-key";

describe("questionKey", () => {
  it("uses the explicit id when present", () => {
    expect(questionKey("ohms-law", { id: "q-volts", q: "What is V?" })).toBe(
      "ohms-law#q-volts",
    );
  });
  it("falls back to a stable hash of the question text", () => {
    const a = questionKey("ohms-law", { q: "What is V?" });
    const b = questionKey("ohms-law", { q: "What is V?" });
    expect(a).toBe(b);
    expect(a).toMatch(/^ohms-law#h[0-9a-f]{8}$/);
  });
  it("differs when the text differs", () => {
    expect(questionKey("s", { q: "A" })).not.toBe(questionKey("s", { q: "B" }));
  });
});
```

**Step 2: Run to verify it fails** — `pnpm exec vitest run src/lib/logbook/question-key.test.ts`
Expected: FAIL (module not found).

**Step 3: Implement**

`src/lib/logbook/question-key.ts`:

```ts
// Stable identity for a quiz question, for the XP ledger + locks (design §3).
// Prefer an authored `id` (new content); fall back to a hash of the question
// text (the 69 existing lessons — no backfill needed). Editing a question's text
// without an id makes it a NEW question, which matches grandfathering (§7).
import { createHash } from "node:crypto";

export function questionKey(
  lessonSlug: string,
  question: { id?: string; q: string },
): string {
  if (question.id) return `${lessonSlug}#${question.id}`;
  const h = createHash("sha256").update(question.q).digest("hex").slice(0, 8);
  return `${lessonSlug}#h${h}`;
}
```

> **SERVER-ONLY:** `node:crypto` means this module must never be imported by a
> client component. Keys are computed server-side (the lesson page / GuideBlocks,
> both server components) and passed DOWN to `QuizBlock` as a `string[]` aligned
> with the questions array (Task 10). If a client import sneaks in, the build
> fails on the node built-in — that's the guardrail working.

And in `src/lib/schemas/guide.ts`, add to the quiz question object (next to `q`):

```ts
            // Stable identity for the Logbook XP ledger (optional; absent →
            // key falls back to a hash of `q`, see question-key.ts).
            id: z.string().trim().min(1).max(60).optional(),
```

**Step 4: Run tests** — same command. Expected: PASS. Also
`pnpm exec vitest run src/lib` to catch schema ripples.

**Step 5: Commit** — `git add … ; git commit -m "feat(logbook): stable question keys (id + hash fallback)"`

---

## Task 3: Economy (pure)

All numbers/curves in one tunable module. Academy day = **America/Chicago**
(Broken Arrow OK; design §2 timezone row).

**Files:**
- Create: `src/lib/logbook/economy.ts`
- Test: `src/lib/logbook/economy.test.ts`

**Step 1: Failing tests** (inject dates — never real time, design §14):

```ts
import { describe, it, expect } from "vitest";
import {
  academyDay, academyDate, quizXp, lessonXp, levelFor, LEVELS, dedupe,
} from "@/lib/logbook/economy";

describe("academyDay", () => {
  it("keys to America/Chicago, not UTC", () => {
    // 2026-07-11T03:00Z = 2026-07-10 22:00 in Chicago (CDT)
    expect(academyDay(new Date("2026-07-11T03:00:00Z"))).toBe("2026-07-10");
    expect(academyDay(new Date("2026-07-11T06:00:00Z"))).toBe("2026-07-11");
  });
  it("academyDate mirrors academyDay as a 00:00Z Date", () => {
    expect(academyDate(new Date("2026-07-11T03:00:00Z")).toISOString()).toBe(
      "2026-07-10T00:00:00.000Z",
    );
  });
});

describe("amounts", () => {
  it("quiz: full first-ever, reduced on repop", () => {
    expect(quizXp({ firstEver: true })).toBe(5);
    expect(quizXp({ firstEver: false })).toBe(2);
  });
  it("lesson: readMin-scaled, full then reduced", () => {
    expect(lessonXp(4, { firstEver: true })).toBe(12);
    expect(lessonXp(4, { firstEver: false })).toBe(4);
  });
});

describe("levelFor", () => {
  it("walks the FL ladder", () => {
    expect(levelFor(0)).toMatchObject({ level: 1 });
    expect(levelFor(LEVELS[1].minXp)).toMatchObject({ level: 2 });
    expect(levelFor(999999).level).toBe(LEVELS.length);
  });
});

describe("dedupe keys", () => {
  it("daily sources embed the day; once sources don't", () => {
    const d = new Date("2026-07-11T12:00:00Z");
    expect(dedupe.quizCorrect("u1", "s#q1", d)).toBe("QUIZ_CORRECT:u1:s#q1:2026-07-11");
    expect(dedupe.clusterComplete("u1", "fundamentals")).toBe("CLUSTER_COMPLETE:u1:fundamentals");
  });
});
```

**Step 2: Fail** — `pnpm exec vitest run src/lib/logbook/economy.test.ts`

**Step 3: Implement** `src/lib/logbook/economy.ts`:

```ts
// The Logbook economy: every amount, curve, and key in ONE tunable module
// (design §5/§7/§13). Pure — no DB, no clock reads (callers inject `now`).

export const XP = {
  QUIZ_FULL: 5,
  QUIZ_REPOP: 2,
  LESSON_PER_MIN_FULL: 3,
  LESSON_PER_MIN_REPOP: 1,
  FEEDBACK_SUBMIT: 2,
  FEEDBACK_USEFUL: 25,
} as const;
export const CLUSTER_XP = 100;
export const LIBRARY_XP = 500;
export const FEEDBACK_DAILY_CAP = 3;
export const CURRENT_WINDOW_DAYS = 14;

// The flight-training ladder (design §8). Front-loaded: fast early levels.
export const LEVELS = [
  { level: 1, minXp: 0, title: "Ground School" },
  { level: 2, minXp: 50, title: "First Solo" },
  { level: 3, minXp: 200, title: "Cross-Country" },
  { level: 4, minXp: 600, title: "Instrument" },
  { level: 5, minXp: 1300, title: "Commercial" },
  { level: 6, minXp: 2400, title: "Flight Instructor" },
] as const;

export function levelFor(xpTotal: number) {
  let cur = LEVELS[0];
  for (const l of LEVELS) if (xpTotal >= l.minXp) cur = l;
  const next = LEVELS[cur.level] ?? null; // index = level (1-based levels)
  return { ...cur, next };
}

/** The academy-local (America/Chicago) calendar day for `now`, as yyyy-mm-dd. */
export function academyDay(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now); // en-CA renders yyyy-mm-dd
}

/** The same academy day as a Date (00:00Z) — the ONE derivation both
 * `XpEvent.earnedOn` and `QuizLock.lockedOn` use, so they can never disagree. */
export function academyDate(now: Date): Date {
  return new Date(`${academyDay(now)}T00:00:00Z`);
}

export const quizXp = (o: { firstEver: boolean }) =>
  o.firstEver ? XP.QUIZ_FULL : XP.QUIZ_REPOP;
export const lessonXp = (readMin: number, o: { firstEver: boolean }) =>
  Math.max(1, readMin) * (o.firstEver ? XP.LESSON_PER_MIN_FULL : XP.LESSON_PER_MIN_REPOP);

export const dedupe = {
  quizCorrect: (userId: string, qKey: string, now: Date) =>
    `QUIZ_CORRECT:${userId}:${qKey}:${academyDay(now)}`,
  lessonComplete: (userId: string, slug: string, now: Date) =>
    `LESSON_COMPLETE:${userId}:${slug}:${academyDay(now)}`,
  clusterComplete: (userId: string, clusterKey: string) =>
    `CLUSTER_COMPLETE:${userId}:${clusterKey}`,
  libraryComplete: (userId: string) => `LIBRARY_COMPLETE:${userId}`,
  feedbackSubmit: (userId: string, pageRef: string) =>
    `FEEDBACK_SUBMIT:${userId}:${pageRef}`,
  feedbackUseful: (feedbackId: string) => `FEEDBACK_USEFUL:${feedbackId}`,
} as const;
```

**Step 4: Pass.** **Step 5: Commit** `feat(logbook): economy — amounts, ladder, academy-day, dedupe keys`

---

## Task 4: Award engine (idempotent writes)

**Files:**
- Create: `src/lib/logbook/award.ts`
- Test: `src/lib/logbook/award.test.ts` (DB-backed; throwaway user)

**Step 1: Failing test** — create a throwaway user, award twice with the same
dedupeKey, assert: one `XpEvent`, `xpTotal` incremented once, second call returns
`{ awarded: false }`; a level-crossing award returns `levelUp`. Cleanup deletes the
user (cascades). Mirror an existing DB test's setup (see
`src/lib/library/*.test.ts` files with db imports for the house pattern).

```ts
import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db";
import { awardXp } from "@/lib/logbook/award";

const email = `logbook-award-${Date.now()}@test.local`;
let userId: string;

describe("awardXp", () => {
  it("awards once, dedupes the retry, updates the cached total", async () => {
    const u = await db.user.create({ data: { email } });
    userId = u.id;
    const now = new Date("2026-07-11T12:00:00Z");
    const args = {
      userId, source: "QUIZ_CORRECT" as const, amount: 5,
      refId: "s#q1", dedupeKey: "QUIZ_CORRECT:test:once", now,
    };
    const first = await awardXp(args);
    expect(first).toMatchObject({ awarded: true, xpTotal: 5 });
    const second = await awardXp(args);
    expect(second).toMatchObject({ awarded: false });
    const fresh = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(fresh.xpTotal).toBe(5);
    expect(fresh.currentThrough).not.toBeNull();
  });

  it("reports a level-up when the total crosses a threshold", async () => {
    const r = await awardXp({
      userId, source: "CLUSTER_COMPLETE", amount: 100,
      refId: "x", dedupeKey: "CLUSTER_COMPLETE:test:levelup",
      now: new Date("2026-07-11T12:00:00Z"),
    });
    expect(r.awarded).toBe(true);
    expect(r.levelUp).toMatchObject({ level: 2 }); // 105 ≥ 50
  });
});

afterAll(async () => { if (userId) await db.user.delete({ where: { id: userId } }); });
```

**Step 2: Fail.**

**Step 3: Implement** `src/lib/logbook/award.ts`:

```ts
// The single write path for XP (design §3): idempotent on dedupeKey, updates the
// cached User.xpTotal/level/currentThrough in the same transaction, and detects
// level-ups server-side (design §14 — never client-side).
import { Prisma, type XpSource } from "@prisma/client";
import { db } from "@/lib/db";
import { academyDate, levelFor, CURRENT_WINDOW_DAYS } from "@/lib/logbook/economy";

export type AwardResult =
  | { awarded: true; xpTotal: number; levelUp: { level: number; title: string } | null }
  | { awarded: false };

export async function awardXp(o: {
  userId: string;
  source: XpSource;
  amount: number;
  refId?: string;
  dedupeKey: string;
  now: Date;
}): Promise<AwardResult> {
  const earnedOn = academyDate(o.now); // shared helper: Date at 00:00Z of academyDay
  const currentThrough = new Date(earnedOn);
  currentThrough.setUTCDate(currentThrough.getUTCDate() + CURRENT_WINDOW_DAYS);
  try {
    // Level recompute stays INSIDE the transaction so two concurrent awards can't
    // both observe the crossing and double-report a level-up (double email).
    const result = await db.$transaction(async (tx) => {
      await tx.xpEvent.create({
        data: {
          userId: o.userId, source: o.source, amount: o.amount,
          refId: o.refId, earnedOn, dedupeKey: o.dedupeKey,
        },
      });
      const bumped = await tx.user.update({
        where: { id: o.userId },
        data: { xpTotal: { increment: o.amount }, currentThrough },
        select: { xpTotal: true, level: true, id: true },
      });
      const after = levelFor(bumped.xpTotal);
      let levelUp: { level: number; title: string } | null = null;
      if (after.level > bumped.level) {
        await tx.user.update({
          where: { id: bumped.id },
          data: { level: after.level },
        });
        levelUp = { level: after.level, title: after.title };
      }
      return { xpTotal: bumped.xpTotal, levelUp };
    });
    return { awarded: true, ...result };
  } catch (e) {
    // Unique violation on dedupeKey = an idempotent replay: a no-op, not an error.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { awarded: false };
    }
    throw e;
  }
}
```

**Step 4: Pass** — `pnpm exec vitest run src/lib/logbook/award.test.ts`
**Step 5: Commit** `feat(logbook): idempotent award engine with cached totals + level-up detection`

---

## Task 5: Quiz + lesson award actions (server)

The core loop. Mirrors the `recordQuizPass` precedent (`src/lib/actions/quiz.ts`):
the server re-validates against the lesson's own contentBlocks.

**Files:**
- Create: `src/lib/logbook/lesson-awards.ts` (pure-ish core, unit-testable)
- Create: `src/lib/actions/logbook.ts` (`"use server"` — async fns ONLY)
- Test: `src/lib/logbook/lesson-awards.test.ts` (DB-backed)

**Behavior to implement (design §5):**

`recordQuizAnswer({ slug, questionKey, pick }, userId, now)`:
1. Load the lesson (`published: true, accessTier: "PUBLIC"`) with contentBlocks;
   find the quiz question whose `questionKey(slug, q)` matches. Unknown → `{ ok:false }`.
2. If `pick !== question.answer` → upsert `QuizLock(userId, questionKey,
   academyDate(now))`, return `{ ok: true, correct: false, xp: 0 }`. **The client
   MUST call this on wrong first picks too** — the lock row is what later satisfies
   the completion check (Task 10 wires it).
3. If a `QuizLock` exists for today → `{ ok: true, correct: true, xp: 0, locked: true }`.
4. Else: `firstEver` = no prior `XpEvent(source: QUIZ_CORRECT, refId: questionKey)`
   **AND no `LessonCompletion` row for this lesson** (the completion row survives an
   admin reset, so a reset re-enables practice at the REPOP rate, never full-rate
   re-inflation). Award `quizXp({firstEver})` with `dedupe.quizCorrect(...)`.
   Return the award result (+ `levelUp` passthrough) **including the awarded
   `xp` amount — the client renders the server's number, never its own guess.**

`recordLessonComplete({ slug }, userId, now)`:
1. Load the lesson + its questions; compute every questionKey. Zero-question
   lessons complete on call — a dead path in practice (**verified 2026-07-11: all
   69 published lessons carry ≥1 quiz, 207 questions total**) but keep the guard.
2. "Attempted today" per key = an `XpEvent(QUIZ_CORRECT, refId=key)` with
   `earnedOn = today` OR a `QuizLock(lockedOn = today)`. If any key is missing →
   `{ ok: false, incomplete: true }` (the server never trusts the client's claim).
3. Daily XP: `firstEver` = **no `LessonCompletion` row for the slug** (NOT "no
   prior event" — completion rows survive an admin reset, events don't); award
   `lessonXp(readingMinutes(contentBlocks), {firstEver})` (import the existing
   `readingMinutes` from `@/lib/library/reading-time`).
4. Durable milestone (first time only): create `LessonCompletion` (catch P2002 →
   already exists → skip the cascade). Every `BadgeEarned.create` in the cascade
   gets the SAME P2002-catch treatment (composite PK; a concurrent double-fire of
   a first completion must no-op, never throw — mirror the award engine's
   pattern). Then the cascade inside the same flow:
   - cluster complete? (`LessonCompletion` count for the cluster's published
     slugs == cluster size) → `awardXp(CLUSTER_COMPLETE)` + `BadgeEarned`
     (`cluster:<key>`, `meta.asOfLessonCount`).
   - all published lessons complete? → `awardXp(LIBRARY_COMPLETE)` + wings badge.
   - first-ever completion at all? → "First Flight" badge (`skill:first-flight`).
5. Return `{ ok: true, xp, levelUp, newBadges: [...] }`.

The `"use server"` wrappers in `src/lib/actions/logbook.ts` do `auth()` → 401-ish
`{ ok: false, needsAuth: true }` when signed out, then call the core with
`session.user` resolved to the User row + `new Date()`.

**Steps (TDD, DB-backed with a throwaway user + a THROWAWAY lesson row you create
with 2 quiz questions — never a real curriculum row):**

1. Write failing tests covering: correct-first-pick awards 5 · wrong-then-correct
   awards 0 + lock row exists · replay same day → `awarded:false` path (xp 0) ·
   completion refuses while a question unattempted · completion awards
   `readMin×3` + creates `LessonCompletion` + First Flight badge · second-day
   completion (inject `now` +1 day) awards reduced without new milestone ·
   cluster/library cascade: extract the decision as a PURE helper —
   **Create: `src/lib/logbook/milestones.ts`** exporting
   `milestonesFor(completedSlugs: Set<string>, publishedByCluster: Map<string, string[]>)`
   → `{ clusterKeys: string[]; libraryComplete: boolean }` — and unit-test IT
   exhaustively (`milestones.test.ts`: partial cluster, exact completion, growing
   library reopening, empty clusters ignored). Keep the DB test to the
   lesson-level awards; the action just feeds real data into the pure helper.
2. Run → fail. 3. Implement. 4. Run → pass, then `pnpm exec vitest run src/lib/logbook`.
5. Commit: `feat(logbook): quiz + lesson award actions (server-validated, repop, locks, milestones)`

---

## Task 6: Feedback actions

**Files:**
- Create: `src/lib/actions/feedback.ts` (`"use server"`)
- Test: `src/lib/logbook/feedback.test.ts`

**Behavior (design §5/§9.4):** `submitLessonFeedback({ pageRef, body })` — auth
required; body 10–2000 chars; award `FEEDBACK_SUBMIT` once per page
(`dedupe.feedbackSubmit`) AND only if today's submit-award count < `FEEDBACK_DAILY_CAP`
(count today's `XpEvent(source: FEEDBACK_SUBMIT)`); the feedback row itself saves
independent of the XP cap, but with a HARD row limit: refuse the insert when the
user already has **10 `LessonFeedback` rows created today** (flood guard —
`{ ok:false, error:"daily limit" }`). `markFeedback({ id, status })` —
`requireAdmin()` (`src/lib/auth-helpers.ts`); on first transition to `USEFUL`
(guard: only from `NEW`): award `FEEDBACK_USEFUL` **to the author** (`dedupe.feedbackUseful(id)`)
+ `BadgeEarned` (`skill:shipped-it`). Feedback `body` is rendered as **plain text**
everywhere (admin table included) — never HTML.

TDD steps as before (throwaway user; assert cap behavior by injecting 3 prior
submit events). Commit: `feat(logbook): feedback channel — capped submit XP + useful bonus`

---

## Task 7: Logbook + library-progress loaders

**Files:**
- Create: `src/lib/logbook/load.ts`
- Test: `src/lib/logbook/load.test.ts`

**`getLibraryProgress(userId, buckets, now)`** — ONE batched read (design §14):
today's `XpEvent` rows (QUIZ_CORRECT + LESSON_COMPLETE) + all `LessonCompletion`
slugs + all `QuizLock` rows for today, returned as Sets/Maps the page can join
against `listPublishedByCluster()` output. Per lesson: `earnedToday`, `maxToday`,
`completed`. **`maxToday` follows the completion state** (the completions Set is
already in hand): not-yet-completed lesson → FULL rates (Qs×5 + readMin×3);
completed → REPOP rates (Qs×2 + readMin×1). This keeps `earned ≤ max` always —
repop-rate-everywhere would let a first-ever day show `15/6`.

**`getLessonState(userId, slug, questionKeys, now)`** — the lesson-page slice:
per-question `"earned" | "locked" | "open"` for today + whether the lesson is
completed (one query over today's events + locks filtered to the keys). This is
what Task 10 passes into the `logbook` prop.

**`getLogbook(userId)`** — xpTotal/level/title/next threshold, currentThrough +
`isCurrent(now)`, per-cluster `{done, total}`, badges, latest 20 events.

TDD with a throwaway user + a few hand-inserted events. Commit:
`feat(logbook): batched progress + logbook loaders`

---

## Task 8: Logbook page + account-menu link

**Files:**
- Create: `src/app/logbook/page.tsx` (auth-gated by default — `/logbook` is NOT in
  `isPublicPath`, so the middleware bounces anon to sign-in; verify, don't add it)
- Modify: `src/components/UserMenu.tsx` — add a LOGBOOK link (match the existing
  item pattern; mono caps).

**UI (design §9.5, otd-frontend-design rules):** `PageHeader` eyebrow `ACCOUNT`,
title **"Logbook"** (the locked system name — never "Flight log"); meta-strip = XP total (Saira gold) / level +
title / "current through <date>" (greyed when lapsed). Sections (hairline-grouped,
NO filled cards): next-rating progress (Saira `1,240 / 2,400`), per-cluster
completion rows (`8 / 12` numerals + a thin gold progress rule), the patch wall
(roadmap patches as locked silhouettes with "how to earn"; skill patches only when
earned — design §8), recent activity (mono rows: `+5 · QUIZ · Ohm's law · Jul 11`).
Patch art v1 = a square-badge `.badge` treatment with a hex outline glyph; the
full mission-patch art is its own later sandbox round (design §8).

**Steps:** implement → `pnpm exec tsc --noEmit` → dev server on :3006 → screenshot
dark + light (Playwright headless, `reducedMotion: 'reduce'`, force
`data-theme`) → eyeball against the design → commit
`feat(logbook): the Logbook page + account link`.

---

## Task 9: /library index wiring (progress + intro)

**Files:**
- Modify: `src/app/library/page.tsx`
- Create: `src/components/library/LogbookIntro.tsx` (client; dismiss action)
- Modify: `src/lib/actions/logbook.ts` (add `dismissLogbookIntro()`)

**Behavior (design §9.1–9.2):** signed-in only — anon index stays EXACTLY as
shipped (#293). Cluster headers gain `done/total` (Saira, e.g. `8 / 12`); rows gain
`earnedToday / maxToday XP` next to the read-time; header meta-strip gains a
Logbook summary chip (level + XP, links to `/logbook`). First visit
(`logbookIntroSeenAt` null): render `LogbookIntro` — a deep-space + gold-hairline
panel (NOT a modal): 2 sentences (reading + quizzes log XP to your Logbook; XP
earns ratings + patches — with their onboarding goal named when present:
`User.onboardingGoal`), a "got it" button calling `dismissLogbookIntro()`
(stamps the timestamp; never shows again).

**Steps:** implement → tsc → render signed-out (unchanged vs #293 screenshots) +
signed-in (borrow the `authjs.session-token` cookie per memory
`verifying-auth-gated-pages`, or eyeball in the browser) → commit
`feat(logbook): library index progress + one-time intro`.

---

## Task 10: Quiz tick + lesson completion wiring

The interaction core (design §3 async-award + §9.3).

**Files:**
- Modify: `src/components/guide/QuizBlock.tsx`
- Modify: `src/components/guide/GuideBlocks.tsx` (thread a new optional
  `logbook` prop down to quiz blocks, alongside the existing `quizContext`)
- Modify: `src/app/library/[slug]/page.tsx` (currently
  `<GuideBlocks blocks={blocks} isSignedIn={false} />` at ~line 132 — resolve the
  session, compute per-question state via `getLessonState` (Task 7), pass the NEW
  `logbook` prop. **Leave `isSignedIn={false}` exactly as it is**: that prop gates
  the resume rail (`resumeEnabled = !isSignedIn || isEnrolled`, GuideBlocks ~line
  1419) and flipping it would silently disable scroll-resume for signed-in library
  readers. `logbook` is a new, orthogonal prop.)
- Create: `src/components/library/XpTick.tsx` (the +XP animation)

**Behavior:**
- New optional prop `logbook?: { slug: string; questionKeys: string[]; state: Record<string, "earned" | "locked" | "open">; signedIn: boolean }`.
  `questionKeys` is aligned index-for-index with the questions array and is
  **computed server-side** (the lesson page / GuideBlocks are server components;
  `questionKey` is `node:crypto` and must never be imported client-side).
- QuizBlock: on the FIRST pick of a question (no prior wrong picks locally and
  state "open"), fire `recordQuizAnswer` async **for BOTH outcomes** (never await
  before showing feedback — the existing instant grade-as-you-go stays untouched):
  - correct → render `XpTick` in an immediate "pulse" acknowledge state, then show
    **the `xp` amount from the server response** (+5 full or +2 repop — the client
    never guesses the number); if the server returns `{ xp: 0 }`/error, fade out.
  - wrong → the call records the server-side `QuizLock` (the completion check
    depends on that row existing), and the question's XP slot greys for today.
  State "earned"/"locked" render accordingly on load.
- When all questions are answered (the existing `allSolved`-style detection, but
  "all attempted" — wrong-then-corrected counts), fire `recordLessonComplete`
  async → on `{ ok: true, xp }` render a quiet inline line: `lesson logged +N XP`
  (+ badge names if `newBadges`). No modal.
- `XpTick`: gold Saira `+5 XP`, small rise-and-fade, `@media (prefers-reduced-motion)`
  → static show/hide, wrapped in an `aria-live="polite"` region, **no audio**.
- Signed-out (`logbook.signedIn === false` or prop absent on the library page):
  the tick slot renders a quiet mono link — `sign in to log XP` →
  `/sign-in?callbackUrl=<lesson>` (the route is `/sign-in`, hyphenated; design §3
  signup-driver). Emit the PostHog event on click.

**Steps:** implement → tsc → manual E2E on :3006 signed-in (answer right → tick;
answer wrong → grey; finish → logged line; repeat same day → no double XP;
`/logbook` shows the events) → screenshot the tick states → commit
`feat(logbook): quiz XP tick + lesson completion wiring (async, optimistic, a11y)`.

---

## Task 11: Feedback box UI + admin triage

**Files:**
- Create: `src/components/library/FeedbackBox.tsx` (client, collapsible)
- Modify: `src/app/library/[slug]/page.tsx` (render above the footer)
- Create: `src/app/admin/feedback/page.tsx` (+ nav link where the other admin
  pages register — check `src/app/admin/` siblings for the pattern)

**Behavior (design §9.4):** collapsed one-line affordance (`▸ Suggest an
improvement`, mono, hairline-top); expanded = a bench-style underline textarea +
submit (`glass-button`). Signed-out → "sign in to suggest an improvement" prompt
(same callbackUrl pattern). On submit: optimistic "Logged. Thank you." (NO em
dash — the ban covers every rendered glyph) + an XP tick with the server's amount
when it confirms (the cap may make it 0 XP — still thank them). Admin page: table of NEW feedback (page, author, body, date) with
USEFUL / DISMISS actions (confirm on USEFUL — it pays XP); tabs or filters for
status. Hairline rows, never a filled table.

**Steps:** implement → tsc → manual E2E (submit as learner, mark USEFUL as admin,
see +25 + Shipped It in `/logbook`) → commit
`feat(logbook): lesson feedback box + admin triage`.

---

## Task 12: Instrumentation admin view

**Files:**
- Create: `src/app/admin/logbook/page.tsx`

**Behavior (design §9.6):** three hairline tables, most-broken first —
(a) per-question: correct-award count vs lock count → fail rate (`groupBy` on
`XpEvent(QUIZ_CORRECT).refId` + `QuizLock.questionKey`), resolve refId → lesson
title; (b) per-lesson: completions vs distinct attempters; (c) feedback by page +
status. This is the E-E-A-T "what content to fix" list — sort by fail rate desc.
`requireAdmin` page-level like the sibling admin pages.

**Steps:** implement → tsc → eyeball with the data your manual E2E generated →
commit `feat(logbook): admin instrumentation (fail rates, completion, feedback)`.

---

## Task 13: Cert/verify flair + milestone email + PostHog

**Files:**
- Modify: `src/app/verify/page.tsx` — a level + ratings line on the verified
  record (e.g. `FL4 INSTRUMENT · 3 RATINGS`, Saira numerals; render only when
  above defaults). **Timebox:** the `/verify` page line is the deliverable; if the
  certificate PDF/image render is heavy to touch, defer it (a follow-up, not scope
  creep here).
- Modify: the actions (`src/lib/actions/logbook.ts`): on `levelUp` or a new badge,
  send ONE combined milestone template ("you earned <patch> / reached <level>")
  via the existing pipeline — templates in `src/lib/lifecycle-emails.ts`, send via
  `src/lib/lifecycle-send.ts` — **gated on `emailConsent === true`** (motivational,
  not transactional).
- PostHog: client events via `src/lib/analytics-client.ts` (mirror the
  `capture("pricing_viewed", …)` pattern), server-side via `src/lib/analytics.ts`
  where the award actions live. Events: `xp_earned`, `patch_earned`, `level_up`,
  `logbook_intro_seen`, `feedback_submitted`, `signin_to_log_clicked` (design
  §10b — exactly these six, no more).

**Steps:** implement → tsc → verify an email renders (dev: log-only or send to
self) → commit `feat(logbook): cert flair, milestone email, analytics events`.

---

## Task 14: Admin reset + final verification

**Files:**
- Modify: `src/lib/actions/logbook.ts` (add `resetLessonXp({ slug, userId? })`,
  `requireAdmin`, deletes date-scoped QUIZ_CORRECT/LESSON_COMPLETE events + locks
  for the lesson — in ONE transaction: decrement `xpTotal` by the deleted sum AND
  **recompute `level` from the new total** (the one place level may go DOWN;
  leaving the cached level above the curve would lie on the cert flair);
  per-user or all-users scope explicit. `LessonCompletion` rows are NOT deleted —
  they're the durable milestone + the firstEver guard against full-rate
  re-inflation after a reset.)
- Modify: `src/app/admin/logbook/page.tsx` (a reset control per lesson with a
  typed-confirm dialog — destructive, design §14)

**Final verification (the whole feature):**
1. `pnpm exec tsc --noEmit` → 0.
2. `pnpm exec vitest run` → FULL suite green.
3. Manual E2E script on :3006 (signed-in): intro shows once → answer wrong (grey)
   → answer right elsewhere (+5) → complete a lesson (logged line, First Flight)
   → `/library` rings tick up → `/logbook` shows everything → submit feedback →
   admin USEFUL (+25, Shipped It) → admin reset the lesson → re-earnable.
4. Screenshot dark + light on `/library`, a lesson, `/logbook`.
5. Commit any fixes; final commit `feat(logbook): admin reset + E2E verification`.

**Then STOP: batch the commits on the branch, hand Josh the local URLs
(http://localhost:3006/library, /logbook), and wait for his explicit merge
go-ahead — NO auto-merge, no PR merge without it.**

---

## Validation log (lens passes to dry, 2026-07-11)

Lenses: coherence, feasibility, security, scope-guardian, design, adversarial
(product-lens skipped: premise settled in the 3-round design brainstorm). Run
inline, serially; findings fixed in-doc after each round.

| Round | Material | Minor | Highlights |
|---|---|---|---|
| 1 | 6 | 6 | wrong-pick must ALSO call the server (lock feeds completion); `questionKey` is server-only (node:crypto); tick renders the SERVER's amount; firstEver keys off `LessonCompletion` so admin reset can't re-inflate; reset recomputes level; em-dash in rendered copy; level-up moved inside the tx; exact module paths pinned |
| 2 | 1 | 3 | do NOT flip the library page's `isSignedIn` (it gates the resume rail — silent regression); `getLessonState` named; import fix; academyDate test |
| 3 | 1 | 1 | "Flight log" title violated the locked "Logbook" name; badge creates need the P2002-catch |
| 4 | 0 | 0 | **DRY** — targeted sweep of fixed classes + edited regions clean |

Verified against reality during passes: all 69 published lessons carry ≥1 quiz
(207 questions, checked 2026-07-11); `UserMenu.tsx` / `lifecycle-send.ts` /
`analytics-client.ts` / `actions/pass.ts` paths confirmed; sign-in route is
`/sign-in`.
