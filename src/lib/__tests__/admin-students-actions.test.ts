// Tests for the admin student-manager actions. Admin-gated writes over learner
// accounts: profile edit, entitlement grant/revoke, and account deletion with a
// self-delete guard. Self-contained fixtures (its own ADMIN + throwaway learners
// / project), so it never leans on the seed operator or board set.
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

// Intercept Stripe so deleteStudent's subscription-cancel never hits the real API.
const { stripeCancel } = vi.hoisted(() => ({ stripeCancel: vi.fn() }));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    subscriptions: { cancel: (...a: unknown[]) => stripeCancel(...a) },
  }),
}));

import { db } from "@/lib/db";
import {
  updateStudentProfile,
  grantProjectEntitlement,
  revokeEntitlement,
  deleteStudent,
} from "@/lib/actions/admin-students";
import { loadClusterByShareCode } from "@/lib/hex-cluster-load";
import { sharedView } from "@/lib/hex-share-view";
import { updateTag } from "next/cache";
import { hexClusterTag } from "@/lib/cache-profile";

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

  test("cancels an active Stripe subscription BEFORE deleting the account", async () => {
    stripeCancel.mockReset();
    stripeCancel.mockResolvedValue({});
    const target = await db.user.create({
      data: { email: `admin-sub-${stamp}@example.com`, role: "LEARNER" },
    });
    const subId = `sub_test_${stamp}`;
    await db.subscription.create({
      data: {
        userId: target.id,
        stripeSubscriptionId: subId,
        stripeCustomerId: "cus_x",
        status: "active",
      },
    });
    try {
      await deleteStudent({ userId: target.id });
      // The live sub was cancelled in Stripe first.
      expect(stripeCancel).toHaveBeenCalledWith(subId);
      // The account is gone; the Subscription audit row survives with userId → NULL.
      expect(await db.user.findUnique({ where: { id: target.id } })).toBeNull();
      const sub = await db.subscription.findUnique({
        where: { stripeSubscriptionId: subId },
      });
      expect(sub?.userId).toBeNull();
    } finally {
      await db.subscription.deleteMany({ where: { stripeSubscriptionId: subId } });
    }
  });
});

// Owner decision 2026-09-28: deleting an account deletes its saved hex builds,
// revisions and all, so no /c/ page of theirs stays public. The FK is SetNull,
// so without deleteStudent's explicit delete every row here would survive.
const HEX_SUMMARY = {
  nameAtSave: "del test",
  cells: 1,
  caps: 0,
  spikes: 0,
  pieces: 1,
  envelope: null,
  bom: [{ item: 1, qty: 1, label: "x", dims: null, sourceFile: "x" }],
  details: [],
};
let codeSeq = 0;
function shareCode(): string {
  // 22 base62 chars, unique per call and per run.
  return `D${stamp}${++codeSeq}`.padEnd(22, "Q").slice(0, 22);
}

/** A learner with one saved build of two revisions. Returns ids + codes. */
async function learnerWithBuild(tag: string) {
  const user = await db.user.create({
    data: { email: `admin-hex-${tag}-${stamp}@example.com`, role: "LEARNER" },
  });
  const codes = [shareCode(), shareCode()];
  const cluster = await db.hexCluster.create({
    data: {
      userId: user.id,
      name: `build ${tag}`,
      revisions: {
        create: codes.map((code, i) => ({
          revNo: i + 1,
          shareCode: code,
          payload: "v2s=abcdef",
          payloadHash: `h1:${"a".repeat(64)}`,
          schemaVersion: 2,
          summary: HEX_SUMMARY,
        })),
      },
    },
  });
  return { userId: user.id, clusterId: cluster.id, codes };
}

describe("deleteStudent deletes the account's saved hex builds", () => {
  test("builds, revisions and share codes go; another user's stay", async () => {
    const doomed = await learnerWithBuild("doomed");
    const kept = await learnerWithBuild("kept");
    try {
      // Precondition: both are live on /c/ before the delete.
      for (const code of [...doomed.codes, ...kept.codes]) {
        expect((await loadClusterByShareCode(code)).outcome).toBe("hit");
      }

      vi.mocked(updateTag).mockClear();
      await deleteStudent({ userId: doomed.userId });

      // The cached /c/ render is dropped now, not after the hour.
      expect(updateTag).toHaveBeenCalledWith(hexClusterTag(doomed.clusterId));
      expect(updateTag).not.toHaveBeenCalledWith(hexClusterTag(kept.clusterId));

      expect(await db.user.findUnique({ where: { id: doomed.userId } })).toBeNull();
      expect(
        await db.hexCluster.findUnique({ where: { id: doomed.clusterId } }),
      ).toBeNull();
      expect(
        await db.hexClusterRevision.count({
          where: { shareCode: { in: doomed.codes } },
        }),
      ).toBe(0);
      // Nothing orphaned with userId NULL either.
      expect(
        await db.hexCluster.count({ where: { name: "build doomed", userId: null } }),
      ).toBe(0);

      // /c/<code> of the deleted build is the generic "can't be opened" page.
      for (const code of doomed.codes) {
        const lookup = await loadClusterByShareCode(code);
        expect(lookup.outcome).toBe("unknown-code");
        expect(sharedView(lookup).kind).toBe("unknown-code");
      }

      // The other learner is untouched.
      const other = await db.hexCluster.findUnique({
        where: { id: kept.clusterId },
        include: { revisions: true },
      });
      expect(other?.userId).toBe(kept.userId);
      expect(other?.name).toBe("build kept");
      expect(other?.revisions).toHaveLength(2);
      for (const code of kept.codes) {
        expect((await loadClusterByShareCode(code)).outcome).toBe("hit");
      }
    } finally {
      await db.hexCluster.deleteMany({
        where: { id: { in: [doomed.clusterId, kept.clusterId] } },
      });
      await db.user.deleteMany({
        where: { id: { in: [doomed.userId, kept.userId] } },
      });
    }
  });

  test("a refused delete (Restrict FK) keeps the builds: it is one transaction", async () => {
    const author = await learnerWithBuild("author");
    const project = await db.project.create({
      data: {
        slug: `admin-hex-author-${stamp}`,
        name: "Authored",
        createdById: author.userId,
      },
    });
    try {
      await expect(deleteStudent({ userId: author.userId })).rejects.toThrow(
        /authored curriculum content/,
      );
      expect(await db.user.findUnique({ where: { id: author.userId } })).not.toBeNull();
      expect(
        await db.hexClusterRevision.count({ where: { clusterId: author.clusterId } }),
      ).toBe(2);
    } finally {
      await db.project.deleteMany({ where: { id: project.id } });
      await db.hexCluster.deleteMany({ where: { id: author.clusterId } });
      await db.user.deleteMany({ where: { id: author.userId } });
    }
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
