import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db";

// Round-trip smoke test for the Guide/GuideCard models. Uses a dedicated
// throwaway revision (NOT the live l1-01 v1) so it never collides with
// the backfilled curriculum guide (one-guide-per-revision via the
// Guide.revisionId unique index). The throwaway revision + its guide are torn
// down in afterAll.
describe("Guide model", () => {
  const slug = "l1-01-wroom-breakout";
  const testLabel = `guide-model-test-${Date.now()}`;
  let revisionId: string | null = null;
  let guideId: string | null = null;

  afterAll(async () => {
    if (guideId) await db.guide.delete({ where: { id: guideId } }).catch(() => {});
    // Deleting the throwaway revision cascades any remaining guide/cards.
    if (revisionId) await db.revision.delete({ where: { id: revisionId } }).catch(() => {});
  });

  it("creates a Guide with an ordered card on an existing revision", async () => {
    const project = await db.project.findFirstOrThrow({
      where: { slug },
      select: { id: true, createdById: true },
    });
    const rev = await db.revision.create({
      data: { projectId: project.id, label: testLabel },
      select: { id: true },
    });
    revisionId = rev.id;

    const guide = await db.guide.create({
      data: {
        revisionId: rev.id,
        title: "Test guide",
        createdById: project.createdById,
        cards: { create: [{ stage: "REQUIREMENTS", ordinal: 0, eyebrow: "PHASE 01", title: "REQUIREMENTS", contentBlocks: [] }] },
      },
      include: { cards: true },
    });
    guideId = guide.id;
    expect(guide.cards).toHaveLength(1);
    expect(guide.cards[0]!.stage).toBe("REQUIREMENTS");
  });
});
