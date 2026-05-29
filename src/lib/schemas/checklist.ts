// Zod 4 schemas for Checklist + ChecklistItem CRUD (design §4.2 + §9.2/§9.3).
//
// Phase 13 / M9b scope: Build XOR Board owned Checklists. The owner XOR is
// enforced at three layers:
//   1. The DB CHECK constraint `checklist_owner_xor` (raw migration in
//      Phase 1) rejects rows with both or neither id set.
//   2. The action layer dispatches on `ownerKind` to set exactly one of
//      `buildId` / `boardId` on insert.
//   3. The discriminated union here makes the two payload shapes structurally
//      distinct so the client can't accidentally send both.
//
// Subkind / stage / owner are immutable post-create — editing those would
// invalidate the gate-relevant lookup semantics (the ASSEMBLY gate matches
// on `subkind === "POST_ASSEMBLY_CONTINUITY"` on the active Build). Edits
// only touch the human-editable `title`.
//
// `reorderChecklistItems` carries the canonical final order in `orderedIds`.
// The action performs an atomic two-pass swap (negate, then assign) inside
// a Serializable transaction to satisfy the `@@unique([checklistId, ordinal])`
// constraint without intermediate violations.
import { z } from "zod";
import { ChecklistSubkind, Stage } from "@prisma/client";

// ─── createChecklist ───────────────────────────────────

const baseCreateFields = {
  subkind: z.enum(ChecklistSubkind),
  stage: z.enum(Stage),
  title: z.string().trim().min(1).max(200),
};

export const createChecklistSchema = z.discriminatedUnion("ownerKind", [
  z.object({
    ...baseCreateFields,
    ownerKind: z.literal("build"),
    buildId: z.cuid(),
  }),
  z.object({
    ...baseCreateFields,
    ownerKind: z.literal("board"),
    boardId: z.cuid(),
  }),
]);

export type CreateChecklistInput = z.infer<typeof createChecklistSchema>;

// ─── editChecklist ─────────────────────────────────────
//
// Only the title is mutable post-create. Subkind / stage / owner are pinned
// at create time so the ASSEMBLY gate's subkind match (and the picker's
// stage-scoped tagging) stay coherent.
export const editChecklistSchema = z.object({
  id: z.cuid(),
  title: z.string().trim().min(1).max(200).optional(),
});

export type EditChecklistInput = z.infer<typeof editChecklistSchema>;

export const deleteChecklistSchema = z.object({
  id: z.cuid(),
});

export type DeleteChecklistInput = z.infer<typeof deleteChecklistSchema>;

// ─── addChecklistItem ──────────────────────────────────
//
// `ordinal` is optional on the wire — when absent, the action computes
// max(ordinal) + 1 inside the tx so concurrent inserts can't collide on
// the `@@unique([checklistId, ordinal])` constraint.
export const addChecklistItemSchema = z.object({
  checklistId: z.cuid(),
  label: z.string().trim().min(1).max(500),
  expectedValue: z.string().trim().max(500).optional(),
  ordinal: z.int().nonnegative().optional(),
});

export type AddChecklistItemInput = z.infer<typeof addChecklistItemSchema>;

// ─── editChecklistItem ─────────────────────────────────
//
// Setting `checked = true` also writes `completedAt = NOW()` and
// `completedById = user.id` if either is not already populated.
// Setting `checked = false` clears both stamps so a toggled-off row
// behaves like a never-completed item.
export const editChecklistItemSchema = z.object({
  id: z.cuid(),
  label: z.string().trim().min(1).max(500).optional(),
  expectedValue: z.union([z.string().max(500), z.null()]).optional(),
  actualValue: z.union([z.string().max(500), z.null()]).optional(),
  checked: z.boolean().optional(),
});

export type EditChecklistItemInput = z.infer<typeof editChecklistItemSchema>;

// ─── reorderChecklistItems ─────────────────────────────
//
// `orderedIds` is the canonical final order. The action verifies that every
// id belongs to the same Checklist (`checklistId`) and that the supplied
// list is exhaustive before swapping ordinals.
export const reorderChecklistItemsSchema = z.object({
  checklistId: z.cuid(),
  orderedIds: z.array(z.cuid()).min(1),
});

export type ReorderChecklistItemsInput = z.infer<
  typeof reorderChecklistItemsSchema
>;

export const deleteChecklistItemSchema = z.object({
  id: z.cuid(),
});

export type DeleteChecklistItemInput = z.infer<
  typeof deleteChecklistItemSchema
>;
