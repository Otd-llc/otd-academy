// Tests for Checklist + ChecklistItem server actions (Task 13.1).
//
// Exercises the real Neon DB; mocks `next/cache` and `@/auth` per the
// repository's vitest mocking pattern.
//
// createChecklist covers:
//   - Build-scoped EQUIPMENT_PREFLIGHT on the seeded BUILD-001 → success
//     (rev seeded at BRINGUP — gate-relevant subkind binds at create time).
//   - Board-scoped SCREENING_STEP_0 on a fresh Board → success.
//   - Frozen revision rejected (Build-scoped path).
//   - Frozen build rejected (Build-scoped path).
//   - Frozen build (resolved via board.buildId) rejected (Board-scoped path).
//
// addChecklistItem covers:
//   - First insert with no ordinal → ordinal = 0.
//   - Second insert with no ordinal → ordinal = 1.
//   - Explicit ordinal honored.
//
// editChecklistItem covers:
//   - checked = true stamps completedAt + completedById.
//   - checked = false clears the stamps.
//   - Stamping skipped when already populated (first-completion preserved).
//
// reorderChecklistItems covers:
//   - 3-item swap reverses the order atomically; @@unique not violated mid-tx.
//   - Reorder with mismatched id-set rejected.
//
// ASSEMBLY gate exercise (gate-relevant subkind matching):
//   - Fresh rev at ASSEMBLY with 1 ASSEMBLED board, no checklist → gate
//     blocked with "No POST_ASSEMBLY_CONTINUITY".
//   - Create checklist with unchecked items → "has unchecked items".
//   - Tick all → gate passes.
//
// Cleanup: all created revs/builds/boards/checklists/items are tracked and
// removed in afterAll. Deleting the revision cascades the build and its
// children (boards/checklists/items) per the schema's onDelete: Cascade.
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mockAuth = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({
  auth: () => mockAuth(),
}));

import type { Stage } from "@prisma/client";
import { db } from "@/lib/db";
import {
  addChecklistItem,
  createChecklist,
  deleteChecklist,
  deleteChecklistItem,
  editChecklist,
  editChecklistItem,
  reorderChecklistItems,
} from "@/lib/actions/checklists";
import { loadGateContext } from "@/lib/load-gate-context";
import { STAGES } from "@/lib/stages";

const SEED_EMAIL = "seed@example.com";
const SEED_PROJECT_SLUG = "esp32-sensor-breakout";

const createdRevisionIds: string[] = [];
const createdBuildIds: string[] = [];
const createdBoardIds: string[] = [];
const createdChecklistIds: string[] = [];

beforeAll(() => {
  mockAuth.mockImplementation(async () => ({
    user: { email: SEED_EMAIL },
  }));
});

afterAll(async () => {
  // Items + checklists are cascaded by revision/build deletion below, but
  // keep an explicit delete for any orphaned ids from rejection-path tests.
  if (createdChecklistIds.length > 0) {
    await db.checklist.deleteMany({
      where: { id: { in: createdChecklistIds } },
    });
  }
  if (createdBoardIds.length > 0) {
    await db.board.deleteMany({ where: { id: { in: createdBoardIds } } });
  }
  if (createdBuildIds.length > 0) {
    await db.build.deleteMany({ where: { id: { in: createdBuildIds } } });
  }
  if (createdRevisionIds.length > 0) {
    await db.revision.deleteMany({
      where: { id: { in: createdRevisionIds } },
    });
  }
});

async function seedUser() {
  return db.user.findUniqueOrThrow({ where: { email: SEED_EMAIL } });
}

async function makeRevAtStage(
  stage: Stage,
  label: string,
): Promise<{ id: string; projectId: string }> {
  const user = await seedUser();
  const project = await db.project.findUniqueOrThrow({
    where: { slug: SEED_PROJECT_SLUG },
  });
  const rev = await db.revision.create({
    data: {
      projectId: project.id,
      label,
      currentStage: stage,
    },
  });
  createdRevisionIds.push(rev.id);
  await db.stageTransition.create({
    data: {
      revisionId: rev.id,
      fromStage: null,
      toStage: "REQUIREMENTS",
      direction: "INIT",
      gateSnapshot: {
        v: 1,
        kind: "init",
        ts: new Date().toISOString(),
      },
      transitionedBy: user.id,
    },
  });
  return { id: rev.id, projectId: project.id };
}

async function makeBuild(revisionId: string, label: string) {
  const user = await seedUser();
  const build = await db.build.create({
    data: {
      revisionId,
      label,
      boardCount: 1,
      createdById: user.id,
    },
  });
  createdBuildIds.push(build.id);
  return build;
}

async function makeBoard(buildId: string, serial: string) {
  const board = await db.board.create({
    data: { buildId, serial, status: "ASSEMBLED" },
  });
  createdBoardIds.push(board.id);
  return board;
}

// ─── createChecklist ───────────────────────────────────

describe("createChecklist — happy paths", () => {
  test("Build-scoped EQUIPMENT_PREFLIGHT at ASSEMBLY: succeeds", async () => {
    const rev = await makeRevAtStage(
      "ASSEMBLY",
      `t13.1-ckbuild-${Date.now()}`,
    );
    const build = await makeBuild(rev.id, `BUILD-CKB-${Date.now()}`);
    const user = await seedUser();

    const checklist = await createChecklist({
      ownerKind: "build",
      buildId: build.id,
      subkind: "EQUIPMENT_PREFLIGHT",
      stage: "ASSEMBLY",
      title: "Equipment preflight",
    });
    createdChecklistIds.push(checklist.id);

    expect(checklist.buildId).toBe(build.id);
    expect(checklist.boardId).toBeNull();
    expect(checklist.subkind).toBe("EQUIPMENT_PREFLIGHT");
    expect(checklist.stage).toBe("ASSEMBLY");
    expect(checklist.title).toBe("Equipment preflight");
    expect(checklist.createdById).toBe(user.id);
  });

  test("Board-scoped SCREENING_STEP_0 at ASSEMBLY: succeeds", async () => {
    const rev = await makeRevAtStage(
      "ASSEMBLY",
      `t13.1-ckboard-${Date.now()}`,
    );
    const build = await makeBuild(rev.id, `BUILD-CKBR-${Date.now()}`);
    const board = await makeBoard(build.id, "B01");

    const checklist = await createChecklist({
      ownerKind: "board",
      boardId: board.id,
      subkind: "SCREENING_STEP_0",
      stage: "ASSEMBLY",
      title: "Screening step 0",
    });
    createdChecklistIds.push(checklist.id);

    expect(checklist.boardId).toBe(board.id);
    expect(checklist.buildId).toBeNull();
    expect(checklist.subkind).toBe("SCREENING_STEP_0");
  });
});

describe("createChecklist — rejection paths", () => {
  test("frozen revision (build-scoped): rejected", async () => {
    const user = await seedUser();
    const rev = await makeRevAtStage(
      "ASSEMBLY",
      `t13.1-frozen-rev-${Date.now()}`,
    );
    const build = await makeBuild(rev.id, `BUILD-FZ-${Date.now()}`);
    await db.revision.update({
      where: { id: rev.id },
      data: { frozenAt: new Date(), frozenById: user.id },
    });

    await expect(
      createChecklist({
        ownerKind: "build",
        buildId: build.id,
        subkind: "EQUIPMENT_PREFLIGHT",
        stage: "ASSEMBLY",
        title: "should fail",
      }),
    ).rejects.toThrow(/frozen/i);
  });

  test("frozen build (build-scoped): rejected", async () => {
    const rev = await makeRevAtStage(
      "ASSEMBLY",
      `t13.1-frozen-build-${Date.now()}`,
    );
    const build = await makeBuild(rev.id, `BUILD-FZB-${Date.now()}`);
    await db.build.update({
      where: { id: build.id },
      data: { frozenAt: new Date() },
    });

    await expect(
      createChecklist({
        ownerKind: "build",
        buildId: build.id,
        subkind: "EQUIPMENT_PREFLIGHT",
        stage: "ASSEMBLY",
        title: "should fail",
      }),
    ).rejects.toThrow(/build is frozen/i);
  });

  test("frozen build via board.buildId resolution (board-scoped): rejected", async () => {
    const rev = await makeRevAtStage(
      "ASSEMBLY",
      `t13.1-frozen-via-board-${Date.now()}`,
    );
    const build = await makeBuild(rev.id, `BUILD-FZVB-${Date.now()}`);
    const board = await makeBoard(build.id, "B01");
    await db.build.update({
      where: { id: build.id },
      data: { frozenAt: new Date() },
    });

    await expect(
      createChecklist({
        ownerKind: "board",
        boardId: board.id,
        subkind: "SCREENING_STEP_0",
        stage: "ASSEMBLY",
        title: "should fail",
      }),
    ).rejects.toThrow(/build is frozen/i);
  });
});

// ─── editChecklist ─────────────────────────────────────

describe("editChecklist", () => {
  test("edit title: succeeds; subkind unchanged", async () => {
    const rev = await makeRevAtStage(
      "ASSEMBLY",
      `t13.1-edit-${Date.now()}`,
    );
    const build = await makeBuild(rev.id, `BUILD-EDT-${Date.now()}`);
    const ck = await createChecklist({
      ownerKind: "build",
      buildId: build.id,
      subkind: "POST_ASSEMBLY_CONTINUITY",
      stage: "ASSEMBLY",
      title: "original",
    });
    createdChecklistIds.push(ck.id);

    const updated = await editChecklist({ id: ck.id, title: "renamed" });
    expect(updated.title).toBe("renamed");
    expect(updated.subkind).toBe("POST_ASSEMBLY_CONTINUITY");
  });

  test("edit on frozen revision: rejected", async () => {
    const user = await seedUser();
    const rev = await makeRevAtStage(
      "ASSEMBLY",
      `t13.1-editfrozen-${Date.now()}`,
    );
    const build = await makeBuild(rev.id, `BUILD-EDF-${Date.now()}`);
    const ck = await createChecklist({
      ownerKind: "build",
      buildId: build.id,
      subkind: "GENERIC",
      stage: "ASSEMBLY",
      title: "original",
    });
    createdChecklistIds.push(ck.id);

    await db.revision.update({
      where: { id: rev.id },
      data: { frozenAt: new Date(), frozenById: user.id },
    });

    await expect(
      editChecklist({ id: ck.id, title: "should fail" }),
    ).rejects.toThrow(/frozen/i);
  });
});

// ─── addChecklistItem ──────────────────────────────────

describe("addChecklistItem — ordinal defaulting", () => {
  test("inserts increment ordinal from 0", async () => {
    const rev = await makeRevAtStage(
      "ASSEMBLY",
      `t13.1-ord-${Date.now()}`,
    );
    const build = await makeBuild(rev.id, `BUILD-ORD-${Date.now()}`);
    const ck = await createChecklist({
      ownerKind: "build",
      buildId: build.id,
      subkind: "EQUIPMENT_PREFLIGHT",
      stage: "ASSEMBLY",
      title: "Equipment preflight",
    });
    createdChecklistIds.push(ck.id);

    const a = await addChecklistItem({
      checklistId: ck.id,
      label: "First",
    });
    expect(a.ordinal).toBe(0);

    const b = await addChecklistItem({
      checklistId: ck.id,
      label: "Second",
    });
    expect(b.ordinal).toBe(1);

    const c = await addChecklistItem({
      checklistId: ck.id,
      label: "Explicit",
      ordinal: 7,
    });
    expect(c.ordinal).toBe(7);
  });
});

// ─── editChecklistItem ─────────────────────────────────

describe("editChecklistItem — completion stamping", () => {
  test("checked=true stamps completedAt + completedById on first tick; preserved on subsequent edits", async () => {
    const rev = await makeRevAtStage(
      "ASSEMBLY",
      `t13.1-tick-${Date.now()}`,
    );
    const build = await makeBuild(rev.id, `BUILD-TK-${Date.now()}`);
    const user = await seedUser();
    const ck = await createChecklist({
      ownerKind: "build",
      buildId: build.id,
      subkind: "POST_ASSEMBLY_CONTINUITY",
      stage: "ASSEMBLY",
      title: "Continuity",
    });
    createdChecklistIds.push(ck.id);

    const item = await addChecklistItem({
      checklistId: ck.id,
      label: "Check 5V rail",
    });
    expect(item.checked).toBe(false);
    expect(item.completedAt).toBeNull();
    expect(item.completedById).toBeNull();

    const ticked = await editChecklistItem({
      id: item.id,
      checked: true,
    });
    expect(ticked.checked).toBe(true);
    expect(ticked.completedAt).not.toBeNull();
    expect(ticked.completedById).toBe(user.id);

    const firstStampAt = ticked.completedAt!;

    // Subsequent edit (label change with checked still true) preserves
    // the original first-completed audit.
    const relabeled = await editChecklistItem({
      id: item.id,
      label: "Check 5V rail (revised)",
      checked: true,
    });
    expect(relabeled.checked).toBe(true);
    expect(relabeled.completedAt!.getTime()).toBe(firstStampAt.getTime());
    expect(relabeled.completedById).toBe(user.id);
  });

  test("checked=false clears the stamps", async () => {
    const rev = await makeRevAtStage(
      "ASSEMBLY",
      `t13.1-untick-${Date.now()}`,
    );
    const build = await makeBuild(rev.id, `BUILD-UN-${Date.now()}`);
    const ck = await createChecklist({
      ownerKind: "build",
      buildId: build.id,
      subkind: "EQUIPMENT_PREFLIGHT",
      stage: "ASSEMBLY",
      title: "Preflight",
    });
    createdChecklistIds.push(ck.id);
    const item = await addChecklistItem({
      checklistId: ck.id,
      label: "Power on bench supply",
    });
    await editChecklistItem({ id: item.id, checked: true });
    const cleared = await editChecklistItem({ id: item.id, checked: false });
    expect(cleared.checked).toBe(false);
    expect(cleared.completedAt).toBeNull();
    expect(cleared.completedById).toBeNull();
  });
});

// ─── reorderChecklistItems ─────────────────────────────

describe("reorderChecklistItems", () => {
  test("3-item swap reverses the order atomically", async () => {
    const rev = await makeRevAtStage(
      "ASSEMBLY",
      `t13.1-reorder-${Date.now()}`,
    );
    const build = await makeBuild(rev.id, `BUILD-RE-${Date.now()}`);
    const ck = await createChecklist({
      ownerKind: "build",
      buildId: build.id,
      subkind: "EQUIPMENT_PREFLIGHT",
      stage: "ASSEMBLY",
      title: "Reorder me",
    });
    createdChecklistIds.push(ck.id);

    const a = await addChecklistItem({ checklistId: ck.id, label: "A" });
    const b = await addChecklistItem({ checklistId: ck.id, label: "B" });
    const c = await addChecklistItem({ checklistId: ck.id, label: "C" });
    expect([a.ordinal, b.ordinal, c.ordinal]).toEqual([0, 1, 2]);

    const reordered = await reorderChecklistItems({
      checklistId: ck.id,
      orderedIds: [c.id, b.id, a.id],
    });

    const byId = new Map(reordered.map((r) => [r.id, r.ordinal]));
    expect(byId.get(c.id)).toBe(0);
    expect(byId.get(b.id)).toBe(1);
    expect(byId.get(a.id)).toBe(2);
  });

  test("reorder with mismatched id-set rejected", async () => {
    const rev = await makeRevAtStage(
      "ASSEMBLY",
      `t13.1-reorder-bad-${Date.now()}`,
    );
    const build = await makeBuild(rev.id, `BUILD-RB-${Date.now()}`);
    const ck = await createChecklist({
      ownerKind: "build",
      buildId: build.id,
      subkind: "EQUIPMENT_PREFLIGHT",
      stage: "ASSEMBLY",
      title: "Mismatch",
    });
    createdChecklistIds.push(ck.id);

    const a = await addChecklistItem({ checklistId: ck.id, label: "A" });
    const b = await addChecklistItem({ checklistId: ck.id, label: "B" });

    await expect(
      reorderChecklistItems({
        checklistId: ck.id,
        orderedIds: [a.id], // missing b
      }),
    ).rejects.toThrow(/must include every item/i);

    // Right-length list but one id is foreign — should fail on the
    // contains-foreign-id check, not the length check.
    await expect(
      reorderChecklistItems({
        checklistId: ck.id,
        orderedIds: [a.id, "c123456789012345678901abcd"],
      }),
    ).rejects.toThrow(/not on the checklist/i);
  });
});

// ─── ASSEMBLY gate exercise ────────────────────────────

describe("ASSEMBLY gate — subkind-based checklist match", () => {
  test("blocks without POST_ASSEMBLY_CONTINUITY, then with unchecked items, then passes once all ticked", async () => {
    const rev = await makeRevAtStage(
      "ASSEMBLY",
      `t13.1-gate-${Date.now()}`,
    );
    const build = await makeBuild(rev.id, `BUILD-GT-${Date.now()}`);
    await makeBoard(build.id, "B01");

    // Step 1: no POST_ASSEMBLY_CONTINUITY checklist at all.
    let ctx = await loadGateContext(db, rev.id);
    let result = await STAGES.ASSEMBLY.exitGate!(ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons).toContain(
        "No POST_ASSEMBLY_CONTINUITY Checklist on the active Build.",
      );
    }

    // Step 2: create the checklist with 3 unchecked items. The subkind is
    // what the gate matches on — title is intentionally NOT "post assembly
    // continuity" to prove subkind-based lookup.
    const ck = await createChecklist({
      ownerKind: "build",
      buildId: build.id,
      subkind: "POST_ASSEMBLY_CONTINUITY",
      stage: "ASSEMBLY",
      title: "Final wraparound test",
    });
    createdChecklistIds.push(ck.id);
    const items = await Promise.all([
      addChecklistItem({ checklistId: ck.id, label: "5V rail check" }),
      addChecklistItem({ checklistId: ck.id, label: "3V3 rail check" }),
      addChecklistItem({ checklistId: ck.id, label: "GND continuity" }),
    ]);

    ctx = await loadGateContext(db, rev.id);
    result = await STAGES.ASSEMBLY.exitGate!(ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons).toContain(
        "POST_ASSEMBLY_CONTINUITY Checklist has unchecked items.",
      );
    }

    // Step 3: tick all items. Gate passes.
    for (const i of items) {
      await editChecklistItem({ id: i.id, checked: true });
    }
    ctx = await loadGateContext(db, rev.id);
    result = await STAGES.ASSEMBLY.exitGate!(ctx);
    expect(result.ok).toBe(true);
  });
});

// ─── deleteChecklistItem + deleteChecklist (cleanup paths) ──────────────

describe("delete paths", () => {
  test("delete item leaves the rest intact; delete checklist removes it", async () => {
    const rev = await makeRevAtStage(
      "ASSEMBLY",
      `t13.1-del-${Date.now()}`,
    );
    const build = await makeBuild(rev.id, `BUILD-DL-${Date.now()}`);
    const ck = await createChecklist({
      ownerKind: "build",
      buildId: build.id,
      subkind: "EQUIPMENT_PREFLIGHT",
      stage: "ASSEMBLY",
      title: "Deletable",
    });
    const a = await addChecklistItem({ checklistId: ck.id, label: "A" });
    await addChecklistItem({ checklistId: ck.id, label: "B" });

    await deleteChecklistItem({ id: a.id });
    const remaining = await db.checklistItem.findMany({
      where: { checklistId: ck.id },
    });
    expect(remaining.length).toBe(1);

    await deleteChecklist({ id: ck.id });
    const gone = await db.checklist.findUnique({ where: { id: ck.id } });
    expect(gone).toBeNull();
  });
});
