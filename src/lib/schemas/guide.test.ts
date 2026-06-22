import { describe, expect, it } from "vitest";
import { contentBlockSchema } from "@/lib/schemas/guide";

describe("youtube content block", () => {
  it("accepts a minimal valid youtube block", () => {
    const r = contentBlockSchema.safeParse({
      type: "youtube",
      videoId: "dQw4w9WgXcQ",
      title: "How the ADS1299 samples 8 channels",
    });
    expect(r.success).toBe(true);
  });

  it("accepts an optional caption and start offset", () => {
    const r = contentBlockSchema.safeParse({
      type: "youtube",
      videoId: "dQw4w9WgXcQ",
      title: "Routing the EEG front-end",
      caption: "Full build at academy.onethousanddrones.com",
      start: 42,
    });
    expect(r.success).toBe(true);
  });

  it("accepts an empty videoId as a 'to be added' placeholder (mirrors image/video)", () => {
    const r = contentBlockSchema.safeParse({ type: "youtube", videoId: "", title: "" });
    expect(r.success).toBe(true);
  });

  it("rejects a NON-empty videoId with URL/path characters (must be a bare id)", () => {
    const r = contentBlockSchema.safeParse({
      type: "youtube",
      videoId: "https://youtu.be/abc",
      title: "x",
    });
    expect(r.success).toBe(false);
  });
});
