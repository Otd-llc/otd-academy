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
import { s3Target } from "@/lib/r2-target";
import { env } from "@/env";
import type { PartAssetKindT } from "@/lib/schemas/part-asset";

const target = s3Target(env);

export const r2 = new S3Client({
  region: "auto",
  endpoint: target.endpoint,
  forcePathStyle: target.forcePathStyle,
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

// Hex-cluster printable key. The .FCStd sources live in the PRIVATE hardware
// repo and never ship; what ships is the generated mesh set (3MF primary, STL
// fallback, STEP archival) produced by that repo's tools/build_printables.py.
//
// Keyed by an immutable `release` segment (a date, e.g. 2026-07-31) rather than
// overwriting in place. Two reasons: a Printables/MakerWorld listing links a URL
// that must not silently change under people who already downloaded it, and an
// immutable key can be served with a long cache header. Re-cutting the meshes
// mints a NEW release; the old one stays until deliberately purged.
//   printables/{release}/{format}/{part}.{ext}
//   printables/{release}/sets/{set}.zip
export function printableKey(
  release: string, format: "3mf" | "stl" | "step", part: string, ext: string,
): string {
  return `printables/${release}/${format}/${slug(part)}.${ext.replace(/^\./, "").toLowerCase()}`;
}

export function printableSetKey(release: string, set: string): string {
  return `printables/${release}/sets/${slug(set)}.zip`;
}

// The release's standalone CC BY notice. It sits beside the meshes as well as
// inside the set archive: anyone grabbing a single .3mf by URL never opens the
// zip, and CC BY only works if the terms travel with the file. A helper rather
// than a literal because two places name it — the uploader that writes it and
// the /hex page that links it — and they must not drift.
export function printableLicenseKey(release: string): string {
  return `printables/${release}/LICENSE.txt`;
}

// Guide screenshot/clip key (admin in-app capture). A flat, content-addressed
// tree keyed only by a per-capture cuid — these are public lesson media, served
// (with long-cache headers) through `/api/shot/{cuid}`, NOT presigned. `.webp`
// for screenshots; the same shape extends to `.webm`/`.mp4` clips later.
//   guide-shots/{cuid}.{ext}
export function guideShotKey(cuid: string, ext = "webp"): string {
  return `guide-shots/${cuid}.${ext}`;
}
