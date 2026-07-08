import { describe, expect, it } from "vitest";
import { contentBlockSchema } from "@/lib/schemas/guide";

describe("heading content block", () => {
  it("accepts a heading with default level", () => {
    expect(contentBlockSchema.safeParse({ type: "heading", text: "What is motor imagery?" }).success).toBe(true);
  });
  it("accepts an explicit level 2 or 3", () => {
    expect(contentBlockSchema.safeParse({ type: "heading", text: "Sub", level: 3 }).success).toBe(true);
    expect(contentBlockSchema.safeParse({ type: "heading", text: "Sec", level: 2 }).success).toBe(true);
  });
  it("rejects empty text and out-of-range levels", () => {
    expect(contentBlockSchema.safeParse({ type: "heading", text: "" }).success).toBe(false);
    expect(contentBlockSchema.safeParse({ type: "heading", text: "x", level: 1 }).success).toBe(false);
    expect(contentBlockSchema.safeParse({ type: "heading", text: "x", level: 4 }).success).toBe(false);
  });
});

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

describe("calculator content block", () => {
  it("accepts a valid calculator block (slug only)", () => {
    expect(contentBlockSchema.safeParse({ type: "calculator", slug: "voltage-divider" }).success).toBe(true);
  });
  it("accepts an optional caption", () => {
    const r = contentBlockSchema.safeParse({ type: "calculator", slug: "ohms-law", caption: "Try it" });
    expect(r.success).toBe(true);
  });
  it("rejects an empty slug (must reference a tool)", () => {
    expect(contentBlockSchema.safeParse({ type: "calculator", slug: "" }).success).toBe(false);
    expect(contentBlockSchema.safeParse({ type: "calculator", slug: "   " }).success).toBe(false);
  });
});
