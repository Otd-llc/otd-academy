// Task 6.1 — resolveCardCompletion completion adapters (real Neon DB).
//
// resolveCardCompletion maps a card's `completionRef` → the live completion
// widget state (done/total/href) AND delegates the `complete` verdict to the
// stage's REAL exit-gate predicate (src/lib/stages.ts), so the guide footer
// never reports "done" while the real gate is still closed.
//
// No server-action mocks: resolveCardCompletion is a pure-ish read helper that
// imports `db` directly. It is NOT a "use server" action.
//
// THE AUTHORITATIVE-DONE TEST (per the plan note): a BRINGUP card whose boards
// are all BROUGHT_UP but which has NO BRINGUP_COMPLETE artifact must report
// NOT "complete" — the boardStatus ref is satisfied, but the real BRINGUP gate
// (stages.ts:428-452) additionally requires BRINGUP_LOG + BRINGUP_COMPLETE.
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { db } from "@/lib/db";
import { resolveCardCompletion } from "@/lib/guide-completion";

const SEED_EMAIL = "seed@example.com";
const WROOM_SLUG = "l1-01-wroom-breakout";
const SEED_PROJECT_SLUG = "esp32-sensor-breakout";

const createdArtifactIds: string[] = [];
const createdBoardIds: string[] = [];
const createdBuildIds: string[] = [];
const createdRevisionIds: string[] = [];

afterAll(async () => {
  if (createdArtifactIds.length > 0) {
    await db.artifact.deleteMany({ where: { id: { in: createdArtifactIds } } });
  }
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

describe("resolveCardCompletion — plan-pinned states", () => {
  test("revisionChecklist REQUIREMENTS_REVIEW with unchecked items → partial, total>0", async () => {
    // Self-contained: a FRESH revision with a REQUIREMENTS_REVIEW checklist that
    // still has an unchecked item, so the requirements gate is open. (This used
    // to read the real curriculum v1 board, whose requirements review flips to
    // "complete" — and this assertion to red — once that board is actually
    // advanced. The state under test is the checklist's, not the live board's.)
    const user = await db.user.findUniqueOrThrow({ where: { email: SEED_EMAIL } });
    const project = await db.project.findUniqueOrThrow({
      where: { slug: SEED_PROJECT_SLUG },
      select: { id: true },
    });
    const rev = await db.revision.create({
      data: {
        projectId: project.id,
        label: `gc-reqpartial-${Date.now()}`,
        currentStage: "REQUIREMENTS",
      },
    });
    createdRevisionIds.push(rev.id);
    await db.checklist.create({
      data: {
        revisionId: rev.id,
        stage: "REQUIREMENTS",
        subkind: "REQUIREMENTS_REVIEW",
        title: "Requirements review",
        createdById: user.id,
        items: {
          create: [
            { ordinal: 0, label: "Interfaces defined", checked: true },
            { ordinal: 1, label: "Power budget bounded", checked: false },
          ],
        },
      },
    });

    const r = await resolveCardCompletion({
      revisionId: rev.id,
      stage: "REQUIREMENTS",
      completionRef: { kind: "revisionChecklist", subkind: "REQUIREMENTS_REVIEW" },
    });
    expect(r.state).toBe("partial");
    expect(r.total).toBe(2);
  });

  test("buildChecklist card with no active build → blocked", async () => {
    const rev = await db.revision.findFirstOrThrow({
      where: {
        project: { slug: WROOM_SLUG },
        label: { equals: "v1", mode: "insensitive" },
      },
      select: { id: true },
    });
    const r = await resolveCardCompletion({
      revisionId: rev.id,
      stage: "ASSEMBLY",
      completionRef: {
        kind: "buildChecklist",
        subkind: "POST_ASSEMBLY_CONTINUITY",
      },
    });
    expect(r.state).toBe("blocked");
  });

  test("revisionChecklist that has never been materialized → untouched (total 0) with materialize href", async () => {
    // The rev sits at REQUIREMENTS and has no LAYOUT_REVIEW yet.
    const rev = await db.revision.findFirstOrThrow({
      where: {
        project: { slug: WROOM_SLUG },
        label: { equals: "v1", mode: "insensitive" },
      },
      select: { id: true },
    });
    const r = await resolveCardCompletion({
      revisionId: rev.id,
      stage: "LAYOUT",
      completionRef: { kind: "revisionChecklist", subkind: "LAYOUT_REVIEW" },
    });
    expect(r.state).toBe("untouched");
    expect(r.total).toBe(0);
    expect(r.href).toBeTruthy();
  });
});

describe("resolveCardCompletion — AUTHORITATIVE-DONE (BRINGUP dual-source)", () => {
  let revId: string;

  beforeAll(async () => {
    const user = await db.user.findUniqueOrThrow({
      where: { email: SEED_EMAIL },
    });
    const project = await db.project.findUniqueOrThrow({
      where: { slug: SEED_PROJECT_SLUG },
      select: { id: true },
    });
    // Fresh revision at BRINGUP with its own active (unfrozen) build whose
    // boards are ALL BROUGHT_UP — but deliberately NO BRINGUP_COMPLETE artifact
    // and NO BRINGUP_LOG. The boardStatus ref is fully satisfied; the real gate
    // is still closed.
    const rev = await db.revision.create({
      data: {
        projectId: project.id,
        label: `gc-bringup-${Date.now()}`,
        currentStage: "BRINGUP",
      },
    });
    revId = rev.id;
    createdRevisionIds.push(rev.id);

    const build = await db.build.create({
      data: {
        revisionId: rev.id,
        label: "BUILD-001",
        boardCount: 2,
        createdById: user.id,
      },
    });
    createdBuildIds.push(build.id);

    for (const serial of ["B01", "B02"]) {
      const board = await db.board.create({
        data: { buildId: build.id, serial, status: "BROUGHT_UP" },
      });
      createdBoardIds.push(board.id);
    }
  });

  test("all boards BROUGHT_UP but NO BRINGUP_COMPLETE → boardStatus ref satisfied, but state is NOT complete", async () => {
    const r = await resolveCardCompletion({
      revisionId: revId,
      stage: "BRINGUP",
      completionRef: {
        kind: "boardStatus",
        statuses: ["BROUGHT_UP", "QUARANTINED"],
      },
    });
    // The boardStatus widget reports done === total (both boards BROUGHT_UP)…
    expect(r.done).toBe(r.total);
    expect(r.total).toBe(2);
    // …but the REAL gate is still closed (no BRINGUP_LOG / BRINGUP_COMPLETE),
    // so the authoritative verdict must NOT be "complete".
    expect(r.state).not.toBe("complete");
  });

  test("a `none` completionRef on a gated stage must NOT shortcut the closed gate → not complete", async () => {
    // Defensive: `none` previously short-circuited to `complete` whenever stage
    // was absent (the removed ref-only fallback). With the authoritative-done
    // contract, a `none` ref on a stage whose REAL gate is still closed (this
    // BRINGUP rev has no BRINGUP_LOG / BRINGUP_COMPLETE yet) must NOT report
    // complete — proving the ref can never bypass the gate.
    const r = await resolveCardCompletion({
      revisionId: revId,
      stage: "BRINGUP",
      completionRef: { kind: "none" },
    });
    expect(r.state).not.toBe("complete");
  });

  test("adding BRINGUP_LOG + BRINGUP_COMPLETE closes the gate → state complete", async () => {
    const user = await db.user.findUniqueOrThrow({
      where: { email: SEED_EMAIL },
    });
    const build = await db.build.findFirstOrThrow({
      where: { revisionId: revId, frozenAt: null },
      select: { id: true },
    });
    const log = await db.artifact.create({
      data: {
        buildId: build.id,
        stage: "BRINGUP",
        kind: "NOTE",
        subkind: "BRINGUP_LOG",
        title: "bring-up log",
        noteBody: "rails ok",
        createdBy: user.id,
      },
    });
    createdArtifactIds.push(log.id);
    const done = await db.artifact.create({
      data: {
        buildId: build.id,
        stage: "BRINGUP",
        kind: "NOTE",
        subkind: "BRINGUP_COMPLETE",
        title: "bring-up complete",
        noteBody: "sealed",
        createdBy: user.id,
      },
    });
    createdArtifactIds.push(done.id);

    const r = await resolveCardCompletion({
      revisionId: revId,
      stage: "BRINGUP",
      completionRef: {
        kind: "boardStatus",
        statuses: ["BROUGHT_UP", "QUARANTINED"],
      },
    });
    expect(r.state).toBe("complete");
  });
});
