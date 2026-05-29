// Stage exit-gate tests (Task 7.1).
//
// Each stage's exit gate is a pure function over `GateContext` — these tests
// pass canned contexts in (no DB) for the per-stage failure-mode + happy-path
// cases. The seeded BRINGUP rev gets its own test against the live DB to
// verify that `loadGateContext()` + the BRINGUP gate together reach the
// expected result on the demoable seed.
//
// Per the seed:
//   - All 5 boards are status ASSEMBLED (NOT BROUGHT_UP / QUARANTINED).
//   - Both BRINGUP_LOG and BRINGUP_COMPLETE artifacts are present.
// So the seeded BRINGUP gate is expected to FAIL with one reason:
// "5 board(s) not yet BROUGHT_UP or QUARANTINED."
// That's the intended demo state — Phase 8 lets the user transition boards.

import { describe, expect, test } from "vitest";
import type {
  Artifact,
  ArtifactSubkind,
  BomLine,
  Board,
  BoardStatus,
  Build,
  Checklist,
  ChecklistItem,
  ChecklistSubkind,
  Part,
  PartLifecycle,
  Stage,
} from "@prisma/client";
import {
  FAILED_BOARD_MSG,
  GATE_SNAPSHOT_VERSION,
  STAGES,
  STAGE_ORDER,
  type GateContext,
} from "@/lib/stages";

// ─── Canned-context helpers ────────────────────────────

function makeRevision(
  stage: Stage,
  overrides: Partial<GateContext["revision"]> = {},
): GateContext["revision"] {
  return {
    id: "rev-test",
    currentStage: stage,
    schematicCommit: null,
    layoutCommit: null,
    ...overrides,
  };
}

function makePart(overrides: Partial<Part> = {}): Part {
  return {
    id: "part-test",
    mpn: "TEST-MPN",
    manufacturer: "TEST-MFR",
    description: "Test part",
    category: null,
    footprint: null,
    datasheetUrl: "https://example.com/datasheet.pdf",
    lifecycle: "ACTIVE" satisfies PartLifecycle,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: "user-test",
    ...overrides,
  };
}

function makeBomLine(part: Part, overrides: Partial<BomLine> = {}): BomLine & {
  part: Part;
} {
  return {
    id: `bom-${part.id}`,
    revisionId: "rev-test",
    partId: part.id,
    refDes: "U1",
    quantity: 1,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: "user-test",
    ...overrides,
    part,
  };
}

function makeArtifact(
  stage: Stage,
  subkind: ArtifactSubkind,
  overrides: Partial<Artifact> = {},
): Artifact {
  return {
    id: `art-${stage}-${subkind}`,
    revisionId: "rev-test",
    buildId: null,
    stage,
    kind: "NOTE",
    subkind,
    title: `${stage} ${subkind}`,
    fileKey: null,
    fileMime: null,
    fileBytes: null,
    noteBody: "body",
    linkUrl: null,
    createdBy: "user-test",
    createdAt: new Date(),
    ...overrides,
  };
}

function makeBuildArtifact(
  stage: Stage,
  subkind: ArtifactSubkind,
  overrides: Partial<Artifact> = {},
): Artifact {
  return makeArtifact(stage, subkind, {
    revisionId: null,
    buildId: "build-test",
    ...overrides,
  });
}

function makeBoard(
  serial: string,
  status: BoardStatus = "BARE",
  overrides: Partial<Board> = {},
): Board {
  return {
    id: `board-${serial}`,
    buildId: "build-test",
    serial,
    silkscreenHash: null,
    status,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeChecklist(
  subkind: ChecklistSubkind,
  items: { checked: boolean }[],
  overrides: Partial<Checklist> = {},
): Checklist & { items: ChecklistItem[] } {
  return {
    id: `cl-${subkind}`,
    buildId: "build-test",
    boardId: null,
    stage: "ASSEMBLY",
    subkind,
    title: `${subkind} checklist`,
    createdAt: new Date(),
    createdById: "user-test",
    ...overrides,
    items: items.map((i, idx) => ({
      id: `cli-${subkind}-${idx}`,
      checklistId: `cl-${subkind}`,
      ordinal: idx,
      label: `item ${idx}`,
      expectedValue: null,
      actualValue: null,
      checked: i.checked,
      completedAt: i.checked ? new Date() : null,
      completedById: i.checked ? "user-test" : null,
    })),
  };
}

function makeBuild(
  overrides: Partial<
    Build & {
      boards: Board[];
      artifacts: Artifact[];
      checklists: (Checklist & { items: ChecklistItem[] })[];
    }
  > = {},
): NonNullable<GateContext["activeBuild"]> {
  return {
    id: "build-test",
    revisionId: "rev-test",
    label: "BUILD-001",
    boardCount: 5,
    pcbOrderRef: null,
    partsOrderRef: null,
    orderedAt: null,
    receivedAt: null,
    assemblyStartedAt: null,
    frozenAt: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: "user-test",
    boards: [],
    artifacts: [],
    checklists: [],
    ...overrides,
  };
}

function ctx(
  stage: Stage,
  overrides: Partial<GateContext> = {},
): GateContext {
  return {
    revision: makeRevision(stage),
    bomLines: [],
    artifacts: [],
    activeBuild: null,
    ...overrides,
  };
}

// ─── Sanity ────────────────────────────────────────────

describe("STAGES config sanity", () => {
  test("GATE_SNAPSHOT_VERSION is 1", () => {
    expect(GATE_SNAPSHOT_VERSION).toBe(1);
  });

  test("STAGE_ORDER has all 9 stages in canonical order", () => {
    expect(STAGE_ORDER).toEqual([
      "REQUIREMENTS",
      "SCHEMATIC",
      "BOM_SOURCING",
      "LAYOUT",
      "DRC_GERBER",
      "ORDERING",
      "ASSEMBLY",
      "BRINGUP",
      "REVISION",
    ]);
  });

  test("every stage has a STAGES entry; only REVISION omits exitGate", () => {
    for (const stage of STAGE_ORDER) {
      const def = STAGES[stage];
      expect(def).toBeDefined();
      expect(def.stage).toBe(stage);
      if (stage === "REVISION") {
        expect(def.exitGate).toBeUndefined();
      } else {
        expect(def.exitGate).toBeTypeOf("function");
      }
    }
  });
});

// ─── REQUIREMENTS ──────────────────────────────────────

describe("REQUIREMENTS exit gate", () => {
  test("fails when no requirements artifact present", async () => {
    const r = await STAGES.REQUIREMENTS.exitGate!(ctx("REQUIREMENTS"));
    expect(r).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining([
        expect.stringMatching(/no requirements artifact/i),
      ]),
    });
  });

  test("passes when at least one requirements-stage artifact exists", async () => {
    const r = await STAGES.REQUIREMENTS.exitGate!(
      ctx("REQUIREMENTS", {
        artifacts: [makeArtifact("REQUIREMENTS", "REQUIREMENTS_DOC")],
      }),
    );
    expect(r).toEqual({ ok: true });
  });
});

// ─── SCHEMATIC ─────────────────────────────────────────

describe("SCHEMATIC exit gate", () => {
  test("fails when artifact missing and commit not pinned", async () => {
    const r = await STAGES.SCHEMATIC.exitGate!(ctx("SCHEMATIC"));
    expect(r).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining([
        expect.stringMatching(/no schematic artifact/i),
        expect.stringMatching(/schematicCommit not pinned/i),
      ]),
    });
  });

  test("fails when only commit is missing", async () => {
    const r = await STAGES.SCHEMATIC.exitGate!(
      ctx("SCHEMATIC", {
        artifacts: [makeArtifact("SCHEMATIC", "SCHEMATIC_FILE")],
      }),
    );
    expect(r).toMatchObject({
      ok: false,
      reasons: [expect.stringMatching(/schematicCommit not pinned/i)],
    });
  });

  test("passes when artifact + commit present", async () => {
    const r = await STAGES.SCHEMATIC.exitGate!(
      ctx("SCHEMATIC", {
        revision: makeRevision("SCHEMATIC", { schematicCommit: "abc1234" }),
        artifacts: [makeArtifact("SCHEMATIC", "SCHEMATIC_FILE")],
      }),
    );
    expect(r).toEqual({ ok: true });
  });
});

// ─── BOM_SOURCING ──────────────────────────────────────

describe("BOM_SOURCING exit gate", () => {
  test("fails when BOM is empty", async () => {
    const r = await STAGES.BOM_SOURCING.exitGate!(ctx("BOM_SOURCING"));
    expect(r).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining([
        expect.stringMatching(/BOM is empty/i),
      ]),
    });
  });

  test("fails when a part is missing a datasheet URL", async () => {
    const r = await STAGES.BOM_SOURCING.exitGate!(
      ctx("BOM_SOURCING", {
        bomLines: [
          makeBomLine(makePart({ id: "p1", datasheetUrl: null })),
        ],
      }),
    );
    expect(r).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining([
        expect.stringMatching(/1 part\(s\) missing datasheet URL/),
      ]),
    });
  });

  test("fails when a part is EOL or OBSOLETE", async () => {
    const r = await STAGES.BOM_SOURCING.exitGate!(
      ctx("BOM_SOURCING", {
        bomLines: [
          makeBomLine(makePart({ id: "p1", lifecycle: "EOL" })),
          makeBomLine(makePart({ id: "p2", lifecycle: "OBSOLETE" })),
        ],
      }),
    );
    expect(r).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining([
        expect.stringMatching(/2 part\(s\) are EOL or OBSOLETE/),
      ]),
    });
  });

  test("passes when all parts ACTIVE with datasheet URLs", async () => {
    const r = await STAGES.BOM_SOURCING.exitGate!(
      ctx("BOM_SOURCING", {
        bomLines: [
          makeBomLine(makePart({ id: "p1" })),
          makeBomLine(makePart({ id: "p2" })),
        ],
      }),
    );
    expect(r).toEqual({ ok: true });
  });
});

// ─── LAYOUT ────────────────────────────────────────────

describe("LAYOUT exit gate", () => {
  test("fails when artifact missing and layoutCommit not pinned", async () => {
    const r = await STAGES.LAYOUT.exitGate!(ctx("LAYOUT"));
    expect(r).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining([
        expect.stringMatching(/no layout artifact/i),
        expect.stringMatching(/layoutCommit not pinned/i),
      ]),
    });
  });

  test("passes when artifact + layoutCommit present", async () => {
    const r = await STAGES.LAYOUT.exitGate!(
      ctx("LAYOUT", {
        revision: makeRevision("LAYOUT", { layoutCommit: "def5678" }),
        artifacts: [makeArtifact("LAYOUT", "LAYOUT_FILE")],
      }),
    );
    expect(r).toEqual({ ok: true });
  });
});

// ─── DRC_GERBER ────────────────────────────────────────

describe("DRC_GERBER exit gate", () => {
  test("fails when DRC_REPORT missing", async () => {
    const r = await STAGES.DRC_GERBER.exitGate!(
      ctx("DRC_GERBER", {
        artifacts: [makeArtifact("DRC_GERBER", "GERBER_ZIP")],
      }),
    );
    expect(r).toMatchObject({
      ok: false,
      reasons: [expect.stringMatching(/No DRC_REPORT artifact/)],
    });
  });

  test("fails when GERBER_ZIP missing", async () => {
    const r = await STAGES.DRC_GERBER.exitGate!(
      ctx("DRC_GERBER", {
        artifacts: [makeArtifact("DRC_GERBER", "DRC_REPORT")],
      }),
    );
    expect(r).toMatchObject({
      ok: false,
      reasons: [expect.stringMatching(/No GERBER_ZIP artifact/)],
    });
  });

  test("passes when both DRC_REPORT + GERBER_ZIP present", async () => {
    const r = await STAGES.DRC_GERBER.exitGate!(
      ctx("DRC_GERBER", {
        artifacts: [
          makeArtifact("DRC_GERBER", "DRC_REPORT"),
          makeArtifact("DRC_GERBER", "GERBER_ZIP"),
        ],
      }),
    );
    expect(r).toEqual({ ok: true });
  });
});

// ─── ORDERING ──────────────────────────────────────────

describe("ORDERING exit gate", () => {
  test("fails when no active Build", async () => {
    const r = await STAGES.ORDERING.exitGate!(ctx("ORDERING"));
    expect(r).toMatchObject({
      ok: false,
      reasons: [expect.stringMatching(/No active Build/)],
    });
  });

  test("fails when PCB_ORDER missing", async () => {
    const r = await STAGES.ORDERING.exitGate!(
      ctx("ORDERING", {
        activeBuild: makeBuild({
          artifacts: [makeBuildArtifact("ORDERING", "PARTS_ORDER")],
        }),
      }),
    );
    expect(r).toMatchObject({
      ok: false,
      reasons: [expect.stringMatching(/no PCB_ORDER artifact/i)],
    });
  });

  test("fails when PARTS_ORDER missing", async () => {
    const r = await STAGES.ORDERING.exitGate!(
      ctx("ORDERING", {
        activeBuild: makeBuild({
          artifacts: [makeBuildArtifact("ORDERING", "PCB_ORDER")],
        }),
      }),
    );
    expect(r).toMatchObject({
      ok: false,
      reasons: [expect.stringMatching(/no PARTS_ORDER artifact/i)],
    });
  });

  test("passes when both order artifacts on the build", async () => {
    const r = await STAGES.ORDERING.exitGate!(
      ctx("ORDERING", {
        activeBuild: makeBuild({
          artifacts: [
            makeBuildArtifact("ORDERING", "PCB_ORDER"),
            makeBuildArtifact("ORDERING", "PARTS_ORDER"),
          ],
        }),
      }),
    );
    expect(r).toEqual({ ok: true });
  });
});

// ─── ASSEMBLY ──────────────────────────────────────────

describe("ASSEMBLY exit gate", () => {
  test("fails when no active Build", async () => {
    const r = await STAGES.ASSEMBLY.exitGate!(ctx("ASSEMBLY"));
    expect(r).toMatchObject({
      ok: false,
      reasons: [expect.stringMatching(/No active Build/)],
    });
  });

  test("fails when active Build has no boards", async () => {
    const r = await STAGES.ASSEMBLY.exitGate!(
      ctx("ASSEMBLY", { activeBuild: makeBuild() }),
    );
    expect(r).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining([
        expect.stringMatching(/no Board rows/i),
      ]),
    });
  });

  test("FAILED-board case uses canonical FAILED_BOARD_MSG verbatim", async () => {
    const r = await STAGES.ASSEMBLY.exitGate!(
      ctx("ASSEMBLY", {
        activeBuild: makeBuild({
          boards: [
            makeBoard("B01", "FAILED"),
            makeBoard("B02", "FAILED"),
            makeBoard("B03", "ASSEMBLED"),
          ],
          checklists: [
            makeChecklist("POST_ASSEMBLY_CONTINUITY", [{ checked: true }]),
          ],
        }),
      }),
    );
    expect(r).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining([FAILED_BOARD_MSG(2)]),
    });
  });

  test("fails when no POST_ASSEMBLY_CONTINUITY checklist", async () => {
    const r = await STAGES.ASSEMBLY.exitGate!(
      ctx("ASSEMBLY", {
        activeBuild: makeBuild({
          boards: [makeBoard("B01", "ASSEMBLED")],
        }),
      }),
    );
    expect(r).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining([
        expect.stringMatching(/POST_ASSEMBLY_CONTINUITY Checklist/),
      ]),
    });
  });

  test("fails when POST_ASSEMBLY_CONTINUITY checklist has unchecked items", async () => {
    const r = await STAGES.ASSEMBLY.exitGate!(
      ctx("ASSEMBLY", {
        activeBuild: makeBuild({
          boards: [makeBoard("B01", "ASSEMBLED")],
          checklists: [
            makeChecklist("POST_ASSEMBLY_CONTINUITY", [
              { checked: true },
              { checked: false },
            ]),
          ],
        }),
      }),
    );
    expect(r).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining([
        expect.stringMatching(/unchecked items/),
      ]),
    });
  });

  test("passes when all conditions met", async () => {
    const r = await STAGES.ASSEMBLY.exitGate!(
      ctx("ASSEMBLY", {
        activeBuild: makeBuild({
          boards: [
            makeBoard("B01", "ASSEMBLED"),
            makeBoard("B02", "POWERED"),
            makeBoard("B03", "BROUGHT_UP"),
            makeBoard("B04", "QUARANTINED"),
          ],
          checklists: [
            makeChecklist("POST_ASSEMBLY_CONTINUITY", [
              { checked: true },
              { checked: true },
            ]),
          ],
        }),
      }),
    );
    expect(r).toEqual({ ok: true });
  });
});

// ─── BRINGUP ───────────────────────────────────────────

describe("BRINGUP exit gate", () => {
  test("fails when no active Build", async () => {
    const r = await STAGES.BRINGUP.exitGate!(ctx("BRINGUP"));
    expect(r).toMatchObject({
      ok: false,
      reasons: [expect.stringMatching(/No active Build/)],
    });
  });

  test("fails when BRINGUP_LOG missing", async () => {
    const r = await STAGES.BRINGUP.exitGate!(
      ctx("BRINGUP", {
        activeBuild: makeBuild({
          boards: [makeBoard("B01", "BROUGHT_UP")],
          artifacts: [makeBuildArtifact("BRINGUP", "BRINGUP_COMPLETE")],
        }),
      }),
    );
    expect(r).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining([
        expect.stringMatching(/no BRINGUP_LOG artifact/i),
      ]),
    });
  });

  test("fails when BRINGUP_COMPLETE missing", async () => {
    const r = await STAGES.BRINGUP.exitGate!(
      ctx("BRINGUP", {
        activeBuild: makeBuild({
          boards: [makeBoard("B01", "BROUGHT_UP")],
          artifacts: [makeBuildArtifact("BRINGUP", "BRINGUP_LOG")],
        }),
      }),
    );
    expect(r).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining([
        expect.stringMatching(/Bring-up not marked complete/i),
      ]),
    });
  });

  test("FAILED-board case uses canonical FAILED_BOARD_MSG verbatim", async () => {
    const r = await STAGES.BRINGUP.exitGate!(
      ctx("BRINGUP", {
        activeBuild: makeBuild({
          boards: [
            makeBoard("B01", "FAILED"),
            makeBoard("B02", "BROUGHT_UP"),
          ],
          artifacts: [
            makeBuildArtifact("BRINGUP", "BRINGUP_LOG"),
            makeBuildArtifact("BRINGUP", "BRINGUP_COMPLETE"),
          ],
        }),
      }),
    );
    expect(r).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining([FAILED_BOARD_MSG(1)]),
    });
  });

  test("fails when boards not yet BROUGHT_UP or QUARANTINED", async () => {
    const r = await STAGES.BRINGUP.exitGate!(
      ctx("BRINGUP", {
        activeBuild: makeBuild({
          boards: [
            makeBoard("B01", "ASSEMBLED"),
            makeBoard("B02", "POWERED"),
            makeBoard("B03", "BROUGHT_UP"),
          ],
          artifacts: [
            makeBuildArtifact("BRINGUP", "BRINGUP_LOG"),
            makeBuildArtifact("BRINGUP", "BRINGUP_COMPLETE"),
          ],
        }),
      }),
    );
    expect(r).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining([
        "2 board(s) not yet BROUGHT_UP or QUARANTINED.",
      ]),
    });
  });

  test("passes when all conditions met", async () => {
    const r = await STAGES.BRINGUP.exitGate!(
      ctx("BRINGUP", {
        activeBuild: makeBuild({
          boards: [
            makeBoard("B01", "BROUGHT_UP"),
            makeBoard("B02", "BROUGHT_UP"),
            makeBoard("B03", "QUARANTINED"),
          ],
          artifacts: [
            makeBuildArtifact("BRINGUP", "BRINGUP_LOG"),
            makeBuildArtifact("BRINGUP", "BRINGUP_COMPLETE"),
          ],
        }),
      }),
    );
    expect(r).toEqual({ ok: true });
  });
});

// ─── REVISION (terminal) ───────────────────────────────

describe("REVISION exit gate", () => {
  test("has no exitGate (terminal stage)", () => {
    expect(STAGES.REVISION.exitGate).toBeUndefined();
  });
});

// ─── FAILED_BOARD_MSG canonical wording ────────────────

describe("FAILED_BOARD_MSG", () => {
  test("matches canonical action-oriented wording from design §2", () => {
    expect(FAILED_BOARD_MSG(3)).toBe(
      "3 board(s) FAILED — investigate and either return to ASSEMBLED (repaired) or set QUARANTINED (removed from build).",
    );
  });
});

// Seeded BRINGUP rev → loadGateContext + BRINGUP gate integration test
// lives in load-gate-context.test.ts (Task 7.3) — keeping this file purely
// gate-function unit tests means it stays runnable without the DB-touching
// loader.
