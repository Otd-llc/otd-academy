// src/lib/library/block-allowlist.ts
//
// The subset of content-block types valid on a public Library mini-lesson.
// `GuideBlocks` is shared with the project guide, where blocks like partModel /
// bomTable / action / kit / mp4 video resolve against project + enrollment
// context a standalone article does not have. This allowlist is the guard: the
// admin authoring route validates against it, and the public page filters
// through it (defense-in-depth — a bad row can't render a project-coupled block).
import type { ContentBlock } from "@/lib/schemas/guide";

export const LIBRARY_BLOCK_TYPES: ReadonlySet<string> = new Set([
  "prose",
  "heading",
  "callout",
  "steps",
  "table",
  "image",
  "quiz",
  "sourceRef",
  "deepDive",
  "termRef",
  "vendorCta",
  "youtube",
  "calculator",
  "math",
]);

export function isLibraryBlock(block: ContentBlock): boolean {
  return LIBRARY_BLOCK_TYPES.has(block.type);
}

export function filterLibraryBlocks(blocks: ContentBlock[]): ContentBlock[] {
  return blocks.filter(isLibraryBlock);
}
