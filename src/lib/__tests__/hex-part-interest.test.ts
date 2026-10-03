// The molded-line interest signals (plan 1.2.2 / 1.2.3). DB-backed.
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));
// A client IP, so the tap has an identity to key on.
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7" }),
}));
const mockAuth = vi.fn<() => Promise<unknown>>(async () => null);
vi.mock("@/auth", () => ({ auth: () => mockAuth() }));
// The limiter is the thing under test for the tap, so it is scripted.
const { enforceMock } = vi.hoisted(() => ({
  enforceMock:
    vi.fn<(...a: unknown[]) => Promise<{ ok: boolean; rule?: string }>>(),
}));
vi.mock("@/lib/abuse-limit", () => ({
  enforce: (...a: unknown[]) => enforceMock(...a),
}));
// The kill switch, scripted too.
const { flagMock } = vi.hoisted(() => ({
  flagMock: vi.fn<() => Promise<boolean>>(),
}));
vi.mock("@/lib/hex-flags", () => ({ hexFlag: () => flagMock() }));

import { db } from "@/lib/db";
import { HEX_CONCEPT_STEMS } from "@/lib/hex-concepts";
import {
  notifyOnHexPart,
  tapHexPartInterest,
} from "@/lib/actions/hex-part-interest";

const STEM = [...HEX_CONCEPT_STEMS][0];
const EMAIL = "hex-part-test@example.com";

let prevOpen: string | undefined;
let prevDoi: string | undefined;
beforeAll(() => {
  prevOpen = process.env.HEX_PART_WAITLIST_OPEN;
  prevDoi = process.env.WAITLIST_DOUBLE_OPT_IN;
  process.env.HEX_PART_WAITLIST_OPEN = "1";
  // Single-step for these tests: the confirmation send has its own suite.
  process.env.WAITLIST_DOUBLE_OPT_IN = "false";
});
afterAll(async () => {
  if (prevOpen === undefined) delete process.env.HEX_PART_WAITLIST_OPEN;
  else process.env.HEX_PART_WAITLIST_OPEN = prevOpen;
  if (prevDoi === undefined) delete process.env.WAITLIST_DOUBLE_OPT_IN;
  else process.env.WAITLIST_DOUBLE_OPT_IN = prevDoi;
  await db.hexPartWaitlist.deleteMany({
    where: { email: { startsWith: "hex-part-test" } },
  });
  await db.hexPartInterest.deleteMany({ where: { stem: STEM } });
});
beforeEach(async () => {
  enforceMock.mockReset();
  enforceMock.mockResolvedValue({ ok: true });
  flagMock.mockReset();
  flagMock.mockResolvedValue(true);
  mockAuth.mockReset();
  mockAuth.mockResolvedValue(null);
  await db.hexPartWaitlist.deleteMany({
    where: { email: { startsWith: "hex-part-test" } },
  });
  await db.hexPartInterest.deleteMany({ where: { stem: STEM } });
});

describe("notifyOnHexPart", () => {
  test("the allow-list is checked before anything: an unknown stem writes no row", async () => {
    const res = await notifyOnHexPart({
      email: EMAIL,
      stems: [STEM, "hex-not-a-concept"],
    });
    expect(res).toEqual({
      ok: false,
      error: "One of those designs is not on this page.",
    });
    expect(await db.hexPartWaitlist.count({ where: { email: EMAIL } })).toBe(0);
    expect(enforceMock).not.toHaveBeenCalled();
  });

  test("closed when the opener is unset, whatever the input", async () => {
    process.env.HEX_PART_WAITLIST_OPEN = "0";
    try {
      const res = await notifyOnHexPart({ email: EMAIL, stems: [STEM] });
      expect(res.ok).toBe(false);
      expect(await db.hexPartWaitlist.count({ where: { email: EMAIL } })).toBe(
        0,
      );
    } finally {
      process.env.HEX_PART_WAITLIST_OPEN = "1";
    }
  });

  test("one row per lowercase address; a repeat on an UNCONFIRMED row replaces the stems", async () => {
    process.env.WAITLIST_DOUBLE_OPT_IN = "true";
    try {
      // The confirmation send would hit Resend; with no row-level fetch injection
      // here the action swallows the failure and the row stands unconfirmed.
      await notifyOnHexPart({ email: EMAIL.toUpperCase(), stems: [STEM] });
      const first = await db.hexPartWaitlist.findUnique({
        where: { email: EMAIL },
      });
      expect(first?.confirmedAt).toBeNull();
      expect(first?.stems).toEqual([STEM]);
      // One concept exists today, so "replace" and "union" give the same set;
      // what this pins is ONE row and no throw on the repeat.
      const res = await notifyOnHexPart({ email: EMAIL, stems: [STEM] });
      expect(res.ok).toBe(true);
      expect(
        await db.hexPartWaitlist.count({
          where: { email: { startsWith: "hex-part-test" } },
        }),
      ).toBe(1);
    } finally {
      process.env.WAITLIST_DOUBLE_OPT_IN = "false";
    }
  });

  test("with the switch off the row confirms at creation and the result says so", async () => {
    const res = await notifyOnHexPart({ email: EMAIL, stems: [STEM] });
    expect(res).toEqual({ ok: true, state: "confirmed" });
    const row = await db.hexPartWaitlist.findUnique({
      where: { email: EMAIL },
    });
    expect(row?.confirmedAt).not.toBeNull();
    expect(row?.stems).toEqual([STEM]);
  });

  test("a signed-in visitor's OWN address is stamped; a stranger's is not", async () => {
    const me = await db.user.findFirst({ select: { id: true, email: true } });
    expect(me, "the seed has no user").not.toBeNull();
    const own = me!.email.toLowerCase();
    await db.hexPartWaitlist.deleteMany({ where: { email: own } });
    try {
      mockAuth.mockResolvedValue({ user: { email: me!.email } });
      // Someone else's address while signed in: no claim on the row.
      await notifyOnHexPart({ email: EMAIL, stems: [STEM] });
      expect(
        (await db.hexPartWaitlist.findUnique({ where: { email: EMAIL } }))
          ?.userId,
      ).toBeNull();
      // Their own address, typed in upper case: stamped.
      await notifyOnHexPart({ email: me!.email.toUpperCase(), stems: [STEM] });
      expect(
        (await db.hexPartWaitlist.findUnique({ where: { email: own } }))
          ?.userId,
      ).toBe(me!.id);
    } finally {
      await db.hexPartWaitlist.deleteMany({ where: { email: own } });
    }
  });
});

describe("tapHexPartInterest", () => {
  test("a vouched tap counts once in ipDays", async () => {
    const res = await tapHexPartInterest({ stem: STEM });
    expect(res).toEqual({ ok: true });
    const row = await db.hexPartInterest.findUnique({ where: { stem: STEM } });
    expect(row).toMatchObject({ ipDays: 1, degradedDrops: 0 });
    expect(enforceMock).toHaveBeenCalledWith(
      [expect.objectContaining({ rule: "interest:ip:day" })],
      "closed",
    );
  });

  test("a repeat inside the day is 'already' and counts nothing more", async () => {
    await tapHexPartInterest({ stem: STEM });
    enforceMock.mockResolvedValue({ ok: false, rule: "interest:ip:day" });
    const res = await tapHexPartInterest({ stem: STEM });
    expect(res).toEqual({ ok: false, reason: "already" });
    expect(
      (await db.hexPartInterest.findUnique({ where: { stem: STEM } }))?.ipDays,
    ).toBe(1);
  });

  test("a degraded limiter DROPS the tap and counts the drop, not the tap", async () => {
    enforceMock.mockResolvedValue({ ok: false, rule: "degraded" });
    const res = await tapHexPartInterest({ stem: STEM });
    expect(res).toEqual({ ok: false, reason: "degraded" });
    expect(
      await db.hexPartInterest.findUnique({ where: { stem: STEM } }),
    ).toMatchObject({
      ipDays: 0,
      degradedDrops: 1,
    });
  });

  test("the kill switch stops the button and touches nothing", async () => {
    flagMock.mockResolvedValue(false);
    expect(await tapHexPartInterest({ stem: STEM })).toEqual({
      ok: false,
      reason: "off",
    });
    expect(
      await db.hexPartInterest.findUnique({ where: { stem: STEM } }),
    ).toBeNull();
    expect(enforceMock).not.toHaveBeenCalled();
  });

  test("an unknown stem is refused before the limiter or the flag are asked", async () => {
    expect(await tapHexPartInterest({ stem: "hex-not-a-concept" })).toEqual({
      ok: false,
      reason: "unknown-stem",
    });
    expect(enforceMock).not.toHaveBeenCalled();
    expect(flagMock).not.toHaveBeenCalled();
  });
});
