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
  materializeCanonicalChecklist,
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

// ─── m15: Revision-scoped Checklists ───────────────────

describe("createChecklist — revision ownerKind (m15)", () => {
  test("Revision-scoped GENERIC at REQUIREMENTS: succeeds", async () => {
    const rev = await makeRevAtStage(
      "REQUIREMENTS",
      `t15-rev-ck-${Date.now()}`,
    );
    const user = await seedUser();

    const checklist = await createChecklist({
      ownerKind: "revision",
      revisionId: rev.id,
      subkind: "GENERIC",
      stage: "REQUIREMENTS",
      title: "Revision-scoped review checklist",
    });
    createdChecklistIds.push(checklist.id);

    expect(checklist.revisionId).toBe(rev.id);
    expect(checklist.buildId).toBeNull();
    expect(checklist.boardId).toBeNull();
    expect(checklist.subkind).toBe("GENERIC");
    expect(checklist.stage).toBe("REQUIREMENTS");
    expect(checklist.createdById).toBe(user.id);
  });

  test("Revision-scoped on frozen revision: rejected", async () => {
    const user = await seedUser();
    const rev = await makeRevAtStage(
      "REQUIREMENTS",
      `t15-rev-ck-fz-${Date.now()}`,
    );
    await db.revision.update({
      where: { id: rev.id },
      data: { frozenAt: new Date(), frozenById: user.id },
    });

    await expect(
      createChecklist({
        ownerKind: "revision",
        revisionId: rev.id,
        subkind: "GENERIC",
        stage: "REQUIREMENTS",
        title: "should fail",
      }),
    ).rejects.toThrow(/frozen/i);
  });

  test("Revision-scoped: edit + add-item + tick + delete flow", async () => {
    const rev = await makeRevAtStage(
      "REQUIREMENTS",
      `t15-rev-flow-${Date.now()}`,
    );
    const ck = await createChecklist({
      ownerKind: "revision",
      revisionId: rev.id,
      subkind: "GENERIC",
      stage: "REQUIREMENTS",
      title: "original",
    });

    // edit title (freeze-guard via resolveChecklistFreezeRefs revision arm)
    const renamed = await editChecklist({ id: ck.id, title: "renamed" });
    expect(renamed.title).toBe("renamed");

    // add an item — exercises the addChecklistItem freeze dispatch for the
    // revision-scoped path (buildId null, no assertBuildNotFrozen call).
    const item = await addChecklistItem({
      checklistId: ck.id,
      label: "Capture interfaces",
    });
    expect(item.ordinal).toBe(0);

    // tick — exercises editChecklistItem freeze dispatch
    const ticked = await editChecklistItem({ id: item.id, checked: true });
    expect(ticked.checked).toBe(true);
    expect(ticked.completedAt).not.toBeNull();

    // reorder (single-item, trivially)
    const reordered = await reorderChecklistItems({
      checklistId: ck.id,
      orderedIds: [item.id],
    });
    expect(reordered[0]!.id).toBe(item.id);

    // delete the item then the checklist — exercises both delete paths
    await deleteChecklistItem({ id: item.id });
    await deleteChecklist({ id: ck.id });
    const gone = await db.checklist.findUnique({ where: { id: ck.id } });
    expect(gone).toBeNull();
  });
});

// ─── m16: editChecklistItemSchema refinement ─────────────────────────────
//
// Mirrors the raw CHECK `checklist_item_checked_xor_napplicable`. The schema
// must reject a payload that sets both `checked: true` and `notApplicable:
// true`, while accepting either alone.
//
// Uses a hardcoded cuid v1 fixture because `z.cuid()` validates the v1
// regex `^[cC][0-9a-z]{6,}$`. `createId()` from `@paralleldrive/cuid2`
// produces v2-shaped strings without the leading `c`, which fail
// validation — flagged in the plan §16.4 gotcha.
describe("editChecklistItemSchema (m16 refinement)", () => {
  test("rejects checked=true AND notApplicable=true with canonical message", async () => {
    const { editChecklistItemSchema } = await import(
      "@/lib/schemas/checklist"
    );
    // Hardcoded cuid v1 fixture: `z.cuid()` regex is `^[cC][0-9a-z]{6,}$`
    // (cuid v1). `createId()` from `@paralleldrive/cuid2` produces v2-shaped
    // strings (no leading 'c'), which fail validation; the plan flags this
    // explicitly in §16.4's gotcha.
    const VALID_CUID = "cl9z0jjg100007bsh4d9c4n3h";
    expect(() =>
      editChecklistItemSchema.parse({
        id: VALID_CUID,
        checked: true,
        notApplicable: true,
      }),
    ).toThrow(/cannot be both checked and N\/A/i);
  });

  test("accepts checked=true alone", async () => {
    const { editChecklistItemSchema } = await import(
      "@/lib/schemas/checklist"
    );
    // Hardcoded cuid v1 fixture: `z.cuid()` regex is `^[cC][0-9a-z]{6,}$`
    // (cuid v1). `createId()` from `@paralleldrive/cuid2` produces v2-shaped
    // strings (no leading 'c'), which fail validation; the plan flags this
    // explicitly in §16.4's gotcha.
    const VALID_CUID = "cl9z0jjg100007bsh4d9c4n3h";
    expect(() =>
      editChecklistItemSchema.parse({
        id: VALID_CUID,
        checked: true,
      }),
    ).not.toThrow();
  });

  test("accepts notApplicable=true alone", async () => {
    const { editChecklistItemSchema } = await import(
      "@/lib/schemas/checklist"
    );
    // Hardcoded cuid v1 fixture: `z.cuid()` regex is `^[cC][0-9a-z]{6,}$`
    // (cuid v1). `createId()` from `@paralleldrive/cuid2` produces v2-shaped
    // strings (no leading 'c'), which fail validation; the plan flags this
    // explicitly in §16.4's gotcha.
    const VALID_CUID = "cl9z0jjg100007bsh4d9c4n3h";
    expect(() =>
      editChecklistItemSchema.parse({
        id: VALID_CUID,
        notApplicable: true,
      }),
    ).not.toThrow();
  });
});

// ─── m16: materializeCanonicalChecklist ────────────────────────────────────
//
// Materializes a canonical TypeScript-literal template
// (`CANONICAL_TEMPLATES[templateKey]`) into a real Revision-scoped Checklist
// + ChecklistItem row-set. Refuses to materialize twice for the same
// `(revisionId, subkind)` pair — the existing row should be edited instead.

describe("materializeCanonicalChecklist", () => {
  test("REQUIREMENTS_REVIEW creates a revision-scoped checklist + 4 items", async () => {
    const rev = await makeRevAtStage(
      "REQUIREMENTS",
      `t16.7-mat-rr-${Date.now()}`,
    );

    const checklist = await materializeCanonicalChecklist({
      revisionId: rev.id,
      templateKey: "REQUIREMENTS_REVIEW",
    });
    createdChecklistIds.push(checklist.id);

    expect(checklist.revisionId).toBe(rev.id);
    expect(checklist.buildId).toBeNull();
    expect(checklist.boardId).toBeNull();
    expect(checklist.subkind).toBe("REQUIREMENTS_REVIEW");
    expect(checklist.stage).toBe("REQUIREMENTS");
    expect(checklist.title).toBe("REQUIREMENTS review checklist");

    const items = await db.checklistItem.findMany({
      where: { checklistId: checklist.id },
      orderBy: { ordinal: "asc" },
    });
    expect(items.length).toBe(4);
    expect(items[0]!.label).toMatch(/WS2812 level-shift/i);
    expect(items[1]!.label).toMatch(/Servo brownout/i);
    expect(items[2]!.label).toMatch(/ADC1-only/i);
    expect(items[3]!.label).toMatch(/Auto-shutoff/i);
    // Items default to unchecked / not-applicable=false.
    for (const it of items) {
      expect(it.checked).toBe(false);
      expect(it.notApplicable).toBe(false);
    }
  });

  test("refuses to materialize twice for the same (revisionId, subkind)", async () => {
    const rev = await makeRevAtStage(
      "LAYOUT",
      `t16.7-mat-twice-${Date.now()}`,
    );

    const first = await materializeCanonicalChecklist({
      revisionId: rev.id,
      templateKey: "LAYOUT_REVIEW",
    });
    createdChecklistIds.push(first.id);
    expect(first.subkind).toBe("LAYOUT_REVIEW");

    await expect(
      materializeCanonicalChecklist({
        revisionId: rev.id,
        templateKey: "LAYOUT_REVIEW",
      }),
    ).rejects.toThrow(/LAYOUT_REVIEW checklist already exists/);
  });
});

// ─── m5: build-scoped materializeCanonicalChecklist ─────────────────────────
//
// The ASSEMBLY guide card's buildChecklist completionRef materializes the
// POST_ASSEMBLY_CONTINUITY template onto the active Build (not the Revision).
// The generalized action accepts an optional `buildId` owner; dedupe is by
// `(buildId, subkind)`; both the Revision AND the Build freeze guards apply.

describe("materializeCanonicalChecklist — build-scoped (m5)", () => {
  test("POST_ASSEMBLY_CONTINUITY on a build creates a build-scoped checklist + items; second call dedupes", async () => {
    const rev = await makeRevAtStage(
      "ASSEMBLY",
      `t5.2-mat-build-${Date.now()}`,
    );
    const build = await makeBuild(rev.id, `BUILD-PAC-${Date.now()}`);

    const checklist = await materializeCanonicalChecklist({
      buildId: build.id,
      templateKey: "POST_ASSEMBLY_CONTINUITY",
    });
    createdChecklistIds.push(checklist.id);

    expect(checklist.buildId).toBe(build.id);
    expect(checklist.revisionId).toBeNull();
    expect(checklist.boardId).toBeNull();
    expect(checklist.subkind).toBe("POST_ASSEMBLY_CONTINUITY");
    expect(checklist.stage).toBe("ASSEMBLY");

    const items = await db.checklistItem.findMany({
      where: { checklistId: checklist.id },
      orderBy: { ordinal: "asc" },
    });
    expect(items.length).toBeGreaterThan(0);
    for (const it of items) {
      expect(it.checked).toBe(false);
      expect(it.notApplicable).toBe(false);
    }

    // Second call on the same build → dedupe by (buildId, subkind).
    await expect(
      materializeCanonicalChecklist({
        buildId: build.id,
        templateKey: "POST_ASSEMBLY_CONTINUITY",
      }),
    ).rejects.toThrow(/already exists/i);
  });

  test("frozen build: rejected", async () => {
    const rev = await makeRevAtStage(
      "ASSEMBLY",
      `t5.2-mat-build-fzb-${Date.now()}`,
    );
    const build = await makeBuild(rev.id, `BUILD-PACFZB-${Date.now()}`);
    await db.build.update({
      where: { id: build.id },
      data: { frozenAt: new Date() },
    });

    await expect(
      materializeCanonicalChecklist({
        buildId: build.id,
        templateKey: "POST_ASSEMBLY_CONTINUITY",
      }),
    ).rejects.toThrow(/build is frozen/i);
  });

  test("frozen revision (build-scoped): rejected", async () => {
    const user = await seedUser();
    const rev = await makeRevAtStage(
      "ASSEMBLY",
      `t5.2-mat-build-fzr-${Date.now()}`,
    );
    const build = await makeBuild(rev.id, `BUILD-PACFZR-${Date.now()}`);
    await db.revision.update({
      where: { id: rev.id },
      data: { frozenAt: new Date(), frozenById: user.id },
    });

    await expect(
      materializeCanonicalChecklist({
        buildId: build.id,
        templateKey: "POST_ASSEMBLY_CONTINUITY",
      }),
    ).rejects.toThrow(/frozen/i);
  });
});
