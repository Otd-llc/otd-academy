// Zod schema for the Library mini-lesson authoring boundary (Task A9).
//
// A plain module (NOT "use server") so it can export consts/schemas freely; the
// `"use server"` action file (`src/lib/actions/mini-lesson.ts`) imports from
// here. (Repo rule: a "use server" file may export ONLY async functions.)
//
// Reuses the guide content-block shape (`guideContentBlocksSchema`) so the
// Library editor can reuse the guide BlockListEditor verbatim, THEN refines the
// array to REJECT any block whose type isn't on the Library allowlist
// (`LIBRARY_BLOCK_TYPES`). A project-coupled block (partModel / bomTable /
// action / kit / video) resolves against project + enrollment context a
// standalone article lacks, so it's refused HERE — at the authoring door — not
// merely filtered at render (defense-in-depth: bad data can't even be saved).
import { z } from "zod";
import { guideContentBlocksSchema } from "@/lib/schemas/guide";
import { LIBRARY_BLOCK_TYPES } from "@/lib/library/block-allowlist";

const libraryBlocksSchema = guideContentBlocksSchema.refine(
  (blocks) => blocks.every((b) => LIBRARY_BLOCK_TYPES.has(b.type)),
  "Library mini-lessons may not use project-coupled blocks (partModel/bomTable/action/kit/video).",
);

export const miniLessonInputSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9-]+$/, "slug must be kebab-case"),
  title: z.string().trim().min(1).max(160),
  summary: z.string().max(400).nullable().optional(),
  seoTitle: z.string().max(70).nullable().optional(),
  seoDescription: z.string().max(200).nullable().optional(),
  byline: z.string().max(200).nullable().optional(),
  contentBlocks: libraryBlocksSchema,
  relatedProjects: z
    .array(
      z.object({
        projectSlug: z.string().trim().min(1),
        role: z.enum(["SUPPORTING", "DOWN_FUNNEL"]),
        ordinal: z.int().nonnegative().default(0),
      }),
    )
    .max(20)
    .optional(),
});
export type MiniLessonInput = z.infer<typeof miniLessonInputSchema>;
