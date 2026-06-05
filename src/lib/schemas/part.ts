// Zod 4 schemas for Part CRUD (design §4.3 — Parts library is global,
// composite key `(manufacturer, mpn)`).
import { z } from "zod";
import { PartCategory, PartLifecycle } from "@prisma/client";

// A KiCad library reference id — `Lib:Name` with exactly one colon (Phase C).
// `Device:R`, `Resistor_SMD:R_0805_2012Metric`, `Regulator_Linear:AP2112K-3.3`.
export const kicadLibId = z
  .string()
  .trim()
  .max(200)
  .regex(/^[\w.-]+:[\w./-]+$/, "must be a KiCad lib-id (Lib:Name)");

export const createPartSchema = z.object({
  mpn: z.string().trim().min(1).max(128),
  manufacturer: z.string().trim().min(1).max(128),
  description: z.string().trim().min(1).max(500),
  // Legacy enum category (retained during the Phase B transition). The create
  // form now posts `categoryId` (the picker); `category` stays accepted for
  // back-compat (and is still set directly by seed scripts / tests).
  category: z.enum(PartCategory).optional().nullable(),
  // Category tree FK (Phase B). The picker posts this; createPart resolves it,
  // sets categoryId, and dual-writes the legacy enum when the leaf slug is an
  // enum token. Blank → omitted → optional/nullable → NULL.
  categoryId: z.string().optional().nullable(),
  footprint: z.string().trim().max(128).optional().nullable(),
  // KiCad standard-library references (Phase C). The form pickers post these;
  // createPart validates they exist in the index before setting them.
  kicadSymbol: kicadLibId.optional().nullable(),
  kicadFootprint: kicadLibId.optional().nullable(),
  datasheetUrl: z.url().optional().nullable(),
  lifecycle: z.enum(PartLifecycle).default("ACTIVE"),
  isCertifiedModule: z.boolean().optional(),
  notes: z.string().max(2000).optional().nullable(),
});

export type CreatePartInput = z.infer<typeof createPartSchema>;

export const listPartsBySearchSchema = z.object({
  q: z.string().trim().max(128).optional(),
  take: z.coerce.number().int().positive().max(50).default(25),
});

export const PART_SORTS = ["manufacturer", "mpn", "recent"] as const;
export type PartSort = (typeof PART_SORTS)[number];

// Total parser for the parts-list URL params: every field `.catch`es to a safe
// default so a hand-edited/garbage querystring narrows nothing rather than 500ing.
// `mains` is true ONLY for the literal "1" (mirrors the existing list-page check).
export const partsListParamsSchema = z.object({
  q: z.string().trim().max(128).optional().catch(undefined),
  lifecycle: z.enum(PartLifecycle).optional().catch(undefined),
  mains: z.preprocess((v) => v === "1", z.boolean()).catch(false),
  // Category subtree filter (Phase B): a materialized category `path` (e.g.
  // "passives/capacitors/MLCC_CAPACITOR"). An unknown path narrows nothing.
  cat: z.string().trim().max(256).optional().catch(undefined),
  sort: z.enum(PART_SORTS).catch("manufacturer"),
  page: z.coerce.number().int().min(1).catch(1),
});
export type PartsListParams = z.infer<typeof partsListParamsSchema>;
