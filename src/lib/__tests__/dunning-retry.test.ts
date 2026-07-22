// The durable dunning retry: a failed payment-failed email used to be a
// console.error and nothing else — the webhook's event claim had already
// committed, so Stripe's redelivery no-oped and the customer was never told
// their card failed (silent involuntary churn). recordDunningPending parks a
// marker row in the LifecycleSend ledger (sequence "dunning-pending:<invoice>")
// and the lifecycle cron drains it: send via the transactional dunning sender
// (NOT consent-gated), delete the marker on success, keep it for the next tick
// on failure.
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

vi.mock("@/env", () => ({
  env: { AUTH_RESEND_KEY: "re_test", AUTH_RESEND_FROM: "billing@academy.test" },
}));
vi.mock("@/lib/seo/jsonld", () => ({ siteUrl: () => "https://academy.test" }));

import { db } from "@/lib/db";
import {
  recordDunningPending,
  drainDunningPending,
} from "@/lib/dunning-retry";

const EMAIL = `dunning-retry-${Date.now()}@example.com`;
let userId = "";

beforeAll(async () => {
  const u = await db.user.create({
    data: { email: EMAIL, name: "Dunned", role: "LEARNER" },
  });
  userId = u.id;
});

afterAll(async () => {
  await db.lifecycleSend.deleteMany({ where: { userId } });
  await db.user.deleteMany({ where: { id: userId } });
});

const okFetch = vi.fn(async () =>
  new Response(JSON.stringify({ id: "mock" }), { status: 200 }),
) as unknown as typeof fetch;
const failFetch = vi.fn(async () =>
  new Response(JSON.stringify({ error: "down" }), { status: 500 }),
) as unknown as typeof fetch;

describe("dunning retry ledger", () => {
  test("recordDunningPending is idempotent per invoice", async () => {
    await recordDunningPending(db, userId, "in_test123");
    await recordDunningPending(db, userId, "in_test123"); // duplicate = no throw
    const rows = await db.lifecycleSend.findMany({
      where: { userId, sequence: "dunning-pending:in_test123" },
    });
    expect(rows).toHaveLength(1);
  });

  test("drain sends the parked email and deletes the marker on success", async () => {
    const result = await drainDunningPending(db, okFetch);
    expect(result.sent).toBeGreaterThanOrEqual(1);
    const row = await db.lifecycleSend.findUnique({
      where: {
        userId_sequence: { userId, sequence: "dunning-pending:in_test123" },
      },
    });
    expect(row).toBeNull();
  });

  test("drain keeps the marker when the send fails (retries next tick)", async () => {
    await recordDunningPending(db, userId, "in_test456");
    const result = await drainDunningPending(db, failFetch);
    expect(result.failed).toBeGreaterThanOrEqual(1);
    const row = await db.lifecycleSend.findUnique({
      where: {
        userId_sequence: { userId, sequence: "dunning-pending:in_test456" },
      },
    });
    expect(row).not.toBeNull();
    // Cleanup for repeat runs.
    await db.lifecycleSend.deleteMany({ where: { userId } });
  });
});
