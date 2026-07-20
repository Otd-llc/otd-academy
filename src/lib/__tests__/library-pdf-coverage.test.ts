import { describe, it, expect } from "vitest";
import { BLOCK_TYPES, defaultBlock } from "@/lib/guide-block-defaults";
import { LIBRARY_BLOCK_TYPES } from "@/lib/library/block-allowlist";
import { renderBlockToPdf } from "@/lib/pdf/library-pdf";

// library-pdf's switch ends in `default: return null`, so a missing case is
// invisible to tsc AND to the eye until someone prints a PDF and finds a hole.
// It is the only contentBlocks consumer with no compiler backstop, so this test
// is the backstop.
//
// SCOPE: this renderer prints /library mini-lessons only — there is no
// build-guide PDF route — and the public page filters through
// LIBRARY_BLOCK_TYPES. So a project-coupled type (bomTable, partModel, action,
// kit, mp4 video) rendering null here is CORRECT: it can never reach this
// renderer. Only library-allowed types are required to print.
//
// EMPTY-MEDIA EXEMPTION: `image` and `youtube` legitimately return null for an
// EMPTY block (no src / no videoId), and `defaultBlock` produces exactly that.
// Their case exists and is exercised by the Library set; a blank media slot
// printing nothing is the intended behaviour, not a hole. Everything else must
// print something even at its default.
const EMPTY_DEFAULT_PRINTS_NOTHING = new Set(["image", "youtube"]);

describe("library PDF block coverage", () => {
  it("renders every library-allowed block type to a non-null node", () => {
    const required = BLOCK_TYPES.filter(
      (t) => LIBRARY_BLOCK_TYPES.has(t) && !EMPTY_DEFAULT_PRINTS_NOTHING.has(t),
    );
    const holes = required.filter(
      (t) => renderBlockToPdf(defaultBlock(t), new Map()) === null,
    );
    expect(holes, "these block types print NOTHING in the field-guide PDF").toEqual(
      [],
    );
  });

  // Guards the exemption above from quietly widening: if a third type ever needs
  // to be exempt, that is a decision to make explicitly, not by editing a set.
  it("keeps the empty-media exemption to exactly image and youtube", () => {
    expect([...EMPTY_DEFAULT_PRINTS_NOTHING].sort()).toEqual(["image", "youtube"]);
  });
});
