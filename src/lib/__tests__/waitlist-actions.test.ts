// Tests for the anonymous `joinWaitlist` action (Task B1). A visitor leaves an
// email against a PREMIUM project's paywall so we can notify them when it opens.
// There is NO auth here — anonymous capture is the whole point. The action is
// idempotent on [email, projectId] and refuses non-PREMIUM projects (the
// waitlist only fronts a premium paywall).
//
// Self-contained fixtures: its own throwaway PREMIUM + FREE projects, so it
// never depends on the seed operator's role or project set.
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { db } from "@/lib/db";
import { joinWaitlist } from "@/lib/actions/waitlist";

const OWNER_EMAIL = "waitlist-owner@example.com";
const SIGNUP_EMAIL = "waitlist-signup@example.com";

let ownerId = "";
let premiumProjectId = "";
let freeProjectId = "";

beforeAll(async () => {
  await db.user.deleteMany({ where: { email: OWNER_EMAIL } });
  const owner = await db.user.create({
    data: { email: OWNER_EMAIL, name: "Owner", role: "ADMIN" },
  });
  ownerId = owner.id;

  const premium = await db.project.create({
    data: {
      slug: `waitlist-premium-${Date.now()}`,
      name: "Premium Course",
      createdById: owner.id,
      accessTier: "PREMIUM",
    },
  });
  premiumProjectId = premium.id;

  const free = await db.project.create({
    data: {
      slug: `waitlist-free-${Date.now()}`,
      name: "Free Course",
      createdById: owner.id,
      accessTier: "FREE",
    },
  });
  freeProjectId = free.id;
});

afterAll(async () => {
  // WaitlistSignup has ON DELETE CASCADE on project, so deleting the projects
  // clears any rows this suite created.
  await db.project.deleteMany({
    where: { id: { in: [premiumProjectId, freeProjectId] } },
  });
  await db.user.deleteMany({ where: { id: ownerId } });
});

describe("joinWaitlist", () => {
  test("an anonymous join on a PREMIUM project creates a row", async () => {
    const res = await joinWaitlist({
      email: SIGNUP_EMAIL,
      projectId: premiumProjectId,
    });
    expect(res).toEqual({ ok: true });
    const count = await db.waitlistSignup.count({
      where: { email: SIGNUP_EMAIL, projectId: premiumProjectId },
    });
    expect(count).toBe(1);
  });

  test("a second identical join is idempotent — still exactly one row", async () => {
    await joinWaitlist({ email: SIGNUP_EMAIL, projectId: premiumProjectId });
    await joinWaitlist({ email: SIGNUP_EMAIL, projectId: premiumProjectId });
    const count = await db.waitlistSignup.count({
      where: { email: SIGNUP_EMAIL, projectId: premiumProjectId },
    });
    expect(count).toBe(1);
  });

  test("a join on a non-PREMIUM (FREE) project is rejected", async () => {
    await expect(
      joinWaitlist({ email: SIGNUP_EMAIL, projectId: freeProjectId }),
    ).rejects.toThrow(/premium/i);
    const count = await db.waitlistSignup.count({
      where: { projectId: freeProjectId },
    });
    expect(count).toBe(0);
  });

  test("a malformed email is rejected at parse", async () => {
    await expect(
      joinWaitlist({ email: "not-an-email", projectId: premiumProjectId }),
    ).rejects.toThrow();
  });
});
