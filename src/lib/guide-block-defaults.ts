// Block-type metadata + schema-valid starting blocks for the inline guide-card
// editor. `defaultBlock(type)` MUST satisfy `contentBlockSchema` in
// `src/lib/schemas/guide.ts`; where the schema requires a non-empty field
// (callout.label, steps.items, table.columns) the default supplies a sensible
// placeholder the author then edits.
import type { JSX } from "react";
import type { ContentBlock } from "@/lib/schemas/guide";
import {
  AlertTriangleIcon,
  ChevronDownIcon,
  DocumentIcon,
  EyeIcon,
  LinkIcon,
  ListIcon,
  PhotoIcon,
  QuizIcon,
  TableIcon,
  TagIcon,
  VideoIcon,
} from "@/components/icons";

export const BLOCK_TYPES = [
  "prose", "callout", "steps", "table", "termRef", "sourceRef", "partModel", "image", "video", "quiz", "deepDive", "action",
] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

export const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  prose: "Prose",
  callout: "Callout",
  steps: "Steps",
  table: "Table",
  termRef: "Glossary term",
  sourceRef: "Source link",
  partModel: "3D part",
  image: "Image",
  video: "Video",
  quiz: "Quiz",
  deepDive: "Deep dive",
  action: "Action button",
};

// Type glyph for each block, paired with BLOCK_TYPE_LABELS to give blocks a
// legible identity in the inline editor (block header + Add-block menu items).
// Each entry is a component taking the shared `{ className }` icon props.
export const BLOCK_TYPE_ICON: Record<
  BlockType,
  (props: { className?: string }) => JSX.Element
> = {
  prose: DocumentIcon,
  callout: AlertTriangleIcon,
  steps: ListIcon,
  table: TableIcon,
  termRef: TagIcon,
  sourceRef: LinkIcon,
  partModel: EyeIcon,
  image: PhotoIcon,
  video: VideoIcon,
  quiz: QuizIcon,
  deepDive: ChevronDownIcon,
  action: LinkIcon,
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
    case "partModel":
      return { type: "partModel", mpn: "" };
    case "image":
      return { type: "image", src: "", alt: "" };
    case "video":
      return { type: "video", src: "", alt: "" };
    case "quiz":
      return {
        type: "quiz",
        questions: [
          { q: "New question?", options: ["Option A", "Option B"], answer: 0 },
        ],
      };
    case "deepDive":
      return { type: "deepDive", summary: "Deep dive", body: "" };
    case "action":
      return {
        type: "action",
        action: "downloadKicadStarter",
        label: "Download the KiCad starter",
      };
  }
}
