// Weekly review-due nudge: >= 3 due cards + consent → ONE email per ISO week
// (LifecycleSend ledger key `review-nudge:<week>`); below-threshold, unconsented,
// and already-nudged users are never mailed.
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/seo/jsonld", () => ({ siteUrl: () => "https://academy.test" }));

import { db } from "@/lib/db";
import { sendReviewDueNudges, isoWeekStamp } from "@/lib/review-nudge";

const TAG = `rn-${Date.now()}`;
const NOW = new Date("2026-07-22T15:00:00Z");
const PAST = new Date("2026-07-10T00:00:00Z");
let dueUser = "";
let fewUser = "";
let noConsent = "";

async function mkItems(prefix: string, n: number) {
  for (let i = 0; i < n; i++) {
    await db.quizItem.create({
      data: {
        reviewItemId: `${prefix}:${i}`,
        projectSlug: TAG,
        stage: null,
        q: `Q${i}?`,
        options: ["a", "b"],
        answer: 0,
      },
    });
  }
}

async function schedule(userId: string, prefix: string, n: number) {
  for (let i = 0; i < n; i++) {
    await db.reviewSchedule.create({
      data: {
        userId,
        reviewItemId: `${prefix}:${i}`,
        dueOn: PAST,
        intervalDays: 1,
        lastSeenOn: PAST,
      },
    });
  }
}

beforeAll(async () => {
  const a = await db.user.create({
    data: { email: `${TAG}-due@example.com`, name: "Due Dana", emailConsent: true },
  });
  dueUser = a.id;
  const b = await db.user.create({
    data: { email: `${TAG}-few@example.com`, name: "Few Fay", emailConsent: true },
  });
  fewUser = b.id;
  const c = await db.user.create({
    data: { email: `${TAG}-nc@example.com`, name: "No Consent", emailConsent: false },
  });
  noConsent = c.id;

  await mkItems(`${TAG}-a`, 4);
  await mkItems(`${TAG}-b`, 2);
  await mkItems(`${TAG}-c`, 4);
  await schedule(dueUser, `${TAG}-a`, 4); // >= 3 due → nudged
  await schedule(fewUser, `${TAG}-b`, 2); // below threshold
  await schedule(noConsent, `${TAG}-c`, 4); // enough due, no consent
});

afterAll(async () => {
  const ids = [dueUser, fewUser, noConsent];
  await db.reviewSchedule.deleteMany({ where: { userId: { in: ids } } });
  await db.quizItem.deleteMany({ where: { projectSlug: TAG } });
  await db.lifecycleSend.deleteMany({ where: { userId: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
});

describe("sendReviewDueNudges", () => {
  test("nudges only the consented user with >= 3 due; once per ISO week", async () => {
    const sentTo: string[] = [];
    const okFetch = vi.fn(async (_u: unknown, init?: RequestInit) => {
      sentTo.push(JSON.parse(String(init?.body)).to as string);
      return new Response(JSON.stringify({ id: "mock" }), { status: 200 });
    }) as unknown as typeof fetch;

    const r = await sendReviewDueNudges(db, NOW, okFetch);
    expect(sentTo).toContain(`${TAG}-due@example.com`);
    expect(sentTo).not.toContain(`${TAG}-few@example.com`);
    expect(sentTo).not.toContain(`${TAG}-nc@example.com`);
    expect(r.sent).toBeGreaterThanOrEqual(1);

    // Ledger row written under the week key…
    const seq = `review-nudge:${isoWeekStamp(NOW)}`;
    const row = await db.lifecycleSend.findUnique({
      where: { userId_sequence: { userId: dueUser, sequence: seq } },
    });
    expect(row).not.toBeNull();

    // …and a second tick the same week sends nothing new to that user.
    sentTo.length = 0;
    await sendReviewDueNudges(db, NOW, okFetch);
    expect(sentTo).not.toContain(`${TAG}-due@example.com`);
  });

  test("isoWeekStamp is stable within a week and ISO-correct at year edges", () => {
    expect(isoWeekStamp(new Date("2026-07-22T00:00:00Z"))).toBe(
      isoWeekStamp(new Date("2026-07-26T23:59:59Z")), // same ISO week (Wed→Sun)
    );
    // 2027-01-01 is a Friday → ISO week 53 of 2026.
    expect(isoWeekStamp(new Date("2027-01-01T12:00:00Z"))).toBe("2026-w53");
  });
});
