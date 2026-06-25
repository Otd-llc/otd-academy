// Tests that a bundle (All-Access Pass) Entitlement grants access to EVERY
// project through `hasProjectEntitlement` — the read path every paywall uses.
//
// DB-backed (the vitest harness leases an isolated Neon branch per file, so this
// is prod-safe). Self-contained fixtures: its own user + two throwaway PREMIUM
// projects + the Pass Bundle row, all cleaned up in afterAll.
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { db } from "@/lib/db";
import { hasProjectEntitlement } from "@/lib/entitlements";

const OWNER_EMAIL = "ent-bundle-owner@example.com";
const USER_EMAIL = "ent-bundle-user@example.com";
const BUNDLE_KEY = `all-access-test-${Date.now()}`;

let ownerId = "";
let userId = "";
let projectAId = "";
let projectBId = "";
let bundleId = "";

beforeAll(async () => {
  await db.user.deleteMany({
    where: { email: { in: [OWNER_EMAIL, USER_EMAIL] } },
  });
  const owner = await db.user.create({
    data: { email: OWNER_EMAIL, name: "Owner", role: "ADMIN" },
  });
  ownerId = owner.id;
  const user = await db.user.create({
    data: { email: USER_EMAIL, name: "User", role: "LEARNER" },
  });
  userId = user.id;

  const projectA = await db.project.create({
    data: {
      slug: `ent-bundle-a-${Date.now()}`,
      name: "Bundle Target A",
      createdById: owner.id,
      accessTier: "PREMIUM",
    },
  });
  projectAId = projectA.id;
  const projectB = await db.project.create({
    data: {
      slug: `ent-bundle-b-${Date.now()}`,
      name: "Bundle Target B",
      createdById: owner.id,
      accessTier: "PREMIUM",
    },
  });
  projectBId = projectB.id;

  const bundle = await db.bundle.create({
    data: { key: BUNDLE_KEY, name: "All-Access Pass (test)" },
  });
  bundleId = bundle.id;
});

afterAll(async () => {
  await db.bundle.deleteMany({ where: { id: bundleId } });
  await db.project.deleteMany({
    where: { id: { in: [projectAId, projectBId] } },
  });
  await db.user.deleteMany({ where: { id: { in: [ownerId, userId] } } });
});

describe("hasProjectEntitlement with a bundle entitlement", () => {
  test("no entitlement → no access", async () => {
    expect(await hasProjectEntitlement(db, userId, projectAId)).toBe(false);
    expect(await hasProjectEntitlement(db, userId, projectBId)).toBe(false);
  });

  test("a bundle entitlement unlocks EVERY project", async () => {
    await db.entitlement.create({
      data: { userId, bundleId, source: "PURCHASE" },
    });
    // Both projects are now accessible off the single bundle row.
    expect(await hasProjectEntitlement(db, userId, projectAId)).toBe(true);
    expect(await hasProjectEntitlement(db, userId, projectBId)).toBe(true);
  });

  test("a per-project entitlement still grants only that project", async () => {
    const otherEmail = "ent-bundle-perproj@example.com";
    await db.user.deleteMany({ where: { email: otherEmail } });
    const other = await db.user.create({
      data: { email: otherEmail, name: "PerProject", role: "LEARNER" },
    });
    await db.entitlement.create({
      data: { userId: other.id, projectId: projectAId, source: "PURCHASE" },
    });

    expect(await hasProjectEntitlement(db, other.id, projectAId)).toBe(true);
    expect(await hasProjectEntitlement(db, other.id, projectBId)).toBe(false);

    await db.user.deleteMany({ where: { id: other.id } });
  });
});
