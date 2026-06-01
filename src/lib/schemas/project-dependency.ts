// Zod 4 schemas for ProjectDependency CRUD. STAGE_VALUES mirrors the Prisma
// `Stage` enum literal set (kept in sync with `enum Stage` in schema.prisma).
// `kind` defaults to DE_RISK to match the Prisma model default.
//
// `editProjectDependencySchema` requires `id` (cuid) and makes every editable
// field optional — the action layer is responsible for spreading only the
// provided fields onto the update.
import { z } from "zod";

export const STAGE_VALUES = [
  "REQUIREMENTS",
  "SCHEMATIC",
  "BOM_SOURCING",
  "LAYOUT",
  "DRC_GERBER",
  "ORDERING",
  "ASSEMBLY",
  "BRINGUP",
  "REVISION",
] as const;

export const createProjectDependencySchema = z.object({
  dependentProjectId: z.cuid(),
  dependsOnProjectId: z.cuid(),
  kind: z.enum(["DE_RISK", "FOUNDATION", "SHARED_BLOCK"]).default("DE_RISK"),
  dependentStageGated: z.enum(STAGE_VALUES),
  dependsOnStageRequired: z.enum(STAGE_VALUES),
  notes: z.string().max(500).optional().nullable(),
});

export type CreateProjectDependencyInput = z.infer<
  typeof createProjectDependencySchema
>;

export const editProjectDependencySchema = createProjectDependencySchema
  .partial()
  .extend({
    id: z.cuid(),
  });

export type EditProjectDependencyInput = z.infer<
  typeof editProjectDependencySchema
>;
