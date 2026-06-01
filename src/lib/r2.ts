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
