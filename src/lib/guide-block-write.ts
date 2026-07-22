// Set an image/video block's src (+ optional caption) on a guide card. NOT
// auth-gated here — callers gate it: `setGuideBlockMedia` (requireAdmin) and the
// token-verified `/api/capture` route. Freeze-checked; revalidates the guide route.
// Lives in its own (non-"use server") module so both an action and a route handler
// can import it.
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { invalidateGuideContent } from "@/lib/cache-invalidate";
import { db } from "@/lib/db";
import { assertNotFrozen } from "@/lib/assertions";
import { withTxRetry } from "@/lib/tx-retry";
import { parseBlockAt } from "@/lib/guide-blocks-parse";

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

        // Validate ONLY the target block (parseBlockAt), not the whole array, so a
        // malformed SIBLING block can't throw and block a legitimate capture write.
        // `blockIndex` is the block's STORAGE position (threaded from the resilient
        // render parse), so writing back to the raw array's [blockIndex] hits the
        // right block. Malformed siblings pass through the copy untouched.
        const raw = card.contentBlocks;
        if (!Array.isArray(raw)) {
          throw new Error("Card has no content blocks.");
        }
        const block = parseBlockAt(raw, blockIndex);
        if (!block || (block.type !== "image" && block.type !== "video")) {
          throw new Error("Target block is not an image or video block.");
        }
        const next = [...raw];
        next[blockIndex] = {
          ...block,
          src,
          ...(caption !== undefined ? { caption } : {}),
        };

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
  // Bust the cached anonymous guide read (capture writes change live media).
  invalidateGuideContent(rev.project.slug);
  return { src };
}
