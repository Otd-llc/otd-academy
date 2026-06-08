"use server";

// R2 upload server actions (design §7, Phase 10 / M8b).
//
// Three actions live here. They follow the same defense-in-depth pattern as
// the rest of the action layer (cf. createArtifact in actions/artifacts.ts):
//
//   1. createUploadUrl(input) → presigned PUT URL + token. Validates
//      everything we can before R2 is touched: Zod, ownerMatches, size cap,
//      freeze. Mints a per-object cuid so the key is unique per attempt
//      regardless of filename collisions.
//
//   2. recordArtifact(token) → inserts the Artifact row after the client PUT
//      succeeds. Re-validates ownerMatches + freeze (defense-in-depth
//      against forged tokens — design §7 step 8), and HEADs the R2 object
//      to confirm the uploaded ContentLength doesn't exceed what was
//      declared. Oversize → R2 DeleteObject + reject. The HEAD check is
//      load-bearing because Cloudflare R2 has historically been
//      inconsistent about enforcing presigned `Content-Length` conditions.
//
//   3. getDownloadUrl(artifactId) → presigned GET URL (5-min TTL) for FILE-
//      kind artifacts. Auth-gated only; we don't re-check freeze on read.
//
// Phase 1 policy: no inline R2 deletion when an Artifact row is deleted
// (design §7). Orphan sweep deferred. Don't add deletion here.
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createId } from "@paralleldrive/cuid2";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { env } from "@/env";
import { db } from "@/lib/db";
import { r2, artifactKey, artifactRenderKey } from "@/lib/r2";
import { ownerMatches } from "@/lib/artifacts";
import { requireUser, requireAdmin } from "@/lib/auth-helpers";
import { assertBuildNotFrozen, assertNotFrozen } from "@/lib/assertions";
import { withTxRetry } from "@/lib/tx-retry";
import { RENDER_MIME, RENDER_MAX_BYTES } from "@/lib/schemas/render";
import {
  createUploadUrlSchema,
  createArtifactRenderUploadUrlSchema,
  MAX_UPLOAD_BYTES,
  recordArtifactSchema,
} from "@/lib/schemas/upload";

const PUT_TTL_SECONDS = 900; // 15 min, design §7 step 4
const GET_TTL_SECONDS = 300; // 5 min, design §7

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

// Resolve the owning revision id for freeze-policy assertions. Build-owned
// artifacts inherit a frozen Revision via cascade (design §5.3), so we
// always assert both: assertNotFrozen on the revision, then
// assertBuildNotFrozen if the artifact is build-scoped.
async function loadRevisionIdForOwner(
  tx: Prisma.TransactionClient,
  owner: { kind: "revision" | "build"; id: string },
): Promise<string> {
  if (owner.kind === "revision") return owner.id;
  const build = await tx.build.findUniqueOrThrow({
    where: { id: owner.id },
    select: { revisionId: true },
  });
  return build.revisionId;
}

async function loadRevisionRoute(
  tx: Prisma.TransactionClient,
  revisionId: string,
) {
  const rev = await tx.revision.findUniqueOrThrow({
    where: { id: revisionId },
    select: {
      label: true,
      project: { select: { slug: true } },
    },
  });
  return { projectSlug: rev.project.slug, revLabel: rev.label };
}

async function loadBuildRoute(
  tx: Prisma.TransactionClient,
  buildId: string,
) {
  const build = await tx.build.findUniqueOrThrow({
    where: { id: buildId },
    select: {
      label: true,
      revision: {
        select: {
          label: true,
          project: { select: { slug: true } },
        },
      },
    },
  });
  return {
    projectSlug: build.revision.project.slug,
    revLabel: build.revision.label,
    buildLabel: build.label,
  };
}

// ─── createUploadUrl ───────────────────────────────────

export type CreateUploadUrlResult = {
  uploadUrl: string;
  key: string;
  cuid: string;
  owner: { kind: "revision" | "build"; id: string };
  stage: string;
  subkind: string;
  sizeBytes: number;
  mime: string;
  filename: string;
};

export async function createUploadUrl(
  input: unknown,
): Promise<CreateUploadUrlResult> {
  const data = createUploadUrlSchema.parse(input);
  await requireAdmin();
  ensureR2Enabled();

  // Cross-check #1: owner kind ↔ subkind (design §7 step 2). Run before any
  // R2 call so a forged payload gets the cheapest possible rejection.
  if (!ownerMatches(data.subkind, data.owner.kind)) {
    throw new Error(
      `Subkind ${data.subkind} is not valid for ${data.owner.kind}-owned artifacts.`,
    );
  }

  // Server-enforced cap (defense-in-depth — Zod already enforced it).
  if (data.sizeBytes > MAX_UPLOAD_BYTES) {
    throw new Error(
      `File too large: ${data.sizeBytes} bytes exceeds ${MAX_UPLOAD_BYTES}.`,
    );
  }

  // Freeze guards. Wrap the SELECT-only checks in a short read transaction
  // so concurrent freeze + presign races resolve consistently.
  await withTxRetry(() =>
    db.$transaction(
      async (tx) => {
        const revisionId = await loadRevisionIdForOwner(tx, data.owner);
        await assertNotFrozen(tx, revisionId);
        if (data.owner.kind === "build") {
          await assertBuildNotFrozen(tx, data.owner.id);
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );

  const cuid = createId();
  const key = artifactKey(data.owner, data.stage, cuid, data.filename);

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

  return {
    uploadUrl,
    key,
    cuid,
    owner: data.owner,
    stage: data.stage,
    subkind: data.subkind,
    sizeBytes: data.sizeBytes,
    mime: data.mime,
    filename: data.filename,
  };
}

// ─── createArtifactRenderUploadUrl ─────────────────────
//
// Board stub. Mints a presigned PUT for an Artifact's DERIVED .glb render
// (produced client-side by `convertToGlb`). Mirrors the part-side
// `createPartAssetRenderUploadUrl`: subkind is implicitly MODEL_3D (only models
// carry a render), the forced content-type is RENDER_MIME ("model/gltf-binary")
// — signed into the PUT and echoed by the client — and the minted `.glb` key is
// returned so the client passes it back to `recordArtifact` as `renderKey`.
// Deliberately thin: no freeze re-check here (the source file's createUploadUrl
// already gated freeze; the render PUT is best-effort and non-load-bearing).

export type CreateArtifactRenderUploadUrlResult = {
  uploadUrl: string;
  renderKey: string;
  contentType: string;
};

export async function createArtifactRenderUploadUrl(
  input: unknown,
): Promise<CreateArtifactRenderUploadUrlResult> {
  const data = createArtifactRenderUploadUrlSchema.parse(input);
  await requireAdmin();
  ensureR2Enabled();

  const renderKey = artifactRenderKey(data.owner, data.stage, createId());
  const uploadUrl = await getSignedUrl(
    r2,
    new PutObjectCommand({
      Bucket: env.R2_BUCKET!,
      Key: renderKey,
      ContentLength: data.byteSize,
      ContentType: RENDER_MIME,
    }),
    { expiresIn: PUT_TTL_SECONDS },
  );
  return { uploadUrl, renderKey, contentType: RENDER_MIME };
}

// ─── recordArtifact ────────────────────────────────────

export async function recordArtifact(input: unknown) {
  const data = recordArtifactSchema.parse(input);
  const user = await requireAdmin();
  ensureR2Enabled();

  // Defense-in-depth: re-check owner ↔ subkind. The token's `subkind` /
  // `owner.kind` could be tampered with; this catches that before HEAD.
  if (!ownerMatches(data.subkind, data.owner.kind)) {
    throw new Error(
      `Subkind ${data.subkind} is not valid for ${data.owner.kind}-owned artifacts.`,
    );
  }

  // HEAD the R2 object to verify it exists + actual size. This is load-
  // bearing per design §7 — R2 has been inconsistent about enforcing
  // Content-Length on presigned PUTs, so the only reliable size check is
  // post-PUT.
  const head = await r2.send(
    new HeadObjectCommand({
      Bucket: env.R2_BUCKET!,
      Key: data.key,
    }),
  );

  const actualSize = head.ContentLength ?? 0;
  if (actualSize > data.sizeBytes || actualSize > MAX_UPLOAD_BYTES) {
    // Delete the orphan and refuse to record. Best-effort: the row was
    // never inserted, the user gets a clear error.
    await r2.send(
      new DeleteObjectCommand({
        Bucket: env.R2_BUCKET!,
        Key: data.key,
      }),
    );
    throw new Error(
      `Uploaded file exceeds declared size (${actualSize} > ${data.sizeBytes}).`,
    );
  }

  // Board stub: optional DERIVED .glb render (present only when the client's
  // MODEL_3D conversion succeeded). HEAD-verify the render object — best-effort,
  // null-on-failure (mirrors the part side): a failed/oversize/missing render
  // simply drops the render columns; the FILE record ALWAYS proceeds. The render
  // is non-load-bearing and must NEVER block recording the source file.
  let render: {
    renderKey: string;
    renderBytes: number;
    renderMime: string;
    renderBounds: unknown;
  } | null = null;
  if (data.renderKey && data.renderBytes) {
    try {
      const renderHead = await r2.send(
        new HeadObjectCommand({
          Bucket: env.R2_BUCKET!,
          Key: data.renderKey,
        }),
      );
      const actualRender = renderHead.ContentLength ?? 0;
      if (actualRender > 0 && actualRender <= RENDER_MAX_BYTES) {
        render = {
          renderKey: data.renderKey,
          renderBytes: actualRender,
          renderMime: RENDER_MIME,
          renderBounds: data.renderBounds ?? null,
        };
      }
    } catch {
      render = null; // render is non-load-bearing; never block the source record
    }
  }

  const artifact = await withTxRetry(() =>
    db.$transaction(
      async (tx) => {
        // Freeze re-check inside the tx: catches any freeze that landed
        // between createUploadUrl and recordArtifact. R2 object is
        // orphaned per design §7 in-flight-during-freeze policy.
        const revisionId = await loadRevisionIdForOwner(tx, data.owner);
        await assertNotFrozen(tx, revisionId);
        if (data.owner.kind === "build") {
          await assertBuildNotFrozen(tx, data.owner.id);
        }

        return tx.artifact.create({
          data: {
            revisionId: data.owner.kind === "revision" ? data.owner.id : null,
            buildId: data.owner.kind === "build" ? data.owner.id : null,
            stage: data.stage,
            kind: "FILE",
            subkind: data.subkind,
            title: data.title,
            fileKey: data.key,
            fileMime: data.mime,
            fileBytes: actualSize,
            createdBy: user.id,
            // Board stub: derived render columns (null when no render passed /
            // verify failed). Existing FILE/NOTE/LINK records leave these null.
            renderKey: render?.renderKey ?? null,
            renderBytes: render?.renderBytes ?? null,
            renderMime: render?.renderMime ?? null,
            renderBounds:
              (render?.renderBounds ?? null) === null
                ? Prisma.JsonNull
                : (render!.renderBounds as Prisma.InputJsonValue),
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );

  // Revalidate the owning detail page so the new FILE row shows up.
  if (artifact.revisionId) {
    const route = await loadRevisionRoute(db, artifact.revisionId);
    revalidatePath(
      `/projects/${route.projectSlug}/${encodeURIComponent(route.revLabel)}`,
    );
  } else if (artifact.buildId) {
    const route = await loadBuildRoute(db, artifact.buildId);
    revalidatePath(
      `/projects/${route.projectSlug}/${encodeURIComponent(route.revLabel)}/builds/${encodeURIComponent(route.buildLabel)}`,
    );
  }

  return artifact;
}

// ─── getDownloadUrl ────────────────────────────────────

export async function getDownloadUrl(artifactId: string): Promise<string> {
  await requireUser();
  ensureR2Enabled();

  const artifact = await db.artifact.findUniqueOrThrow({
    where: { id: artifactId },
    select: { kind: true, fileKey: true },
  });

  if (artifact.kind !== "FILE" || !artifact.fileKey) {
    throw new Error("Artifact is not a file.");
  }

  return getSignedUrl(
    r2,
    new GetObjectCommand({
      Bucket: env.R2_BUCKET!,
      Key: artifact.fileKey,
    }),
    { expiresIn: GET_TTL_SECONDS },
  );
}

// ─── getArtifactRenderUrl ──────────────────────────────
//
// Board stub. INLINE presigned GET (no Content-Disposition) for a MODEL_3D
// Artifact's render `.glb`, or null when R2 is off / the artifact carries no
// render. Mirrors the part-side `getPartAssetRenderUrl`: NOT `requireUser`-gated
// (board renders are viewable like part renders, and the artifact's owning page
// is the auth boundary) and uses a no-disposition GetObjectCommand so the
// browser <ModelViewer> can fetch the bytes inline. `getDownloadUrl` above stays
// auth-gated — only this render resolver is ungated.
export async function getArtifactRenderUrl(
  artifactId: string,
): Promise<string | null> {
  if (!env.R2_ENABLED || !env.R2_BUCKET) return null;
  const artifact = await db.artifact.findUnique({
    where: { id: artifactId },
    select: { renderKey: true },
  });
  if (!artifact?.renderKey) return null;
  return getSignedUrl(
    r2,
    new GetObjectCommand({
      Bucket: env.R2_BUCKET!,
      Key: artifact.renderKey,
    }),
    { expiresIn: GET_TTL_SECONDS },
  );
}
