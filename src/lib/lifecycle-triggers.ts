// Audience selection for each lifecycle-email sequence. Pure Prisma query
// builders — given a db client + a clock `now`, each returns the users who should
// receive that sequence RIGHT NOW. Two invariants every selector enforces:
//
//   1. CONSENT — only `emailConsent: true` users (the compliance gate).
//   2. ONCE-ONLY — exclude any user who already has a LifecycleSend row for this
//      sequence (the idempotency ledger). Expressed as a `NOT { lifecycleSends:
//      { some: { sequence } } }` so the SELECT itself skips already-sent users;
//      the cron's post-send INSERT (the @@unique) is the belt-and-suspenders.
//
// "Activation" = an L1.01 enrollment that passed the DRC/gerber gate: status
// COMPLETED, or currentStage at/after DRC_GERBER. Stage order:
// REQUIREMENTS < SCHEMATIC < BOM_SOURCING < LAYOUT < DRC_GERBER < ...
//
// The entry board is L1.01 (`l1-01-wroom-breakout`) — the only board the
// build-along + win-back nudges track (the lesson everyone starts in). The slug is
// a defaulted parameter so tests can point selectors at a throwaway project.
import type { PrismaClient, Stage } from "@prisma/client";

export const ENTRY_BOARD_SLUG = "l1-01-wroom-breakout";

/** A selected recipient. `name` feeds the [FIRST_NAME] token. */
export interface AudienceUser {
  id: string;
  email: string;
  name: string | null;
}

const SELECT = { id: true, email: true, name: true } as const;

/** Days → the cutoff Date `now - days` (a row's timestamp must be ≤ this to qualify). */
function daysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

/** Reusable consent + once-only guard fragment for a given sequence. (User.email is
 * a non-null unique column, so there is no null-email case to exclude here.) */
function eligible(sequence: string) {
  return {
    emailConsent: true,
    NOT: { lifecycleSends: { some: { sequence } } },
  };
}

// ─── 1.1 Welcome — opted in, account created, has NOT started L1.01 ──────────
// "Has not started" = no enrollment in the entry board at all. We still gate on a
// short minimum age so the row exists before the first cron tick after sign-up
// (and so the welcome doesn't race the magic-link). `minAccountAgeHours` default 0
// keeps tests simple; the cron can pass a small value.
export function welcomeAudience(
  db: PrismaClient,
  now: Date,
  opts: { minAccountAgeHours?: number; entryBoardSlug?: string } = {},
) {
  const slug = opts.entryBoardSlug ?? ENTRY_BOARD_SLUG;
  const ageCut = new Date(now.getTime() - (opts.minAccountAgeHours ?? 0) * 60 * 60 * 1000);
  return db.user.findMany({
    where: {
      ...eligible("1.1"),
      createdAt: { lte: ageCut },
      enrollments: { none: { project: { slug } } },
    },
    select: SELECT,
  });
}

// ─── 2.1 Schematic nudge — started L1.01, no schematic saved after N days ────
// "Started, no schematic" = entry-board enrollment still at REQUIREMENTS (hasn't
// advanced to SCHEMATIC) and idle ≥ N days (currentStageEnteredAt is the last
// stage move; for a brand-new enrollment it equals startedAt).
export function schematicNudgeAudience(
  db: PrismaClient,
  now: Date,
  reactivationDays: number,
  entryBoardSlug: string = ENTRY_BOARD_SLUG,
) {
  return db.user.findMany({
    where: {
      ...eligible("2.1"),
      enrollments: {
        some: {
          project: { slug: entryBoardSlug },
          currentStage: "REQUIREMENTS",
          currentStageEnteredAt: { lte: daysAgo(now, reactivationDays) },
        },
      },
    },
    select: SELECT,
  });
}

// ─── 2.2 Layout nudge — schematic passed ERC, no layout progress after N days ─
// "Passed ERC, not into layout" = entry-board enrollment cleared SCHEMATIC (now at
// SCHEMATIC or BOM_SOURCING, the post-ERC pre-layout stages) and idle ≥ N days.
export function layoutNudgeAudience(
  db: PrismaClient,
  now: Date,
  reactivationDays: number,
  entryBoardSlug: string = ENTRY_BOARD_SLUG,
) {
  const beforeLayout: Stage[] = ["SCHEMATIC", "BOM_SOURCING"];
  return db.user.findMany({
    where: {
      ...eligible("2.2"),
      enrollments: {
        some: {
          project: { slug: entryBoardSlug },
          currentStage: { in: beforeLayout },
          currentStageEnteredAt: { lte: daysAgo(now, reactivationDays) },
        },
      },
    },
    select: SELECT,
  });
}

// ─── 2.3 DRC nudge — layout started, DRC not clean after N days ──────────────
// "In layout, not finished" = entry-board enrollment at LAYOUT (placing/routing,
// hasn't reached DRC_GERBER) and idle ≥ N days, and NOT already COMPLETED.
export function drcNudgeAudience(
  db: PrismaClient,
  now: Date,
  reactivationDays: number,
  entryBoardSlug: string = ENTRY_BOARD_SLUG,
) {
  return db.user.findMany({
    where: {
      ...eligible("2.3"),
      enrollments: {
        some: {
          project: { slug: entryBoardSlug },
          currentStage: "LAYOUT",
          status: { not: "COMPLETED" },
          currentStageEnteredAt: { lte: daysAgo(now, reactivationDays) },
        },
      },
    },
    select: SELECT,
  });
}

// ─── 3.1 Activation upsell — exported valid gerbers for L1.01 ────────────────
// The activation gate: entry-board enrollment passed DRC/gerbers — status
// COMPLETED, or currentStage at/after DRC_GERBER.
export function activationUpsellAudience(
  db: PrismaClient,
  now: Date,
  entryBoardSlug: string = ENTRY_BOARD_SLUG,
) {
  const atOrAfterGerber: Stage[] = ["DRC_GERBER", "ORDERING", "ASSEMBLY", "BRINGUP", "REVISION"];
  return db.user.findMany({
    where: {
      ...eligible("3.1"),
      enrollments: {
        some: {
          project: { slug: entryBoardSlug },
          OR: [{ status: "COMPLETED" }, { currentStage: { in: atOrAfterGerber } }],
        },
      },
    },
    select: SELECT,
  });
}

// ─── 4.1 Pay-the-difference — bought their first paid project ────────────────
// Audience = users holding a PURCHASE entitlement on any project. (The personalized
// [PROJECT_NAME]/[PROJECT_PRICE] are resolved per-user by the cron from their
// most-recent PURCHASE; selection here is just "has purchased ≥ 1 project".)
export function payTheDifferenceAudience(db: PrismaClient, _now: Date) {
  return db.user.findMany({
    where: {
      ...eligible("4.1"),
      entitlements: { some: { source: "PURCHASE", projectId: { not: null } } },
    },
    select: SELECT,
  });
}

// ─── 5.x Launch window — in the window, NOT yet holding the Pass, ENGAGED ─────
// "Holding the Pass" = an Entitlement on the reserved bundle slot (bundleId set).
// Each of the four beats fires on its OWN schedule so they never pile up on one
// tick: 5.1 at window open, 5.2 near the middle, 5.3 with 48h left, 5.4 in the
// final hours. Timing is derived from the window END minus fixed offsets (window
// length = `windowDays`), so a beat only becomes eligible once `now` has reached
// its trigger; the once-only ledger + the cron's per-user daily cap keep a late
// entrant from getting several beats at once. The audience is also narrowed to
// ENGAGED users (at least one enrollment) so signed-up-never-started accounts
// don't get a four-email sales sequence they never asked for.
const DAY_MS = 24 * 60 * 60 * 1000;

/** The earliest time each launch beat may send, given the window end + length. */
export function launchBeatTrigger(
  sequence: "5.1" | "5.2" | "5.3" | "5.4",
  launchWindowEnd: Date,
  windowDays: number,
): Date {
  const end = launchWindowEnd.getTime();
  switch (sequence) {
    case "5.1":
      return new Date(end - windowDays * DAY_MS); // window open (launch day)
    case "5.2":
      return new Date(end - Math.min(8, Math.max(1, windowDays - 1)) * DAY_MS); // near the middle
    case "5.3":
      return new Date(end - 48 * 60 * 60 * 1000); // 48 hours left
    case "5.4":
      return new Date(end - 12 * 60 * 60 * 1000); // final hours
  }
}

export function launchWindowAudience(
  db: PrismaClient,
  now: Date,
  sequence: "5.1" | "5.2" | "5.3" | "5.4",
  launchWindowEnd: Date | null,
  windowDays: number = 14,
) {
  // No window, closed, or this beat's trigger not reached yet → no audience
  // (never fabricate urgency, never fire all four beats at once).
  if (!launchWindowEnd || now >= launchWindowEnd) return Promise.resolve([] as AudienceUser[]);
  if (now < launchBeatTrigger(sequence, launchWindowEnd, windowDays)) {
    return Promise.resolve([] as AudienceUser[]);
  }
  return db.user.findMany({
    where: {
      ...eligible(sequence),
      entitlements: { none: { bundleId: { not: null } } },
      enrollments: { some: {} },
    },
    select: SELECT,
  });
}

// ─── 6.1 Win-back — stalled in L1, no progress for N days, no purchase ───────
// "Stalled" = entry-board enrollment NOT completed and idle ≥ N days, AND the user
// holds no PURCHASE entitlement (a buyer isn't a churn-risk to win back).
export function winBackAudience(
  db: PrismaClient,
  now: Date,
  reactivationDays: number,
  entryBoardSlug: string = ENTRY_BOARD_SLUG,
) {
  return db.user.findMany({
    where: {
      ...eligible("6.1"),
      entitlements: { none: { source: "PURCHASE" } },
      enrollments: {
        some: {
          project: { slug: entryBoardSlug },
          status: { not: "COMPLETED" },
          currentStageEnteredAt: { lte: daysAgo(now, reactivationDays) },
        },
      },
    },
    select: SELECT,
  });
}
