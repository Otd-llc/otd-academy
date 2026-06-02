"use server";

// Guide + GuideCard server actions (learner-guide M4).
//
// Mirrors `materializeCanonicalChecklist` / `editChecklistItem` /
// `reorderChecklistItems` in `checklists.ts`:
//   - `requireUser` for the audit `createdById`.
//   - Every mutation runs inside a Serializable `db.$transaction` wrapped in
//     `withTxRetry` for the SSI retry loop.
//   - `assertNotFrozen` guards the owning Revision before any write.
//   - `revalidatePath` refreshes the affected guide route on success.
//
// materializeGuide turns the composed template (`composeGuide`) into a real
// revision-scoped Guide + GuideCard[] row-set. The `Guide.revisionId @unique`
// constraint makes the guide one-per-revision; we both pre-check (friendly
// error) AND catch the P2002 unique violation (race-safe) so two concurrent
// callers can't both insert.
//
// editGuideCard patches only the supplied fields of a single card, resolving
// the owning revision via `card.guide.revisionId` for the freeze guard.
//
// reorderGuideCards copies the two-pass negative-scratch swap from
// `reorderChecklistItems`: the `@@unique([guideId, ordinal])` constraint can't
// tolerate two cards sharing an ordinal mid-transaction, so pass 1 flips every
// ordinal to `-(ordinal + 1)` (disjoint from any non-negative target) and pass
// 2 writes the final 0..N-1 order.

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { assertNotFrozen } from "@/lib/assertions";
import { withTxRetry } from "@/lib/tx-retry";
import { materializeGuideSchema } from "@/lib/schemas/guide";
import { composeGuide } from "@/lib/guide-templates/compose";

const GUIDE_EXISTS_MESSAGE = "A guide already exists for this revision.";

// Revalidate the guide route for a revision (slug + url-encoded label).
async function revalidateGuideRoute(revisionId: string): Promise<void> {
  const rev = await db.revision.findUniqueOrThrow({
    where: { id: revisionId },
    select: {
      label: true,
      project: { select: { slug: true } },
    },
  });
  revalidatePath(
    `/projects/${rev.project.slug}/${encodeURIComponent(rev.label)}/guide`,
  );
}

// ─── materializeGuide ──────────────────────────────────

export async function materializeGuide(input: unknown) {
  const { revisionId } = materializeGuideSchema.parse(input);
  const user = await requireUser();

  const guide = await withTxRetry(() =>
    db.$transaction(
      async (tx) => {
        await assertNotFrozen(tx, revisionId);

        const rev = await tx.revision.findUniqueOrThrow({
          where: { id: revisionId },
          select: {
            project: {
              select: {
                slug: true,
                name: true,
                track: true,
                requiresStripboard: true,
                disciplineTaught: true,
              },
            },
          },
        });

        // Pre-check dedupe: friendly error when a guide already exists.
        const existing = await tx.guide.findUnique({
          where: { revisionId },
          select: { id: true },
        });
        if (existing) throw new Error(GUIDE_EXISTS_MESSAGE);

        const composed = composeGuide({
          slug: rev.project.slug,
          name: rev.project.name,
          track: rev.project.track,
          requiresStripboard: rev.project.requiresStripboard,
          disciplineTaught: rev.project.disciplineTaught,
        });

        try {
          return await tx.guide.create({
            data: {
              revisionId,
              title: composed.title,
              trackSnapshot: composed.trackSnapshot,
              createdById: user.id,
              cards: {
                create: composed.cards.map((c) => ({
                  stage: c.stage as Prisma.GuideCardCreateManyGuideInput["stage"],
                  ordinal: c.ordinal,
                  eyebrow: c.eyebrow,
                  title: c.title,
                  lead: c.lead ?? null,
                  contentBlocks: c.contentBlocks as Prisma.InputJsonValue,
                  isGate: c.isGate,
                  completionRef: (c.completionRef ??
                    Prisma.JsonNull) as Prisma.InputJsonValue,
                })),
              },
            },
          });
        } catch (e) {
          // Race-safe dedupe: the unique index on Guide.revisionId catches a
          // concurrent inserter that slipped past the pre-check above.
          if (
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === "P2002"
          ) {
            throw new Error(GUIDE_EXISTS_MESSAGE);
          }
          throw e;
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );

  await revalidateGuideRoute(revisionId);
  return guide;
}
