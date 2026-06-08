"use server";

// KiCad export server action (export-engine Task 8, design §1, §3).
//
// `exportKicad({ revisionId })` is the deliberate, auth-gated entrypoint that
// turns a revision's BOM + curated assets + verified rails into a downloadable
// `BOM_EXPORT` artifact:
//   1. requireUser (signed-in gate — mirrors every other action).
//   2. buildKicadExportZip(revisionId) — the pure-ish assembler (DB + R2 reads,
//      no mutation). Returns the zip Buffer + coverage + report.
//   3. PutObject the zip to R2 at `exports/{revisionId}/kicad-{cuid}.zip`
//      (content-type `application/zip`) — mirrors the r2.ts client / part-r2
//      helper shape.
//   4. Create a revision-owned Artifact (kind: FILE, subkind: BOM_EXPORT, stage
//      BOM_SOURCING, fileKey/fileMime/fileBytes) — mirrors the recordArtifact
//      FILE shape. The DB stamps `createdAt`; we use the asset coverage counts
//      (NOT Date.now()) in the title so the action stays test-deterministic.
//   5. revalidatePath the owning revision page → the artifacts pane shows it.
//
// NB: a "use server" module may export ONLY async functions — the Zod envelope
// + the R2 key helper live as module-private consts/functions below (never
// exported), so Next's server-actions transform never tries to register them.

import { createId } from "@paralleldrive/cuid2";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Artifact } from "@prisma/client";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-helpers";
import { ensureR2Enabled, putR2Object } from "@/lib/part-r2";
import { buildKicadExportZip } from "@/lib/kicad/export";

const EXPORT_MIME = "application/zip";

// Strict envelope: a typo'd key is rejected, not silently dropped.
const exportKicadSchema = z.object({ revisionId: z.cuid() }).strict();

/** R2 key for an export zip: `exports/{revisionId}/kicad-{cuid}.zip`. Mirrors
 *  the `parts/...`/`revisions/...` key shapes in `r2.ts`. */
function exportKey(revisionId: string, cuid: string): string {
  return `exports/${revisionId}/kicad-${cuid}.zip`;
}

/**
 * Generate + store a KiCad export for a revision and record it as a
 * revision-owned `BOM_EXPORT` FILE artifact. Returns the created Artifact row.
 */
export async function exportKicad(input: unknown): Promise<Artifact> {
  const { revisionId } = exportKicadSchema.parse(input);
  const user = await requireAdmin();
  ensureR2Enabled();

  // The revision must exist (a clean error beats a deep Prisma failure) and
  // gives us the route to revalidate.
  const revision = await db.revision.findUniqueOrThrow({
    where: { id: revisionId },
    select: {
      label: true,
      project: { select: { slug: true } },
    },
  });

  // Build the zip (DB + R2 reads only).
  const { zip, coverage } = await buildKicadExportZip(revisionId);

  // PUT the zip to R2.
  const key = exportKey(revisionId, createId());
  await putR2Object(key, zip, EXPORT_MIME);

  // Record the artifact. Title carries the part count (deterministic — no
  // Date.now()); the DB-set createdAt is the timestamp of record.
  const artifact = await db.artifact.create({
    data: {
      revisionId,
      stage: "BOM_SOURCING",
      kind: "FILE",
      subkind: "BOM_EXPORT",
      title: `KiCad export (${coverage.length} parts)`,
      fileKey: key,
      fileMime: EXPORT_MIME,
      fileBytes: zip.byteLength,
      createdBy: user.id,
    },
  });

  revalidatePath(
    `/projects/${revision.project.slug}/${encodeURIComponent(revision.label)}`,
  );

  return artifact;
}
