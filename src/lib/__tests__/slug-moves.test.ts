// The table ships EMPTY (no lesson has ever been renamed or withdrawn), so these
// inject a fixture. Testing the shipped constant would only assert "still empty",
// which is a fact about today rather than about the mechanism -- and the whole
// point of the module is that the first real entry must work without redesign.
import { describe, expect, test } from "vitest";
import { resolveSlugMove, SLUG_MOVES, type MoveTable } from "@/lib/slug-moves";

const TABLE: MoveTable = {
  library: {
    "old-ohms-law": "ohms-law",
    withdrawn: null,
    "self-referential": "self-referential",
  },
  courses: { "old-course": "new-course" },
  parts: {},
};

describe("resolveSlugMove", () => {
  test("a renamed slug redirects to its replacement", () => {
    expect(resolveSlugMove("/library/old-ohms-law", TABLE)).toEqual({
      kind: "moved",
      to: "/library/ohms-law",
    });
  });

  test("the surface is preserved, not hardcoded to /library", () => {
    expect(resolveSlugMove("/courses/old-course", TABLE)).toEqual({
      kind: "moved",
      to: "/courses/new-course",
    });
  });

  test("a null target means withdrawn", () => {
    expect(resolveSlugMove("/library/withdrawn", TABLE)).toEqual({ kind: "gone" });
  });

  test("an unknown slug is not a move -- the request is served as it is today", () => {
    // This is the fail-open property the design turns on: everything not named in
    // the table keeps today's behaviour, so the table can never 404 a live lesson.
    expect(resolveSlugMove("/library/some-real-lesson", TABLE)).toBeNull();
  });

  test("an untabled surface is ignored", () => {
    expect(resolveSlugMove("/glossary/old-ohms-law", TABLE)).toBeNull();
  });

  test("the hub index is a real page, not a two-segment path", () => {
    expect(resolveSlugMove("/library", TABLE)).toBeNull();
  });

  test("a deeper path is not a route this owns", () => {
    expect(resolveSlugMove("/library/old-ohms-law/extra", TABLE)).toBeNull();
  });

  test("a trailing slash still resolves", () => {
    expect(resolveSlugMove("/library/old-ohms-law/", TABLE)).toEqual({
      kind: "moved",
      to: "/library/ohms-law",
    });
  });

  test("a percent-encoded old slug resolves", () => {
    expect(resolveSlugMove("/library/old%2Dohms%2Dlaw", TABLE)).toEqual({
      kind: "moved",
      to: "/library/ohms-law",
    });
  });

  test("a malformed escape is not a move", () => {
    // Unlike isUnknownStaticParam, which 404s a malformed param, this must NOT
    // claim a move it cannot resolve -- it would be redirecting to a guess.
    expect(resolveSlugMove("/library/%E0%A4%A", TABLE)).toBeNull();
  });

  test("an entry pointing at itself does not loop", () => {
    // A 308 to the same URL is an infinite redirect. Guarded in code rather than
    // trusted to the table, because the table is hand-edited.
    expect(resolveSlugMove("/library/self-referential", TABLE)).toBeNull();
  });

  test("the shipped table is empty, and every surface it names is a real prefix", () => {
    // Not "assert empty forever" -- assert that what ships today claims nothing,
    // and that a future entry lands under a prefix the app actually serves.
    for (const [surface, moves] of Object.entries(SLUG_MOVES)) {
      expect(["library", "courses", "parts"]).toContain(surface);
      expect(Object.keys(moves)).toEqual([]);
    }
  });
});
