// M9a checkpoint (Task 12.5).
//
// End-to-end demoable Boards-CRUD flow against the seeded
// "esp32-sensor-breakout" v1 BRINGUP revision + BUILD-001 + 5 boards
// (B01-B05, all seeded as ASSEMBLED with silkscreenHash "g1ebc1cc").
//
// Observable steps:
//   1. Register a new board B06 with the seeded silkscreenHash via the
//      createBoard action — success; default status BARE.
//   2. Edit B01 through the in-flight enum chain ASSEMBLED → POWERED
//      → BROUGHT_UP — each transition succeeds.
//   3. Set B05 to QUARANTINED. Re-evaluate the BRINGUP exit gate; the
//      QUARANTINED status counts as "done" per design §2 (the gate's
//      unfinished filter excludes both BROUGHT_UP and QUARANTINED),
//      so the gate's pre-existing failure count for "not yet
//      BROUGHT_UP or QUARANTINED" must DROP by one when B05 flips.
//
// All mutations happen against the real DB; the test restores the seeded
// state (B01-B05 all ASSEMBLED, B06 deleted, board statuses normal) in
// afterAll so the existing M7/M8a/M8c demos keep working.
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mockAuth = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({
  auth: () => mockAuth(),
}));

import type { BoardStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { createBoard, deleteBoard, editBoard } from "@/lib/actions/boards";
import { loadGateContext } from "@/lib/load-gate-context";
import { STAGES } from "@/lib/stages";

const SEED_EMAIL = "seed@example.com";
const SEED_PROJECT_SLUG = "esp32-sensor-breakout";

let seededBuildId = "";
let seededRevId = "";
let originalStatuses: { id: string; status: BoardStatus }[] = [];
const createdBoardIds: string[] = [];

beforeAll(async () => {
  mockAuth.mockImplementation(async () => ({
    user: { email: SEED_EMAIL },
  }));

  const project = await db.project.findUniqueOrThrow({
    where: { slug: SEED_PROJECT_SLUG },
  });
  const rev = await db.revision.findFirstOrThrow({
    where: {
      projectId: project.id,
      label: { equals: "v1", mode: "insensitive" },
    },
  });
  const build = await db.build.findFirstOrThrow({
    where: { revisionId: rev.id },
    include: { boards: { orderBy: { serial: "asc" } } },
  });
  seededBuildId = build.id;
  seededRevId = rev.id;
  originalStatuses = build.boards.map((b) => ({ id: b.id, status: b.status }));
});

afterAll(async () => {
  // Restore B01-B05 statuses.
  for (const s of originalStatuses) {
    await db.board.update({ where: { id: s.id }, data: { status: s.status } });
  }
  // Remove any test-created boards (e.g., B06).
  if (createdBoardIds.length > 0) {
    await db.board.deleteMany({ where: { id: { in: createdBoardIds } } });
  }
});

describe("M9a checkpoint — Boards CRUD + status + silkscreen on the seeded fixture", () => {
  test("step 1: register a new board B06 with the seeded silkscreen hash → success, default BARE", async () => {
    const board = await createBoard({
      buildId: seededBuildId,
      serial: "B06",
      silkscreenHash: "g1ebc1cc",
    });
    createdBoardIds.push(board.id);

    expect(board.serial).toBe("B06");
    expect(board.silkscreenHash).toBe("g1ebc1cc");
    expect(board.status).toBe("BARE");
    expect(board.buildId).toBe(seededBuildId);
  });

  test("step 2: edit B01 through ASSEMBLED → POWERED → BROUGHT_UP", async () => {
    const b01 = await db.board.findFirstOrThrow({
      where: {
        buildId: seededBuildId,
        serial: { equals: "B01", mode: "insensitive" },
      },
    });

    // Seeded as ASSEMBLED — first edit moves to POWERED, second to BROUGHT_UP.
    expect(b01.status).toBe("ASSEMBLED");

    const after1 = await editBoard({ id: b01.id, status: "POWERED" });
    expect(after1.status).toBe("POWERED");

    const after2 = await editBoard({ id: after1.id, status: "BROUGHT_UP" });
    expect(after2.status).toBe("BROUGHT_UP");
  });

  test("step 3: setting B05 to QUARANTINED drops the BRINGUP unfinished-boards count by one", async () => {
    // Pre-state: B01 is BROUGHT_UP (from step 2), B06 was just created BARE,
    // B02-B05 still ASSEMBLED. The BRINGUP gate's "not yet BROUGHT_UP or
    // QUARANTINED" filter flags everything except B01 → 5 boards.
    const ctxBefore = await loadGateContext(db, seededRevId);
    const unfinishedBefore = ctxBefore.activeBuild?.boards.filter(
      (b) => !["BROUGHT_UP", "QUARANTINED"].includes(b.status),
    );
    expect(unfinishedBefore?.length).toBe(5);

    const b05 = await db.board.findFirstOrThrow({
      where: {
        buildId: seededBuildId,
        serial: { equals: "B05", mode: "insensitive" },
      },
    });
    const after = await editBoard({ id: b05.id, status: "QUARANTINED" });
    expect(after.status).toBe("QUARANTINED");

    // Re-run the gate predicate. B05 is now QUARANTINED — that's a "done"
    // bucket per the gate's filter, so unfinished should drop to 4.
    const ctxAfter = await loadGateContext(db, seededRevId);
    const unfinishedAfter = ctxAfter.activeBuild?.boards.filter(
      (b) => !["BROUGHT_UP", "QUARANTINED"].includes(b.status),
    );
    expect(unfinishedAfter?.length).toBe(4);

    // Belt-and-suspenders: drive the actual BRINGUP exitGate function and
    // confirm the unfinished-count reason still shows up (we have 4 of them).
    const gateResult = await STAGES.BRINGUP.exitGate!(ctxAfter);
    expect(gateResult.ok).toBe(false);
    if (!gateResult.ok) {
      expect(gateResult.reasons).toContain(
        "4 board(s) not yet BROUGHT_UP or QUARANTINED.",
      );
    }
  });

  test("step 4: cleanup — delete the registered B06 via the action and restore B01-B05", async () => {
    // Use the deleteBoard action so we exercise the freeze-guarded path
    // instead of bypassing the action layer.
    const b06 = await db.board.findFirstOrThrow({
      where: {
        buildId: seededBuildId,
        serial: { equals: "B06", mode: "insensitive" },
      },
    });
    await deleteBoard({ id: b06.id });
    // Drop from the cleanup list so afterAll doesn't try again.
    const idx = createdBoardIds.indexOf(b06.id);
    if (idx >= 0) createdBoardIds.splice(idx, 1);

    const gone = await db.board.findUnique({ where: { id: b06.id } });
    expect(gone).toBeNull();

    // Restore seeded statuses in the action path (B01, B05 changed in
    // steps 2-3). afterAll re-runs the same restoration as a backstop.
    for (const s of originalStatuses) {
      await editBoard({ id: s.id, status: s.status });
    }
    const seedBoards = await db.board.findMany({
      where: { buildId: seededBuildId },
      orderBy: { serial: "asc" },
    });
    for (const b of seedBoards) {
      expect(b.status).toBe("ASSEMBLED");
    }
  });
});
