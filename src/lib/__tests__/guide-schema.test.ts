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
  it("accepts a bomTable block with and without a caption", () => {
    expect(contentBlockSchema.safeParse({ type: "bomTable" }).success).toBe(true);
    expect(contentBlockSchema.safeParse({ type: "bomTable", caption: "Parts" }).success).toBe(true);
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
  it("accepts a video block with a root-relative src", () => {
    expect(contentBlockSchema.safeParse({ type: "video", src: "/guide-media/x.mp4", alt: "a", caption: "c" }).success).toBe(true);
  });
  it("accepts an empty-src video block as a placeholder", () => {
    expect(contentBlockSchema.safeParse({ type: "video", src: "", alt: "solder a row" }).success).toBe(true);
  });
  it("rejects a javascript: video src", () => {
    expect(contentBlockSchema.safeParse({ type: "video", src: "javascript:alert(1)", alt: "a" }).success).toBe(false);
  });
  it("accepts a valid quiz block", () => {
    expect(contentBlockSchema.safeParse({
      type: "quiz",
      prompt: "Check your understanding",
      questions: [
        { q: "2 + 2?", options: ["3", "4", "5"], answer: 1, explain: "basic" },
        { q: "Pull-up holds a pin?", options: ["high", "low"], answer: 0 },
      ],
    }).success).toBe(true);
  });
  it("rejects a quiz answer index out of range", () => {
    expect(contentBlockSchema.safeParse({
      type: "quiz",
      questions: [{ q: "x", options: ["a", "b"], answer: 2 }],
    }).success).toBe(false);
  });
  it("rejects a quiz question with fewer than 2 options", () => {
    expect(contentBlockSchema.safeParse({
      type: "quiz",
      questions: [{ q: "x", options: ["only one"], answer: 0 }],
    }).success).toBe(false);
  });
  it("rejects a quiz with no questions", () => {
    expect(contentBlockSchema.safeParse({ type: "quiz", questions: [] }).success).toBe(false);
  });
  it("accepts a vendorCta with the digikey-bom vendor", () => {
    expect(contentBlockSchema.safeParse({ type: "vendorCta", vendor: "digikey-bom", label: "Shop the BOM at DigiKey" }).success).toBe(true);
  });
  it("rejects the removed newark-bom vendor", () => {
    expect(contentBlockSchema.safeParse({ type: "vendorCta", vendor: "newark-bom", label: "x" }).success).toBe(false);
  });
  it("accepts a valid deepDive block", () => {
    expect(contentBlockSchema.safeParse({ type: "deepDive", summary: "Why a low-dropout part?", body: "Even when USB sags…" }).success).toBe(true);
  });
  it("rejects a deepDive with an empty summary", () => {
    expect(contentBlockSchema.safeParse({ type: "deepDive", summary: "", body: "x" }).success).toBe(false);
  });
  it("accepts a video block with a narration script", () => {
    expect(
      contentBlockSchema.safeParse({
        type: "video",
        src: "",
        alt: "solder a row",
        script: "Today we solder the first row. Take the iron…",
      }).success,
    ).toBe(true);
  });
  it("preserves script through parse (not stripped)", () => {
    const parsed = contentBlockSchema.safeParse({
      type: "video",
      src: "",
      alt: "a",
      script: "read me aloud",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      // discriminatedUnion strips unknown keys, so this only holds once `script`
      // is part of the schema — the whole point of this task.
      expect((parsed.data as { script?: string }).script).toBe("read me aloud");
    }
  });
  it("rejects a script over the 8000-char cap", () => {
    expect(
      contentBlockSchema.safeParse({
        type: "video",
        src: "",
        alt: "a",
        script: "x".repeat(8001),
      }).success,
    ).toBe(false);
  });
});

describe("signpost block types", () => {
  it("accepts a doSteps block", () => {
    const r = contentBlockSchema.safeParse({
      type: "doSteps",
      title: "wire the decoupling, then tie the module",
      body: "Caps first, right at U1's power pins.",
      steps: [{ text: "Drop a +3V3 port on C1.", proof: "C1 carries a +3V3 port." }],
    });
    expect(r.success, JSON.stringify(r)).toBe(true);
  });

  it("accepts a doSteps step with no proof", () => {
    const r = contentBlockSchema.safeParse({
      type: "doSteps",
      title: "x",
      body: "",
      steps: [{ text: "Do the thing." }],
    });
    expect(r.success).toBe(true);
  });

  it("rejects a doSteps block with no steps", () => {
    const r = contentBlockSchema.safeParse({ type: "doSteps", title: "x", body: "", steps: [] });
    expect(r.success).toBe(false);
  });

  it("accepts a traceList block", () => {
    const r = contentBlockSchema.safeParse({
      type: "traceList",
      headline: "what ERC can't catch",
      body: "ERC checks connectivity, not intent.",
      items: [{ text: "U2 VIN sits on +5V.", help: "The VIN wire lands on the +5V label." }],
    });
    expect(r.success, JSON.stringify(r)).toBe(true);
  });

  // discriminatedUnion STRIPS unknown keys, so asserting `.success` alone would
  // pass before `reason` exists. Assert the value survives the parse.
  it("accepts an optional reason on a callout and preserves it", () => {
    const r = contentBlockSchema.safeParse({
      type: "callout",
      severity: "warn",
      label: "02 · Set up PCBWay's rules",
      body: "Load the limits now.",
      reason: "Do this before you route, or you will redo it",
    });
    expect(r.success, JSON.stringify(r)).toBe(true);
    if (r.success) {
      expect((r.data as { reason?: string }).reason).toBe(
        "Do this before you route, or you will redo it",
      );
    }
  });

  it("still accepts a callout with no reason", () => {
    const r = contentBlockSchema.safeParse({
      type: "callout", severity: "info", label: "Note", body: "",
    });
    expect(r.success).toBe(true);
  });
});
