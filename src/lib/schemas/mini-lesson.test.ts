// Unit tests for the Library mini-lesson authoring schema (Task A9).
//
// The schema reuses `guideContentBlocksSchema` for content-block shape, then
// REJECTS any block whose type isn't on the Library allowlist
// (`LIBRARY_BLOCK_TYPES`) — so a project-coupled block (bomTable / partModel /
// action / kit / video) is refused at the authoring boundary, not just filtered
// at render time. Slug is kebab-case.
import { describe, expect, it } from "vitest";
import type { ContentBlock } from "@/lib/schemas/guide";
import { miniLessonInputSchema } from "@/lib/schemas/mini-lesson";

const proseAndYoutube: ContentBlock[] = [
  { type: "prose", md: "Some teaching prose." },
  { type: "youtube", videoId: "dQw4w9WgXcQ", title: "Demo clip" },
];

const withBomTable: ContentBlock[] = [
  { type: "prose", md: "Intro." },
  { type: "bomTable" },
];

function base(over: Record<string, unknown> = {}) {
  return {
    slug: "motor-imagery-bci",
    title: "Motor Imagery & the Mu Rhythm",
    contentBlocks: proseAndYoutube,
    ...over,
  };
}

describe("miniLessonInputSchema", () => {
  it("accepts a prose + youtube block set", () => {
    const r = miniLessonInputSchema.safeParse(base());
    expect(r.success).toBe(true);
  });

  it("rejects a block set containing a project-coupled bomTable block", () => {
    const r = miniLessonInputSchema.safeParse(base({ contentBlocks: withBomTable }));
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(JSON.stringify(r.error.issues)).toContain("project-coupled");
    }
  });

  it("rejects a non-kebab-case slug", () => {
    const r = miniLessonInputSchema.safeParse(base({ slug: "Not Kebab Case" }));
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes("slug"))).toBe(true);
    }
  });

  it("accepts optional relatedProjects links", () => {
    const r = miniLessonInputSchema.safeParse(
      base({
        relatedProjects: [
          { projectSlug: "l3-05-wireless-hub", role: "DOWN_FUNNEL", ordinal: 0 },
        ],
      }),
    );
    expect(r.success).toBe(true);
  });
});
