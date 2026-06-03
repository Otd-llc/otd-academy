import { describe, it, expect } from "vitest";
import { collectBlockErrors } from "@/lib/guide-card-errors";

describe("collectBlockErrors", () => {
  it("returns [] for undefined input", () => {
    expect(collectBlockErrors(undefined, 0)).toEqual([]);
  });

  it("returns [] when no key targets the block", () => {
    expect(
      collectBlockErrors({ "contentBlocks.2.label": ["bad"] }, 0),
    ).toEqual([]);
  });

  it("surfaces a sub-field error, stripping the prefix", () => {
    expect(
      collectBlockErrors({ "contentBlocks.0.label": ["Required"] }, 0),
    ).toEqual(["label: Required"]);
  });

  it("surfaces a bare block-level key verbatim (no leading colon)", () => {
    expect(collectBlockErrors({ "contentBlocks.3": ["Invalid block"] }, 3)).toEqual([
      "Invalid block",
    ]);
  });

  it("surfaces nested sub-paths with the full sub-key", () => {
    expect(
      collectBlockErrors({ "contentBlocks.1.rows.0.2.text": ["Too long"] }, 1),
    ).toEqual(["rows.0.2.text: Too long"]);
  });

  it("does not match a longer index that merely shares the prefix digits", () => {
    // index 1 must NOT collect contentBlocks.10.* (the boundary dot guards it).
    expect(
      collectBlockErrors(
        {
          "contentBlocks.1.label": ["mine"],
          "contentBlocks.10.label": ["theirs"],
        },
        1,
      ),
    ).toEqual(["label: mine"]);
  });

  it("collects multiple messages across keys for the same block", () => {
    expect(
      collectBlockErrors(
        {
          "contentBlocks.0.label": ["A", "B"],
          "contentBlocks.0.body": ["C"],
        },
        0,
      ).sort(),
    ).toEqual(["body: C", "label: A", "label: B"]);
  });
});
