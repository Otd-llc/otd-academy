"use server";

// Board server actions (design §4.2, §9.3).
//
// Phase 12 / M9a scope: createBoard / editBoard / deleteBoard.
//
// Freeze policy: all three guards wrap both `assertNotFrozen(revisionId)` and
// `assertBuildNotFrozen(buildId)` — boards live UNDER a Build, and a frozen
// parent Revision cascades the Build's freeze (design §5.4). Mirroring both
// checks matches the symmetric mutation surface (Phase 6 / M5b builds).
//
// Concurrency: Serializable transactions wrapped in `withTxRetry`. The
// `board_build_serial_ci` functional unique index is the DB safety net for
// case-insensitive serial collisions; the application-level findFirst is a
// best-effort friendly path, but the index is the authoritative check.

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-helpers";
import { assertBuildNotFrozen, assertNotFrozen } from "@/lib/assertions";
import { withTxRetry } from "@/lib/tx-retry";
import {
  createBoardSchema,
  deleteBoardSchema,
  editBoardSchema,
} from "@/lib/schemas/board";

async function loadBoardRoute(boardId: string) {
  const board = await db.board.findUniqueOrThrow({
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
  return {
    projectSlug: board.build.revision.project.slug,
    revLabel: board.build.revision.label,
    buildLabel: board.build.label,
    serial: board.serial,
  };
}

export async function createBoard(input: unknown) {
  const data = createBoardSchema.parse(input);
  await requireAdmin();

  const { board, projectSlug, revLabel, buildLabel } = await withTxRetry(() =>
    db.$transaction(
      async (tx) => {
        // 1. Load the build (and its parent revision) for the freeze checks
        //    + revalidation path.
        const build = await tx.build.findUniqueOrThrow({
          where: { id: data.buildId },
          select: {
            id: true,
            label: true,
            revisionId: true,
            revision: {
              select: {
                label: true,
                project: { select: { slug: true } },
              },
            },
          },
        });

        // 2. Freeze guards — both the Build and its parent Revision.
        await assertNotFrozen(tx, build.revisionId);
        await assertBuildNotFrozen(tx, build.id);

        // 3. Insert the Board. silkscreenHash is optional; empty string →
        //    null to satisfy the CHECK (which is `IS NULL OR ~* regex`).
        const normalizedHash =
          data.silkscreenHash === undefined || data.silkscreenHash === ""
            ? null
            : data.silkscreenHash;

        const newBoard = await tx.board.create({
          data: {
            buildId: build.id,
            serial: data.serial,
            silkscreenHash: normalizedHash,
            // status defaults to BARE per schema.
          },
        });

        return {
          board: newBoard,
          projectSlug: build.revision.project.slug,
          revLabel: build.revision.label,
          buildLabel: build.label,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );

  revalidatePath(
    `/projects/${projectSlug}/${encodeURIComponent(
      revLabel,
    )}/builds/${encodeURIComponent(buildLabel)}`,
  );

  return board;
}

export async function editBoard(input: unknown) {
  const data = editBoardSchema.parse(input);
  await requireAdmin();

  const patch: Prisma.BoardUpdateInput = {};
  if (data.silkscreenHash !== undefined) {
    // Empty string clears the silkscreenHash. The DB CHECK allows null.
    patch.silkscreenHash = data.silkscreenHash === "" ? null : data.silkscreenHash;
  }
  if (data.status !== undefined) {
    patch.status = data.status;
  }
  if (data.notes !== undefined) {
    // null or empty string → clear
    if (data.notes === null) {
      patch.notes = null;
    } else {
      const trimmed = data.notes.trim();
      patch.notes = trimmed === "" ? null : trimmed;
    }
  }

  const updated = await withTxRetry(() =>
    db.$transaction(
      async (tx) => {
        const existing = await tx.board.findUniqueOrThrow({
          where: { id: data.id },
          select: { id: true, buildId: true, build: { select: { revisionId: true } } },
        });
        await assertNotFrozen(tx, existing.build.revisionId);
        await assertBuildNotFrozen(tx, existing.buildId);
        return tx.board.update({ where: { id: data.id }, data: patch });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );

  const route = await loadBoardRoute(updated.id);
  revalidatePath(
    `/projects/${route.projectSlug}/${encodeURIComponent(
      route.revLabel,
    )}/builds/${encodeURIComponent(route.buildLabel)}`,
  );
  revalidatePath(
    `/projects/${route.projectSlug}/${encodeURIComponent(
      route.revLabel,
    )}/builds/${encodeURIComponent(route.buildLabel)}/boards/${encodeURIComponent(route.serial)}`,
  );
  return updated;
}

export async function deleteBoard(input: unknown) {
  const data = deleteBoardSchema.parse(input);
  await requireAdmin();

  const route = await withTxRetry(() =>
    db.$transaction(
      async (tx) => {
        const existing = await tx.board.findUniqueOrThrow({
          where: { id: data.id },
          select: {
            id: true,
            buildId: true,
            build: {
              select: {
                label: true,
                revisionId: true,
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
        await assertNotFrozen(tx, existing.build.revisionId);
        await assertBuildNotFrozen(tx, existing.buildId);
        await tx.board.delete({ where: { id: data.id } });
        return {
          projectSlug: existing.build.revision.project.slug,
          revLabel: existing.build.revision.label,
          buildLabel: existing.build.label,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );

  revalidatePath(
    `/projects/${route.projectSlug}/${encodeURIComponent(
      route.revLabel,
    )}/builds/${encodeURIComponent(route.buildLabel)}`,
  );

  return { ok: true as const };
}
