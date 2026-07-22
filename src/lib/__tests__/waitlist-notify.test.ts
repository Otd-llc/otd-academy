// The promised "we'll email you the moment it goes live" send. WaitlistSignup
// used to be a dead store (admin CSV export was the only reader); notifyWaitlist
// fulfills the promise once per signup, claim-first with release-on-failure.
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

vi.mock("@/env", () => ({
  env: {
    AUTH_RESEND_KEY: "re_test",
    AUTH_RESEND_FROM: "hello@academy.test",
    LIFECYCLE_POSTAL_ADDRESS: "One Thousand Drones, LLC, Broken Arrow, OK",
  },
}));
vi.mock("@/lib/seo/jsonld", () => ({ siteUrl: () => "https://academy.test" }));

import { db } from "@/lib/db";
import { notifyWaitlist, courseLiveEmail } from "@/lib/waitlist-notify";

const TAG = `wl-notify-${Date.now()}`;
let liveProjectId = "";
let comingProjectId = "";
let adminId = "";

beforeAll(async () => {
  const admin = await db.user.findFirstOrThrow({ where: { role: "ADMIN" } });
  adminId = admin.id;
  const live = await db.project.create({
    data: { slug: `${TAG}-live`, name: "Live Board", createdById: adminId },
  });
  liveProjectId = live.id;
  const rev = await db.revision.create({
    data: { projectId: live.id, label: "v1" },
  });
  await db.project.update({
    where: { id: live.id },
    data: { publishedRevisionId: rev.id },
  });
  const coming = await db.project.create({
    data: { slug: `${TAG}-coming`, name: "Coming Board", createdById: adminId },
  });
  comingProjectId = coming.id;

  await db.waitlistSignup.createMany({
    data: [
      { email: `${TAG}-a@example.com`, projectId: live.id },
      { email: `${TAG}-b@example.com`, projectId: coming.id },
    ],
  });
});

afterAll(async () => {
  await db.waitlistSignup.deleteMany({
    where: { projectId: { in: [liveProjectId, comingProjectId] } },
  });
  await db.project.deleteMany({
    where: { id: { in: [liveProjectId, comingProjectId] } },
  });
});

describe("notifyWaitlist", () => {
  test("failed send releases the claim (retries next tick), unpublished untouched", async () => {
    const failFetch = vi.fn(async () =>
      new Response(JSON.stringify({ error: "down" }), { status: 500 }),
    ) as unknown as typeof fetch;
    const r = await notifyWaitlist(db, failFetch);
    expect(r.failed).toBeGreaterThanOrEqual(1);
    const rowA = await db.waitlistSignup.findFirstOrThrow({
      where: { email: `${TAG}-a@example.com` },
    });
    expect(rowA.notifiedAt).toBeNull();
  });

  test("sends once for the published course only, stamps notifiedAt, never re-sends", async () => {
    const sentTo: string[] = [];
    const okFetch = vi.fn(async (_u: unknown, init?: RequestInit) => {
      sentTo.push(JSON.parse(String(init?.body)).to as string);
      return new Response(JSON.stringify({ id: "mock" }), { status: 200 });
    }) as unknown as typeof fetch;

    const r = await notifyWaitlist(db, okFetch);
    expect(r.sent).toBeGreaterThanOrEqual(1);
    expect(sentTo).toContain(`${TAG}-a@example.com`);
    expect(sentTo).not.toContain(`${TAG}-b@example.com`); // course not published

    const rowA = await db.waitlistSignup.findFirstOrThrow({
      where: { email: `${TAG}-a@example.com` },
    });
    expect(rowA.notifiedAt).not.toBeNull();

    // Second tick: nothing new for this signup.
    sentTo.length = 0;
    await notifyWaitlist(db, okFetch);
    expect(sentTo).not.toContain(`${TAG}-a@example.com`);
  });
});

describe("courseLiveEmail", () => {
  test("carries the course link and the one-email promise; no unsubscribe token", () => {
    const e = courseLiveEmail({
      courseName: "Live Board",
      courseUrl: "https://academy.test/learn/x",
      host: "academy.test",
      postalAddress: "addr",
    });
    expect(e.subject).toContain("Live Board");
    expect(e.html).toContain("https://academy.test/learn/x");
    expect(e.text).toContain("won't email you again");
    expect(e.html).not.toContain("Unsubscribe");
  });
});
