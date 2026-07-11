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
      userId,
      source: "QUIZ_CORRECT" as const,
      amount: 5,
      refId: "s#q1",
      dedupeKey: "QUIZ_CORRECT:test:once",
      now,
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
      userId,
      source: "CLUSTER_COMPLETE",
      amount: 100,
      refId: "x",
      dedupeKey: "CLUSTER_COMPLETE:test:levelup",
      now: new Date("2026-07-11T12:00:00Z"),
    });
    expect(r.awarded).toBe(true);
    if (!r.awarded) throw new Error("unreachable");
    expect(r.levelUp).toMatchObject({ level: 2 }); // 105 ≥ 50
  });
});

afterAll(async () => {
  if (userId) await db.user.delete({ where: { id: userId } });
});
