// Tests for the anonymous `joinWaitlist` action. A visitor leaves an email so we
// notify them when a course opens. Two legitimate contexts: a PREMIUM paywall,
// OR any UNPUBLISHED "coming soon" course (any tier). There is NO auth — the
// capture is anonymous. The action is idempotent on [email, projectId] and
// rejects only PUBLISHED non-premium courses (already available → no waitlist).
//
// Self-contained fixtures: its own throwaway projects (a PREMIUM, an unpublished
// FREE "coming soon", and a PUBLISHED FREE), so it never depends on the seed set.
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

// next/cache is stubbed WHOLESALE, so this factory must carry every export anything
// in this module graph touches — a missing one fails the import with "No X export is
// defined on the next/cache mock", which reads like a mock problem rather than the
// real cause. cacheLife/cacheTag are no-ops here: without the Next compiler the
// `use cache` directive is an inert string, so cached loaders simply run uncached.
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));

import { db } from "@/lib/db";
import { joinWaitlist } from "@/lib/actions/waitlist";

const OWNER_EMAIL = "waitlist-owner@example.com";
const SIGNUP_EMAIL = "waitlist-signup@example.com";

let ownerId = "";
let premiumProjectId = "";
let freeComingSoonId = "";
let freePublishedId = "";

beforeAll(async () => {
  await db.user.deleteMany({ where: { email: OWNER_EMAIL } });
  const owner = await db.user.create({
    data: { email: OWNER_EMAIL, name: "Owner", role: "ADMIN" },
  });
  ownerId = owner.id;
  const ts = Date.now();

  // Unpublished PREMIUM (allowed: premium case).
  const premium = await db.project.create({
    data: {
      slug: `waitlist-premium-${ts}`,
      name: "Premium Course",
      createdById: owner.id,
      accessTier: "PREMIUM",
    },
  });
  premiumProjectId = premium.id;

  // Unpublished FREE — "coming soon" (allowed: coming-soon case).
  const freeCs = await db.project.create({
    data: {
      slug: `waitlist-free-cs-${ts}`,
      name: "Free Coming Soon",
      createdById: owner.id,
      accessTier: "FREE",
    },
  });
  freeComingSoonId = freeCs.id;

  // Published FREE — already available (rejected: no waitlist).
  const freePub = await db.project.create({
    data: {
      slug: `waitlist-free-pub-${ts}`,
      name: "Free Published",
      createdById: owner.id,
      accessTier: "FREE",
    },
  });
  const rev = await db.revision.create({
    data: { projectId: freePub.id, label: "v1" },
  });
  await db.project.update({
    where: { id: freePub.id },
    data: { publishedRevisionId: rev.id },
  });
  freePublishedId = freePub.id;
});

afterAll(async () => {
  // WaitlistSignup + Revision have ON DELETE CASCADE on project, so deleting the
  // projects clears any rows this suite created.
  await db.project.deleteMany({
    where: { id: { in: [premiumProjectId, freeComingSoonId, freePublishedId] } },
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

  test("a join on an UNPUBLISHED (coming-soon) FREE course is allowed", async () => {
    const res = await joinWaitlist({
      email: SIGNUP_EMAIL,
      projectId: freeComingSoonId,
    });
    expect(res).toEqual({ ok: true });
    const count = await db.waitlistSignup.count({
      where: { email: SIGNUP_EMAIL, projectId: freeComingSoonId },
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

  test("a join on a PUBLISHED non-PREMIUM (FREE) course is rejected", async () => {
    await expect(
      joinWaitlist({ email: SIGNUP_EMAIL, projectId: freePublishedId }),
    ).rejects.toThrow(/premium/i);
    const count = await db.waitlistSignup.count({
      where: { projectId: freePublishedId },
    });
    expect(count).toBe(0);
  });

  test("a malformed email is rejected at parse", async () => {
    await expect(
      joinWaitlist({ email: "not-an-email", projectId: premiumProjectId }),
    ).rejects.toThrow();
  });
});
