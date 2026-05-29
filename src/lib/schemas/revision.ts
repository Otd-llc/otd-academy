// Zod 4 schemas for Revision CRUD.
//
// `label` is case-preserving (`v1`, `v1.1`, `rev A` per design §4.3); the
// functional unique index `revision_project_label_ci` enforces
// case-insensitive uniqueness at the DB layer, so we don't lowercase here.
// The regex is intentionally permissive — alphanumerics, spaces, dots,
// dashes — matching the documented label vocabulary.
import { z } from "zod";

export const REVISION_LABEL_RE = /^[A-Za-z0-9 .-]+$/;

export const createRevisionSchema = z.object({
  projectId: z.cuid(),
  label: z
    .string()
    .trim()
    .min(1)
    .max(32)
    .regex(
      REVISION_LABEL_RE,
      "label may contain only letters, digits, spaces, dots, and dashes",
    ),
  copyForwardFromRevisionId: z.cuid().optional(),
});

export type CreateRevisionInput = z.infer<typeof createRevisionSchema>;

// SILKSCREEN_HASH_RE is shared with Board.silkscreenHash; commits + board
// silkscreens share the git-SHA shape per design §4.3 and constants.ts.
// Empty string means "clear" — the action layer converts it to null before
// writing.
export const commitShaSchema = z
  .string()
  .trim()
  .max(64)
  .refine(
    (v) => v === "" || /^g?[0-9a-f]{7,40}$/i.test(v),
    "must be a git SHA (7-40 hex chars, optional 'g' prefix) or empty to clear",
  );

export const setCommitSchema = z.object({
  revisionId: z.cuid(),
  value: commitShaSchema,
});

export type SetCommitInput = z.infer<typeof setCommitSchema>;
