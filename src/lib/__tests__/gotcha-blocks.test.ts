import { describe, it, expect } from "vitest";
import { gotchaBlocksFor } from "@/lib/guide-templates/gotcha-blocks";

const wroom = { slug: "foundry-l1-01-wroom-breakout", track: "COMMS", requiresStripboard: false } as const;
const eeg = { slug: "foundry-l3-01-eeg-front-end", track: "SENSE", requiresStripboard: false } as const;

describe("gotchaBlocksFor", () => {
  it("attaches antenna keep-out to every board at LAYOUT", () => {
    const blocks = gotchaBlocksFor(wroom, "LAYOUT");
    expect(blocks.some((b) => b.type === "callout" && /antenna keep-out/i.test(b.label))).toBe(true);
  });
  it("attaches isolation post-reg only to isolated boards", () => {
    expect(gotchaBlocksFor(eeg, "LAYOUT").some((b) => /isolat/i.test((b as { label?: string }).label ?? ""))).toBe(true);
    expect(gotchaBlocksFor(wroom, "LAYOUT").some((b) => /isolat/i.test((b as { label?: string }).label ?? ""))).toBe(false);
  });
  it("does not attach antenna keep-out at REQUIREMENTS", () => {
    expect(gotchaBlocksFor(wroom, "REQUIREMENTS").some((b) => /antenna/i.test((b as { label?: string }).label ?? ""))).toBe(false);
  });
});
