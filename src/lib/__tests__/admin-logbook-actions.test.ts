// Tests for the admin per-learner logbook actions (2026-07-13): grant/revoke a patch,
// adjust XP (rank follows, floored at 0), and override the FL level — each requireAdmin
// + AdminAudit. Self-contained fixtures (its own ADMIN + throwaway learner), real pool
// DB. Runs sequentially: the XP/level cases build on prior state on purpose.
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockAuth = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({ auth: () => mockAuth() }));

import { db } from "@/lib/db";
import {
  adminGrantPatch,
  adminRevokePatch,
  adminAdjustXp,
  adminSetLevel,
} from "@/lib/actions/admin-logbook";

const ADMIN_EMAIL = "admin-logbook-admin@example.com";
const LEARNER_EMAIL = "admin-logbook-learner@example.com";

let adminId = "";
let learnerId = "";

beforeAll(async () => {
  await db.user.deleteMany({ where: { email: { in: [ADMIN_EMAIL, LEARNER_EMAIL] } } });
  const admin = await db.user.create({ data: { email: ADMIN_EMAIL, name: "Ops", role: "ADMIN" } });
  adminId = admin.id;
  mockAuth.mockResolvedValue({ user: { email: ADMIN_EMAIL } });
  const learner = await db.user.create({
    data: { email: LEARNER_EMAIL, name: "Test Learner", xpTotal: 0, level: 1 },
  });
  learnerId = learner.id;
});

afterAll(async () => {
  await db.adminAudit.deleteMany({ where: { targetUserId: learnerId } });
  await db.user.deleteMany({ where: { email: { in: [ADMIN_EMAIL, LEARNER_EMAIL] } } }); // cascades badges/events
});

describe("adminGrantPatch / adminRevokePatch", () => {
  test("grants a hardware-tier patch, persists meta, and audits the actor", async () => {
    const res = await adminGrantPatch({ userId: learnerId, badgeKey: "hw:solder:2", note: "comp" });
    expect(res.ok).toBe(true);
    const row = await db.badgeEarned.findUnique({
      where: { userId_badgeKey: { userId: learnerId, badgeKey: "hw:solder:2" } },
    });
    expect(row).not.toBeNull();
    const audit = await db.adminAudit.findFirst({
      where: { targetUserId: learnerId, action: "grant_patch" },
    });
    expect(audit?.actorId).toBe(adminId);
  });

  test("re-granting the same patch is an idempotent no-op (no throw)", async () => {
    const res = await adminGrantPatch({ userId: learnerId, badgeKey: "hw:solder:2" });
    expect(res.ok).toBe(true);
    const count = await db.badgeEarned.count({
      where: { userId: learnerId, badgeKey: "hw:solder:2" },
    });
    expect(count).toBe(1);
  });

  test("an empty badge key is rejected", async () => {
    const res = await adminGrantPatch({ userId: learnerId, badgeKey: "  " });
    expect(res).toEqual({ ok: false, error: expect.any(String) });
  });

  test("revokes a patch, and revoking a missing one is idempotent", async () => {
    const first = await adminRevokePatch({ userId: learnerId, badgeKey: "hw:solder:2" });
    expect(first.ok).toBe(true);
    const gone = await db.badgeEarned.findUnique({
      where: { userId_badgeKey: { userId: learnerId, badgeKey: "hw:solder:2" } },
    });
    expect(gone).toBeNull();
    const again = await adminRevokePatch({ userId: learnerId, badgeKey: "hw:solder:2" });
    expect(again.ok).toBe(true); // no-op, still ok
  });
});

describe("adminAdjustXp", () => {
  test("adds XP, writes a MANUAL_ADJUST event, and the rank follows up", async () => {
    const res = await adminAdjustXp({ userId: learnerId, amount: 700 });
    expect(res.ok).toBe(true);
    const u = await db.user.findUniqueOrThrow({
      where: { id: learnerId },
      select: { xpTotal: true, level: true },
    });
    expect(u.xpTotal).toBe(700);
    expect(u.level).toBe(5); // 650 minXp → FL5
    const ev = await db.xpEvent.findFirst({
      where: { userId: learnerId, source: "MANUAL_ADJUST" },
    });
    expect(ev?.amount).toBe(700);
  });

  test("subtracting past zero floors the total at 0 and lowers the rank", async () => {
    const res = await adminAdjustXp({ userId: learnerId, amount: -1000 });
    expect(res.ok).toBe(true);
    const u = await db.user.findUniqueOrThrow({
      where: { id: learnerId },
      select: { xpTotal: true, level: true },
    });
    expect(u.xpTotal).toBe(0);
    expect(u.level).toBe(1);
    // The event ledger keeps summing to xpTotal: +700 then effective -700.
    const sum = await db.xpEvent.aggregate({
      where: { userId: learnerId, source: "MANUAL_ADJUST" },
      _sum: { amount: true },
    });
    expect(sum._sum.amount).toBe(0);
  });

  test("a zero amount is rejected", async () => {
    const res = await adminAdjustXp({ userId: learnerId, amount: 0 });
    expect(res).toEqual({ ok: false, error: expect.any(String) });
  });
});

describe("adminSetLevel", () => {
  test("overrides the FL level without touching XP, and audits the previous level", async () => {
    const res = await adminSetLevel({ userId: learnerId, level: 8, note: "override" });
    expect(res.ok).toBe(true);
    const u = await db.user.findUniqueOrThrow({
      where: { id: learnerId },
      select: { xpTotal: true, level: true },
    });
    expect(u.level).toBe(8);
    expect(u.xpTotal).toBe(0); // unchanged
    const audit = await db.adminAudit.findFirst({
      where: { targetUserId: learnerId, action: "set_level" },
      orderBy: { createdAt: "desc" },
    });
    expect((audit?.detail as { prevLevel?: number } | null)?.prevLevel).toBe(1);
  });

  test("an out-of-range level is rejected", async () => {
    const res = await adminSetLevel({ userId: learnerId, level: 99 });
    expect(res).toEqual({ ok: false, error: expect.any(String) });
  });
});
