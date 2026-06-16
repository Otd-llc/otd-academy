import { describe, it, expect } from "vitest";
import {
  collectEmptyMedia,
  emptyMediaCount,
} from "@/lib/guide-media-queue";
import type { ContentBlock } from "@/lib/schemas/guide";

const emptyImg: ContentBlock = {
  type: "image",
  src: "",
  alt: "schematic",
  captureHint: "KiCad ▸ schematic",
};
const filledImg: ContentBlock = { type: "image", src: "/shot.png", alt: "x" };
const emptyVid: ContentBlock = { type: "video", src: "", alt: "route the diff pair" };
const prose: ContentBlock = { type: "prose", md: "hi" };

describe("collectEmptyMedia", () => {
  it("gathers only empty-src image/video slots, grouped by stage", () => {
    const q = collectEmptyMedia([
      { stage: "SCHEMATIC", blocks: [prose, emptyImg, filledImg] },
      { stage: "LAYOUT", blocks: [emptyVid] },
      { stage: "BRINGUP", blocks: [filledImg, prose] }, // nothing empty
    ]);
    expect(q.map((s) => s.stage)).toEqual(["SCHEMATIC", "LAYOUT"]);
    expect(q[0]!.slots).toHaveLength(1);
    expect(q[0]!.slots[0]).toMatchObject({ type: "image", captureHint: "KiCad ▸ schematic" });
    expect(q[1]!.slots[0]!.type).toBe("video");
  });

  it("omits a stage with no empty slots", () => {
    const q = collectEmptyMedia([
      { stage: "ORDERING", blocks: [filledImg, prose] },
    ]);
    expect(q).toHaveLength(0);
  });

  it("counts total slots across stages", () => {
    const q = collectEmptyMedia([
      { stage: "A", blocks: [emptyImg, emptyVid] },
      { stage: "B", blocks: [emptyImg] },
    ]);
    expect(emptyMediaCount(q)).toBe(3);
  });
});
