// Tests for the `Net` server actions (design §2, §4) — CRUD, the verify GATE,
// and the meaty `deriveRails(revisionId)`.
//
// Nets are first-class revision connectivity data and reuse the same verify
// gate as PartFact/PartAsset: a Net moves through `UNVERIFIED → VERIFIED →
// FLAGGED` only via deliberate server actions, each behind `requireUser` +
// (for mutations) optimistic concurrency on `Net.updatedAt`. The guarantees:
//   - `createNet` validates the strict envelope (KiCad-safe name) + defaults
//     trust UNVERIFIED + stamps createdById; respects @@unique([revisionId,name]).
//   - `addNetNode` / `removeNetNode` attach/detach a single designator+pin;
//     respects @@unique([netId, refDes, pin]).
//   - `setNetTrust` is the gate: verify (UNVERIFIED→VERIFIED, stamps verifier),
//     unverify (VERIFIED→UNVERIFIED, clears verifier), flag (→FLAGGED), all on
//     the `updatedAt` optimistic-lock fence.
//   - `deriveRails` loads the revision's BomLines → each part's PINOUT fact,
//     expands comma-joined refDes, creates a `GND` (GROUND) net with a NetNode
//     per gnd pin, proposes POWER nets from power pins (3V3→+3V3), ignores io
//     pins, leaves every created net UNVERIFIED, and is idempotent on re-run.
//
// Exercises the real Neon DB. Mocks `next/cache` + `@/auth` exactly like
// `part-facts-actions.test.ts` — `requireUser()` resolves the mocked session
// email to the seeded User row. Isolation: ONE throwaway Project (cascading its
// Revision → Nets → NetNodes, and the BomLine) + ONE throwaway Part (cascading
// its PartFacts) created in `beforeAll`, torn down in `afterAll` (which asserts
// zero leftover rows). The real curriculum / seed data is never touched.
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mockAuth = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({
  auth: () => mockAuth(),
}));

import { db } from "@/lib/db";
import {
  addNetNode,
  createNet,
  deleteNet,
  deriveRails,
  removeNetNode,
  setNetTrust,
} from "@/lib/actions/nets";
import { powerNetNameFor } from "@/lib/schemas/net";

const SEED_EMAIL = "seed@example.com";
const TEST_SLUG = `nets-actions-test-${Date.now()}`;
const TEST_MFR = "NetsActions-TestCo";
const TEST_MPN = `NA-${Date.now()}`;

let seedUserId: string;
let throwawayProjectId: string;
let throwawayRevisionId: string;
let throwawayPartId: string;

beforeAll(async () => {
  mockAuth.mockImplementation(async () => ({
    user: { email: SEED_EMAIL },
  }));

  const seedUser = await db.user.findUniqueOrThrow({
    where: { email: SEED_EMAIL },
    select: { id: true },
  });
  seedUserId = seedUser.id;

  const project = await db.project.create({
    data: {
      slug: TEST_SLUG,
      name: "Nets actions test project",
      createdById: seedUserId,
      revisions: { create: { label: "v1" } },
    },
    select: { id: true, revisions: { select: { id: true } } },
  });
  throwawayProjectId = project.id;
  throwawayRevisionId = project.revisions[0]!.id;

  // The part on the BOM line — an LDO with a PINOUT fact carrying gnd + power
  // (named "3V3") + io pins. Three designators (U2 grouped) per the BomLine
  // refDes CHECK (array_length(string_to_array(refDes, ',')) === quantity).
  const part = await db.part.create({
    data: {
      manufacturer: TEST_MFR,
      mpn: TEST_MPN,
      description: "nets actions test part",
      category: "LDO_REGULATOR",
      createdById: seedUserId,
    },
    select: { id: true },
  });
  throwawayPartId = part.id;

  await db.partFact.create({
    data: {
      partId: throwawayPartId,
      group: "PINOUT",
      data: {
        pins: [
          { number: "1", name: "GND", function: "ground", type: "gnd" },
          { number: "2", name: "3V3", function: "power output", type: "power" },
          { number: "3", name: "EN", function: "enable", type: "io" },
        ],
      },
      trust: "UNVERIFIED",
      sourceKind: "DATASHEET",
      sourcePage: 1,
      createdById: seedUserId,
    },
  });

  // A BOM line grouping two designators (U2, U3) onto the one part. quantity
  // must equal the comma-split count to satisfy the DB CHECK.
  await db.bomLine.create({
    data: {
      revisionId: throwawayRevisionId,
      partId: throwawayPartId,
      refDes: "U2, U3",
      quantity: 2,
      createdById: seedUserId,
    },
  });
});

afterAll(async () => {
  // Project delete cascades Revision → Net → NetNode + BomLine. Part delete
  // cascades its PartFacts. Sweep by id and by slug/manufacturer.
  if (throwawayProjectId) {
    await db.project
      .deleteMany({ where: { id: throwawayProjectId } })
      .catch(() => {});
  }
  await db.project.deleteMany({ where: { slug: TEST_SLUG } }).catch(() => {});
  if (throwawayPartId) {
    await db.part.deleteMany({ where: { id: throwawayPartId } }).catch(() => {});
  }
  await db.part.deleteMany({ where: { manufacturer: TEST_MFR } }).catch(() => {});

  const leftoverProjects = throwawayProjectId
    ? await db.project.count({ where: { id: throwawayProjectId } })
    : 0;
  const leftoverNets = throwawayRevisionId
    ? await db.net.count({ where: { revisionId: throwawayRevisionId } })
    : 0;
  const leftoverParts = throwawayPartId
    ? await db.part.count({ where: { id: throwawayPartId } })
    : 0;
  expect(leftoverProjects).toBe(0);
  expect(leftoverNets).toBe(0);
  expect(leftoverParts).toBe(0);
});

// Sweep every net on the throwaway revision (between tests that both write nets
// — `@@unique([revisionId, name])` only allows one row per name).
async function clearNets() {
  await db.net
    .deleteMany({ where: { revisionId: throwawayRevisionId } })
    .catch(() => {});
}

// ─── powerNetNameFor (pure) ─────────────────────────────────────────────────
describe("powerNetNameFor (pure)", () => {
  test("3V3 / VDD / VCC → +3V3", () => {
    expect(powerNetNameFor("3V3")).toBe("+3V3");
    expect(powerNetNameFor("VDD")).toBe("+3V3");
    expect(powerNetNameFor("VCC")).toBe("+3V3");
  });

  test("VBUS / 5V / VIN → +5V", () => {
    expect(powerNetNameFor("VBUS")).toBe("+5V");
    expect(powerNetNameFor("5V")).toBe("+5V");
    expect(powerNetNameFor("VIN")).toBe("+5V");
  });

  test("an unmatched name falls back to a sanitized uppercase token", () => {
    expect(powerNetNameFor("VREF")).toBe("VREF");
    expect(powerNetNameFor("v ref")).toBe("V_REF");
  });
});

// ─── createNet ──────────────────────────────────────────────────────────────
describe("createNet", () => {
  test("defaults trust UNVERIFIED and stamps createdById", async () => {
    const net = await createNet({
      revisionId: throwawayRevisionId,
      name: "GND",
      netClass: "GROUND",
    });
    try {
      expect(net.trust).toBe("UNVERIFIED");
      expect(net.createdById).toBe(seedUserId);
      expect(net.netClass).toBe("GROUND");
      expect(net.verifiedById).toBeNull();
    } finally {
      await clearNets();
    }
  });

  test("rejects a name with KiCad-unsafe characters", async () => {
    await expect(
      createNet({
        revisionId: throwawayRevisionId,
        name: "bad net (x)",
        netClass: "SIGNAL",
      }),
    ).rejects.toThrow();
    const count = await db.net.count({
      where: { revisionId: throwawayRevisionId },
    });
    expect(count).toBe(0);
  });

  test("rejects a typo'd key via .strict()", async () => {
    await expect(
      createNet({
        revisionId: throwawayRevisionId,
        name: "GND",
        netClass: "GROUND",
        netClas: "GROUND",
      } as unknown),
    ).rejects.toThrow();
    await clearNets();
  });

  test("rejects a duplicate (revisionId, name) with a friendly error", async () => {
    const first = await createNet({
      revisionId: throwawayRevisionId,
      name: "+3V3",
      netClass: "POWER",
    });
    try {
      await expect(
        createNet({
          revisionId: throwawayRevisionId,
          name: "+3V3",
          netClass: "POWER",
        }),
      ).rejects.toThrow(/already/i);
    } finally {
      await db.net.deleteMany({ where: { id: first.id } }).catch(() => {});
      await clearNets();
    }
  });
});

// ─── deleteNet ────────────────────────────────────────────────────────────
describe("deleteNet", () => {
  test("deletes a net (cascading its nodes)", async () => {
    const net = await createNet({
      revisionId: throwawayRevisionId,
      name: "GND",
      netClass: "GROUND",
    });
    await addNetNode({ netId: net.id, refDes: "U2", pin: "1" });

    await deleteNet({ id: net.id });

    const stillThere = await db.net.count({ where: { id: net.id } });
    const nodes = await db.netNode.count({ where: { netId: net.id } });
    expect(stillThere).toBe(0);
    expect(nodes).toBe(0);
  });
});

// ─── addNetNode / removeNetNode ─────────────────────────────────────────────
describe("addNetNode / removeNetNode", () => {
  test("adds a node, rejects a duplicate (netId,refDes,pin), then removes it", async () => {
    const net = await createNet({
      revisionId: throwawayRevisionId,
      name: "GND",
      netClass: "GROUND",
    });
    try {
      const node = await addNetNode({ netId: net.id, refDes: "U2", pin: "1" });
      expect(node.refDes).toBe("U2");
      expect(node.pin).toBe("1");

      // A duplicate is rejected.
      await expect(
        addNetNode({ netId: net.id, refDes: "U2", pin: "1" }),
      ).rejects.toThrow();
      expect(await db.netNode.count({ where: { netId: net.id } })).toBe(1);

      await removeNetNode({ id: node.id });
      expect(await db.netNode.count({ where: { netId: net.id } })).toBe(0);
    } finally {
      await clearNets();
    }
  });
});

// ─── setNetTrust — the verify gate ──────────────────────────────────────────
describe("setNetTrust", () => {
  test("verify moves UNVERIFIED → VERIFIED and stamps the verifier", async () => {
    const net = await createNet({
      revisionId: throwawayRevisionId,
      name: "GND",
      netClass: "GROUND",
    });
    try {
      const verified = await setNetTrust({
        id: net.id,
        updatedAt: net.updatedAt,
        action: "verify",
      });
      expect(verified.trust).toBe("VERIFIED");
      expect(verified.verifiedById).toBe(seedUserId);
      expect(verified.verifiedAt).not.toBeNull();
    } finally {
      await clearNets();
    }
  });

  test("unverify moves VERIFIED → UNVERIFIED and clears the verifier", async () => {
    const net = await createNet({
      revisionId: throwawayRevisionId,
      name: "GND",
      netClass: "GROUND",
    });
    try {
      const v = await setNetTrust({
        id: net.id,
        updatedAt: net.updatedAt,
        action: "verify",
      });
      const un = await setNetTrust({
        id: v.id,
        updatedAt: v.updatedAt,
        action: "unverify",
      });
      expect(un.trust).toBe("UNVERIFIED");
      expect(un.verifiedById).toBeNull();
      expect(un.verifiedAt).toBeNull();
    } finally {
      await clearNets();
    }
  });

  test("flag moves a net to FLAGGED", async () => {
    const net = await createNet({
      revisionId: throwawayRevisionId,
      name: "GND",
      netClass: "GROUND",
    });
    try {
      const flagged = await setNetTrust({
        id: net.id,
        updatedAt: net.updatedAt,
        action: "flag",
      });
      expect(flagged.trust).toBe("FLAGGED");
    } finally {
      await clearNets();
    }
  });

  test("a stale updatedAt is rejected and the net is unchanged", async () => {
    const net = await createNet({
      revisionId: throwawayRevisionId,
      name: "GND",
      netClass: "GROUND",
    });
    try {
      const staleUpdatedAt = net.updatedAt;
      // A concurrent verify bumps updatedAt forward.
      await setNetTrust({
        id: net.id,
        updatedAt: net.updatedAt,
        action: "verify",
      });
      // Unverify carrying the STALE updatedAt must be rejected.
      await expect(
        setNetTrust({
          id: net.id,
          updatedAt: staleUpdatedAt,
          action: "unverify",
        }),
      ).rejects.toThrow(/reload|changed/i);
      const row = await db.net.findUniqueOrThrow({
        where: { id: net.id },
        select: { trust: true },
      });
      expect(row.trust).toBe("VERIFIED");
    } finally {
      await clearNets();
    }
  });
});

// ─── deriveRails — the meaty one ────────────────────────────────────────────
describe("deriveRails", () => {
  test("creates GND with the gnd nodes, proposes +3V3, ignores io, leaves UNVERIFIED", async () => {
    const summary = await deriveRails({ revisionId: throwawayRevisionId });
    try {
      // GND net (GROUND) created with a node per (designator × gnd pin).
      const gnd = await db.net.findFirstOrThrow({
        where: { revisionId: throwawayRevisionId, name: "GND" },
        include: { nodes: true },
      });
      expect(gnd.netClass).toBe("GROUND");
      expect(gnd.trust).toBe("UNVERIFIED");
      // gnd pin number is "1"; designators U2 + U3.
      const gndNodes = gnd.nodes
        .map((n) => `${n.refDes}.${n.pin}`)
        .sort();
      expect(gndNodes).toEqual(["U2.1", "U3.1"]);

      // +3V3 (POWER) proposed from the power pin named "3V3".
      const v3 = await db.net.findFirstOrThrow({
        where: { revisionId: throwawayRevisionId, name: "+3V3" },
        include: { nodes: true },
      });
      expect(v3.netClass).toBe("POWER");
      expect(v3.trust).toBe("UNVERIFIED");
      const v3Nodes = v3.nodes.map((n) => `${n.refDes}.${n.pin}`).sort();
      // power pin number is "2"; designators U2 + U3.
      expect(v3Nodes).toEqual(["U2.2", "U3.2"]);

      // io pin "EN" produced NO net.
      const en = await db.net.findFirst({
        where: { revisionId: throwawayRevisionId, name: "EN" },
      });
      expect(en).toBeNull();

      // Summary is testable: 2 nets, 4 nodes, +3V3 proposed.
      expect(summary.netsCreated).toBe(2);
      expect(summary.nodesCreated).toBe(4);
      expect(summary.proposedPowerNets).toEqual(["+3V3"]);
    } finally {
      await clearNets();
    }
  });

  test("is idempotent on a second run — no duplicate nets or nodes", async () => {
    const first = await deriveRails({ revisionId: throwawayRevisionId });
    try {
      expect(first.netsCreated).toBe(2);
      expect(first.nodesCreated).toBe(4);

      const second = await deriveRails({ revisionId: throwawayRevisionId });
      // Re-run reconciles: nothing new created.
      expect(second.netsCreated).toBe(0);
      expect(second.nodesCreated).toBe(0);
      expect(second.proposedPowerNets).toEqual(["+3V3"]);

      // Still exactly 2 nets, 4 nodes total.
      const nets = await db.net.count({
        where: { revisionId: throwawayRevisionId },
      });
      const nodes = await db.netNode.count({
        where: { net: { revisionId: throwawayRevisionId } },
      });
      expect(nets).toBe(2);
      expect(nodes).toBe(4);
    } finally {
      await clearNets();
    }
  });

  test("re-run after a manual verify preserves trust (does not reset to UNVERIFIED)", async () => {
    await deriveRails({ revisionId: throwawayRevisionId });
    try {
      const gnd = await db.net.findFirstOrThrow({
        where: { revisionId: throwawayRevisionId, name: "GND" },
      });
      const verified = await setNetTrust({
        id: gnd.id,
        updatedAt: gnd.updatedAt,
        action: "verify",
      });
      expect(verified.trust).toBe("VERIFIED");

      // Re-running must not clobber the human's verify on the existing GND net.
      await deriveRails({ revisionId: throwawayRevisionId });
      const after = await db.net.findUniqueOrThrow({
        where: { id: gnd.id },
        select: { trust: true },
      });
      expect(after.trust).toBe("VERIFIED");
    } finally {
      await clearNets();
    }
  });
});
