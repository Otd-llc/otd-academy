// Zod 4 schemas for Checklist + ChecklistItem CRUD (design §4.2 + §9.2/§9.3).
//
// m15 widened scope: Revision XOR Build XOR Board owned Checklists. The owner
// XOR is enforced at three layers:
//   1. The DB CHECK constraint `checklist_owner_xor` (raw migration; widened
//      to 3-way in m15) rejects rows with more than one or no id set.
//   2. The action layer dispatches on `ownerKind` to set exactly one of
//      `revisionId` / `buildId` / `boardId` on insert.
//   3. The discriminated union here makes the three payload shapes
//      structurally distinct so the client can't accidentally send more
//      than one.
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
    ownerKind: z.literal("revision"),
    revisionId: z.cuid(),
  }),
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
//
// m16: `notApplicable` mirrors the DB column; the `.refine` below
// matches the raw CHECK `checklist_item_checked_xor_napplicable` so the
// action layer rejects the conflict before the DB does. The
// `addChecklistItemSchema` does NOT expose `checked` on the wire
// (creation forces `checked = false`), so an analogous refinement there
// would collapse to trivially-true — skipped per Task 16.4.
export const editChecklistItemSchema = z
  .object({
    id: z.cuid(),
    label: z.string().trim().min(1).max(500).optional(),
    expectedValue: z.union([z.string().max(500), z.null()]).optional(),
    actualValue: z.union([z.string().max(500), z.null()]).optional(),
    checked: z.boolean().optional(),
    notApplicable: z.boolean().optional(),
  })
  .refine((d) => !(d.checked === true && d.notApplicable === true), {
    message: "An item cannot be both checked and N/A simultaneously.",
    path: ["notApplicable"],
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
