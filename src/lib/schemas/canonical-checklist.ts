// Zod schema for the `materializeCanonicalChecklist` server action (Task 16.7).
//
// The action turns a canonical TypeScript-literal template
// (`CANONICAL_TEMPLATES[templateKey]`) into a real Checklist + ChecklistItem
// row-set on the supplied revision. The template enum is the source of truth
// for which canonical kinds are materializable; subkinds added in later
// Wave 2 milestones (e.g. STRIPBOARD_VALIDATION in m17) will extend this
// enum alongside the templates record.

import { z } from "zod";

export const materializeCanonicalChecklistSchema = z.object({
  revisionId: z.cuid(),
  templateKey: z.enum([
    "REQUIREMENTS_REVIEW",
    "LAYOUT_REVIEW",
    "STRIPBOARD_VALIDATION",
  ]),
});

export type MaterializeCanonicalChecklistInput = z.infer<
  typeof materializeCanonicalChecklistSchema
>;
