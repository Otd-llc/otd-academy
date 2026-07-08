// src/lib/library/block-allowlist.test.ts
import { describe, expect, it } from "vitest";
import {
  LIBRARY_BLOCK_TYPES,
  isLibraryBlock,
  filterLibraryBlocks,
} from "@/lib/library/block-allowlist";
import type { ContentBlock } from "@/lib/schemas/guide";

describe("library block allowlist", () => {
  it("allows the public-safe block types", () => {
    for (const t of ["prose", "heading", "callout", "steps", "table", "image", "quiz", "sourceRef", "deepDive", "termRef", "vendorCta", "youtube", "calculator", "math"]) {
      expect(LIBRARY_BLOCK_TYPES.has(t)).toBe(true);
    }
  });

  it("excludes project/enrollment-coupled block types", () => {
    for (const t of ["partModel", "bomTable", "action", "kit", "video"]) {
      expect(LIBRARY_BLOCK_TYPES.has(t)).toBe(false);
    }
  });

  it("filterLibraryBlocks drops disallowed blocks, preserves order", () => {
    const blocks = [
      { type: "prose", md: "hi" },
      { type: "bomTable" },
      { type: "youtube", videoId: "abc", title: "t" },
    ] as ContentBlock[];
    const kept = filterLibraryBlocks(blocks);
    expect(kept.map((b) => b.type)).toEqual(["prose", "youtube"]);
  });

  it("isLibraryBlock narrows a single block", () => {
    expect(isLibraryBlock({ type: "kit", items: [] } as unknown as ContentBlock)).toBe(false);
    expect(isLibraryBlock({ type: "prose", md: "x" } as ContentBlock)).toBe(true);
  });
});
