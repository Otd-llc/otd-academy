import { describe, it, expect } from "vitest";
import { canonicalLessonPath } from "@/lib/seo/canonical";

describe("canonicalLessonPath", () => {
  it("points at the published revision label, not the viewed one", () => {
    expect(
      canonicalLessonPath({
        slug: "wroom",
        publishedLabel: "v1",
        stage: "REQUIREMENTS",
      }),
    ).toBe("/projects/wroom/v1/guide/REQUIREMENTS");
  });
  it("returns null when there is no published revision", () => {
    expect(
      canonicalLessonPath({
        slug: "wroom",
        publishedLabel: null,
        stage: "REQUIREMENTS",
      }),
    ).toBeNull();
  });
});
