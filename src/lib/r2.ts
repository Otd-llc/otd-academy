// Cloudflare R2 client + key helpers (design §7, Phase 10 / M8b).
//
// R2 is S3-compatible; we use `@aws-sdk/client-s3` (region `auto`) pointed at
// the account-specific R2 endpoint. The endpoint is **derived at runtime** from
// `R2_ACCOUNT_ID` rather than hardcoded — same code shape works for any
// account once env vars flip.
//
// Object key shape per design §7:
//   - Revision-scoped: `revisions/{revisionId}/{stage}/{cuid}-{slug(filename)}`
//   - Build-scoped:    `builds/{buildId}/{stage}/{cuid}-{slug(filename)}`
//   - The `{cuid}` segment is a per-object unique id minted at presign time
//     (not the Artifact row's `id` — Prisma generates that at insert). The
//     two ids being decoupled is fine; the key is opaque to the row, and the
//     row's `fileKey` is the only lookup.
//
// `slug()` is intentionally aggressive: lowercase + collapse anything not in
// `[a-z0-9.-]` to `-`, trim leading/trailing `-`, fall back to `"file"` for an
// empty result. This means the original filename is recoverable-ish but the
// key segment never contains characters that need URL-encoding or fight with
// the S3 SDK's URL builder.
import { S3Client } from "@aws-sdk/client-s3";
import { env } from "@/env";
import type { PartAssetKindT } from "@/lib/schemas/part-asset";

export const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID!,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
  },
});

export function slug(filename: string): string {
  return (
    filename
      .toLowerCase()
      .replace(/[^a-z0-9.-]+/g, "-")
      .replace(/^-|-$/g, "") || "file"
  );
}

export function artifactKey(
  owner: { kind: "revision" | "build"; id: string },
  stage: string,
  cuid: string,
  filename: string,
): string {
  const folder = owner.kind === "revision" ? "revisions" : "builds";
  return `${folder}/${owner.id}/${stage}/${cuid}-${slug(filename)}`;
}

// Part-scoped datasheet key (design §3.1 / Stage A Task 9). NOT the Artifact
// key — the cached datasheet is net-new infra (`PartDatasheet`), keyed only by
// `partId` (one PDF per part). The `{cuid}` segment is a per-attempt unique id
// minted at presign time, so re-uploading a replacement never collides with a
// stale object; the upsert points `r2Key` at whichever attempt was recorded.
//   parts/{partId}/datasheet-{cuid}.pdf
export function partDatasheetKey(partId: string, cuid: string): string {
  return `parts/${partId}/datasheet-${cuid}.pdf`;
}

// Part-scoped CAD asset key (design §2). parts/{partId}/{kind}-{cuid}.{ext}
// `extOf` already lowercases in production, but the helper strips a leading dot
// and lowercases the ext itself so the key shape is stable for any caller.
export function partAssetKey(
  partId: string, kind: PartAssetKindT, cuid: string, ext: string,
): string {
  const e = (ext.startsWith(".") ? ext.slice(1) : ext).toLowerCase();
  return `parts/${partId}/${kind.toLowerCase()}-${cuid}.${e}`;
}
