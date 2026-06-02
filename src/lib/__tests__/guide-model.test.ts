import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db";

describe("Guide model", () => {
  const slug = "foundry-l1-01-wroom-breakout";
  let guideId: string | null = null;
  afterAll(async () => { if (guideId) await db.guide.delete({ where: { id: guideId } }); });

  it("creates a Guide with an ordered card on an existing revision", async () => {
    const rev = await db.revision.findFirstOrThrow({
      where: { project: { slug }, label: { equals: "v1", mode: "insensitive" } },
      select: { id: true, project: { select: { createdById: true } } },
    });
    const guide = await db.guide.create({
      data: {
        revisionId: rev.id,
        title: "Test guide",
        createdById: rev.project.createdById,
        cards: { create: [{ stage: "REQUIREMENTS", ordinal: 0, eyebrow: "PHASE 01", title: "REQUIREMENTS", contentBlocks: [] }] },
      },
      include: { cards: true },
    });
    guideId = guide.id;
    expect(guide.cards).toHaveLength(1);
    expect(guide.cards[0]!.stage).toBe("REQUIREMENTS");
  });
});
