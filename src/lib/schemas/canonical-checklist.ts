// Zod schema for the `materializeCanonicalChecklist` server action (Task 16.7).
//
// The action turns a canonical TypeScript-literal template
// (`CANONICAL_TEMPLATES[templateKey]`) into a real Checklist + ChecklistItem
// row-set on the supplied owner. The template enum is the source of truth
// for which canonical kinds are materializable; subkinds added in later
// milestones (e.g. STRIPBOARD_VALIDATION in m17, POST_ASSEMBLY_CONTINUITY in
// the m5 learner-guide work) extend this enum alongside the templates record.
//
// m5: the action gained a Build-scoped owner. The owner is now an
// (revisionId XOR buildId) pair — exactly one must be supplied. The original
// revision-scoped shape (`{ revisionId, templateKey }`) stays valid so all
// existing callers/tests are unaffected.

import { z } from "zod";

export const canonicalTemplateKeySchema = z.enum([
  "REQUIREMENTS_REVIEW",
  "LAYOUT_REVIEW",
  "STRIPBOARD_VALIDATION",
  "POST_ASSEMBLY_CONTINUITY",
]);

export const materializeCanonicalChecklistSchema = z
  .object({
    revisionId: z.cuid().optional(),
    buildId: z.cuid().optional(),
    templateKey: canonicalTemplateKeySchema,
  })
  .refine(
    (d) =>
      (d.revisionId != null && d.buildId == null) ||
      (d.revisionId == null && d.buildId != null),
    {
      message: "Provide exactly one of revisionId or buildId.",
      path: ["revisionId"],
    },
  );

export type MaterializeCanonicalChecklistInput = z.infer<
  typeof materializeCanonicalChecklistSchema
>;
