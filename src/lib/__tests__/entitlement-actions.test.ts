// Tests for the admin `grantEntitlement` action (Task A5). An ADMIN comps a
// learner access to a (typically PREMIUM) project by writing an Entitlement row
// keyed on [userId, projectId]. The action is admin-gated and idempotent — a
// re-grant must not throw or duplicate.
//
// Self-contained fixtures: its own ADMIN + LEARNER users and a throwaway
// project, so it never depends on the seed operator's role or board set.
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockAuth = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({ auth: () => mockAuth() }));

import { db } from "@/lib/db";
import { grantEntitlement } from "@/lib/actions/entitlement";

const ADMIN_EMAIL = "grant-ent-admin@example.com";
const LEARNER_EMAIL = "grant-ent-learner@example.com";
const TARGET_EMAIL = "grant-ent-target@example.com";

let adminId = "";
let learnerId = "";
let targetId = "";
let projectId = "";

beforeAll(async () => {
  await db.user.deleteMany({
    where: { email: { in: [ADMIN_EMAIL, LEARNER_EMAIL, TARGET_EMAIL] } },
  });
  const admin = await db.user.create({
    data: { email: ADMIN_EMAIL, name: "Admin", role: "ADMIN" },
  });
  adminId = admin.id;
  const learner = await db.user.create({
    data: { email: LEARNER_EMAIL, name: "Learner", role: "LEARNER" },
  });
  learnerId = learner.id;
  const target = await db.user.create({
    data: { email: TARGET_EMAIL, name: "Target", role: "LEARNER" },
  });
  targetId = target.id;

  const project = await db.project.create({
    data: {
      slug: `grant-ent-${Date.now()}`,
      name: "Grant Target",
      createdById: admin.id,
      accessTier: "PREMIUM",
    },
  });
  projectId = project.id;
});

afterAll(async () => {
  // Entitlement has ON DELETE CASCADE on both user and project, so deleting
  // the project + users clears any rows this suite created.
  await db.project.deleteMany({ where: { id: projectId } });
  await db.user.deleteMany({
    where: { id: { in: [adminId, learnerId, targetId] } },
  });
});

describe("grantEntitlement", () => {
  test("rejects a non-admin caller", async () => {
    mockAuth.mockResolvedValue({ user: { email: LEARNER_EMAIL } });
    await expect(
      grantEntitlement({ userId: targetId, projectId }),
    ).rejects.toThrow(/Forbidden/);
    const count = await db.entitlement.count({
      where: { userId: targetId, projectId },
    });
    expect(count).toBe(0);
  });

  test("an admin grant creates the entitlement row (source GRANT)", async () => {
    mockAuth.mockResolvedValue({ user: { email: ADMIN_EMAIL } });
    await grantEntitlement({ userId: targetId, projectId });
    const row = await db.entitlement.findUniqueOrThrow({
      where: { userId_projectId: { userId: targetId, projectId } },
    });
    expect(row.source).toBe("GRANT");
  });

  test("re-granting is idempotent — still exactly one row", async () => {
    mockAuth.mockResolvedValue({ user: { email: ADMIN_EMAIL } });
    await grantEntitlement({ userId: targetId, projectId });
    await grantEntitlement({ userId: targetId, projectId });
    const count = await db.entitlement.count({
      where: { userId: targetId, projectId },
    });
    expect(count).toBe(1);
  });
});
