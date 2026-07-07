// Tests for the admin student-manager actions. Admin-gated writes over learner
// accounts: profile edit, entitlement grant/revoke, and account deletion with a
// self-delete guard. Self-contained fixtures (its own ADMIN + throwaway learners
// / project), so it never leans on the seed operator or board set.
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockAuth = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({ auth: () => mockAuth() }));

import { db } from "@/lib/db";
import {
  updateStudentProfile,
  grantProjectEntitlement,
  revokeEntitlement,
  deleteStudent,
} from "@/lib/actions/admin-students";

const ADMIN_EMAIL = "admin-students-admin@example.com";
const stamp = Date.now();

let adminId = "";
let projectId = "";

beforeAll(async () => {
  await db.user.deleteMany({ where: { email: ADMIN_EMAIL } });
  const admin = await db.user.create({
    data: { email: ADMIN_EMAIL, name: "Ops", role: "ADMIN" },
  });
  adminId = admin.id;
  mockAuth.mockResolvedValue({ user: { email: ADMIN_EMAIL } });

  const project = await db.project.create({
    data: {
      slug: `admin-students-${stamp}`,
      name: "Admin Students Target",
      createdById: admin.id,
      accessTier: "PREMIUM",
    },
  });
  projectId = project.id;
});

afterAll(async () => {
  await db.project.deleteMany({ where: { id: projectId } });
  await db.user.deleteMany({ where: { email: ADMIN_EMAIL } });
});

describe("deleteStudent", () => {
  test("refuses to delete the acting admin's own account", async () => {
    await expect(deleteStudent({ userId: adminId })).rejects.toThrow(
      /your own account/i,
    );
    // The admin row is still there.
    expect(await db.user.findUnique({ where: { id: adminId } })).not.toBeNull();
  });

  test("deletes a learner account", async () => {
    const target = await db.user.create({
      data: { email: `admin-del-${stamp}@example.com`, role: "LEARNER" },
    });
    await deleteStudent({ userId: target.id });
    expect(await db.user.findUnique({ where: { id: target.id } })).toBeNull();
  });
});

describe("updateStudentProfile", () => {
  test("edits name, consent, and onboarding goal (stamps consent time)", async () => {
    const u = await db.user.create({
      data: { email: `admin-prof-${stamp}@example.com`, role: "LEARNER" },
    });
    try {
      await updateStudentProfile({
        userId: u.id,
        name: "Renamed Learner",
        emailConsent: true,
        onboardingGoal: "first_board",
      });
      const after = await db.user.findUniqueOrThrow({ where: { id: u.id } });
      expect(after.name).toBe("Renamed Learner");
      expect(after.emailConsent).toBe(true);
      expect(after.emailConsentUpdatedAt).not.toBeNull();
      expect(after.onboardingGoal).toBe("first_board");
    } finally {
      await db.user.deleteMany({ where: { id: u.id } });
    }
  });
});

describe("grant / revoke entitlement", () => {
  test("grants a board then revokes it", async () => {
    const u = await db.user.create({
      data: { email: `admin-ent-${stamp}@example.com`, role: "LEARNER" },
    });
    try {
      await grantProjectEntitlement({ userId: u.id, projectId });
      const granted = await db.entitlement.findUnique({
        where: { userId_projectId: { userId: u.id, projectId } },
      });
      expect(granted).not.toBeNull();
      expect(granted?.source).toBe("GRANT");

      await revokeEntitlement({ userId: u.id, entitlementId: granted!.id });
      expect(
        await db.entitlement.findUnique({
          where: { userId_projectId: { userId: u.id, projectId } },
        }),
      ).toBeNull();
    } finally {
      await db.user.deleteMany({ where: { id: u.id } });
    }
  });
});
