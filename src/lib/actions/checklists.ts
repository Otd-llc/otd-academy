"use server";

// Checklist + ChecklistItem server actions (design §4.2, §5.2, §9.2/§9.3).
//
// m15 widened scope: full CRUD with the Revision XOR Build XOR Board owner
// split. The ASSEMBLY gate (`STAGES.ASSEMBLY.exitGate`) matches the active
// Build's `POST_ASSEMBLY_CONTINUITY` checklist by `subkind` — NOT by title —
// so the create path here pins the subkind at insert time and editChecklist
// refuses to touch it.
//
// Freeze policy (design §5.3):
//   - Revision-scoped: assert parent Revision not frozen.
//   - Build-scoped: assert parent Revision + Build not frozen.
//   - Board-scoped: resolve `board.buildId`, then assert parent Revision +
//     resolved Build not frozen. Mirrors the artifacts.ts symmetric guard.
//
// Reorder semantics: the `@@unique([checklistId, ordinal])` constraint
// cannot tolerate an intermediate state where two items share an ordinal,
// so the action performs a two-pass swap inside a single Serializable tx:
//   pass 1  ─ flip every item's ordinal to a negative scratch value
//             (`-(currentOrdinal + 1)`) so it's guaranteed disjoint from any
//             non-negative target.
//   pass 2  ─ write the final ordinal (0..N-1) from the supplied id order.
// The two-pass approach is atomic and idempotent — if the second pass were
// to fail partway, the unique index would catch it before the tx commits.
//
// Concurrency: all mutations run inside `withTxRetry` for the SSI retry loop.

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { assertBuildNotFrozen, assertNotFrozen } from "@/lib/assertions";
import { withTxRetry } from "@/lib/tx-retry";
import {
  addChecklistItemSchema,
  createChecklistSchema,
  deleteChecklistItemSchema,
  deleteChecklistSchema,
  editChecklistItemSchema,
  editChecklistSchema,
  reorderChecklistItemsSchema,
} from "@/lib/schemas/checklist";
import { CANONICAL_TEMPLATES } from "@/lib/canonical-checklist-templates";
import { materializeCanonicalChecklistSchema } from "@/lib/schemas/canonical-checklist";

// ─── Route revalidation helpers ────────────────────────

async function revalidateChecklistOwner(
  tx: Prisma.TransactionClient | typeof db,
  revisionId: string | null,
  buildId: string | null,
  boardId: string | null,
): Promise<void> {
  if (revisionId) {
    const rev = await tx.revision.findUniqueOrThrow({
      where: { id: revisionId },
      select: {
        label: true,
        project: { select: { slug: true } },
      },
    });
    revalidatePath(
      `/projects/${rev.project.slug}/${encodeURIComponent(rev.label)}`,
    );
    return;
  }
  if (buildId) {
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
    revalidatePath(
      `/projects/${build.revision.project.slug}/${encodeURIComponent(
        build.revision.label,
      )}/builds/${encodeURIComponent(build.label)}`,
    );
    return;
  }
  if (boardId) {
    const board = await tx.board.findUniqueOrThrow({
      where: { id: boardId },
      select: {
        serial: true,
        build: {
          select: {
            label: true,
            revision: {
              select: {
                label: true,
                project: { select: { slug: true } },
              },
            },
          },
        },
      },
    });
    revalidatePath(
      `/projects/${board.build.revision.project.slug}/${encodeURIComponent(
        board.build.revision.label,
      )}/builds/${encodeURIComponent(board.build.label)}/boards/${encodeURIComponent(board.serial)}`,
    );
  }
}

// Resolve the freeze targets for a checklist row.
//
// m15: three owner shapes are now possible. The dispatch table (per
// proposal §3 #3) is:
//
//   Revision-scoped → assertNotFrozen(rev)
//   Build-scoped    → assertNotFrozen(rev) + assertBuildNotFrozen(build)
//   Board-scoped    → resolve board.buildId → revision; same as Build-scoped
//
// `buildId` is null for revision-scoped rows; callers must skip
// `assertBuildNotFrozen` when it's null. `ownerRevisionId / ownerBuildId /
// ownerBoardId` carry the originating owner ids so the revalidation step
// can route to the right route.
async function resolveChecklistFreezeRefs(
  tx: Prisma.TransactionClient,
  checklistId: string,
): Promise<{
  revisionId: string;
  buildId: string | null;
  ownerRevisionId: string | null;
  ownerBuildId: string | null;
  ownerBoardId: string | null;
}> {
  const checklist = await tx.checklist.findUniqueOrThrow({
    where: { id: checklistId },
    select: {
      revisionId: true,
      buildId: true,
      boardId: true,
      build: { select: { revisionId: true } },
      board: { select: { buildId: true, build: { select: { revisionId: true } } } },
    },
  });

  if (checklist.revisionId) {
    return {
      revisionId: checklist.revisionId,
      buildId: null,
      ownerRevisionId: checklist.revisionId,
      ownerBuildId: null,
      ownerBoardId: null,
    };
  }
  if (checklist.buildId && checklist.build) {
    return {
      revisionId: checklist.build.revisionId,
      buildId: checklist.buildId,
      ownerRevisionId: null,
      ownerBuildId: checklist.buildId,
      ownerBoardId: null,
    };
  }
  if (checklist.boardId && checklist.board) {
    return {
      revisionId: checklist.board.build.revisionId,
      buildId: checklist.board.buildId,
      ownerRevisionId: null,
      ownerBuildId: null,
      ownerBoardId: checklist.boardId,
    };
  }
  // The DB CHECK constraint precludes this, but TypeScript can't see that.
  throw new Error("Checklist has no owner (DB CHECK should preclude).");
}

// ─── createChecklist ───────────────────────────────────

export async function createChecklist(input: unknown) {
  const data = createChecklistSchema.parse(input);
  const user = await requireUser();

  const checklist = await withTxRetry(() =>
    db.$transaction(
      async (tx) => {
        if (data.ownerKind === "revision") {
          // Revision-scoped: only the Revision needs a freeze check; there
          // is no Build to resolve. The CHECK enforces revisionId is the
          // only owner set.
          await assertNotFrozen(tx, data.revisionId);
          return tx.checklist.create({
            data: {
              revisionId: data.revisionId,
              stage: data.stage,
              subkind: data.subkind,
              title: data.title,
              createdById: user.id,
            },
          });
        }

        let revisionId: string;
        let buildId: string;

        if (data.ownerKind === "build") {
          const build = await tx.build.findUniqueOrThrow({
            where: { id: data.buildId },
            select: { revisionId: true },
          });
          revisionId = build.revisionId;
          buildId = data.buildId;
        } else {
          const board = await tx.board.findUniqueOrThrow({
            where: { id: data.boardId },
            select: {
              buildId: true,
              build: { select: { revisionId: true } },
            },
          });
          revisionId = board.build.revisionId;
          buildId = board.buildId;
        }

        await assertNotFrozen(tx, revisionId);
        await assertBuildNotFrozen(tx, buildId);

        return tx.checklist.create({
          data: {
            buildId: data.ownerKind === "build" ? data.buildId : null,
            boardId: data.ownerKind === "board" ? data.boardId : null,
            stage: data.stage,
            subkind: data.subkind,
            title: data.title,
            createdById: user.id,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );

  await revalidateChecklistOwner(
    db,
    checklist.revisionId,
    checklist.buildId,
    checklist.boardId,
  );
  return checklist;
}

// ─── editChecklist ─────────────────────────────────────

export async function editChecklist(input: unknown) {
  const data = editChecklistSchema.parse(input);
  await requireUser();

  const updated = await withTxRetry(() =>
    db.$transaction(
      async (tx) => {
        const refs = await resolveChecklistFreezeRefs(tx, data.id);
        await assertNotFrozen(tx, refs.revisionId);
        if (refs.buildId) await assertBuildNotFrozen(tx, refs.buildId);

        const patch: Prisma.ChecklistUpdateInput = {};
        if (data.title !== undefined) patch.title = data.title;
        return tx.checklist.update({ where: { id: data.id }, data: patch });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );

  await revalidateChecklistOwner(
    db,
    updated.revisionId,
    updated.buildId,
    updated.boardId,
  );
  return updated;
}

// ─── deleteChecklist ───────────────────────────────────

export async function deleteChecklist(input: unknown) {
  const data = deleteChecklistSchema.parse(input);
  await requireUser();

  const refs = await withTxRetry(() =>
    db.$transaction(
      async (tx) => {
        const r = await resolveChecklistFreezeRefs(tx, data.id);
        await assertNotFrozen(tx, r.revisionId);
        if (r.buildId) await assertBuildNotFrozen(tx, r.buildId);
        await tx.checklist.delete({ where: { id: data.id } });
        return r;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );

  await revalidateChecklistOwner(
    db,
    refs.ownerRevisionId,
    refs.ownerBuildId,
    refs.ownerBoardId,
  );
  return { ok: true as const };
}

// ─── addChecklistItem ──────────────────────────────────

export async function addChecklistItem(input: unknown) {
  const data = addChecklistItemSchema.parse(input);
  await requireUser();

  const item = await withTxRetry(() =>
    db.$transaction(
      async (tx) => {
        const refs = await resolveChecklistFreezeRefs(tx, data.checklistId);
        await assertNotFrozen(tx, refs.revisionId);
        if (refs.buildId) await assertBuildNotFrozen(tx, refs.buildId);

        // Compute ordinal server-side when missing. Read the current max
        // inside the same tx — SSI catches a concurrent inserter racing on
        // the same checklist and the retry loop replays.
        let ordinal = data.ordinal;
        if (ordinal === undefined) {
          const max = await tx.checklistItem.aggregate({
            where: { checklistId: data.checklistId },
            _max: { ordinal: true },
          });
          ordinal = (max._max.ordinal ?? -1) + 1;
        }

        return tx.checklistItem.create({
          data: {
            checklistId: data.checklistId,
            ordinal,
            label: data.label,
            expectedValue: data.expectedValue ?? null,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );

  // Revalidate via the parent checklist's owner.
  const owner = await db.checklist.findUniqueOrThrow({
    where: { id: data.checklistId },
    select: { revisionId: true, buildId: true, boardId: true },
  });
  await revalidateChecklistOwner(
    db,
    owner.revisionId,
    owner.buildId,
    owner.boardId,
  );
  return item;
}

// ─── editChecklistItem ─────────────────────────────────

export async function editChecklistItem(input: unknown) {
  const data = editChecklistItemSchema.parse(input);
  const user = await requireUser();

  const updated = await withTxRetry(() =>
    db.$transaction(
      async (tx) => {
        const existing = await tx.checklistItem.findUniqueOrThrow({
          where: { id: data.id },
          select: {
            id: true,
            checklistId: true,
            checked: true,
            notApplicable: true,
            completedAt: true,
            completedById: true,
          },
        });

        const refs = await resolveChecklistFreezeRefs(
          tx,
          existing.checklistId,
        );
        await assertNotFrozen(tx, refs.revisionId);
        if (refs.buildId) await assertBuildNotFrozen(tx, refs.buildId);

        const resultChecked = data.checked ?? existing.checked;
        const resultNotApplicable =
          data.notApplicable ?? existing.notApplicable;
        if (resultChecked && resultNotApplicable) {
          throw new Error(
            "An item cannot be both checked and N/A simultaneously.",
          );
        }

        const patch: Prisma.ChecklistItemUpdateInput = {};
        if (data.label !== undefined) patch.label = data.label;

        // expectedValue / actualValue: null clears, string sets, undefined leaves alone.
        if (data.expectedValue !== undefined) {
          patch.expectedValue =
            data.expectedValue === null || data.expectedValue === ""
              ? null
              : data.expectedValue;
        }
        if (data.actualValue !== undefined) {
          patch.actualValue =
            data.actualValue === null || data.actualValue === ""
              ? null
              : data.actualValue;
        }

        if (data.checked !== undefined) {
          patch.checked = data.checked;
          if (data.checked === true) {
            // Stamp completedAt / completedById on first transition to true.
            // Leave alone if already stamped so we preserve the original
            // "first completed" audit.
            if (existing.completedAt === null) {
              patch.completedAt = new Date();
            }
            if (existing.completedById === null) {
              patch.completedBy = { connect: { id: user.id } };
            }
          } else {
            // Clearing the check resets the stamps so a re-check writes
            // a fresh audit trail.
            patch.completedAt = null;
            patch.completedBy = { disconnect: true };
          }
        }

        // m16: `notApplicable` rides through to the DB column. The Zod
        // refinement on `editChecklistItemSchema` and the raw CHECK
        // `checklist_item_checked_xor_napplicable` together guarantee we
        // never write `checked=true` AND `notApplicable=true` in the same
        // patch — see schema and Task 16.3 migration.
        if (data.notApplicable !== undefined) {
          patch.notApplicable = data.notApplicable;
        }

        return tx.checklistItem.update({
          where: { id: data.id },
          data: patch,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );

  const owner = await db.checklist.findUniqueOrThrow({
    where: { id: updated.checklistId },
    select: { revisionId: true, buildId: true, boardId: true },
  });
  await revalidateChecklistOwner(
    db,
    owner.revisionId,
    owner.buildId,
    owner.boardId,
  );
  return updated;
}

// ─── reorderChecklistItems ─────────────────────────────

export async function reorderChecklistItems(input: unknown) {
  const data = reorderChecklistItemsSchema.parse(input);
  await requireUser();

  const items = await withTxRetry(() =>
    db.$transaction(
      async (tx) => {
        const refs = await resolveChecklistFreezeRefs(tx, data.checklistId);
        await assertNotFrozen(tx, refs.revisionId);
        if (refs.buildId) await assertBuildNotFrozen(tx, refs.buildId);

        // Load all items on the checklist so we can verify the supplied
        // id-set is exhaustive (no partial reorder, no foreign rows).
        const existing = await tx.checklistItem.findMany({
          where: { checklistId: data.checklistId },
          select: { id: true, ordinal: true },
        });
        const existingIds = new Set(existing.map((i) => i.id));
        const suppliedIds = new Set(data.orderedIds);

        if (existing.length !== data.orderedIds.length) {
          throw new Error(
            `Reorder list must include every item on the checklist (expected ${existing.length}, got ${data.orderedIds.length}).`,
          );
        }
        for (const id of data.orderedIds) {
          if (!existingIds.has(id)) {
            throw new Error(
              "Reorder list contains an id that is not on the checklist.",
            );
          }
        }
        // Belt-and-braces: every existing row must also appear in the
        // supplied order.
        for (const row of existing) {
          if (!suppliedIds.has(row.id)) {
            throw new Error(
              "Reorder list is missing one or more existing item ids.",
            );
          }
        }

        // Pass 1: flip every ordinal to its negative-scratch value so
        // pass 2 can write 0..N-1 without violating the unique constraint
        // mid-stream. Use `-(ordinal + 1)` so the scratch range is
        // [-N..-1], disjoint from any non-negative target.
        for (const row of existing) {
          await tx.checklistItem.update({
            where: { id: row.id },
            data: { ordinal: -(row.ordinal + 1) },
          });
        }

        // Pass 2: write the final order.
        for (let i = 0; i < data.orderedIds.length; i++) {
          const id = data.orderedIds[i]!;
          await tx.checklistItem.update({
            where: { id },
            data: { ordinal: i },
          });
        }

        return tx.checklistItem.findMany({
          where: { checklistId: data.checklistId },
          orderBy: { ordinal: "asc" },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );

  const owner = await db.checklist.findUniqueOrThrow({
    where: { id: data.checklistId },
    select: { revisionId: true, buildId: true, boardId: true },
  });
  await revalidateChecklistOwner(
    db,
    owner.revisionId,
    owner.buildId,
    owner.boardId,
  );
  return items;
}

// ─── deleteChecklistItem ───────────────────────────────

export async function deleteChecklistItem(input: unknown) {
  const data = deleteChecklistItemSchema.parse(input);
  await requireUser();

  const { checklistId } = await withTxRetry(() =>
    db.$transaction(
      async (tx) => {
        const existing = await tx.checklistItem.findUniqueOrThrow({
          where: { id: data.id },
          select: { id: true, checklistId: true },
        });
        const refs = await resolveChecklistFreezeRefs(
          tx,
          existing.checklistId,
        );
        await assertNotFrozen(tx, refs.revisionId);
        if (refs.buildId) await assertBuildNotFrozen(tx, refs.buildId);
        await tx.checklistItem.delete({ where: { id: data.id } });
        return { checklistId: existing.checklistId };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );

  const owner = await db.checklist.findUniqueOrThrow({
    where: { id: checklistId },
    select: { revisionId: true, buildId: true, boardId: true },
  });
  await revalidateChecklistOwner(
    db,
    owner.revisionId,
    owner.buildId,
    owner.boardId,
  );
  return { ok: true as const };
}

// ─── materializeCanonicalChecklist (m16 / Task 16.7) ───
//
// Turns a canonical TypeScript-literal template
// (`CANONICAL_TEMPLATES[templateKey]`) into a real Revision-scoped Checklist
// with its items inside a single Serializable transaction. Refuses to
// materialize twice for the same `(revisionId, subkind)` pair — the existing
// row should be edited instead. Frozen revisions are rejected via
// `assertNotFrozen`.
export async function materializeCanonicalChecklist(input: unknown) {
  const data = materializeCanonicalChecklistSchema.parse(input);
  const user = await requireUser();
  const template = CANONICAL_TEMPLATES[data.templateKey];

  const checklist = await withTxRetry(() =>
    db.$transaction(
      async (tx) => {
        await assertNotFrozen(tx, data.revisionId);

        // Guard: refuse to materialize twice for the same (revision, subkind).
        // The plan-quoted error message is asserted in tests so keep this
        // string stable.
        const existing = await tx.checklist.findFirst({
          where: {
            revisionId: data.revisionId,
            subkind: template.subkind,
          },
        });
        if (existing) {
          throw new Error(
            `A ${template.subkind} checklist already exists for this revision.`,
          );
        }

        return tx.checklist.create({
          data: {
            revisionId: data.revisionId,
            stage: template.stage,
            subkind: template.subkind,
            title: template.title,
            createdById: user.id,
            items: {
              create: template.items.map((it, idx) => ({
                ordinal: idx,
                label: it.label,
              })),
            },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );

  // Revalidate the revision detail route so the new pane row shows up.
  const rev = await db.revision.findUniqueOrThrow({
    where: { id: data.revisionId },
    select: {
      label: true,
      project: { select: { slug: true } },
    },
  });
  revalidatePath(
    `/projects/${rev.project.slug}/${encodeURIComponent(rev.label)}`,
  );
  return checklist;
}
