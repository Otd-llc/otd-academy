import { describe, it, expect } from "vitest";
import { BLOCK_TYPES, BLOCK_TYPE_LABELS, defaultBlock } from "@/lib/guide-block-defaults";
import { contentBlockSchema } from "@/lib/schemas/guide";

describe("guide block defaults", () => {
  it("lists all six block types", () => {
    expect([...BLOCK_TYPES].sort()).toEqual(
      ["callout", "prose", "sourceRef", "steps", "table", "termRef"],
    );
  });
  it("has a human label for every type", () => {
    for (const t of BLOCK_TYPES) expect(BLOCK_TYPE_LABELS[t]).toBeTruthy();
  });
  it("defaultBlock(type) passes contentBlockSchema for every type", () => {
    for (const t of BLOCK_TYPES) {
      const r = contentBlockSchema.safeParse(defaultBlock(t));
      expect(r.success, `${t} default should be valid: ${JSON.stringify(r)}`).toBe(true);
    }
  });
  it("defaultBlock returns the requested type", () => {
    expect(defaultBlock("callout").type).toBe("callout");
    expect(defaultBlock("table").type).toBe("table");
  });
});
