// Block-type metadata + schema-valid starting blocks for the inline guide-card
// editor. `defaultBlock(type)` MUST satisfy `contentBlockSchema` in
// `src/lib/schemas/guide.ts`; where the schema requires a non-empty field
// (callout.label, steps.items, table.columns) the default supplies a sensible
// placeholder the author then edits.
import type { ContentBlock } from "@/lib/schemas/guide";

export const BLOCK_TYPES = [
  "prose", "callout", "steps", "table", "termRef", "sourceRef",
] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

export const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  prose: "Prose",
  callout: "Callout",
  steps: "Steps",
  table: "Table",
  termRef: "Glossary term",
  sourceRef: "Source link",
};

// A valid, schema-passing starting block for each type. Where the schema
// requires non-empty fields (callout.label, steps.items, table.columns), the
// default supplies a sensible placeholder the author then edits.
export function defaultBlock(type: BlockType): ContentBlock {
  switch (type) {
    case "prose":
      return { type: "prose", md: "" };
    case "callout":
      return { type: "callout", severity: "info", label: "Note", body: "" };
    case "steps":
      return { type: "steps", ordered: true, items: ["Step 1"] };
    case "table":
      return { type: "table", columns: ["Column 1"], rows: [[{ text: "" }]] };
    case "termRef":
      return { type: "termRef", term: "" };
    case "sourceRef":
      return { type: "sourceRef", label: "", href: "https://" };
  }
}
