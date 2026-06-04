// Shared R2 helpers for part CAD asset uploads (Stage C Task 3). These are
// PLAIN helpers (NOT a `"use server"` module) — the `"use server"` asset
// actions in Task 5 (`part-assets.ts`) call these. They reuse the `r2` S3
// client singleton + the validated `env` from `@/lib/r2` / `@/env`. Each helper
// references `env.R2_BUCKET!`; the actions call `ensureR2Enabled()` first, which
// guarantees both `R2_ENABLED` and `R2_BUCKET` are set before any presign/HEAD.
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/env";
import { r2 } from "@/lib/r2";

const PUT_TTL_SECONDS = 900;
const GET_TTL_SECONDS = 300;

export function ensureR2Enabled(): void {
  if (!env.R2_ENABLED) {
    throw new Error("R2 file storage is not enabled on this deployment. Set R2_ENABLED=true and configure R2_* credentials.");
  }
  if (!env.R2_BUCKET) throw new Error("R2_BUCKET is not configured.");
}

export function presignPut(key: string, contentType: string, byteSize: number) {
  return getSignedUrl(r2, new PutObjectCommand({
    Bucket: env.R2_BUCKET!, Key: key, ContentLength: byteSize, ContentType: contentType,
  }), { expiresIn: PUT_TTL_SECONDS });
}

/** HEAD the uploaded object; on oversize (vs declared OR the cap) delete the
 *  orphan and throw. Returns the actual ContentLength to record. */
export async function headVerifySize(key: string, declaredBytes: number, maxBytes: number): Promise<number> {
  const head = await r2.send(new HeadObjectCommand({ Bucket: env.R2_BUCKET!, Key: key }));
  const actual = head.ContentLength ?? 0;
  if (actual > declaredBytes || actual > maxBytes) {
    await r2.send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET!, Key: key }));
    throw new Error(`Uploaded file exceeds declared size (${actual} > ${declaredBytes}).`);
  }
  return actual;
}

/** Presigned GET. When `downloadFilename` is given, signs a
 *  `Content-Disposition: attachment` override so the browser DOWNLOADS the file
 *  (with that name) instead of rendering it inline — the `<a download>` attr is
 *  ignored for cross-origin R2 URLs, so the disposition must be signed in here.
 *  Quotes/CR/LF are stripped from the name to prevent header injection. */
export function presignGet(key: string, downloadFilename?: string) {
  const safeName = downloadFilename?.replace(/["\\\r\n]/g, "");
  return getSignedUrl(
    r2,
    new GetObjectCommand({
      Bucket: env.R2_BUCKET!,
      Key: key,
      ...(safeName
        ? { ResponseContentDisposition: `attachment; filename="${safeName}"` }
        : {}),
    }),
    { expiresIn: GET_TTL_SECONDS },
  );
}

/** Presigned GET WITHOUT a Content-Disposition override → the browser may fetch
 *  the object inline (CORS GET). Used ONLY for the derived `.glb` render that
 *  <ModelViewer> loads; every human-facing download uses `presignGet(key, name)`
 *  (attachment). Identical to `presignGet(key)` with no filename — named for
 *  intent so a future reader doesn't "tidy" the render path onto the attachment
 *  presign and break in-browser rendering. */
export function presignGetInline(key: string) {
  return presignGet(key);
}

/** Best-effort delete of a single R2 object. DeleteObject is idempotent (a
 *  missing key is a no-op), so callers use this to clean up after a row is
 *  removed; a failure here is swallowed by the caller (orphan swept later). */
export async function deleteR2Object(key: string): Promise<void> {
  await r2.send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET!, Key: key }));
}
