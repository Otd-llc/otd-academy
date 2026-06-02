// Zod 4 schemas for Part CRUD (design §4.3 — Parts library is global,
// composite key `(manufacturer, mpn)`).
import { z } from "zod";
import { PartLifecycle } from "@prisma/client";

export const createPartSchema = z.object({
  mpn: z.string().trim().min(1).max(128),
  manufacturer: z.string().trim().min(1).max(128),
  description: z.string().trim().min(1).max(500),
  category: z.string().trim().max(128).optional().nullable(),
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
