import { describe, it, expect } from "vitest";
import { contentBlockSchema, completionRefSchema, guideContentBlocksSchema } from "@/lib/schemas/guide";

describe("guide schemas", () => {
  it("accepts a valid callout block", () => {
    const r = contentBlockSchema.safeParse({ type: "callout", severity: "critical", label: "X", body: "Y" });
    expect(r.success).toBe(true);
  });
  it("rejects an unknown block type", () => {
    expect(contentBlockSchema.safeParse({ type: "nope" }).success).toBe(false);
  });
  it("rejects a callout with a bad severity", () => {
    expect(contentBlockSchema.safeParse({ type: "callout", severity: "boom", label: "X", body: "Y" }).success).toBe(false);
  });
  it("validates a block array", () => {
    expect(guideContentBlocksSchema.safeParse([{ type: "prose", md: "hi" }]).success).toBe(true);
  });
  it("accepts a revisionChecklist completionRef", () => {
    expect(completionRefSchema.safeParse({ kind: "revisionChecklist", subkind: "LAYOUT_REVIEW" }).success).toBe(true);
  });
  it("rejects a completionRef with an invalid subkind", () => {
    expect(completionRefSchema.safeParse({ kind: "revisionChecklist", subkind: "NOPE" }).success).toBe(false);
  });
});
