// M8a checkpoint (Task 9.5).
//
// End-to-end demoable flow against the seeded "esp32-sensor-breakout" v1
// BRINGUP revision + BUILD-001 + 5 boards. Exercises the design §9.2
// Mark-bring-up-complete state machine in three observable states:
//
//   1. Seed-injected BRINGUP_COMPLETE present  → button hidden.
//   2. BRINGUP_COMPLETE deleted, boards ASSEMBLED → button shown, DISABLED
//      (boards not BROUGHT_UP).
//   3. Boards BROUGHT_UP → button shown, ENABLED; calling markBringupComplete
//      succeeds and inserts a new BRINGUP_COMPLETE.
//
// The "button hidden / disabled / enabled" decision lives in the Build
// detail server component; here we re-evaluate the same predicate purely
// from DB state so a future refactor of the page doesn't break the
// behavioral guarantee.
//
// All mutations happen inside this test then get rolled back at the end so
// the seed is left in a state where M7's BRINGUP → REVISION demo still
// works (BRINGUP_COMPLETE artifact present + boards reset to ASSEMBLED).
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
import { markBringupComplete } from "@/lib/actions/bringup";

const SEED_EMAIL = "seed@example.com";
const SEED_PROJECT_SLUG = "esp32-sensor-breakout";

// Predicate equivalent to the Build-detail page server-component computation
// (design §9.2 / Task 9.4 mount). Reproducing it here lets us assert the
// state machine without rendering.
type ButtonState = "hidden" | "disabled" | "enabled";

function buttonStateFromBuildSnapshot(snapshot: {
  revCurrentStage: string;
  revFrozenAt: Date | null;
  buildFrozenAt: Date | null;
  hasBringupComplete: boolean;
  boardStatuses: BoardStatus[];
}): { state: ButtonState; blockingSerials?: string[] } {
  const showMarkComplete =
    snapshot.revCurrentStage === "BRINGUP" &&
    snapshot.buildFrozenAt === null &&
    snapshot.revFrozenAt === null &&
    !snapshot.hasBringupComplete;
  if (!showMarkComplete) return { state: "hidden" };
  const blocking = snapshot.boardStatuses.filter(
    (s) => !["BROUGHT_UP", "QUARANTINED"].includes(s),
  );
  return blocking.length > 0
    ? { state: "disabled", blockingSerials: [] /* serials computed separately */ }
    : { state: "enabled" };
}

async function loadSeed() {
  const project = await db.project.findUniqueOrThrow({
    where: { slug: SEED_PROJECT_SLUG },
  });
  const revision = await db.revision.findFirstOrThrow({
    where: {
      projectId: project.id,
      label: { equals: "v1", mode: "insensitive" },
    },
  });
  const build = await db.build.findFirstOrThrow({
    where: {
      revisionId: revision.id,
      label: { equals: "BUILD-001", mode: "insensitive" },
    },
    include: {
      boards: { orderBy: { serial: "asc" } },
      artifacts: true,
    },
  });
  return { project, revision, build };
}

// Snapshot of "what the seed claims" so we can restore at the end.
let originalBoardStatuses: { id: string; status: BoardStatus }[] = [];
let seededBringupCompleteArtifact: {
  id: string;
  buildId: string | null;
  revisionId: string | null;
  stage: "BRINGUP";
  title: string;
  noteBody: string | null;
  createdBy: string;
} | null = null;
let createdInTest: string[] = [];

beforeAll(async () => {
  mockAuth.mockImplementation(async () => ({
    user: { email: SEED_EMAIL },
  }));

  const { build } = await loadSeed();
  originalBoardStatuses = build.boards.map((b) => ({
    id: b.id,
    status: b.status,
  }));
  const seedComplete = build.artifacts.find(
    (a) => a.subkind === "BRINGUP_COMPLETE",
  );
  if (seedComplete) {
    seededBringupCompleteArtifact = {
      id: seedComplete.id,
      buildId: seedComplete.buildId,
      revisionId: seedComplete.revisionId,
      stage: "BRINGUP",
      title: seedComplete.title,
      noteBody: seedComplete.noteBody,
      createdBy: seedComplete.createdBy,
    };
  }
});

afterAll(async () => {
  // 1. Delete anything we created in the test run.
  if (createdInTest.length > 0) {
    await db.artifact.deleteMany({ where: { id: { in: createdInTest } } });
  }
  // 2. Restore the seed-injected BRINGUP_COMPLETE artifact (so M7's demo
  //    keeps working — design §12.1 / M2b trapdoor).
  const { build } = await loadSeed();
  const stillHas = build.artifacts.some((a) => a.subkind === "BRINGUP_COMPLETE");
  if (!stillHas && seededBringupCompleteArtifact) {
    await db.artifact.create({
      data: {
        buildId: seededBringupCompleteArtifact.buildId ?? undefined,
        revisionId: seededBringupCompleteArtifact.revisionId ?? undefined,
        stage: seededBringupCompleteArtifact.stage,
        kind: "NOTE",
        subkind: "BRINGUP_COMPLETE",
        title: seededBringupCompleteArtifact.title,
        noteBody: seededBringupCompleteArtifact.noteBody,
        createdBy: seededBringupCompleteArtifact.createdBy,
      },
    });
  }
  // 3. Restore the original board statuses.
  for (const b of originalBoardStatuses) {
    await db.board.update({
      where: { id: b.id },
      data: { status: b.status },
    });
  }
});

describe("M8a checkpoint — Mark bring-up complete state machine on seeded BUILD-001", () => {
  test("step 1: seed-injected BRINGUP_COMPLETE present → button hidden", async () => {
    const { revision, build } = await loadSeed();
    const hasComplete = build.artifacts.some(
      (a) => a.subkind === "BRINGUP_COMPLETE",
    );
    expect(hasComplete).toBe(true);

    const result = buttonStateFromBuildSnapshot({
      revCurrentStage: revision.currentStage,
      revFrozenAt: revision.frozenAt,
      buildFrozenAt: build.frozenAt,
      hasBringupComplete: hasComplete,
      boardStatuses: build.boards.map((b) => b.status),
    });
    expect(result.state).toBe("hidden");
  });

  test("step 2: delete BRINGUP_COMPLETE; boards still ASSEMBLED → button DISABLED", async () => {
    const { build } = await loadSeed();
    // Delete the seed BRINGUP_COMPLETE artifact via direct DB call ("raw
    // SQL" via Prisma); matches §9.5 step's direct-DB inspection model.
    await db.artifact.deleteMany({
      where: { buildId: build.id, subkind: "BRINGUP_COMPLETE" },
    });

    const after = await loadSeed();
    expect(
      after.build.artifacts.some((a) => a.subkind === "BRINGUP_COMPLETE"),
    ).toBe(false);

    // All five seeded boards are ASSEMBLED — disabled.
    const blocking = after.build.boards.filter(
      (b) => !["BROUGHT_UP", "QUARANTINED"].includes(b.status),
    );
    expect(blocking.length).toBeGreaterThan(0);

    const result = buttonStateFromBuildSnapshot({
      revCurrentStage: after.revision.currentStage,
      revFrozenAt: after.revision.frozenAt,
      buildFrozenAt: after.build.frozenAt,
      hasBringupComplete: false,
      boardStatuses: after.build.boards.map((b) => b.status),
    });
    expect(result.state).toBe("disabled");

    // markBringupComplete called now should reject with the §9.2 truncated
    // message. 5 boards × ASSEMBLED — at the threshold, no "…and N more".
    await expect(markBringupComplete(after.build.id)).rejects.toThrow(
      /Blocked by boards not BROUGHT_UP or QUARANTINED:/,
    );
  });

  test("step 3: update boards to BROUGHT_UP → button ENABLED; markBringupComplete succeeds", async () => {
    const { build } = await loadSeed();
    // Update all boards on BUILD-001 to BROUGHT_UP via raw SQL (Prisma
    // updateMany).
    await db.board.updateMany({
      where: { buildId: build.id },
      data: { status: "BROUGHT_UP" },
    });

    const after = await loadSeed();
    const blocking = after.build.boards.filter(
      (b) => !["BROUGHT_UP", "QUARANTINED"].includes(b.status),
    );
    expect(blocking.length).toBe(0);

    const buttonState = buttonStateFromBuildSnapshot({
      revCurrentStage: after.revision.currentStage,
      revFrozenAt: after.revision.frozenAt,
      buildFrozenAt: after.build.frozenAt,
      hasBringupComplete: false,
      boardStatuses: after.build.boards.map((b) => b.status),
    });
    expect(buttonState.state).toBe("enabled");

    // Now markBringupComplete should succeed.
    const artifact = await markBringupComplete(after.build.id);
    createdInTest.push(artifact.id);
    expect(artifact.subkind).toBe("BRINGUP_COMPLETE");
    expect(artifact.buildId).toBe(after.build.id);
    expect(artifact.kind).toBe("NOTE");
    expect(artifact.title).toBe("Bring-up complete");

    // And the button now flips back to "hidden" (a complete row exists).
    const final = await loadSeed();
    const finalState = buttonStateFromBuildSnapshot({
      revCurrentStage: final.revision.currentStage,
      revFrozenAt: final.revision.frozenAt,
      buildFrozenAt: final.build.frozenAt,
      hasBringupComplete: final.build.artifacts.some(
        (a) => a.subkind === "BRINGUP_COMPLETE",
      ),
      boardStatuses: final.build.boards.map((b) => b.status),
    });
    expect(finalState.state).toBe("hidden");
  });
});
