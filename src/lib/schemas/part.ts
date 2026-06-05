// Zod 4 schemas for Part CRUD (design §4.3 — Parts library is global,
// composite key `(manufacturer, mpn)`).
import { z } from "zod";
import { PartCategory, PartLifecycle } from "@prisma/client";

export const createPartSchema = z.object({
  mpn: z.string().trim().min(1).max(128),
  manufacturer: z.string().trim().min(1).max(128),
  description: z.string().trim().min(1).max(500),
  // Constrained to the PartCategory enum (migration parts_knowledge_stage_a;
  // the create form is a <select> as of Task 5). A blank select option posts
  // no value → the form wrapper omits it → optional/nullable lets it be NULL.
  category: z.enum(PartCategory).optional().nullable(),
  footprint: z.string().trim().max(128).optional().nullable(),
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
  sort: z.enum(PART_SORTS).catch("manufacturer"),
  page: z.coerce.number().int().min(1).catch(1),
});
export type PartsListParams = z.infer<typeof partsListParamsSchema>;
