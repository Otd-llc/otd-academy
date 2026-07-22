// Per-block resilient parse of a guide card's contentBlocks.
//
// `guideContentBlocksSchema.safeParse` is a single `z.array(...)` parse, which is
// ALL-OR-NOTHING: one malformed block fails the whole array and the render path
// falls back to `[]`, blanking the ENTIRE card (and silently killing the gate
// quiz + per-pick XP that read the same array). As lessons grow more inline
// checks, one typo in block 30 must not nuke blocks 1-29 plus the stage gate.
//
// This parses each element on its own, keeps the ones that validate, and reports
// the ones that don't. Every survivor carries its ORIGINAL storage index, because
// the in-app capture tool addresses a block by its position in the STORED array
// (`writeGuideBlockMedia` writes back to `blocks[blockIndex]`). Renumbering the
// survivors would land a capture on the wrong image; carrying the original index
// keeps it correct.
import { contentBlockSchema, type ContentBlock } from "@/lib/schemas/guide";

// Same sanity guardrail as `guideContentBlocksSchema.max(200)` — a cap against a
// runaway/buggy write, not a content policy. Kept in lockstep with that schema.
const MAX_BLOCKS = 200;

export type ParsedGuideBlocks = {
  /** Blocks that passed schema validation, in original order. */
  blocks: ContentBlock[];
  /**
   * `storageIndices[i]` is the position of `blocks[i]` in the RAW stored array.
   * Positional consumers (the capture write path) must address blocks by this,
   * not by the filtered position, so a survivor after a dropped block keeps its
   * true index.
   */
  storageIndices: number[];
  /**
   * Raw-array positions that failed to parse (malformed) or fell past the cap
   * (truncated). Drives an admin-only "N blocks skipped" signal so a typo that
   * silently deletes a live check is visible to the author, not invisible.
   */
  dropped: number[];
};

export function parseGuideBlocks(raw: unknown): ParsedGuideBlocks {
  if (!Array.isArray(raw)) return { blocks: [], storageIndices: [], dropped: [] };

  const blocks: ContentBlock[] = [];
  const storageIndices: number[] = [];
  const dropped: number[] = [];

  for (let i = 0; i < raw.length; i++) {
    // Past the cap: keep the first MAX_BLOCKS survivors, report the rest as
    // dropped (truncated) rather than failing the whole card as the old cap did.
    if (blocks.length >= MAX_BLOCKS) {
      dropped.push(i);
      continue;
    }
    const res = contentBlockSchema.safeParse(raw[i]);
    if (res.success) {
      blocks.push(res.data);
      storageIndices.push(i);
    } else {
      dropped.push(i);
    }
  }

  return { blocks, storageIndices, dropped };
}

/**
 * Validate the single block at a RAW storage `index`, tolerating malformed
 * siblings. Returns the parsed block, or null if the index is out of range / the
 * block is malformed / `raw` is not an array. The capture path uses this to
 * address one image/video block by its stored position without full-parsing the
 * whole array (which would throw on any bad sibling and make a card with one
 * malformed block un-capturable).
 */
export function parseBlockAt(raw: unknown, index: number): ContentBlock | null {
  if (!Array.isArray(raw)) return null;
  const res = contentBlockSchema.safeParse(raw[index]);
  return res.success ? res.data : null;
}
