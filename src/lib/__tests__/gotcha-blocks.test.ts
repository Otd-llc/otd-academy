import { describe, it, expect } from "vitest";
import {
  gotchaBlocksFor,
  type GuideProjectFacts,
} from "@/lib/guide-templates/gotcha-blocks";
import { GUIDE_STAGES } from "@/lib/guide-templates/stage-skeletons";

const wroom = { slug: "foundry-l1-01-wroom-breakout", track: "COMMS", requiresStripboard: false } as const;
const eeg = { slug: "foundry-l3-01-eeg-front-end", track: "SENSE", requiresStripboard: false } as const;

// The exact 22 `foundry-*` slugs from the seed's PROJECTS array
// (scripts/populate-curriculum-dag.ts), with each project's `track` and
// `requiresStripboard` so we can build real `GuideProjectFacts`. This is the
// "single source of truth must match the seed" guard: if a slug is renamed or a
// gotcha predicate goes over-broad, the matched-set assertions below fail loudly.
const ALL_SLUGS: GuideProjectFacts[] = [
  { slug: "foundry-l1-01-wroom-breakout", track: "COMMS", requiresStripboard: false },
  { slug: "foundry-l1-02-espnow-link", track: "COMMS", requiresStripboard: true },
  { slug: "foundry-l1-03-ws2812-node", track: "ACT", requiresStripboard: true },
  { slug: "foundry-l1-04-single-servo", track: "ACT", requiresStripboard: true },
  { slug: "foundry-l1-05-internal-adc", track: "SENSE", requiresStripboard: true },
  { slug: "foundry-l2-01-battery-power-module", track: "POWER", requiresStripboard: false },
  { slug: "foundry-l2-02-ads1220-sense", track: "SENSE", requiresStripboard: false },
  { slug: "foundry-l2-03-motor-driver", track: "ACT", requiresStripboard: false },
  { slug: "foundry-l2-04-power-led-driver", track: "POWER", requiresStripboard: false },
  { slug: "foundry-l2-05-isolated-spi-bridge", track: "COMMS", requiresStripboard: false },
  { slug: "foundry-l3-01-eeg-front-end", track: "SENSE", requiresStripboard: false },
  { slug: "foundry-l3-02-brushless-motor", track: "ACT", requiresStripboard: false },
  { slug: "foundry-l3-03-lighting-array", track: "ACT", requiresStripboard: false },
  { slug: "foundry-l3-04-bms", track: "POWER", requiresStripboard: false },
  { slug: "foundry-l3-05-wireless-hub", track: "COMMS", requiresStripboard: false },
  { slug: "foundry-l3-de-ads1292r", track: "SENSE", requiresStripboard: false },
  { slug: "foundry-bn-01-usb-c-power-meter", track: "POWER", requiresStripboard: false },
  { slug: "foundry-bn-02-dc-electronic-load", track: "POWER", requiresStripboard: false },
  { slug: "foundry-bn-03-dds-function-generator", track: "ACT", requiresStripboard: false },
  { slug: "foundry-bn-04-curve-tracer", track: "SENSE", requiresStripboard: false },
  { slug: "foundry-bn-05-spot-welder-controller", track: "POWER", requiresStripboard: false },
  { slug: "foundry-bn-06-tec-thermal-chamber", track: "POWER", requiresStripboard: false },
];

// For a given gotcha (identified by a stable marker in its callout `label`),
// the set of slugs that get at least one matching block at ANY guide stage.
function slugsMatching(labelRe: RegExp): string[] {
  return ALL_SLUGS.filter((p) =>
    GUIDE_STAGES.some((stage) =>
      gotchaBlocksFor(p, stage).some(
        (b) => b.type === "callout" && labelRe.test(b.label),
      ),
    ),
  ).map((p) => p.slug);
}

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

  // Guards the file's "single source of truth must match the seed" claim, which
  // is otherwise enforced only by a comment. Each gotcha's matched slug-set (over
  // the full 22 real curriculum slugs, across every stage) must equal exactly the
  // set the seed targets. A slug rename or an over-broad regex fails here.
  describe("gotcha → seed agreement (all 22 curriculum slugs)", () => {
    it("antenna keep-out attaches to ALL 22 slugs", () => {
      expect(slugsMatching(/antenna/i).sort()).toEqual(
        ALL_SLUGS.map((p) => p.slug).sort(),
      );
    });
    it("antenna keep-out attaches at LAYOUT specifically", () => {
      // every slug gets the antenna block at LAYOUT (the only stage it applies at)
      for (const p of ALL_SLUGS) {
        expect(
          gotchaBlocksFor(p, "LAYOUT").some(
            (b) => b.type === "callout" && /antenna/i.test(b.label),
          ),
        ).toBe(true);
      }
    });
    it("isolation post-reg attaches to EXACTLY the two isolated boards", () => {
      expect(slugsMatching(/isolat/i).sort()).toEqual(
        ["foundry-l2-05-isolated-spi-bridge", "foundry-l3-01-eeg-front-end"].sort(),
      );
    });
    it("ws2812 attaches to EXACTLY the ws2812 node + lighting array", () => {
      expect(slugsMatching(/ws2812/i).sort()).toEqual(
        ["foundry-l1-03-ws2812-node", "foundry-l3-03-lighting-array"].sort(),
      );
    });
    it("servo/brownout attaches to EXACTLY the single-servo + brushless boards", () => {
      expect(slugsMatching(/servo|brownout/i).sort()).toEqual(
        ["foundry-l1-04-single-servo", "foundry-l3-02-brushless-motor"].sort(),
      );
    });
    it("adc1 attaches to EXACTLY the internal-adc board", () => {
      expect(slugsMatching(/adc1/i)).toEqual(["foundry-l1-05-internal-adc"]);
    });
    it("auto-shutoff attaches to EXACTLY the 6 bench-tool slugs", () => {
      expect(slugsMatching(/auto-shutoff|power-bank/i).sort()).toEqual(
        [
          "foundry-bn-01-usb-c-power-meter",
          "foundry-bn-02-dc-electronic-load",
          "foundry-bn-03-dds-function-generator",
          "foundry-bn-04-curve-tracer",
          "foundry-bn-05-spot-welder-controller",
          "foundry-bn-06-tec-thermal-chamber",
        ].sort(),
      );
    });
  });
});
