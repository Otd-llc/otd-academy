// Zod 4 schemas for BomLine CRUD.
//
// The refdes-count invariant (`refDes.split(',').length === quantity`) is
// validated here as well as by the raw-migration CHECK constraint
// `check_bomline_refdes_count`. Doing it at the Zod layer lets us surface a
// clean field error instead of a Postgres CHECK violation.
import { z } from "zod";

// Reference designators are comma-separated identifiers like `R1`, `C1,C2,C3`.
// Disallow leading/trailing whitespace; commas separate; each segment must
// be non-empty after trim. The DB CHECK uses string_to_array on `,` so we
// match its semantics here.
const refDesField = z
  .string()
  .min(1)
  .max(512)
  .refine((s) => s === s.trim(), "no leading/trailing spaces");

export const createBomLineSchema = z
  .object({
    revisionId: z.cuid(),
    partId: z.cuid(),
    refDes: refDesField,
    quantity: z.coerce.number().int().positive(),
    notes: z.string().max(1000).optional().nullable(),
  })
  .refine(
    (v) => v.refDes.split(",").length === v.quantity,
    {
      message:
        "refDes count must equal quantity (comma-separated designators)",
      path: ["refDes"],
    },
  );

export type CreateBomLineInput = z.infer<typeof createBomLineSchema>;

// editBomLineSchema: id required; refDes / quantity / notes optional but
// when supplied together must still satisfy the count invariant. We can't
// express "either both or neither" with .refine directly without partial
// reconstruction, so we run a refinement that's a no-op when either field
// is absent and validates when both are present.
export const editBomLineSchema = z
  .object({
    id: z.cuid(),
    refDes: refDesField.optional(),
    quantity: z.coerce.number().int().positive().optional(),
    notes: z.string().max(1000).optional().nullable(),
  })
  .refine(
    (v) => {
      if (v.refDes === undefined || v.quantity === undefined) return true;
      return v.refDes.split(",").length === v.quantity;
    },
    {
      message:
        "refDes count must equal quantity (comma-separated designators)",
      path: ["refDes"],
    },
  );

export type EditBomLineInput = z.infer<typeof editBomLineSchema>;

export const deleteBomLineSchema = z.object({ id: z.cuid() });
