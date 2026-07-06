// DB-backed tests for lifecycle-email selection + sending. Runs against an
// isolated Neon test branch (vitest.setup.ts leases one per file — prod-safe).
// Resend is MOCKED; no email ever leaves. Covers:
//   - trigger queries select the RIGHT users (and exclude the wrong stage/consent)
//   - once-only: a sent sequence is not re-selected, and a double send is a no-op
//   - consent guard: an opted-out user is never selected and never sent
//   - unsubscribe token round-trips and flips emailConsent → false
//
// Fixtures are throwaway: a unique entry-board project + revision + a set of users
// created in beforeAll and deleted in afterAll. We pass the throwaway slug into the
// selectors (their entryBoardSlug param) so the test never depends on prod
// curriculum rows being present in the branch.
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

import { db } from "@/lib/db";
import {
  welcomeAudience,
  schematicNudgeAudience,
  layoutNudgeAudience,
  drcNudgeAudience,
  activationUpsellAudience,
  payTheDifferenceAudience,
  launchWindowAudience,
  winBackAudience,
} from "@/lib/lifecycle-triggers";
import { sendLifecycleEmail } from "@/lib/lifecycle-send";
import { welcomeEmail } from "@/lib/lifecycle-emails";
import { signUnsubscribeToken, verifyUnsubscribeToken } from "@/lib/unsubscribe-token";

const TAG = `lifecycle-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const SLUG = `${TAG}-entry`;
// Per-call unique suffix so vitest's retry (which re-runs a failed test body)
// never collides on User.email's unique constraint.
let emailCounter = 0;
const email = (k: string) => `${TAG}-${k}-${emailCounter++}@example.test`;

let entryProjectId = "";
let entryRevisionId = "";
let paidProjectId = "";
const userIds: string[] = [];

// A Resend stub that records calls and never hits the network.
const resendCalls: Array<{ to: unknown; subject: unknown }> = [];
const okFetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
  const body = JSON.parse(String(init?.body ?? "{}"));
  resendCalls.push({ to: body.to, subject: body.subject });
  return new Response(JSON.stringify({ id: "mock" }), { status: 200 });
}) as unknown as typeof fetch;

// `now` and a day helper so we control the idle-age windows deterministically.
const NOW = new Date("2026-06-25T12:00:00.000Z");
const daysBefore = (d: number) => new Date(NOW.getTime() - d * 86_400_000);

async function makeUser(
  key: string,
  data: { emailConsent?: boolean; name?: string | null; createdAt?: Date } = {},
) {
  const u = await db.user.create({
    data: {
      email: email(key),
      name: data.name ?? `User ${key}`,
      role: "LEARNER",
      emailConsent: data.emailConsent ?? true,
      // Pin the account age relative to NOW so the welcome audience
      // (createdAt <= now) is deterministic regardless of the wall-clock time
      // the suite runs at (it was created at real `now`, which is after the
      // fixed NOW past noon UTC, so it was being excluded).
      createdAt: data.createdAt ?? daysBefore(1),
    },
  });
  userIds.push(u.id);
  return u;
}

async function enroll(
  userId: string,
  opts: { stage: string; status?: string; idleDays: number },
) {
  await db.enrollment.create({
    data: {
      userId,
      projectId: entryProjectId,
      revisionId: entryRevisionId,
      currentStage: opts.stage as never,
      status: (opts.status ?? "IN_PROGRESS") as never,
      currentStageEnteredAt: daysBefore(opts.idleDays),
      startedAt: daysBefore(opts.idleDays),
    },
  });
}

beforeAll(async () => {
  const admin = await db.user.findFirstOrThrow({ where: { role: "ADMIN" } });

  const project = await db.project.create({
    data: { slug: SLUG, name: "Lifecycle Test Entry Board", createdById: admin.id },
  });
  entryProjectId = project.id;
  const rev = await db.revision.create({
    data: { projectId: project.id, label: "v1" },
  });
  entryRevisionId = rev.id;

  const paid = await db.project.create({
    data: {
      slug: `${TAG}-paid`,
      name: "Lifecycle Test Paid Board",
      createdById: admin.id,
      accessTier: "PREMIUM",
      priceCents: 4900,
    },
  });
  paidProjectId = paid.id;
});

afterAll(async () => {
  // Children first (FKs). LifecycleSend + Enrollment + Entitlement cascade on user
  // delete, but delete explicitly to be order-independent of cascade config.
  await db.lifecycleSend.deleteMany({ where: { userId: { in: userIds } } });
  await db.enrollment.deleteMany({ where: { userId: { in: userIds } } });
  await db.entitlement.deleteMany({ where: { userId: { in: userIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  if (entryRevisionId) await db.revision.deleteMany({ where: { id: entryRevisionId } });
  if (entryProjectId) await db.project.deleteMany({ where: { id: entryProjectId } });
  if (paidProjectId) await db.project.deleteMany({ where: { id: paidProjectId } });
});

describe("welcome (1.1) audience", () => {
  test("selects opted-in users with NO entry-board enrollment; excludes enrolled + opted-out", async () => {
    const fresh = await makeUser("welcome-fresh");
    const enrolled = await makeUser("welcome-enrolled");
    await enroll(enrolled.id, { stage: "REQUIREMENTS", idleDays: 0 });
    const optedOut = await makeUser("welcome-optout", { emailConsent: false });

    const audience = await welcomeAudience(db, NOW, { entryBoardSlug: SLUG });
    const ids = audience.map((u) => u.id);

    expect(ids).toContain(fresh.id);
    expect(ids).not.toContain(enrolled.id);
    expect(ids).not.toContain(optedOut.id);
  });
});

describe("build-along nudge audiences (2.1 / 2.2 / 2.3)", () => {
  test("each selects only its stage, only when idle past the threshold", async () => {
    const days = 7;
    // 2.1 — at REQUIREMENTS, idle 10d → qualifies for schematic nudge only.
    const atReq = await makeUser("nudge-req");
    await enroll(atReq.id, { stage: "REQUIREMENTS", idleDays: 10 });
    // recently-active REQUIREMENTS user must NOT qualify.
    const atReqFresh = await makeUser("nudge-req-fresh");
    await enroll(atReqFresh.id, { stage: "REQUIREMENTS", idleDays: 1 });
    // 2.2 — passed ERC (BOM_SOURCING), idle 10d.
    const atBom = await makeUser("nudge-bom");
    await enroll(atBom.id, { stage: "BOM_SOURCING", idleDays: 10 });
    // 2.3 — in LAYOUT, idle 10d.
    const atLayout = await makeUser("nudge-layout");
    await enroll(atLayout.id, { stage: "LAYOUT", idleDays: 10 });

    const s = (await schematicNudgeAudience(db, NOW, days, SLUG)).map((u) => u.id);
    const l = (await layoutNudgeAudience(db, NOW, days, SLUG)).map((u) => u.id);
    const d = (await drcNudgeAudience(db, NOW, days, SLUG)).map((u) => u.id);

    expect(s).toContain(atReq.id);
    expect(s).not.toContain(atReqFresh.id); // idle < threshold
    expect(s).not.toContain(atBom.id);
    expect(s).not.toContain(atLayout.id);

    expect(l).toContain(atBom.id);
    expect(l).not.toContain(atReq.id);
    expect(l).not.toContain(atLayout.id);

    expect(d).toContain(atLayout.id);
    expect(d).not.toContain(atReq.id);
    expect(d).not.toContain(atBom.id);
  });
});

describe("activation (3.1) audience", () => {
  test("selects users who passed the gerber gate (COMPLETED or ≥ DRC_GERBER)", async () => {
    const completed = await makeUser("act-completed");
    await enroll(completed.id, { stage: "DRC_GERBER", status: "COMPLETED", idleDays: 1 });
    const atGerber = await makeUser("act-gerber");
    await enroll(atGerber.id, { stage: "DRC_GERBER", idleDays: 1 });
    const stillLayout = await makeUser("act-layout");
    await enroll(stillLayout.id, { stage: "LAYOUT", idleDays: 1 });

    const ids = (await activationUpsellAudience(db, NOW, SLUG)).map((u) => u.id);
    expect(ids).toContain(completed.id);
    expect(ids).toContain(atGerber.id);
    expect(ids).not.toContain(stillLayout.id);
  });
});

describe("pay-the-difference (4.1) audience", () => {
  test("selects users holding a PURCHASE entitlement; excludes GRANT-only", async () => {
    const buyer = await makeUser("paid-buyer");
    await db.entitlement.create({
      data: { userId: buyer.id, projectId: paidProjectId, source: "PURCHASE" },
    });
    const granted = await makeUser("paid-granted");
    await db.entitlement.create({
      data: { userId: granted.id, projectId: paidProjectId, source: "GRANT" },
    });

    const ids = (await payTheDifferenceAudience(db, NOW)).map((u) => u.id);
    expect(ids).toContain(buyer.id);
    expect(ids).not.toContain(granted.id);
  });
});

describe("launch-window (5.x) audience", () => {
  test("empty when no window / window closed; selects engaged Pass-less users when open", async () => {
    const noPass = await makeUser("lw-nopass");
    await enroll(noPass.id, { stage: "REQUIREMENTS", idleDays: 0 }); // engaged
    const open = new Date(NOW.getTime() + 86_400_000); // window ends tomorrow

    expect(await launchWindowAudience(db, NOW, "5.1", null)).toEqual([]);
    expect(await launchWindowAudience(db, NOW, "5.1", daysBefore(1))).toEqual([]); // closed

    const ids = (await launchWindowAudience(db, NOW, "5.1", open)).map((u) => u.id);
    expect(ids).toContain(noPass.id);
  });

  test("beats are paced off the window end, and zero-intent accounts are excluded", async () => {
    const engaged = await makeUser("lw-engaged");
    await enroll(engaged.id, { stage: "REQUIREMENTS", idleDays: 0 });
    const noEnroll = await makeUser("lw-noenroll"); // consented, never started a board
    const end = new Date(NOW.getTime() + 10 * 86_400_000); // 14-day window still open

    // 5.1 (launch day) is live now, and only reaches engaged users.
    const s1 = (await launchWindowAudience(db, NOW, "5.1", end, 14)).map((u) => u.id);
    expect(s1).toContain(engaged.id);
    expect(s1).not.toContain(noEnroll.id);

    // 5.2 (mid) and 5.3 (48h left) are not due yet → the selector short-circuits
    // to empty, so all four beats can never fire on the same tick.
    expect(await launchWindowAudience(db, NOW, "5.2", end, 14)).toEqual([]);
    expect(await launchWindowAudience(db, NOW, "5.3", end, 14)).toEqual([]);
  });
});

describe("win-back (6.1) audience", () => {
  test("selects stalled non-buyers; excludes completed + purchasers", async () => {
    const stalled = await makeUser("wb-stalled");
    await enroll(stalled.id, { stage: "SCHEMATIC", idleDays: 30 });
    const done = await makeUser("wb-done");
    await enroll(done.id, { stage: "DRC_GERBER", status: "COMPLETED", idleDays: 30 });
    const buyer = await makeUser("wb-buyer");
    await enroll(buyer.id, { stage: "SCHEMATIC", idleDays: 30 });
    await db.entitlement.create({
      data: { userId: buyer.id, projectId: paidProjectId, source: "PURCHASE" },
    });

    const ids = (await winBackAudience(db, NOW, 7, SLUG)).map((u) => u.id);
    expect(ids).toContain(stalled.id);
    expect(ids).not.toContain(done.id);
    expect(ids).not.toContain(buyer.id);
  });
});

describe("once-only send + consent guard (lifecycle-send)", () => {
  test("sends once, records the ledger, and refuses to re-send the same sequence", async () => {
    resendCalls.length = 0;
    const u = await makeUser("send-once");
    const built = welcomeEmail({
      firstName: "X",
      founderFirstName: "Josh",
      unsubscribeUrl: "https://x/u",
      host: "x",
      postalAddress: "One Thousand Drones, LLC, Broken Arrow, OK",
      l101Url: "https://x/l101",
    });

    const first = await sendLifecycleEmail(
      db,
      { userId: u.id, to: u.email!, sequence: "1.1", email: built, unsubscribeUrl: "https://x/u" },
      okFetch,
    );
    expect(first).toBe("sent");
    expect(resendCalls).toHaveLength(1);

    // Ledger row written.
    const ledger = await db.lifecycleSend.findUnique({
      where: { userId_sequence: { userId: u.id, sequence: "1.1" } },
    });
    expect(ledger).not.toBeNull();

    // Second attempt: already-sent, no new Resend call.
    const second = await sendLifecycleEmail(
      db,
      { userId: u.id, to: u.email!, sequence: "1.1", email: built, unsubscribeUrl: "https://x/u" },
      okFetch,
    );
    expect(second).toBe("already-sent");
    expect(resendCalls).toHaveLength(1);

    // And the selector excludes a user who already has the ledger row.
    const wEnrolledNone = await welcomeAudience(db, NOW, { entryBoardSlug: SLUG });
    // u has no enrollment, so it WOULD qualify for welcome — but the ledger row
    // for 1.1 must exclude it.
    expect(wEnrolledNone.map((x) => x.id)).not.toContain(u.id);
  });

  test("consent guard: an opted-out user is skipped and never emailed", async () => {
    resendCalls.length = 0;
    const u = await makeUser("send-optout", { emailConsent: false });
    const built = welcomeEmail({
      firstName: "X",
      founderFirstName: "Josh",
      unsubscribeUrl: "https://x/u",
      host: "x",
      postalAddress: "One Thousand Drones, LLC, Broken Arrow, OK",
      l101Url: "https://x/l101",
    });

    const outcome = await sendLifecycleEmail(
      db,
      { userId: u.id, to: u.email!, sequence: "1.1", email: built, unsubscribeUrl: "https://x/u" },
      okFetch,
    );
    expect(outcome).toBe("skipped-consent");
    expect(resendCalls).toHaveLength(0);
    // No ledger row written for a skipped user.
    const ledger = await db.lifecycleSend.findUnique({
      where: { userId_sequence: { userId: u.id, sequence: "1.1" } },
    });
    expect(ledger).toBeNull();
  });
});

describe("unsubscribe round-trip flips consent", () => {
  test("a signed token verifies and an updateMany flips emailConsent → false", async () => {
    const u = await makeUser("unsub-flip"); // starts opted-in
    const token = signUnsubscribeToken(u.id);

    const claims = verifyUnsubscribeToken(token);
    expect(claims?.userId).toBe(u.id);

    // Simulate the route's effect.
    const res = await db.user.updateMany({
      where: { id: claims!.userId },
      data: { emailConsent: false, emailConsentUpdatedAt: NOW },
    });
    expect(res.count).toBe(1);

    const after = await db.user.findUniqueOrThrow({
      where: { id: u.id },
      select: { emailConsent: true, emailConsentUpdatedAt: true },
    });
    expect(after.emailConsent).toBe(false);
    expect(after.emailConsentUpdatedAt).not.toBeNull();

    // And now the welcome selector (consent-gated) excludes them.
    const audience = await welcomeAudience(db, NOW, { entryBoardSlug: SLUG });
    expect(audience.map((x) => x.id)).not.toContain(u.id);
  });
});
