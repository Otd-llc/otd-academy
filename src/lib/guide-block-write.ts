// Set an image/video block's src (+ optional caption) on a guide card. NOT
// auth-gated here — callers gate it: `setGuideBlockMedia` (requireAdmin) and the
// token-verified `/api/capture` route. Freeze-checked; revalidates the guide route.
// Lives in its own (non-"use server") module so both an action and a route handler
// can import it.
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { assertNotFrozen } from "@/lib/assertions";
import { withTxRetry } from "@/lib/tx-retry";
import { guideContentBlocksSchema } from "@/lib/schemas/guide";

export async function writeGuideBlockMedia(
  cardId: string,
  blockIndex: number,
  src: string,
  caption?: string,
): Promise<{ src: string }> {
  const rev = await withTxRetry(() =>
    db.$transaction(
      async (tx) => {
        const card = await tx.guideCard.findUniqueOrThrow({
          where: { id: cardId },
          select: {
            contentBlocks: true,
            guide: { select: { revisionId: true } },
          },
        });
        await assertNotFrozen(tx, card.guide.revisionId);

        const blocks = guideContentBlocksSchema.parse(card.contentBlocks);
        const block = blocks[blockIndex];
        if (!block || (block.type !== "image" && block.type !== "video")) {
          throw new Error("Target block is not an image or video block.");
        }
        blocks[blockIndex] = {
          ...block,
          src,
          ...(caption !== undefined ? { caption } : {}),
        };
        const next = guideContentBlocksSchema.parse(blocks);

        await tx.guideCard.update({
          where: { id: cardId },
          data: { contentBlocks: next as unknown as Prisma.InputJsonValue },
        });
        return tx.revision.findUniqueOrThrow({
          where: { id: card.guide.revisionId },
          select: { label: true, project: { select: { slug: true } } },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );

  revalidatePath(
    `/projects/${rev.project.slug}/${encodeURIComponent(rev.label)}/guide`,
  );
  return { src };
}
