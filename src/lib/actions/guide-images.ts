"use server";

// Admin screen-capture → guide media (image or clip). Two capture paths share
// one storage convention and one block-writer (writeGuideBlockMedia):
//
//   • In-browser (MediaCapture): createGuideShotUploadUrl → presigned PUT →
//     setGuideBlockMedia points the block at the served URL.
//   • Desktop app (OTD Capture): createCaptureSession mints a short-lived signed
//     token + hands back the block's description; the app uploads through
//     /api/capture, which verifies the token and calls the same block-writer.
//
// Media lives under `guide-shots/{cuid}.{ext}` and is served WITH LONG-CACHE
// HEADERS via `/api/shot/{cuid}.{ext}` (stable, CDN-cacheable, SEO-friendly).
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createId } from "@paralleldrive/cuid2";
import { z } from "zod";
import { env } from "@/env";
import { db } from "@/lib/db";
import { r2, guideShotKey } from "@/lib/r2";
import { requireAdmin } from "@/lib/auth-helpers";
import { guideContentBlocksSchema } from "@/lib/schemas/guide";
import { writeGuideBlockMedia } from "@/lib/guide-block-write";
import { signCaptureToken } from "@/lib/capture-token";

const PUT_TTL_SECONDS = 900; // 15 min
const MAX_SHOT_BYTES = 12_000_000; // 12 MB — generous for a webp shot / short clip

function ensureR2Enabled(): void {
  if (!env.R2_ENABLED || !env.R2_BUCKET) {
    throw new Error("R2 file storage is not enabled on this deployment.");
  }
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
  // setGuideBlockMedia. The served URL is /api/shot/{shotId}.{ext}.
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

  const { src } = await writeGuideBlockMedia(
    data.cardId,
    data.blockIndex,
    `/api/shot/${data.shotId}.${data.ext}`,
    data.caption,
  );
  return { ok: true as const, src };
}

// ── Desktop capture (OTD Capture app) ──────────────────────────────────────
// The lesson "+" calls this; it returns the block's description (what to
// capture — shown in the app, becomes the caption) plus a token scoped to this
// one block. The client builds the otd-capture:// deep link from the result.
const captureSessionInputSchema = z.object({
  cardId: z.cuid(),
  blockIndex: z.number().int().nonnegative(),
  kind: z.enum(["image", "video"]),
});

export async function createCaptureSession(input: unknown) {
  const data = captureSessionInputSchema.parse(input);
  await requireAdmin();

  const card = await db.guideCard.findUniqueOrThrow({
    where: { id: data.cardId },
    select: { contentBlocks: true },
  });
  const blocks = guideContentBlocksSchema.parse(card.contentBlocks);
  const block = blocks[data.blockIndex];
  if (!block || (block.type !== "image" && block.type !== "video")) {
    throw new Error("Target block is not an image or video block.");
  }

  const token = signCaptureToken({
    cardId: data.cardId,
    blockIndex: data.blockIndex,
    kind: data.kind,
  });
  return {
    token,
    kind: data.kind,
    // The author's "what to capture" note guides the shot AND becomes the caption.
    hint: block.captureHint ?? "",
    caption: block.caption ?? "",
    // Aspect is LOCKED by the placeholder — the capture tool obeys, can't change it.
    aspect: block.aspect ?? (data.kind === "video" ? "16:9" : "16:10"),
  };
}
