"use server";

// Admin in-app screen-capture → guide image (and, later, clip).
//
// Two actions. Public lesson media: stored under `guide-shots/{cuid}.{ext}` and
// served WITH LONG-CACHE HEADERS via `/api/shot/{cuid}.{ext}` (a stable,
// CDN-cacheable, SEO-friendly URL) — NOT presigned. Admin-gated + freeze-checked,
// mirroring editGuideCard.
//
//   1. createGuideShotUploadUrl(input) → presigned PUT for the captured blob.
//   2. setGuideBlockImage(input)       → point a card's image block at the
//      served URL (replacing an empty-src placeholder).
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createId } from "@paralleldrive/cuid2";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { env } from "@/env";
import { db } from "@/lib/db";
import { r2, guideShotKey } from "@/lib/r2";
import { requireAdmin } from "@/lib/auth-helpers";
import { assertNotFrozen } from "@/lib/assertions";
import { withTxRetry } from "@/lib/tx-retry";
import { guideContentBlocksSchema } from "@/lib/schemas/guide";

const PUT_TTL_SECONDS = 900; // 15 min
const MAX_SHOT_BYTES = 12_000_000; // 12 MB — generous for a webp shot / short clip

function ensureR2Enabled(): void {
  if (!env.R2_ENABLED || !env.R2_BUCKET) {
    throw new Error("R2 file storage is not enabled on this deployment.");
  }
}

// Revalidate the guide route for a revision (slug + url-encoded label) — mirrors
// the private helper in actions/guides.ts.
async function revalidateGuideRoute(revisionId: string): Promise<void> {
  const rev = await db.revision.findUniqueOrThrow({
    where: { id: revisionId },
    select: { label: true, project: { select: { slug: true } } },
  });
  revalidatePath(
    `/projects/${rev.project.slug}/${encodeURIComponent(rev.label)}/guide`,
  );
}

const SHOT_EXT = z.enum(["webp", "webm", "mp4"]);

const uploadInputSchema = z.object({
  ext: SHOT_EXT.default("webp"),
  contentType: z.string().min(3).max(60),
  byteSize: z.number().int().positive().max(MAX_SHOT_BYTES),
});

export async function createGuideShotUploadUrl(input: unknown) {
  const data = uploadInputSchema.parse(input);
  await requireAdmin();
  ensureR2Enabled();

  const shotId = createId();
  const uploadUrl = await getSignedUrl(
    r2,
    new PutObjectCommand({
      Bucket: env.R2_BUCKET!,
      Key: guideShotKey(shotId, data.ext),
      ContentLength: data.byteSize,
      ContentType: data.contentType,
    }),
    { expiresIn: PUT_TTL_SECONDS },
  );
  // Client PUTs the blob to `uploadUrl`, then passes `shotId`/`ext` back to
  // setGuideBlockImage. The served URL is /api/shot/{shotId}.{ext}.
  return { uploadUrl, shotId, ext: data.ext };
}

const setImageInputSchema = z.object({
  cardId: z.cuid(),
  blockIndex: z.number().int().nonnegative(),
  shotId: z.string().regex(/^[a-z0-9]+$/),
  ext: SHOT_EXT.default("webp"),
  // The capture description becomes the block's caption (the on-page metadata).
  caption: z.string().max(200).optional(),
});

export async function setGuideBlockMedia(input: unknown) {
  const data = setImageInputSchema.parse(input);
  await requireAdmin();

  const src = `/api/shot/${data.shotId}.${data.ext}`;

  const updated = await withTxRetry(() =>
    db.$transaction(
      async (tx) => {
        const card = await tx.guideCard.findUniqueOrThrow({
          where: { id: data.cardId },
          select: {
            contentBlocks: true,
            guide: { select: { revisionId: true } },
          },
        });
        await assertNotFrozen(tx, card.guide.revisionId);

        const blocks = guideContentBlocksSchema.parse(card.contentBlocks);
        const block = blocks[data.blockIndex];
        if (!block || (block.type !== "image" && block.type !== "video")) {
          throw new Error("Target block is not an image or video block.");
        }
        blocks[data.blockIndex] = {
          ...block,
          src,
          ...(data.caption !== undefined ? { caption: data.caption } : {}),
        };
        // Re-validate the whole array before writing (belt-and-suspenders).
        const next = guideContentBlocksSchema.parse(blocks);

        return tx.guideCard.update({
          where: { id: data.cardId },
          data: { contentBlocks: next as unknown as Prisma.InputJsonValue },
          select: { id: true, guide: { select: { revisionId: true } } },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );

  await revalidateGuideRoute(updated.guide.revisionId);
  return { ok: true as const, src };
}
