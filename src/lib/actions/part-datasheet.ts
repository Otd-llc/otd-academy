"use server";

// PartDatasheet upload server actions (design §3.1 / Stage A Task 9).
//
// The cached datasheet is a single PDF per part on R2. This mirrors the
// revision/build upload pipeline in `actions/uploads.ts` but is PART-scoped:
// it does NOT reuse the `Artifact` model (Artifact is revision/build
// XOR-scoped). Keying is `parts/{partId}/datasheet-{cuid}.pdf`.
//
// Three actions, all `requireUser()`-gated and all `ensureR2Enabled()`-gated:
//
//   1. createPartDatasheetUploadUrl({ partId, filename, byteSize, contentType })
//      → presigned PUT URL + the minted `r2Key`. Validates everything cheap
//      first (Zod, part exists, size cap, PDF contentType) before R2 is
//      touched. PDF-only by construction (the schema literal).
//
//   2. recordPartDatasheet({ partId, r2Key, filename, byteSize }) → upserts the
//      PartDatasheet row after the client PUT succeeds. HEADs the R2 object to
//      confirm it exists + the actual ContentLength doesn't exceed the
//      declared byteSize (load-bearing — R2 has been inconsistent about
//      enforcing presigned Content-Length conditions; cf. uploads.ts
//      recordArtifact). Oversize → DeleteObject + reject. partId is @unique, so
//      a replacement updates r2Key/filename/byteSize in place.
//
//   3. getPartDatasheetDownloadUrl(partId) → presigned GET (short TTL) for the
//      cached PDF, or `null` when R2 is off / no row exists. The `null` return
//      (rather than a throw) is what lets the part page render a graceful
//      fallback to `datasheetUrl` without leaking R2 state to the client.
//
// FALLBACK: when `R2_ENABLED` is off (dev/CI), createPartDatasheetUploadUrl and
// recordPartDatasheet THROW the friendly R2-disabled error (the same one
// uploads.ts throws), the upload UI renders nothing, and provenance anchors on
// `Part.datasheetUrl` + page via ProvenanceFields' sourceUrl path (design §4).
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createId } from "@paralleldrive/cuid2";
import { revalidatePath } from "next/cache";
import { env } from "@/env";
import { db } from "@/lib/db";
import { r2, partDatasheetKey } from "@/lib/r2";
import { requireUser } from "@/lib/auth-helpers";
import { MAX_UPLOAD_BYTES } from "@/lib/schemas/upload";
import {
  createPartDatasheetUploadUrlSchema,
  recordPartDatasheetSchema,
} from "@/lib/schemas/part-datasheet";

const PUT_TTL_SECONDS = 900; // 15 min, mirrors uploads.ts
const GET_TTL_SECONDS = 300; // 5 min, mirrors uploads.ts

// Same friendly error uploads.ts throws when R2 is off. Keep the message in
// sync so the UI / callers see one consistent disabled signal.
function ensureR2Enabled(): void {
  if (!env.R2_ENABLED) {
    throw new Error(
      "R2 file storage is not enabled on this deployment. Set R2_ENABLED=true and configure R2_* credentials.",
    );
  }
  if (!env.R2_BUCKET) {
    throw new Error("R2_BUCKET is not configured.");
  }
}

// ─── createPartDatasheetUploadUrl ──────────────────────

export type CreatePartDatasheetUploadUrlResult = {
  uploadUrl: string;
  r2Key: string;
};

export async function createPartDatasheetUploadUrl(
  input: unknown,
): Promise<CreatePartDatasheetUploadUrlResult> {
  const data = createPartDatasheetUploadUrlSchema.parse(input);
  await requireUser();
  ensureR2Enabled();

  // Server-enforced cap (defense-in-depth — Zod already enforced it).
  if (data.byteSize > MAX_UPLOAD_BYTES) {
    throw new Error(
      `File too large: ${data.byteSize} bytes exceeds ${MAX_UPLOAD_BYTES}.`,
    );
  }

  // Part must exist before we mint a key under its prefix.
  await db.part.findUniqueOrThrow({
    where: { id: data.partId },
    select: { id: true },
  });

  const cuid = createId();
  const r2Key = partDatasheetKey(data.partId, cuid);

  const uploadUrl = await getSignedUrl(
    r2,
    new PutObjectCommand({
      Bucket: env.R2_BUCKET!,
      Key: r2Key,
      ContentLength: data.byteSize,
      ContentType: data.contentType,
    }),
    { expiresIn: PUT_TTL_SECONDS },
  );

  return { uploadUrl, r2Key };
}

// ─── recordPartDatasheet ───────────────────────────────

export async function recordPartDatasheet(input: unknown) {
  const data = recordPartDatasheetSchema.parse(input);
  const user = await requireUser();
  ensureR2Enabled();

  // Part must exist (the @unique partId FK would fail anyway, but a clean
  // 404-ish error beats a Prisma FK violation).
  await db.part.findUniqueOrThrow({
    where: { id: data.partId },
    select: { id: true },
  });

  // HEAD the R2 object to verify it exists + actual size. Load-bearing per
  // design §7 / uploads.ts recordArtifact — R2 has been inconsistent about
  // enforcing Content-Length on presigned PUTs, so the only reliable size
  // check is post-PUT.
  const head = await r2.send(
    new HeadObjectCommand({
      Bucket: env.R2_BUCKET!,
      Key: data.r2Key,
    }),
  );

  const actualSize = head.ContentLength ?? 0;
  if (actualSize > data.byteSize || actualSize > MAX_UPLOAD_BYTES) {
    // Delete the orphan and refuse to record. The row was never written; the
    // user gets a clear error.
    await r2.send(
      new DeleteObjectCommand({
        Bucket: env.R2_BUCKET!,
        Key: data.r2Key,
      }),
    );
    throw new Error(
      `Uploaded file exceeds declared size (${actualSize} > ${data.byteSize}).`,
    );
  }

  // partId is @unique → one cached PDF per part. A replacement updates the
  // pointer in place (the prior R2 object is left orphaned per the design §7
  // no-inline-deletion policy — orphan sweep deferred).
  const datasheet = await db.partDatasheet.upsert({
    where: { partId: data.partId },
    create: {
      partId: data.partId,
      r2Key: data.r2Key,
      filename: data.filename,
      byteSize: actualSize,
      createdById: user.id,
    },
    update: {
      r2Key: data.r2Key,
      filename: data.filename,
      byteSize: actualSize,
    },
  });

  revalidatePath(`/parts/${data.partId}`);
  return datasheet;
}

// ─── getPartDatasheetDownloadUrl ───────────────────────

// Presigned GET for the cached PDF, or `null` when R2 is off or no PartDatasheet
// row exists. Returning `null` (rather than throwing on the disabled / missing
// path) is deliberate: the part page calls this server-side and renders the
// "datasheet (cached)" link only when a URL comes back, falling through to the
// `datasheetUrl` provenance path otherwise.
export async function getPartDatasheetDownloadUrl(
  partId: string,
): Promise<string | null> {
  await requireUser();
  if (!env.R2_ENABLED || !env.R2_BUCKET) return null;

  const datasheet = await db.partDatasheet.findUnique({
    where: { partId },
    select: { r2Key: true },
  });
  if (!datasheet) return null;

  return getSignedUrl(
    r2,
    new GetObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: datasheet.r2Key,
    }),
    { expiresIn: GET_TTL_SECONDS },
  );
}
