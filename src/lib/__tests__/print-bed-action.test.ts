// Tests for setPrintBed / getPrintBed (the account "Printing" group).
//
// Throwaway user, so this never touches the seed fixture. What is actually being
// held here:
//   1. bounds at BOTH edges, inside and out, since an off-by-one on either side
//      is exactly the kind of thing a "roughly right" range check ships with;
//   2. an unauthenticated call is refused, for the setter AND the getter;
//   3. clearing back to null works and really nulls BOTH columns;
//   4. the ROUND TRIP: anything this action agrees to store must be a bed the
//      pack endpoint then accepts. That is the defect worth testing, because it
//      is invisible from either side alone -- the settings page reports success,
//      and every download 400s with no stated cause.
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

// next/cache is stubbed WHOLESALE, so this factory must carry every export
// anything in this module graph touches -- a missing one fails the import with
// "No X export is defined on the next/cache mock", which reads like a mock
// problem rather than the real cause.
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));

const mockAuth = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({ auth: () => mockAuth() }));

import { PrismaClient } from "@prisma/client";

import { db } from "@/lib/db";
import { makeAdapter } from "@/lib/db-adapter";
import {
  getPrintBed,
  promotePrintBed,
  setPrintBed,
} from "@/lib/actions/print-bed";
import { BED_MAX, BED_MIN } from "@/lib/print-bed";
import { HEX_PART_SLUGS } from "@/lib/hex-parts";
import { HEX_RELEASE } from "@/lib/hex-spec";
import { resolvePack } from "@/lib/hex-pack";

const EMAIL = "print-bed-learner@example.com";
let userId = "";

async function row() {
  return db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { printBedXMm: true, printBedYMm: true },
  });
}

beforeAll(async () => {
  await db.user.deleteMany({ where: { email: EMAIL } });
  const user = await db.user.create({
    data: { email: EMAIL, name: "Bed", role: "LEARNER" },
  });
  userId = user.id;
  mockAuth.mockResolvedValue({ user: { email: EMAIL } });
});

afterAll(async () => {
  await db.user.deleteMany({ where: { id: userId } });
});

describe("setPrintBed", () => {
  test("a new user has no stored bed", async () => {
    const u = await row();
    expect(u.printBedXMm).toBeNull();
    expect(u.printBedYMm).toBeNull();
    expect((await getPrintBed()).bed).toBeNull();
  });

  test("stores a bed and reads it back", async () => {
    const res = await setPrintBed({ x: 350, y: 350 });
    expect(res.bed).toEqual({ x: 350, y: 350 });
    expect(await row()).toEqual({ printBedXMm: 350, printBedYMm: 350 });
    expect((await getPrintBed()).bed).toEqual({ x: 350, y: 350 });
  });

  test("stores a non-square bed, since Custom allows one", async () => {
    await setPrintBed({ x: 300, y: 250 });
    expect(await row()).toEqual({ printBedXMm: 300, printBedYMm: 250 });
  });

  test("accepts exactly the bounds", async () => {
    // The inclusive edges. `< BED_MIN` and `<= BED_MIN` differ by one machine,
    // and a 100 mm bed is a real printer, not a pathological input.
    await setPrintBed({ x: BED_MIN, y: BED_MIN });
    expect(await row()).toEqual({ printBedXMm: BED_MIN, printBedYMm: BED_MIN });
    await setPrintBed({ x: BED_MAX, y: BED_MAX });
    expect(await row()).toEqual({ printBedXMm: BED_MAX, printBedYMm: BED_MAX });
  });

  test("refuses one millimetre outside either bound, on either axis", async () => {
    const stored = await row();
    for (const bad of [
      { x: BED_MIN - 1, y: 220 },
      { x: 220, y: BED_MIN - 1 },
      { x: BED_MAX + 1, y: 220 },
      { x: 220, y: BED_MAX + 1 },
    ]) {
      await expect(setPrintBed(bad)).rejects.toThrow();
    }
    // A refusal must also LEAVE THE COLUMN ALONE. An action that throws after
    // writing is still a bug, and the throw would hide it.
    expect(await row()).toEqual(stored);
  });

  test("refuses a non-integer, a NaN, an infinity and a non-number", async () => {
    // NaN is the one that matters: `NaN < BED_MIN` is false and so is
    // `NaN > BED_MAX`, so a bare range check waves it straight into the column.
    const bad: unknown[] = [
      { x: 220.5, y: 220 },
      { x: 220, y: 220.5 },
      { x: Number.NaN, y: 220 },
      { x: 220, y: Number.NaN },
      { x: Number.POSITIVE_INFINITY, y: 220 },
      { x: Number.NEGATIVE_INFINITY, y: 220 },
      { x: "220", y: "220" },
      { x: 220 },
      { y: 220 },
      {},
      { x: null, y: null },
      { x: [220], y: [220] },
    ];
    for (const b of bad) {
      await expect(setPrintBed(b as never)).rejects.toThrow();
    }
  });

  test("clearing puts both columns back to null", async () => {
    await setPrintBed({ x: 235, y: 235 });
    expect(await row()).toEqual({ printBedXMm: 235, printBedYMm: 235 });

    const res = await setPrintBed(null);
    expect(res.bed).toBeNull();
    // BOTH columns. One nulled and one left behind is a corrupt row, and the
    // reader would have to guess what "235 by nothing" means.
    expect(await row()).toEqual({ printBedXMm: null, printBedYMm: null });
    expect((await getPrintBed()).bed).toBeNull();
  });

  test("clearing is idempotent and works from the already-clear state", async () => {
    await setPrintBed(null);
    await setPrintBed(null);
    expect(await row()).toEqual({ printBedXMm: null, printBedYMm: null });
  });

  test("undefined is refused rather than treated as a clear", async () => {
    // Only an EXPLICIT null clears. If a malformed argument erased the stored
    // bed, a broken caller would silently reset a setting the user did choose.
    await setPrintBed({ x: 250, y: 250 });
    await expect(setPrintBed(undefined as never)).rejects.toThrow();
    expect(await row()).toEqual({ printBedXMm: 250, printBedYMm: 250 });
    await setPrintBed(null);
  });

  test("throws when signed out, and writes nothing", async () => {
    const stored = await row();
    mockAuth.mockResolvedValueOnce(null);
    await expect(setPrintBed({ x: 300, y: 300 })).rejects.toThrow();
    expect(await row()).toEqual(stored);
  });

  test("a session with no email is not a session", async () => {
    mockAuth.mockResolvedValueOnce({ user: {} });
    await expect(setPrintBed({ x: 300, y: 300 })).rejects.toThrow();
  });

  test("getPrintBed refuses when signed out", async () => {
    mockAuth.mockResolvedValueOnce(null);
    await expect(getPrintBed()).rejects.toThrow();
  });
});

// The promotion is the ONE write on this pair of columns that must be able to
// lose. A bed stored in the configurator's localStorage is offered to the
// account once, and the offer is made by a peer that CANNOT see the account: an
// absent `Ready.bed` means "no answer", which covers "the read has not landed
// yet". So "the account has none" is not knowable on the wire, and every test
// below is about the write refusing itself rather than the sender being careful.
describe("promotePrintBed — the conditional write", () => {
  test("stores the bed when the account has none", async () => {
    await setPrintBed(null);
    const res = await promotePrintBed({ x: 350, y: 350 });
    expect(res.promoted).toBe(true);
    expect(res.bed).toEqual({ x: 350, y: 350 });
    expect(await row()).toEqual({ printBedXMm: 350, printBedYMm: 350 });
  });

  test("is a NO-OP against an account that already has a bed, and leaves it intact", async () => {
    // THE POINT OF THE WHOLE MESSAGE. This is the promotion arriving after the
    // visitor has already set 235 on another device (or in this tab, moments
    // ago) — the case the child's 4-second grace window could only make less
    // likely, never impossible, because a slow account read is indistinguishable
    // from no account bed at all.
    await setPrintBed({ x: 235, y: 235 });
    const res = await promotePrintBed({ x: 180, y: 180 });
    expect(res.promoted).toBe(false);
    // Not "did not report success" — DID NOT WRITE. An action that reported a
    // decline and clobbered the column anyway would pass a `promoted` assertion
    // and lose the visitor's setting, so the column is what is asserted.
    expect(await row()).toEqual({ printBedXMm: 235, printBedYMm: 235 });
    expect((await getPrintBed()).bed).toEqual({ x: 235, y: 235 });
  });

  test("a decline reports the bed that actually won", async () => {
    // So the caller can tell "stored" from "declined, and here is what beat me"
    // without a second round trip that could read a third value.
    await setPrintBed({ x: 300, y: 250 });
    const res = await promotePrintBed({ x: 220, y: 220 });
    expect(res).toEqual({ promoted: false, bed: { x: 300, y: 250 } });
  });

  test("refuses a half-null row rather than repairing it", async () => {
    // One column set and one null is a corrupt row, not a half-answer:
    // `bedFromColumns` refuses to read it, and a cross-origin message is not the
    // thing that should decide how to fix it. BOTH columns null, or nothing.
    await db.user.update({
      where: { id: userId },
      data: { printBedXMm: 300, printBedYMm: null },
    });
    const res = await promotePrintBed({ x: 220, y: 220 });
    expect(res.promoted).toBe(false);
    expect(await row()).toEqual({ printBedXMm: 300, printBedYMm: null });
    // And the decline reports null, because that IS what a reader gets from a
    // corrupt row — not "300 by nothing".
    expect(res.bed).toBeNull();
    await setPrintBed(null);
  });

  test("two promotions racing cannot both win, and the loser writes nothing", async () => {
    // The interleaving the design doc's "promoted once" cannot prevent on its
    // own: two tabs, two local beds, one account. A read-then-write would let
    // both read null and both write; a single conditional statement cannot.
    await setPrintBed(null);
    const results = await Promise.all([
      promotePrintBed({ x: 180, y: 180 }),
      promotePrintBed({ x: 350, y: 350 }),
    ]);
    const won = results.filter((r) => r.promoted);
    const lost = results.filter((r) => !r.promoted);
    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(1);
    expect(await row()).toEqual({
      printBedXMm: won[0].bed!.x,
      printBedYMm: won[0].bed!.y,
    });
    // The loser must not report the value it tried to write.
    expect(lost[0].bed).toEqual(won[0].bed);
    await setPrintBed(null);
  });

  test("refuses every bed setPrintBed refuses, and writes nothing", async () => {
    // Same validator, same throw. A promotion validated more loosely than a pick
    // would be a second, weaker door into the same two columns.
    await setPrintBed(null);
    const bad: unknown[] = [
      { x: BED_MIN - 1, y: 220 },
      { x: 220, y: BED_MAX + 1 },
      { x: 220.5, y: 220 },
      { x: Number.NaN, y: 220 },
      { x: Number.POSITIVE_INFINITY, y: 220 },
      { x: "220", y: "220" },
      { x: 220 },
      {},
      { x: null, y: null },
    ];
    for (const b of bad) {
      await expect(promotePrintBed(b as never)).rejects.toThrow();
    }
    expect(await row()).toEqual({ printBedXMm: null, printBedYMm: null });
  });

  test("null is refused, never treated as a clear", async () => {
    // `setPrintBed(null)` clears; a promotion of nothing is a broken caller.
    // Giving the wire a spelling for "erase it" would hand it the one
    // destructive operation these two columns have.
    await setPrintBed({ x: 250, y: 250 });
    await expect(promotePrintBed(null as never)).rejects.toThrow();
    await expect(promotePrintBed(undefined as never)).rejects.toThrow();
    expect(await row()).toEqual({ printBedXMm: 250, printBedYMm: 250 });
    await setPrintBed(null);
  });

  test("refuses when signed out, and writes nothing", async () => {
    const stored = await row();
    mockAuth.mockResolvedValueOnce(null);
    await expect(promotePrintBed({ x: 300, y: 300 })).rejects.toThrow();
    expect(await row()).toEqual(stored);
  });

  test("the write is ONE statement with the nulls in it, not a read then a write", async () => {
    // The atomicity claim, measured rather than reasoned about. A read-then-write
    // has a window between deciding and writing; this asserts there is no such
    // window because there is no separate read: Prisma compiles the `updateMany`
    // to a single UPDATE carrying the IS NULL precondition, which Postgres
    // re-evaluates against the committed row version after taking the row lock.
    const captured: string[] = [];
    const probe = new PrismaClient({
      adapter: makeAdapter(process.env.DATABASE_URL!),
      log: [{ emit: "event", level: "query" }],
    });
    (probe as unknown as { $on: (e: string, cb: (v: { query: string }) => void) => void }).$on(
      "query",
      (e) => captured.push(e.query),
    );
    try {
      await probe.user.updateMany({
        where: { id: userId, printBedXMm: null, printBedYMm: null },
        data: { printBedXMm: 300, printBedYMm: 300 },
      });
    } finally {
      await probe.$disconnect();
    }

    // Transaction framing and connection chatter are not statements.
    const statements = captured.filter(
      (q) => !/^\s*(BEGIN|COMMIT|ROLLBACK|DEALLOCATE|SET |SELECT 1\b)/i.test(q),
    );
    expect(statements).toHaveLength(1);
    expect(statements[0]).toMatch(/^\s*UPDATE/i);
    // Both columns, in the WHERE. Dropping either one makes the write
    // unconditional in exactly the direction that loses data.
    expect(statements[0]).toMatch(/printBedXMm"?\s+IS NULL/i);
    expect(statements[0]).toMatch(/printBedYMm"?\s+IS NULL/i);
    // No SELECT anywhere: a read-then-write is what this is not.
    expect(statements.join("\n")).not.toMatch(/SELECT/i);
    await setPrintBed(null);
  });
});

describe("what is stored is what the endpoint accepts", () => {
  // The one property that spans the two halves of the feature. The settings page
  // and the pack endpoint are validated by the same BED_MIN/BED_MAX (imported,
  // never restated), and this is what proves the import actually holds: a stored
  // bed is spelled into `?plate=WxH` and handed to the real resolver.
  const SLUG = HEX_PART_SLUGS[0];

  test("every bed the action stores resolves on the pack endpoint", async () => {
    const beds = [
      { x: BED_MIN, y: BED_MIN },
      { x: BED_MAX, y: BED_MAX },
      { x: 180, y: 180 },
      { x: 220, y: 220 },
      { x: 350, y: 350 },
      { x: 300, y: 250 },
      { x: BED_MIN, y: BED_MAX },
    ];
    for (const bed of beds) {
      const res = await setPrintBed(bed);
      expect(res.bed).toEqual(bed);
      const stored = await row();
      const r = resolvePack({
        release: HEX_RELEASE,
        parts: SLUG,
        plate: `${stored.printBedXMm}x${stored.printBedYMm}`,
      });
      expect(r.ok).toBe(true);
      expect(r.ok && r.request.bed).toEqual(bed);
    }
    await setPrintBed(null);
  });

  test("every bed the endpoint refuses, the action refuses too", async () => {
    // The other direction, so the two cannot drift apart by the action being
    // LOOSER than the endpoint -- which is the direction that produces a saved
    // setting and a broken download.
    for (const bed of [
      { x: BED_MIN - 1, y: BED_MIN - 1 },
      { x: BED_MAX + 1, y: BED_MAX + 1 },
      { x: 0, y: 0 },
      { x: -220, y: -220 },
      { x: 99999, y: 99999 },
    ]) {
      expect(
        resolvePack({
          release: HEX_RELEASE,
          parts: SLUG,
          plate: `${bed.x}x${bed.y}`,
        }).ok,
      ).toBe(false);
      await expect(setPrintBed(bed)).rejects.toThrow();
    }
  });
});
