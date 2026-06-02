// BOM_SOURCING-gate end-to-end exercise (Wave 2 review-fix I3).
//
// Slim integration tests that walk red-to-green for the two new BOM_SOURCING
// branches added by m17 (stripboard) and m18 (mains-net certified module),
// going through the real `advanceStage` server action so any loader-to-gate
// fusion regression lights up red.
//
// Mirrors `gate-assembly-e2e.test.ts` in structure: mock auth, build a
// throwaway project + revision at BOM_SOURCING, run advanceStage, assert
// blocking reasons, satisfy the gate, re-run, assert advancement to LAYOUT.
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mockAuth = vi.fn<() => Promise<unknown>>();
vi.mock("@/auth", () => ({
  auth: () => mockAuth(),
}));

import { db } from "@/lib/db";
import { advanceStage } from "@/lib/actions/stages";
import {
  editChecklistItem,
  materializeCanonicalChecklist,
} from "@/lib/actions/checklists";

const SEED_EMAIL = "seed@example.com";

const createdProjectIds: string[] = [];
const createdRevisionIds: string[] = [];
const createdBomLineIds: string[] = [];
const createdChecklistIds: string[] = [];
const createdPartIds: string[] = [];

beforeAll(() => {
  mockAuth.mockImplementation(async () => ({
    user: { email: SEED_EMAIL },
  }));
});

afterAll(async () => {
  if (createdChecklistIds.length > 0) {
    await db.checklist.deleteMany({
      where: { id: { in: createdChecklistIds } },
    });
  }
  if (createdBomLineIds.length > 0) {
    await db.bomLine.deleteMany({
      where: { id: { in: createdBomLineIds } },
    });
  }
  if (createdRevisionIds.length > 0) {
    await db.revision.deleteMany({
      where: { id: { in: createdRevisionIds } },
    });
  }
  if (createdProjectIds.length > 0) {
    await db.project.deleteMany({
      where: { id: { in: createdProjectIds } },
    });
  }
  if (createdPartIds.length > 0) {
    await db.part.deleteMany({ where: { id: { in: createdPartIds } } });
  }
});

async function makeProjectAtBomSourcing(
  user: { id: string },
  slug: string,
  flags: { requiresStripboard?: boolean; hasMainsNet?: boolean },
) {
  const p = await db.project.create({
    data: {
      slug,
      name: slug,
      createdById: user.id,
      requiresStripboard: flags.requiresStripboard ?? false,
      hasMainsNet: flags.hasMainsNet ?? false,
    },
  });
  createdProjectIds.push(p.id);
  const r = await db.revision.create({
    data: {
      projectId: p.id,
      label: `v1-${Date.now()}`,
      currentStage: "BOM_SOURCING",
    },
  });
  createdRevisionIds.push(r.id);
  await db.stageTransition.create({
    data: {
      revisionId: r.id,
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
  return { project: p, revision: r };
}

describe("BOM_SOURCING gate — m17 stripboard branch end-to-end", () => {
  test("blocks → blocks unchecked → passes once ticked → rev moves to LAYOUT", async () => {
    const user = await db.user.findUniqueOrThrow({
      where: { email: SEED_EMAIL },
    });
    const { project, revision } = await makeProjectAtBomSourcing(
      user,
      `bom-e2e-strip-${Date.now()}`,
      { requiresStripboard: true },
    );

    // Add a passing BomLine so the bomLines/datasheet/EOL checks pass and
    // STRIPBOARD_VALIDATION is the sole blocker.
    const part = await db.part.findFirstOrThrow({
      where: { lifecycle: "ACTIVE", datasheetUrl: { not: null } },
    });
    const line = await db.bomLine.create({
      data: {
        revisionId: revision.id,
        partId: part.id,
        refDes: "U1",
        quantity: 1,
        createdById: user.id,
      },
    });
    createdBomLineIds.push(line.id);

    // Step 1: no STRIPBOARD_VALIDATION → blocked with the missing-checklist reason.
    let result = await advanceStage({ revisionId: revision.id });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons).toContain(
        "No STRIPBOARD_VALIDATION Checklist on the revision.",
      );
    }
    expect(
      (
        await db.revision.findUniqueOrThrow({
          where: { id: revision.id },
          select: { currentStage: true },
        })
      ).currentStage,
    ).toBe("BOM_SOURCING");

    // Step 2: materialize the canonical template (5 unchecked items).
    const checklist = await materializeCanonicalChecklist({
      revisionId: revision.id,
      templateKey: "STRIPBOARD_VALIDATION",
    });
    createdChecklistIds.push(checklist.id);

    result = await advanceStage({ revisionId: revision.id });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons).toContain(
        "STRIPBOARD_VALIDATION Checklist has unchecked items.",
      );
    }

    // Step 3: tick every item; gate now passes.
    const items = await db.checklistItem.findMany({
      where: { checklistId: checklist.id },
    });
    expect(items.length).toBe(5);
    for (const i of items) {
      await editChecklistItem({ id: i.id, checked: true });
    }

    result = await advanceStage({ revisionId: revision.id });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.transition.fromStage).toBe("BOM_SOURCING");
      expect(result.transition.toStage).toBe("LAYOUT");
    }
    expect(
      (
        await db.revision.findUniqueOrThrow({
          where: { id: revision.id },
          select: { currentStage: true },
        })
      ).currentStage,
    ).toBe("LAYOUT");

    // Side-cleanup not needed — project cascade in afterAll handles it.
    void project;
  });
});

describe("BOM_SOURCING gate — m18 mains-net certified-module branch end-to-end", () => {
  test("blocks when hasMainsNet+no certified part → passes once a certified part is added", async () => {
    const user = await db.user.findUniqueOrThrow({
      where: { email: SEED_EMAIL },
    });
    const { project, revision } = await makeProjectAtBomSourcing(
      user,
      `bom-e2e-mains-${Date.now()}`,
      { hasMainsNet: true },
    );

    // Non-certified Part with a datasheet so the BOM-quality checks pass and
    // the certified-module check is the sole blocker.
    const nonCertified = await db.part.create({
      data: {
        manufacturer: "TestNC",
        mpn: `NC-${Date.now()}`,
        description: "non-certified test part",
        datasheetUrl: "https://example.com/datasheet.pdf",
        lifecycle: "ACTIVE",
        isCertifiedModule: false,
        createdById: user.id,
      },
    });
    createdPartIds.push(nonCertified.id);
    const ncLine = await db.bomLine.create({
      data: {
        revisionId: revision.id,
        partId: nonCertified.id,
        refDes: "U1",
        quantity: 1,
        createdById: user.id,
      },
    });
    createdBomLineIds.push(ncLine.id);

    // Step 1: hasMainsNet + no certified BomLine → blocked.
    let result = await advanceStage({ revisionId: revision.id });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons).toContain(
        "Project has mains net but no certified-module part on the BOM.",
      );
    }
    expect(
      (
        await db.revision.findUniqueOrThrow({
          where: { id: revision.id },
          select: { currentStage: true },
        })
      ).currentStage,
    ).toBe("BOM_SOURCING");

    // Step 2: add a certified-module part to the BOM; gate clears.
    const certified = await db.part.create({
      data: {
        manufacturer: "TestCert",
        mpn: `CERT-${Date.now()}`,
        description: "certified module test part",
        datasheetUrl: "https://example.com/cert-datasheet.pdf",
        lifecycle: "ACTIVE",
        isCertifiedModule: true,
        createdById: user.id,
      },
    });
    createdPartIds.push(certified.id);
    const cLine = await db.bomLine.create({
      data: {
        revisionId: revision.id,
        partId: certified.id,
        refDes: "U2",
        quantity: 1,
        createdById: user.id,
      },
    });
    createdBomLineIds.push(cLine.id);

    result = await advanceStage({ revisionId: revision.id });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.transition.fromStage).toBe("BOM_SOURCING");
      expect(result.transition.toStage).toBe("LAYOUT");
    }
    expect(
      (
        await db.revision.findUniqueOrThrow({
          where: { id: revision.id },
          select: { currentStage: true },
        })
      ).currentStage,
    ).toBe("LAYOUT");

    void project;
  });
});

describe("editChecklistItem — I1 post-merge bypass guard", () => {
  test("rejects notApplicable=true when existing row already has checked=true", async () => {
    const user = await db.user.findUniqueOrThrow({
      where: { email: SEED_EMAIL },
    });
    const project = await db.project.create({
      data: {
        slug: `i1-postmerge-${Date.now()}`,
        name: "i1",
        createdById: user.id,
      },
    });
    createdProjectIds.push(project.id);
    const rev = await db.revision.create({
      data: { projectId: project.id, label: "v1" },
    });
    createdRevisionIds.push(rev.id);

    // Item pre-staged as checked=true via direct DB write.
    const checklist = await db.checklist.create({
      data: {
        revisionId: rev.id,
        stage: "REQUIREMENTS",
        subkind: "GENERIC",
        title: "i1",
        createdById: user.id,
        items: {
          create: [
            {
              ordinal: 0,
              label: "pre-checked item",
              checked: true,
              completedAt: new Date(),
              completedById: user.id,
            },
          ],
        },
      },
      include: { items: true },
    });
    createdChecklistIds.push(checklist.id);
    const item = checklist.items[0]!;

    // Partial-update payload that the Zod refinement WOULD accept (only
    // notApplicable, no checked). Without the post-merge guard, this would
    // hit the DB CHECK and surface an opaque Postgres error. The guard
    // throws the canonical message instead.
    await expect(
      editChecklistItem({ id: item.id, notApplicable: true }),
    ).rejects.toThrow(
      "An item cannot be both checked and N/A simultaneously.",
    );

    // Confirm the row is unchanged after the rejection.
    const after = await db.checklistItem.findUniqueOrThrow({
      where: { id: item.id },
    });
    expect(after.checked).toBe(true);
    expect(after.notApplicable).toBe(false);
  });
});
