"use server";

// Admin actions for the board's VERIFIED REFERENCE ASSETS — the proven Gerber
// set AND the bring-up measurements CSV a learner can download to order the
// exact board (or check their own readings) instead of betting on their own
// export. Stored as a GERBER_ZIP / BRINGUP_MEASUREMENTS_CSV Artifact on the
// project's PUBLISHED (reference) revision and served read-only by the matching
// learner-resources resolver.
//
// DELIBERATE FREEZE EXCEPTION: the published reference revision is frozen
// (frozenAt set), and the normal upload path (createUploadUrl/recordArtifact)
// hard-refuses frozen revisions. But verified reference assets are admin-curated
// answer-key material that legitimately lands AFTER a board publishes (you don't
// have the proven set until the reference board is actually fabricated). So
// these two actions intentionally SKIP assertNotFrozen — scoped tightly:
// requireAdmin, GERBER_ZIP or BRINGUP_MEASUREMENTS_CSV subkind only,
// published-revision target only. They do NOT touch the learner work-gate or any
// build; they only add/replace a reference download. Re-upload supersedes (the
// resolver serves the newest), so "update" is just another upload.
import { z } from "zod";
import { HeadObjectCommand, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createId } from "@paralleldrive/cuid2";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { env } from "@/env";
import { requireAdmin } from "@/lib/auth-helpers";
import { ensureR2Enabled } from "@/lib/part-r2";
import { r2, artifactKey } from "@/lib/r2";
import { MAX_UPLOAD_BYTES } from "@/lib/schemas/upload";

const ASSET_CONFIG = {
  gerbers: {
    subkind: "GERBER_ZIP",
    stage: "DRC_GERBER", // GERBER_ZIP's home stage (revision-allowed)
  },
  measurements: {
    subkind: "BRINGUP_MEASUREMENTS_CSV",
    stage: "BRINGUP", // bring-up data's home stage (revision-allowed)
  },
} as const;
type ReferenceAssetKind = keyof typeof ASSET_CONFIG;
const referenceAssetKind = z.enum(["gerbers", "measurements"]);
const PUT_TTL_SECONDS = 900; // 15 min

const presignSchema = z.object({
  kind: referenceAssetKind,
  projectId: z.cuid(),
  filename: z.string().trim().min(1).max(200),
  mime: z.string().trim().min(1).max(120),
  sizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
});

const recordSchema = z.object({
  kind: referenceAssetKind,
  projectId: z.cuid(),
  key: z.string().trim().min(1).max(500),
  filename: z.string().trim().min(1).max(200),
  mime: z.string().trim().min(1).max(120),
  sizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
});

async function publishedRevisionIdOrThrow(projectId: string): Promise<string> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { publishedRevisionId: true },
  });
  if (!project?.publishedRevisionId) {
    throw new Error("This board has no published revision to attach gerbers to.");
  }
  return project.publishedRevisionId;
}

/** Presign a PUT for a reference-asset upload onto the published revision. */
export async function createReferenceAssetUploadUrl(input: unknown) {
  const data = presignSchema.parse(input);
  await requireAdmin();
  ensureR2Enabled();

  const cfg = ASSET_CONFIG[data.kind as ReferenceAssetKind];
  const revisionId = await publishedRevisionIdOrThrow(data.projectId);
  const cuid = createId();
  const key = artifactKey({ kind: "revision", id: revisionId }, cfg.stage, cuid, data.filename);

  const uploadUrl = await getSignedUrl(
    r2,
    new PutObjectCommand({
      Bucket: env.R2_BUCKET!,
      Key: key,
      ContentLength: data.sizeBytes,
      ContentType: data.mime,
    }),
    { expiresIn: PUT_TTL_SECONDS },
  );

  return { uploadUrl, key, filename: data.filename, mime: data.mime, sizeBytes: data.sizeBytes };
}

/** Record the uploaded reference asset as a freeze-exempt artifact (per-kind subkind). */
export async function recordReferenceAsset(input: unknown) {
  const data = recordSchema.parse(input);
  const user = await requireAdmin();
  ensureR2Enabled();

  const cfg = ASSET_CONFIG[data.kind as ReferenceAssetKind];

  // HEAD-verify the object exists + actual size (R2 doesn't always enforce
  // Content-Length on presigned PUTs); delete + refuse an oversize orphan.
  const head = await r2.send(new HeadObjectCommand({ Bucket: env.R2_BUCKET!, Key: data.key }));
  const actualSize = head.ContentLength ?? 0;
  if (actualSize <= 0 || actualSize > data.sizeBytes || actualSize > MAX_UPLOAD_BYTES) {
    await r2.send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET!, Key: data.key })).catch(() => {});
    throw new Error(`Upload failed verification (${actualSize} bytes).`);
  }

  const revisionId = await publishedRevisionIdOrThrow(data.projectId);
  const project = await db.project.findUniqueOrThrow({
    where: { id: data.projectId },
    select: { slug: true },
  });

  // NOTE: deliberately no assertNotFrozen — see the file header.
  const artifact = await db.artifact.create({
    data: {
      revisionId,
      stage: cfg.stage,
      kind: "FILE",
      subkind: cfg.subkind,
      title: data.filename,
      fileKey: data.key,
      fileMime: data.mime,
      fileBytes: actualSize,
      createdBy: user.id,
    },
    select: { id: true },
  });

  revalidatePath(`/learn/${project.slug}/complete`);
  revalidatePath(`/learn/${project.slug}`);
  return { ok: true as const, artifactId: artifact.id };
}
