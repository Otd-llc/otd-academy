import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Real DB (this file leases its own Neon branch), fake auth. The point of
// these tests is the SQL: the advisory lock, the quota counts, the revNo
// allocation and the idempotency window all live there.
let currentUserId = "";
vi.mock("@/lib/auth-helpers", () => ({
  requireUser: async () => ({
    id: currentUserId,
    email: `${currentUserId}@example.invalid`,
  }),
}));
// Keyless in CI and local, so enforce() no-ops anyway; mocked so the test does
// not depend on that staying true.
vi.mock("@/lib/abuse-defense-flag", () => ({
  defenseEnabled: async () => false,
}));
vi.mock("@/lib/cache-invalidate", () => ({ invalidateHexCluster: () => {} }));

import { db } from "@/lib/db";
import {
  archiveHexCluster,
  renameHexCluster,
  saveHexCluster,
  unarchiveHexCluster,
} from "@/lib/actions/hex-clusters";
import {
  MAX_ACTIVE_CLUSTERS,
  MAX_REVISIONS_PER_CLUSTER,
  type SaveInput,
} from "@/lib/hex-cluster";

const madeUsers: string[] = [];

async function makeUser(): Promise<string> {
  const u = await db.user.create({
    data: {
      email: `hex-${Math.random().toString(36).slice(2)}@example.invalid`,
    },
    select: { id: true },
  });
  madeUsers.push(u.id);
  return u.id;
}

const SUMMARY = {
  cells: 2,
  caps: 1,
  spikes: 0,
  pieces: 3,
  envelope: { mm: [90.6, 48.8, 82.7], in: [3.57, 1.92, 3.26] },
  bom: [
    {
      item: 1,
      qty: 3,
      label: "Hex base",
      dims: "87.8 × 33.0 × 78.0",
      sourceFile: "Hex.FCStd",
    },
  ],
  details: [],
};

function input(over: Partial<SaveInput> = {}): SaveInput {
  return {
    mode: "new",
    name: "Bench cluster",
    payload: "s=eJyrVkrKz1WyUkotLs1RqgUAJ8QEjA",
    payloadHash: `h1:${"a".repeat(64)}`,
    schemaVersion: 1,
    summary: SUMMARY,
    ...over,
  };
}

/** A distinct payload+hash pair, so a save is not mistaken for a repeat. */
function distinct(n: number): Partial<SaveInput> {
  return {
    payload: `s=${"b".repeat(10)}${n}`,
    payloadHash: `h1:${n.toString(16).padStart(64, "0")}`,
  };
}

beforeEach(async () => {
  currentUserId = await makeUser();
});

afterAll(async () => {
  // Clusters cascade to revisions; users are throwaway rows this file made.
  await db.hexCluster.deleteMany({ where: { userId: { in: madeUsers } } });
  await db.user.deleteMany({ where: { id: { in: madeUsers } } });
});

describe("saveHexCluster — first save", () => {
  it("mints a drawing at Rev A with a share code", async () => {
    const res = await saveHexCluster(input());
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.revLabel).toBe("A");
    expect(res.shareCode).toMatch(/^[0-9A-Za-z]{22}$/);
    expect(res.name).toBe("Bench cluster");
    // savedAt is the row's own createdAt, not the client clock: the return
    // link stamps the sheet with it and /c/ renders the same instant.
    expect(Date.parse(res.savedAt)).toBeGreaterThan(0);
    expect(res.drawingLabel).toMatch(/-\d{4,}$/);
  });

  it("starts the register above 1000, so no printed number is three digits", async () => {
    const res = await saveHexCluster(input());
    if (!res.ok) throw new Error("expected ok");
    const no = Number(res.drawingLabel.split("-").pop());
    expect(no).toBeGreaterThanOrEqual(1001);
  });

  it("stamps the confirmed name into the summary the public page renders", async () => {
    const res = await saveHexCluster(input({ name: "  Rig cluster  " }));
    if (!res.ok) throw new Error("expected ok");
    const rev = await db.hexClusterRevision.findUnique({
      where: { shareCode: res.shareCode },
      select: { summary: true },
    });
    expect((rev!.summary as Record<string, unknown>).nameAtSave).toBe(
      "Rig cluster",
    );
  });
});

describe("saveHexCluster — rejections", () => {
  it("refuses an uncompressed payload with an actionable code", async () => {
    const res = await saveHexCluster(
      input({ payload: "u=eJyrVkrKz1WyUkotLs1Rqg" }),
    );
    expect(res).toMatchObject({ ok: false, code: "payload-uncompressed" });
  });

  it("refuses a malformed payload, a bad hash and a bad schema version", async () => {
    expect(await saveHexCluster(input({ payload: "nope" }))).toMatchObject({
      code: "payload-malformed",
    });
    expect(await saveHexCluster(input({ payloadHash: "nope" }))).toMatchObject({
      code: "payload-malformed",
    });
    expect(await saveHexCluster(input({ schemaVersion: 0 }))).toMatchObject({
      code: "payload-malformed",
    });
  });

  it("refuses an unusable name", async () => {
    expect(await saveHexCluster(input({ name: "   " }))).toMatchObject({
      code: "name-invalid",
    });
    expect(await saveHexCluster(input({ name: "x".repeat(61) }))).toMatchObject(
      { code: "name-invalid" },
    );
  });

  it("refuses a summary that could not be reconstructed later", async () => {
    expect(
      await saveHexCluster(input({ summary: { ...SUMMARY, bom: [] } })),
    ).toMatchObject({
      code: "summary-invalid",
    });
    expect(await saveHexCluster(input({ summary: null }))).toMatchObject({
      code: "summary-invalid",
    });
  });

  it("treats a revision save with no share code as not-found", async () => {
    expect(await saveHexCluster(input({ mode: "rev" }))).toMatchObject({
      code: "not-found",
    });
  });
});

describe("saveHexCluster — revisions", () => {
  it("appends B, C, D and keeps the drawing number", async () => {
    const first = await saveHexCluster(input());
    if (!first.ok) throw new Error("expected ok");

    const labels = [first.revLabel];
    let share = first.shareCode;
    for (let i = 2; i <= 4; i++) {
      const next = await saveHexCluster(
        input({ mode: "rev", share, ...distinct(i) }),
      );
      if (!next.ok) throw new Error(`rev ${i} failed`);
      expect(next.drawingLabel).toBe(first.drawingLabel);
      labels.push(next.revLabel);
      share = next.shareCode;
    }
    expect(labels).toEqual(["A", "B", "C", "D"]);
  });

  it("gives every revision its own share code", async () => {
    const first = await saveHexCluster(input());
    if (!first.ok) throw new Error("expected ok");
    const second = await saveHexCluster(
      input({ mode: "rev", share: first.shareCode, ...distinct(2) }),
    );
    if (!second.ok) throw new Error("expected ok");
    expect(second.shareCode).not.toBe(first.shareCode);
  });

  it("touches the parent's updatedAt, which the account list orders by", async () => {
    const first = await saveHexCluster(input());
    if (!first.ok) throw new Error("expected ok");
    const before = await db.hexCluster.findFirst({
      where: { userId: currentUserId },
      select: { id: true, updatedAt: true },
    });
    await new Promise((r) => setTimeout(r, 10));
    await saveHexCluster(
      input({ mode: "rev", share: first.shareCode, ...distinct(2) }),
    );
    const after = await db.hexCluster.findUnique({
      where: { id: before!.id },
      select: { updatedAt: true },
    });
    // @updatedAt fires only when the cluster row is updated, and creating a
    // revision does not touch it — without the explicit write the list would
    // order by created-or-last-renamed.
    expect(after!.updatedAt.getTime()).toBeGreaterThan(
      before!.updatedAt.getTime(),
    );
  });

  it("refuses a share code owned by someone else, as not-found", async () => {
    const mine = await saveHexCluster(input());
    if (!mine.ok) throw new Error("expected ok");
    currentUserId = await makeUser();
    // Indistinguishable from a code that does not exist: ownership is in the
    // WHERE, not a later branch.
    expect(
      await saveHexCluster(input({ mode: "rev", share: mine.shareCode })),
    ).toMatchObject({
      code: "not-found",
    });
  });

  it("stops at the revision cap and says which cap", async () => {
    const first = await saveHexCluster(input());
    if (!first.ok) throw new Error("expected ok");
    const cluster = await db.hexCluster.findFirstOrThrow({
      where: { userId: currentUserId },
      select: { id: true },
    });
    // Seed to the cap directly; driving 99 saves through the action would add
    // a minute to the suite to prove the same branch.
    await db.hexClusterRevision.createMany({
      data: Array.from({ length: MAX_REVISIONS_PER_CLUSTER - 1 }, (_, i) => ({
        clusterId: cluster.id,
        revNo: i + 2,
        // Fixed width, then padded with a NON-numeric filler: `seed1` and
        // `seed10` both pad to the same 22 characters with zeros.
        shareCode: `seed${String(i).padStart(4, "0")}`.padEnd(22, "x"),
        payload: "s=seeded",
        payloadHash: `h1:${(i + 2).toString(16).padStart(64, "0")}`,
        schemaVersion: 1,
        summary: SUMMARY,
      })),
    });
    const last = await db.hexClusterRevision.findFirstOrThrow({
      where: { clusterId: cluster.id },
      orderBy: { revNo: "desc" },
      select: { shareCode: true },
    });
    expect(
      await saveHexCluster(
        input({ mode: "rev", share: last.shareCode, ...distinct(999) }),
      ),
    ).toMatchObject({
      code: "quota-revisions",
    });
  });
});

describe("saveHexCluster — idempotency", () => {
  it("returns the same revision for a double-click, rather than a second drawing", async () => {
    const a = await saveHexCluster(input());
    const b = await saveHexCluster(input());
    if (!a.ok || !b.ok) throw new Error("expected ok");
    expect(b.shareCode).toBe(a.shareCode);
    expect(b.drawingLabel).toBe(a.drawingLabel);
    expect(
      await db.hexCluster.count({ where: { userId: currentUserId } }),
    ).toBe(1);
  });

  it("still allows a NEW drawing of the same bytes after a revision save", async () => {
    // The window is scoped to first revisions, or it would swallow the
    // "save as new" fork offered at the revision cap.
    const first = await saveHexCluster(input());
    if (!first.ok) throw new Error("expected ok");
    const rev = await saveHexCluster(
      input({ mode: "rev", share: first.shareCode, ...distinct(2) }),
    );
    if (!rev.ok) throw new Error("expected ok");
    const fresh = await saveHexCluster(input(distinct(2)));
    if (!fresh.ok) throw new Error("expected ok");
    expect(fresh.drawingLabel).not.toBe(first.drawingLabel);
  });

  it("does not collapse A -> B -> A into the earlier revision", async () => {
    // payloadHash is deliberately not unique per cluster: returning to earlier
    // bytes must mint a new revision carrying the old hash.
    const a = await saveHexCluster(input(distinct(1)));
    if (!a.ok) throw new Error("expected ok");
    const b = await saveHexCluster(
      input({ mode: "rev", share: a.shareCode, ...distinct(2) }),
    );
    if (!b.ok) throw new Error("expected ok");
    const backToA = await saveHexCluster(
      input({ mode: "rev", share: b.shareCode, ...distinct(1) }),
    );
    if (!backToA.ok) throw new Error("expected ok");
    expect(backToA.revLabel).toBe("C");
    expect(backToA.shareCode).not.toBe(a.shareCode);
  });
});

describe("saveHexCluster — concurrency", () => {
  it("serialises parallel revision saves into sequential revNo", async () => {
    // The advisory lock's whole job. Without it: INSERT … SELECT MAX+1 races
    // and both compute the same revNo; WITH the unique index but no lock, the
    // loser BLOCKS on the uncommitted key rather than failing fast.
    const first = await saveHexCluster(input());
    if (!first.ok) throw new Error("expected ok");

    const results = await Promise.all([
      saveHexCluster(
        input({ mode: "rev", share: first.shareCode, ...distinct(11) }),
      ),
      saveHexCluster(
        input({ mode: "rev", share: first.shareCode, ...distinct(12) }),
      ),
      saveHexCluster(
        input({ mode: "rev", share: first.shareCode, ...distinct(13) }),
      ),
    ]);
    expect(results.every((r) => r.ok)).toBe(true);

    const cluster = await db.hexCluster.findFirstOrThrow({
      where: { userId: currentUserId },
      select: { id: true },
    });
    const revNos = (
      await db.hexClusterRevision.findMany({
        where: { clusterId: cluster.id },
        orderBy: { revNo: "asc" },
        select: { revNo: true },
      })
    ).map((r) => r.revNo);
    expect(revNos).toEqual([1, 2, 3, 4]);
  });

  it("holds the active-cluster cap under parallel first saves", async () => {
    // count() in-transaction under READ COMMITTED does NOT hold a cap on its
    // own — measured: both transactions saw the same count and both inserted.
    await db.hexCluster.createMany({
      data: Array.from({ length: MAX_ACTIVE_CLUSTERS - 1 }, () => ({
        userId: currentUserId,
        name: "seed",
      })),
    });
    const results = await Promise.all([
      saveHexCluster(input(distinct(21))),
      saveHexCluster(input(distinct(22))),
      saveHexCluster(input(distinct(23))),
    ]);
    const ok = results.filter((r) => r.ok).length;
    expect(ok).toBe(1);
    expect(
      results
        .filter((r) => !r.ok)
        .every((r) => !r.ok && r.code === "quota-clusters"),
    ).toBe(true);
    expect(
      await db.hexCluster.count({
        where: { userId: currentUserId, archivedAt: null },
      }),
    ).toBe(MAX_ACTIVE_CLUSTERS);
  });
});

describe("archive, unarchive, rename", () => {
  it("archives, refuses a revision save, and offers unarchive-and-save instead", async () => {
    const first = await saveHexCluster(input());
    if (!first.ok) throw new Error("expected ok");
    const cluster = await db.hexCluster.findFirstOrThrow({
      where: { userId: currentUserId },
      select: { id: true },
    });

    expect(await archiveHexCluster(cluster.id)).toEqual({ ok: true });

    // cluster-archived, NOT not-found: the owner's remedy is one click, and
    // routing them into "save as new" would mint a duplicate drawing number.
    expect(
      await saveHexCluster(
        input({ mode: "rev", share: first.shareCode, ...distinct(2) }),
      ),
    ).toMatchObject({
      code: "cluster-archived",
    });

    // One transaction: the unarchive, the cap re-check and the insert.
    const saved = await saveHexCluster(
      input({
        mode: "rev",
        share: first.shareCode,
        allowUnarchive: true,
        ...distinct(2),
      }),
    );
    expect(saved.ok).toBe(true);
    const after = await db.hexCluster.findUniqueOrThrow({
      where: { id: cluster.id },
      select: { archivedAt: true },
    });
    expect(after.archivedAt).toBeNull();
  });

  it("archived clusters do not count against the ACTIVE cap", async () => {
    const res = await saveHexCluster(input());
    if (!res.ok) throw new Error("expected ok");
    const cluster = await db.hexCluster.findFirstOrThrow({
      where: { userId: currentUserId },
      select: { id: true },
    });
    await archiveHexCluster(cluster.id);
    expect(
      await db.hexCluster.count({
        where: { userId: currentUserId, archivedAt: null },
      }),
    ).toBe(0);
    expect(
      await db.hexCluster.count({ where: { userId: currentUserId } }),
    ).toBe(1);
  });

  it("unarchive re-checks the active cap", async () => {
    const res = await saveHexCluster(input());
    if (!res.ok) throw new Error("expected ok");
    const cluster = await db.hexCluster.findFirstOrThrow({
      where: { userId: currentUserId },
      select: { id: true },
    });
    await archiveHexCluster(cluster.id);
    await db.hexCluster.createMany({
      data: Array.from({ length: MAX_ACTIVE_CLUSTERS }, () => ({
        userId: currentUserId,
        name: "seed",
      })),
    });
    expect(await unarchiveHexCluster(cluster.id)).toMatchObject({
      code: "quota-clusters",
    });
  });

  it("renames, and refuses a name that could not be printed", async () => {
    const res = await saveHexCluster(input());
    if (!res.ok) throw new Error("expected ok");
    const cluster = await db.hexCluster.findFirstOrThrow({
      where: { userId: currentUserId },
      select: { id: true },
    });
    expect(await renameHexCluster(cluster.id, "Rig cluster")).toEqual({
      ok: true,
    });
    expect(await renameHexCluster(cluster.id, "bad\nname")).toMatchObject({
      code: "name-invalid",
    });

    // The rename does NOT reach summary.nameAtSave, which is what /c/ renders:
    // the revision is immutable and paper says what the name was at save.
    const rev = await db.hexClusterRevision.findUniqueOrThrow({
      where: { shareCode: res.shareCode },
      select: { summary: true },
    });
    expect((rev.summary as Record<string, unknown>).nameAtSave).toBe(
      "Bench cluster",
    );
  });

  it("refuses to touch another user's cluster", async () => {
    const res = await saveHexCluster(input());
    if (!res.ok) throw new Error("expected ok");
    const cluster = await db.hexCluster.findFirstOrThrow({
      where: { userId: currentUserId },
      select: { id: true },
    });
    currentUserId = await makeUser();
    expect(await renameHexCluster(cluster.id, "stolen")).toMatchObject({
      code: "not-found",
    });
    expect(await archiveHexCluster(cluster.id)).toMatchObject({
      code: "not-found",
    });
    expect(await unarchiveHexCluster(cluster.id)).toMatchObject({
      code: "not-found",
    });
  });
});
