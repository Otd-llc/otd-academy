// Stable identity for guide content blocks.
//
// THE PROBLEM. Everything that points at a block points at its POSITION: the
// video scripts in `docs/video/` cite "blocks [8]-[18] of the SCHEMATIC card",
// `writeGuideBlockMedia` takes a `blockIndex`, capture slots are numbered.
// Insert one callout at index 10 and every one of those references now names
// different content -- no parse error, no hash change, no signal at all. It is
// a correctness failure with no detector, and it gets 127 times worse with the
// planned video set.
//
// THE RULE. One function mints ids, and every write door runs it. Minting
// inline at call sites is how half the rows end up with ids and the other half
// silently do not, which is worse than none: partial coverage looks like
// coverage.
//
// IDEMPOTENT BY CONSTRUCTION. An existing id is never replaced -- that is the
// whole point, since a re-minted id breaks exactly the references it exists to
// protect. So this is safe to run on every write, including writes that did not
// touch the blocks.
//
// NOT A MIGRATION. `withBlockIds` only covers blocks that pass through a write.
// Rows nobody edits keep their missing ids until `scripts/backfill-block-ids.ts`
// runs. The schema field stays OPTIONAL until that backfill reports 100%
// coverage, because the render path drops a WHOLE card on a parse failure -- a
// required id would blank every un-backfilled lesson page rather than degrade it.

import { randomUUID } from "node:crypto";

/** A block as stored: an object with a `type` discriminator and maybe an `id`. */
type MaybeBlock = { type?: unknown; id?: unknown } & Record<string, unknown>;

const hasId = (b: MaybeBlock) => typeof b.id === "string" && b.id.length > 0;

/**
 * Return `blocks` with an `id` on every element that lacks one.
 *
 * Non-object entries pass through untouched: this is called on the way into the
 * database, where a malformed sibling must not throw and take a legitimate write
 * down with it (the same reasoning as `parseBlockAt`).
 */
export function withBlockIds<T>(blocks: T): T {
  if (!Array.isArray(blocks)) return blocks;
  return blocks.map((b) => {
    if (!b || typeof b !== "object" || Array.isArray(b)) return b;
    const block = b as MaybeBlock;
    if (hasId(block)) return b;
    return { ...block, id: randomUUID() };
  }) as unknown as T;
}

/** Coverage of a single card's blocks. Used by the backfill and its verifier. */
export function blockIdCoverage(blocks: unknown): { total: number; withId: number } {
  if (!Array.isArray(blocks)) return { total: 0, withId: 0 };
  let withId = 0;
  for (const b of blocks) {
    if (b && typeof b === "object" && !Array.isArray(b) && hasId(b as MaybeBlock)) withId += 1;
  }
  return { total: blocks.length, withId };
}

/**
 * Every id in `blocks`, for duplicate detection.
 *
 * Duplicates matter more than absences. A missing id is visible; a DUPLICATED id
 * means two blocks answer to one reference, which reintroduces the exact
 * ambiguity ids were added to remove -- and it is the predictable outcome of
 * somebody copy-pasting a block in an editor.
 */
export function blockIds(blocks: unknown): string[] {
  if (!Array.isArray(blocks)) return [];
  const out: string[] = [];
  for (const b of blocks) {
    if (b && typeof b === "object" && !Array.isArray(b)) {
      const id = (b as MaybeBlock).id;
      if (typeof id === "string" && id.length > 0) out.push(id);
    }
  }
  return out;
}
