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
import {
  editGuideCardSchema,
  materializeGuideSchema,
  reorderGuideCardsSchema,
} from "@/lib/schemas/guide";
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

// ─── editGuideCard ─────────────────────────────────────
//
// Mirrors `editChecklistItem`: resolve the owning revision via
// `card.guide.revisionId`, freeze-guard it, then patch ONLY the fields the
// caller supplied. `contentBlocks` arrives already Zod-validated by
// `editGuideCardSchema`; `lead`/`completionRef` honor the null-clears /
// undefined-leaves-alone convention.

export async function editGuideCard(input: unknown) {
  const data = editGuideCardSchema.parse(input);
  await requireUser();

  const updated = await withTxRetry(() =>
    db.$transaction(
      async (tx) => {
        const existing = await tx.guideCard.findUniqueOrThrow({
          where: { id: data.id },
          select: { id: true, guide: { select: { revisionId: true } } },
        });
        const revisionId = existing.guide.revisionId;
        await assertNotFrozen(tx, revisionId);

        const patch: Prisma.GuideCardUpdateInput = {};
        if (data.eyebrow !== undefined) patch.eyebrow = data.eyebrow;
        if (data.title !== undefined) patch.title = data.title;
        if (data.lead !== undefined) patch.lead = data.lead;
        if (data.isGate !== undefined) patch.isGate = data.isGate;
        if (data.contentBlocks !== undefined) {
          patch.contentBlocks = data.contentBlocks as Prisma.InputJsonValue;
        }
        if (data.completionRef !== undefined) {
          patch.completionRef = (data.completionRef ??
            Prisma.JsonNull) as Prisma.InputJsonValue;
        }

        return tx.guideCard.update({ where: { id: data.id }, data: patch });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );

  const owner = await db.guideCard.findUniqueOrThrow({
    where: { id: updated.id },
    select: { guide: { select: { revisionId: true } } },
  });
  await revalidateGuideRoute(owner.guide.revisionId);
  return updated;
}

// ─── reorderGuideCards ─────────────────────────────────
//
// Copy of `reorderChecklistItems`' two-pass negative-scratch swap, substituting
// `guideCard`/`guideId`. The `@@unique([guideId, ordinal])` constraint cannot
// tolerate two cards sharing an ordinal mid-transaction, so:
//   pass 1 ─ flip every ordinal to `-(ordinal + 1)` (range [-N..-1], disjoint
//            from any non-negative target);
//   pass 2 ─ write the final 0..N-1 order from the supplied id sequence.
// The supplied id-set must be exhaustive (no partial reorder, no foreign rows).

export async function reorderGuideCards(input: unknown) {
  const data = reorderGuideCardsSchema.parse(input);
  await requireUser();

  const cards = await withTxRetry(() =>
    db.$transaction(
      async (tx) => {
        const guide = await tx.guide.findUniqueOrThrow({
          where: { id: data.guideId },
          select: { revisionId: true },
        });
        await assertNotFrozen(tx, guide.revisionId);

        // Load all cards so we can verify the supplied id-set is exhaustive
        // (no partial reorder, no foreign rows).
        const existing = await tx.guideCard.findMany({
          where: { guideId: data.guideId },
          select: { id: true, ordinal: true },
        });
        const existingIds = new Set(existing.map((c) => c.id));
        const suppliedIds = new Set(data.orderedIds);

        if (existing.length !== data.orderedIds.length) {
          throw new Error(
            `Reorder list must include every card on the guide (expected ${existing.length}, got ${data.orderedIds.length}).`,
          );
        }
        for (const id of data.orderedIds) {
          if (!existingIds.has(id)) {
            throw new Error(
              "Reorder list contains an id that is not on the guide.",
            );
          }
        }
        // Belt-and-braces: every existing row must also appear in the
        // supplied order.
        for (const row of existing) {
          if (!suppliedIds.has(row.id)) {
            throw new Error(
              "Reorder list is missing one or more existing card ids.",
            );
          }
        }

        // Pass 1: flip every ordinal to its negative-scratch value so pass 2
        // can write 0..N-1 without violating the unique constraint mid-stream.
        for (const row of existing) {
          await tx.guideCard.update({
            where: { id: row.id },
            data: { ordinal: -(row.ordinal + 1) },
          });
        }

        // Pass 2: write the final order.
        for (let i = 0; i < data.orderedIds.length; i++) {
          const id = data.orderedIds[i]!;
          await tx.guideCard.update({
            where: { id },
            data: { ordinal: i },
          });
        }

        return tx.guideCard.findMany({
          where: { guideId: data.guideId },
          orderBy: { ordinal: "asc" },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );

  const guide = await db.guide.findUniqueOrThrow({
    where: { id: data.guideId },
    select: { revisionId: true },
  });
  await revalidateGuideRoute(guide.revisionId);
  return cards;
}
