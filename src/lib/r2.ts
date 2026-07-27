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
  // Without these the SDK waits indefinitely, and no call site passes an
  // abortSignal — so a slow or unreachable R2 pinned a whole function invocation
  // per request across every call site, including the PUBLIC asset proxies where
  // an anonymous visitor can trigger it. Set on the client so all of them are
  // covered at once. Plain-object form (the SDK builds the NodeHttpHandler
  // itself), so this needs no extra @smithy dependency.
  requestHandler: {
    // Time to establish the socket — a genuinely unreachable endpoint fails fast.
    connectionTimeout: 3000,
    // Socket INACTIVITY, not total transfer time, so streaming a large asset
    // through the proxy is unaffected as long as bytes keep arriving.
    //
    // Deliberately socketTimeout and not requestTimeout: in @smithy/node-http-handler
    // a bare `requestTimeout` only logs a warning and lets the request run on — it
    // aborts only when paired with `throwOnRequestTimeout: true`. socketTimeout
    // rejects on its own. A total-duration cap is left off on purpose; it would
    // kill legitimate large asset streams.
    socketTimeout: 10000,
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

// Derived-render key for a MODEL_3D Artifact's .glb (board stub; sibling of
// artifactKey). Reuses the same {revisions|builds}/{ownerId}/{stage} folder so
// the render lives next to the source file it was derived from.
//   {folder}/{ownerId}/{stage}/render-{cuid}.glb
export function artifactRenderKey(
  owner: { kind: "revision" | "build"; id: string },
  stage: string,
  cuid: string,
): string {
  const folder = owner.kind === "revision" ? "revisions" : "builds";
  return `${folder}/${owner.id}/${stage}/render-${cuid}.glb`;
}

// Enrollment-scoped learner proof artifact key (Slice 4). Mirrors artifactKey
// but under an `enrollments/` prefix so learner uploads never collide with the
// author/reference `revisions/`|`builds/` trees.
//   enrollments/{enrollmentId}/{stage}/{cuid}-{slug(filename)}
export function enrollmentArtifactKey(
  enrollmentId: string,
  stage: string,
  cuid: string,
  filename: string,
): string {
  return `enrollments/${enrollmentId}/${stage}/${cuid}-${slug(filename)}`;
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

// Derived-render key for a part's MODEL_3D .glb (sibling of partAssetKey).
//   parts/{partId}/model_3d_render-{cuid}.glb
export function partRenderKey(partId: string, cuid: string): string {
  return `parts/${partId}/model_3d_render-${cuid}.glb`;
}

// User avatar key — deterministic (one per user). Served PUBLICLY via
// /api/avatar/{userId} (like guide shots, NOT presigned) so a signed-out returning
// visitor's C1 "welcome back" avatar loads too. Re-upload overwrites the same
// object; the User.avatarUpdatedAt timestamp busts client caches (?v=…).
//   avatars/{userId}.webp
export function userAvatarKey(userId: string): string {
  return `avatars/${userId}.webp`;
}

// Guide screenshot/clip key (admin in-app capture). A flat, content-addressed
// tree keyed only by a per-capture cuid — these are public lesson media, served
// (with long-cache headers) through `/api/shot/{cuid}`, NOT presigned. `.webp`
// for screenshots; the same shape extends to `.webm`/`.mp4` clips later.
//   guide-shots/{cuid}.{ext}
export function guideShotKey(cuid: string, ext = "webp"): string {
  return `guide-shots/${cuid}.${ext}`;
}
