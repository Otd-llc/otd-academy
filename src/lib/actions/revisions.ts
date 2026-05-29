"use server";

// Revision server actions.
//
// Phase 5a scope: createRevision (with optional copy-forward of BomLines and
// revision-scoped Artifacts per design §4.3 / §7). Build-scoped Artifacts
// are explicitly NOT copied — they stay tied to the originating Build.
//
// All mutations run inside `db.$transaction({ isolationLevel: "Serializable" })`
// per design §5.3; the new INIT StageTransition row is written in the same
// transaction as the Revision row so the audit trail is internally coherent.

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { createRevisionSchema } from "@/lib/schemas/revision";

export async function createRevision(input: unknown) {
  const data = createRevisionSchema.parse(input);
  const user = await requireUser();

  const { revision, projectSlug } = await db.$transaction(
    async (tx) => {
      // Pre-load the project so we can revalidate its detail page outside
      // the transaction (we need the slug, not just the id).
      const project = await tx.project.findUniqueOrThrow({
        where: { id: data.projectId },
        select: { id: true, slug: true },
      });

      // 1. Insert Revision. currentStage defaults to REQUIREMENTS per schema;
      //    every new rev starts there regardless of copy-forward (design §5.3).
      const rev = await tx.revision.create({
        data: {
          projectId: project.id,
          label: data.label,
          // currentStage / currentStageEnteredAt use schema defaults.
        },
      });

      // 2. INIT StageTransition. fromStage is null per the spec; the snapshot
      //    blob carries the schema version + the timestamp for forward compat.
      await tx.stageTransition.create({
        data: {
          revisionId: rev.id,
          fromStage: null,
          toStage: "REQUIREMENTS",
          direction: "INIT",
          gateSnapshot: {
            v: 1,
            kind: "init",
            ts: new Date().toISOString(),
          },
          transitionedBy: user.id,
        },
      });

      // 3. Copy-forward (BomLines + Revision-scoped Artifacts only).
      if (data.copyForwardFromRevisionId) {
        const sourceBomLines = await tx.bomLine.findMany({
          where: { revisionId: data.copyForwardFromRevisionId },
        });
        if (sourceBomLines.length > 0) {
          await tx.bomLine.createMany({
            data: sourceBomLines.map((src) => ({
              revisionId: rev.id,
              partId: src.partId,
              refDes: src.refDes,
              quantity: src.quantity,
              notes: src.notes,
              createdById: user.id,
            })),
          });
        }

        // Revision-scoped artifacts ONLY: buildId IS NULL.
        // Build-scoped artifacts stay tied to their original Build per §7 + §4.3.
        const sourceArtifacts = await tx.artifact.findMany({
          where: {
            revisionId: data.copyForwardFromRevisionId,
            buildId: null,
          },
        });
        for (const src of sourceArtifacts) {
          await tx.artifact.create({
            data: {
              revisionId: rev.id,
              // buildId omitted → null; XOR check satisfied.
              stage: src.stage,
              kind: src.kind,
              subkind: src.subkind,
              title: src.title,
              fileKey: src.fileKey,
              fileMime: src.fileMime,
              fileBytes: src.fileBytes,
              noteBody: src.noteBody,
              linkUrl: src.linkUrl,
              createdBy: user.id,
            },
          });
        }
      }

      return { revision: rev, projectSlug: project.slug };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  // Revalidate the parent project page (revision list) and the new rev URL.
  revalidatePath(`/projects/${projectSlug}`);
  revalidatePath(`/projects/${projectSlug}/${revision.label}`);

  return revision;
}
