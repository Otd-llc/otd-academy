import { describe, it, expect } from "vitest";
import { contentBlockSchema, completionRefSchema, guideContentBlocksSchema, guideCardInputSchema } from "@/lib/schemas/guide";

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
  it("applies the steps.ordered default", () => {
    const r = contentBlockSchema.parse({ type: "steps", items: ["a"] });
    expect((r as any).ordered).toBe(true);
  });
  it("applies the isGate default on a card", () => {
    const r = guideCardInputSchema.parse({ stage: "REQUIREMENTS", ordinal: 0, eyebrow: "PHASE 01", title: "REQUIREMENTS", contentBlocks: [] });
    expect(r.isGate).toBe(false);
  });
  it("accepts the none completionRef arm", () => {
    expect(completionRefSchema.safeParse({ kind: "none" }).success).toBe(true);
  });
  it("rejects a javascript: sourceRef href", () => {
    expect(contentBlockSchema.safeParse({ type: "sourceRef", label: "x", href: "javascript:alert(1)" }).success).toBe(false);
  });
  it("rejects a protocol-relative // sourceRef href (open-redirect)", () => {
    expect(contentBlockSchema.safeParse({ type: "sourceRef", label: "x", href: "//evil.com" }).success).toBe(false);
  });
  it("accepts an https:// sourceRef href", () => {
    expect(contentBlockSchema.safeParse({ type: "sourceRef", label: "x", href: "https://x" }).success).toBe(true);
  });
  it("accepts a root-relative sourceRef href", () => {
    expect(contentBlockSchema.safeParse({ type: "sourceRef", label: "x", href: "/rel/path" }).success).toBe(true);
  });
  it("accepts a partModel block with mpn + caption", () => {
    expect(contentBlockSchema.safeParse({ type: "partModel", mpn: "USB4110-GF-A", caption: "USB-C" }).success).toBe(true);
  });
  it("accepts a partModel block with no caption and an empty mpn (editor default)", () => {
    expect(contentBlockSchema.safeParse({ type: "partModel", mpn: "" }).success).toBe(true);
  });
  it("rejects a partModel mpn over 80 chars", () => {
    expect(contentBlockSchema.safeParse({ type: "partModel", mpn: "x".repeat(81) }).success).toBe(false);
  });
  it("accepts an image block with a root-relative src + alt + caption", () => {
    expect(contentBlockSchema.safeParse({ type: "image", src: "/guide-diagrams/x.svg", alt: "a", caption: "c" }).success).toBe(true);
  });
  it("accepts an image block with an empty src (editor default)", () => {
    expect(contentBlockSchema.safeParse({ type: "image", src: "", alt: "" }).success).toBe(true);
  });
  it("accepts an https:// image src", () => {
    expect(contentBlockSchema.safeParse({ type: "image", src: "https://x/y.png", alt: "a" }).success).toBe(true);
  });
  it("rejects a javascript: image src", () => {
    expect(contentBlockSchema.safeParse({ type: "image", src: "javascript:alert(1)", alt: "a" }).success).toBe(false);
  });
  it("rejects a protocol-relative // image src", () => {
    expect(contentBlockSchema.safeParse({ type: "image", src: "//evil.com/x.png", alt: "a" }).success).toBe(false);
  });
});
