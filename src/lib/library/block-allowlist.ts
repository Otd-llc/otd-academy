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
  // The two signpost block types. Both are pure content — a Do list whose steps
  // carry their own proof, and a trace list whose items carry their own answer
  // key — with no project or enrollment coupling, so they are public-safe in the
  // same way `steps` is. Allowed here so an author who reaches for one in a
  // mini-lesson gets it on the page AND in the printed PDF, rather than having it
  // silently filtered out of both.
  "doSteps",
  "traceList",
]);

export function isLibraryBlock(block: ContentBlock): boolean {
  return LIBRARY_BLOCK_TYPES.has(block.type);
}

export function filterLibraryBlocks(blocks: ContentBlock[]): ContentBlock[] {
  return blocks.filter(isLibraryBlock);
}
