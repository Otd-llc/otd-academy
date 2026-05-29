// Zod 4 schemas for Board CRUD (design §4.2 + §9.3).
//
// `serial` is case-preserving (e.g. "B01"); the functional unique index
// `board_build_serial_ci` enforces case-insensitive uniqueness per Build at
// the DB layer. We don't lowercase here.
//
// `silkscreenHash` is validated against `SILKSCREEN_HASH_RE` — the SAME
// shared constant the migration CHECK mirrors. The DB CHECK is the
// defense-in-depth backstop for raw inserts; this Zod refinement is the
// friendly client/server message path.
//
// The refinement runs only for non-empty strings — undefined/empty means
// "no silkscreen yet" (the seed has boards in BARE without one).
import { z } from "zod";
import { BoardStatus } from "@prisma/client";
import { SILKSCREEN_HASH_RE } from "@/lib/constants";

const silkscreenHashOptional = z
  .string()
  .trim()
  .max(64)
  .refine(
    (v) => v === "" || SILKSCREEN_HASH_RE.test(v),
    "must be a git SHA (7-40 hex chars, optional 'g' prefix) or empty",
  )
  .optional();

export const createBoardSchema = z.object({
  buildId: z.cuid(),
  serial: z.string().trim().min(1).max(32),
  silkscreenHash: silkscreenHashOptional,
});

export type CreateBoardInput = z.infer<typeof createBoardSchema>;

// editBoardSchema accepts each editable field optional; the action drops
// undefined keys so unspecified fields are left alone. Empty string on
// silkscreenHash / notes means "clear" (action converts to null).
export const editBoardSchema = z.object({
  id: z.cuid(),
  silkscreenHash: silkscreenHashOptional,
  status: z.enum(BoardStatus).optional(),
  notes: z.union([z.string().max(4000), z.null()]).optional(),
});

export type EditBoardInput = z.infer<typeof editBoardSchema>;

export const deleteBoardSchema = z.object({
  id: z.cuid(),
});

export type DeleteBoardInput = z.infer<typeof deleteBoardSchema>;
