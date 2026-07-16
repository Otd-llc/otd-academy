// Tests for the admin `setProjectAccessTier` action (skill-tree Task 10). An
// ADMIN flips a project's `accessTier` (the dimension /courses reads); a
// non-admin (LEARNER) is rejected with Forbidden and the row is untouched.
//
// Self-contained fixtures: its own ADMIN + LEARNER users and a throwaway
// project (unique slug via Date.now()), so it never depends on the seed
// operator's role. ⚠️ `.env.local` DATABASE_URL is PROD — create + clean up
// only the rows this suite owns.
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

const mockAuth = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({ auth: () => mockAuth() }));

import { db } from "@/lib/db";
import { setProjectAccessTier } from "@/lib/actions/project-visibility";

const ADMIN_EMAIL = "set-tier-admin@example.com";
const LEARNER_EMAIL = "set-tier-learner@example.com";
const PROJECT_SLUG = `set-tier-project-${Date.now()}`;

let adminId = "";
let learnerId = "";
let projectId = "";

beforeAll(async () => {
  await db.user.deleteMany({
    where: { email: { in: [ADMIN_EMAIL, LEARNER_EMAIL] } },
  });
  const admin = await db.user.create({
    data: { email: ADMIN_EMAIL, name: "Admin", role: "ADMIN" },
  });
  adminId = admin.id;
  const learner = await db.user.create({
    data: { email: LEARNER_EMAIL, name: "Learner", role: "LEARNER" },
  });
  learnerId = learner.id;

  const project = await db.project.create({
    data: {
      slug: PROJECT_SLUG,
      name: "Set Tier Target",
      createdById: admin.id,
      accessTier: "FREE",
    },
  });
  projectId = project.id;
});

afterAll(async () => {
  await db.project.deleteMany({ where: { id: projectId } });
  await db.user.deleteMany({
    where: { id: { in: [adminId, learnerId] } },
  });
});

describe("setProjectAccessTier", () => {
  test("rejects a non-admin caller and leaves the tier unchanged", async () => {
    mockAuth.mockResolvedValue({ user: { email: LEARNER_EMAIL } });
    await expect(
      setProjectAccessTier({ slug: PROJECT_SLUG, tier: "PREMIUM" }),
    ).rejects.toThrow(/Forbidden/);
    const row = await db.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { accessTier: true },
    });
    expect(row.accessTier).toBe("FREE");
  });

  test("an admin flips the project's access tier", async () => {
    mockAuth.mockResolvedValue({ user: { email: ADMIN_EMAIL } });
    await setProjectAccessTier({ slug: PROJECT_SLUG, tier: "PREMIUM" });
    const row = await db.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { accessTier: true },
    });
    expect(row.accessTier).toBe("PREMIUM");
  });

  test("an admin can flip it again to PUBLIC", async () => {
    mockAuth.mockResolvedValue({ user: { email: ADMIN_EMAIL } });
    await setProjectAccessTier({ slug: PROJECT_SLUG, tier: "PUBLIC" });
    const row = await db.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { accessTier: true },
    });
    expect(row.accessTier).toBe("PUBLIC");
  });
});
