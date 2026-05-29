// Tests for Board server actions (Task 12.1).
//
// createBoard covers:
//   - Invalid silkscreenHash (fails the shared SILKSCREEN_HASH_RE) → Zod rejects.
//   - Valid input → row inserted, default status BARE.
//   - Duplicate serial (case-insensitive) on the same Build → rejected
//     by `board_build_serial_ci` functional unique index.
// editBoard covers:
//   - Status transition (BARE → ASSEMBLED) succeeds.
//   - Edit on a frozen Build → rejected.
//   - Edit on a board belonging to a frozen Revision → rejected.
// deleteBoard covers:
//   - Removes the row.
//
// Test fixtures are throwaway revisions/builds — we don't touch the seeded
// BUILD-001 / B01-B05.
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mockAuth = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({
  auth: () => mockAuth(),
}));

import { db } from "@/lib/db";
import { createBoard, deleteBoard, editBoard } from "@/lib/actions/boards";

const SEED_EMAIL = "seed@example.com";
const SEED_PROJECT_SLUG = "esp32-sensor-breakout";

const createdBoardIds: string[] = [];
const createdBuildIds: string[] = [];
const createdRevisionIds: string[] = [];

beforeAll(() => {
  mockAuth.mockImplementation(async () => ({
    user: { email: SEED_EMAIL },
  }));
});

afterAll(async () => {
  if (createdBoardIds.length > 0) {
    await db.board.deleteMany({ where: { id: { in: createdBoardIds } } });
  }
  if (createdBuildIds.length > 0) {
    await db.build.deleteMany({ where: { id: { in: createdBuildIds } } });
  }
  if (createdRevisionIds.length > 0) {
    await db.revision.deleteMany({ where: { id: { in: createdRevisionIds } } });
  }
});

async function seedUser() {
  return db.user.findUniqueOrThrow({ where: { email: SEED_EMAIL } });
}

/**
 * Make a throwaway revision + build at ASSEMBLY (which is in the
 * BUILD_CREATABLE_STAGES set). Returns the unfrozen Build id; freeze handling
 * is up to the individual tests.
 */
async function makeRevWithBuild(
  labelSuffix: string,
): Promise<{ revisionId: string; buildId: string }> {
  const user = await seedUser();
  const project = await db.project.findUniqueOrThrow({
    where: { slug: SEED_PROJECT_SLUG },
  });
  const rev = await db.revision.create({
    data: {
      projectId: project.id,
      label: `t12.1-${labelSuffix}-${Date.now()}`,
      currentStage: "ASSEMBLY",
    },
  });
  createdRevisionIds.push(rev.id);
  const build = await db.build.create({
    data: {
      revisionId: rev.id,
      label: `BUILD-T12-${labelSuffix}-${Date.now()}`,
      boardCount: 5,
      createdById: user.id,
    },
  });
  createdBuildIds.push(build.id);
  return { revisionId: rev.id, buildId: build.id };
}

describe("createBoard — validation + insert", () => {
  test("invalid silkscreenHash → Zod rejection", async () => {
    const { buildId } = await makeRevWithBuild("zod");
    await expect(
      createBoard({
        buildId,
        serial: "B01",
        silkscreenHash: "not-a-hash",
      }),
    ).rejects.toThrow();
  });

  test("valid input → row inserted with default status BARE", async () => {
    const { buildId } = await makeRevWithBuild("ok");
    const board = await createBoard({
      buildId,
      serial: "B01",
      silkscreenHash: "g1ebc1cc",
    });
    createdBoardIds.push(board.id);

    expect(board.serial).toBe("B01");
    expect(board.silkscreenHash).toBe("g1ebc1cc");
    expect(board.status).toBe("BARE");
    expect(board.buildId).toBe(buildId);
  });

  test("valid input without silkscreenHash → row inserted with null hash", async () => {
    const { buildId } = await makeRevWithBuild("nohash");
    const board = await createBoard({ buildId, serial: "B02" });
    createdBoardIds.push(board.id);
    expect(board.silkscreenHash).toBeNull();
    expect(board.status).toBe("BARE");
  });

  test("duplicate serial (case-insensitive) on same Build → rejected", async () => {
    const { buildId } = await makeRevWithBuild("dup");
    const first = await createBoard({ buildId, serial: "B01" });
    createdBoardIds.push(first.id);
    await expect(
      createBoard({ buildId, serial: "b01" }),
    ).rejects.toThrow(/board_build_serial_ci|unique/i);
  });
});

describe("editBoard — status transitions and freeze policy", () => {
  test("status transition BARE → ASSEMBLED succeeds", async () => {
    const { buildId } = await makeRevWithBuild("edit-bare");
    const board = await createBoard({ buildId, serial: "B01" });
    createdBoardIds.push(board.id);

    const updated = await editBoard({ id: board.id, status: "ASSEMBLED" });
    expect(updated.status).toBe("ASSEMBLED");
  });

  test("edit on a frozen Build → rejected", async () => {
    const { buildId } = await makeRevWithBuild("edit-frzb");
    const board = await createBoard({ buildId, serial: "B01" });
    createdBoardIds.push(board.id);

    await db.build.update({
      where: { id: buildId },
      data: { frozenAt: new Date() },
    });

    await expect(
      editBoard({ id: board.id, status: "ASSEMBLED" }),
    ).rejects.toThrow(/Build is frozen/i);
  });

  test("edit on a board whose Revision is frozen → rejected", async () => {
    const { revisionId, buildId } = await makeRevWithBuild("edit-frzr");
    const board = await createBoard({ buildId, serial: "B01" });
    createdBoardIds.push(board.id);

    const user = await seedUser();
    await db.revision.update({
      where: { id: revisionId },
      data: { frozenAt: new Date(), frozenById: user.id },
    });

    await expect(
      editBoard({ id: board.id, status: "ASSEMBLED" }),
    ).rejects.toThrow(/Revision is frozen/i);
  });

  test("editing silkscreenHash with invalid value → Zod rejection", async () => {
    const { buildId } = await makeRevWithBuild("edit-zod");
    const board = await createBoard({ buildId, serial: "B01" });
    createdBoardIds.push(board.id);
    await expect(
      editBoard({ id: board.id, silkscreenHash: "ZZZ" }),
    ).rejects.toThrow();
  });

  test("editing silkscreenHash to empty string → clears to null", async () => {
    const { buildId } = await makeRevWithBuild("edit-clear");
    const board = await createBoard({
      buildId,
      serial: "B01",
      silkscreenHash: "g1ebc1cc",
    });
    createdBoardIds.push(board.id);
    const updated = await editBoard({ id: board.id, silkscreenHash: "" });
    expect(updated.silkscreenHash).toBeNull();
  });
});

describe("deleteBoard", () => {
  test("removes the row", async () => {
    const { buildId } = await makeRevWithBuild("del");
    const board = await createBoard({ buildId, serial: "B01" });
    // Do NOT push to createdBoardIds — we're about to delete it.

    await deleteBoard({ id: board.id });

    const after = await db.board.findUnique({ where: { id: board.id } });
    expect(after).toBeNull();
  });
});
