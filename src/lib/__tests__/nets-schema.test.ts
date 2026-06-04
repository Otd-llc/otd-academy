// Schema-level constraint tests for the `Net` / `NetNode` models (design §2).
//
// Nets are first-class revision connectivity data. This test pins the three
// structural guarantees the migration must enforce at the DB level:
//   - `Net @@unique([revisionId, name])` — one net name per revision.
//   - `NetNode @@unique([netId, refDes, pin])` — a pin can attach to a net once.
//   - `onDelete: Cascade` Revision→Net→NetNode — deleting a revision sweeps its
//     nets, and deleting nets sweeps their nodes.
//
// Exercises the real Neon DB (no actions exist yet — Prisma writes direct).
// Isolation: ONE throwaway Project (cascading its Revision → Nets → NetNodes)
// created in `beforeAll`, torn down in `afterAll` (which asserts zero leftover
// rows). The real curriculum / seed data is never touched. Mirrors the
// throwaway-entity + cleanup pattern in `part-assets-actions.test.ts`.
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { db } from "@/lib/db";

const SEED_EMAIL = "seed@example.com";
const TEST_SLUG = `nets-schema-test-${Date.now()}`;

let seedUserId: string;
let throwawayProjectId: string;
let throwawayRevisionId: string;

beforeAll(async () => {
  const seedUser = await db.user.findUniqueOrThrow({
    where: { email: SEED_EMAIL },
    select: { id: true },
  });
  seedUserId = seedUser.id;

  const project = await db.project.create({
    data: {
      slug: TEST_SLUG,
      name: "Nets schema test project",
      createdById: seedUserId,
      revisions: {
        create: {
          label: "v1",
        },
      },
    },
    select: { id: true, revisions: { select: { id: true } } },
  });
  throwawayProjectId = project.id;
  throwawayRevisionId = project.revisions[0]!.id;
});

afterAll(async () => {
  // Project delete cascades Revision → Net → NetNode. Sweep by id and by slug.
  if (throwawayProjectId) {
    await db.project
      .deleteMany({ where: { id: throwawayProjectId } })
      .catch(() => {});
  }
  await db.project.deleteMany({ where: { slug: TEST_SLUG } }).catch(() => {});

  const leftoverProjects = throwawayProjectId
    ? await db.project.count({ where: { id: throwawayProjectId } })
    : 0;
  const leftoverNets = throwawayRevisionId
    ? await db.net.count({ where: { revisionId: throwawayRevisionId } })
    : 0;
  expect(leftoverProjects).toBe(0);
  expect(leftoverNets).toBe(0);
});

// Helper: create a Net row directly on the throwaway revision.
async function createNet(name: string, netClass: "GROUND" | "POWER" | "SIGNAL") {
  return db.net.create({
    data: {
      revisionId: throwawayRevisionId,
      name,
      netClass,
      createdById: seedUserId,
    },
  });
}

// ─── Net @@unique([revisionId, name]) ───────────────────────────────────────
describe("Net unique([revisionId, name])", () => {
  test("a Net is created UNVERIFIED by default", async () => {
    const net = await createNet("GND", "GROUND");
    try {
      expect(net.trust).toBe("UNVERIFIED");
      expect(net.verifiedById).toBeNull();
      expect(net.verifiedAt).toBeNull();
      expect(net.createdById).toBe(seedUserId);
    } finally {
      await db.net.deleteMany({ where: { id: net.id } }).catch(() => {});
    }
  });

  test("a duplicate (revisionId, name) is rejected", async () => {
    const net = await createNet("+3V3", "POWER");
    try {
      await expect(createNet("+3V3", "POWER")).rejects.toThrow();
      // The original is untouched (still exactly one row for this name).
      const count = await db.net.count({
        where: { revisionId: throwawayRevisionId, name: "+3V3" },
      });
      expect(count).toBe(1);
    } finally {
      await db.net.deleteMany({ where: { id: net.id } }).catch(() => {});
    }
  });
});

// ─── NetNode @@unique([netId, refDes, pin]) ─────────────────────────────────
describe("NetNode unique([netId, refDes, pin])", () => {
  test("two distinct nodes on the same net are allowed; a duplicate is rejected", async () => {
    const net = await createNet("+5V", "POWER");
    try {
      // Two distinct designators on one net.
      await db.netNode.create({
        data: { netId: net.id, refDes: "U2", pin: "VIN" },
      });
      await db.netNode.create({
        data: { netId: net.id, refDes: "C2", pin: "1" },
      });
      const after = await db.netNode.count({ where: { netId: net.id } });
      expect(after).toBe(2);

      // A duplicate (netId, refDes, pin) is rejected.
      await expect(
        db.netNode.create({
          data: { netId: net.id, refDes: "U2", pin: "VIN" },
        }),
      ).rejects.toThrow();
      const stillTwo = await db.netNode.count({ where: { netId: net.id } });
      expect(stillTwo).toBe(2);
    } finally {
      await db.net.deleteMany({ where: { id: net.id } }).catch(() => {});
    }
  });

  test("the same (refDes, pin) on a DIFFERENT net is allowed", async () => {
    const a = await createNet("VBUS", "POWER");
    const b = await createNet("3V3_SENSE", "SIGNAL");
    try {
      await db.netNode.create({
        data: { netId: a.id, refDes: "U1", pin: "1" },
      });
      // Same refDes+pin, different net — the unique key includes netId, so OK.
      const node = await db.netNode.create({
        data: { netId: b.id, refDes: "U1", pin: "1" },
      });
      expect(node.id).toBeTruthy();
    } finally {
      await db.net
        .deleteMany({ where: { id: { in: [a.id, b.id] } } })
        .catch(() => {});
    }
  });
});

// ─── onDelete: Cascade Revision → Net → NetNode ─────────────────────────────
describe("cascade delete", () => {
  test("deleting a Net cascades its NetNodes", async () => {
    const net = await createNet("CASCADE_NET", "SIGNAL");
    await db.netNode.create({ data: { netId: net.id, refDes: "U3", pin: "2" } });
    await db.netNode.create({ data: { netId: net.id, refDes: "U3", pin: "3" } });

    await db.net.delete({ where: { id: net.id } });

    const nodes = await db.netNode.count({ where: { netId: net.id } });
    expect(nodes).toBe(0);
  });

  test("deleting a Revision cascades its Nets + NetNodes", async () => {
    // A throwaway revision under the throwaway project so the afterAll project
    // delete still leaves nothing behind even if this test's delete failed.
    const rev = await db.revision.create({
      data: { projectId: throwawayProjectId, label: "cascade-rev" },
      select: { id: true },
    });
    const net = await db.net.create({
      data: {
        revisionId: rev.id,
        name: "GND",
        netClass: "GROUND",
        createdById: seedUserId,
      },
      select: { id: true },
    });
    await db.netNode.create({ data: { netId: net.id, refDes: "U1", pin: "GND" } });
    await db.netNode.create({ data: { netId: net.id, refDes: "C1", pin: "2" } });

    await db.revision.delete({ where: { id: rev.id } });

    const nets = await db.net.count({ where: { revisionId: rev.id } });
    const nodes = await db.netNode.count({ where: { netId: net.id } });
    expect(nets).toBe(0);
    expect(nodes).toBe(0);
  });
});
