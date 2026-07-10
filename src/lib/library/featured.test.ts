import { describe, it, expect } from "vitest";

import {
  pickFeatured,
  pickFreshRail,
  FEATURED_SLUGS,
  type LessonMeta,
} from "@/lib/library/featured";

// Build a lesson with sane defaults; override what a case cares about.
function lesson(over: Partial<LessonMeta> & { slug: string }): LessonMeta {
  const created = over.createdAt ?? new Date("2026-07-01");
  return {
    title: over.slug,
    summary: null,
    cluster: "fundamentals",
    clusterOrdinal: 0,
    createdAt: created,
    updatedAt: over.updatedAt ?? created,
    ...over,
  };
}

describe("pickFeatured", () => {
  it("returns the configured slugs in order when they are live", () => {
    const lessons = [
      lesson({ slug: "other", cluster: "eeg-bci" }),
      lesson({ slug: FEATURED_SLUGS[1], cluster: "fundamentals" }),
      lesson({ slug: FEATURED_SLUGS[0], cluster: "eeg-bci" }),
    ];
    const picked = pickFeatured(lessons);
    expect(picked.map((l) => l.slug)).toEqual(FEATURED_SLUGS);
  });

  it("fills from the freshest of an unused cluster when a config slug is absent", () => {
    // Only the first configured slug is live; the second slot must come from a
    // DIFFERENT cluster than the resolved lead, freshest first.
    const lessons = [
      lesson({ slug: FEATURED_SLUGS[0], cluster: "eeg-bci" }),
      lesson({ slug: "stale-fund", cluster: "fundamentals", updatedAt: new Date("2026-07-02") }),
      lesson({ slug: "fresh-fund", cluster: "fundamentals", updatedAt: new Date("2026-07-09") }),
      lesson({ slug: "fresh-eeg-2", cluster: "eeg-bci", updatedAt: new Date("2026-07-10") }),
    ];
    const picked = pickFeatured(lessons);
    expect(picked).toHaveLength(2);
    expect(picked[0].slug).toBe(FEATURED_SLUGS[0]);
    // second is the freshest from a not-yet-used cluster (fundamentals), not the
    // even-fresher eeg row (its cluster is already used by the lead).
    expect(picked[1].slug).toBe("fresh-fund");
  });

  it("never repeats a cluster when more than one cluster exists", () => {
    const lessons = [
      lesson({ slug: "a", cluster: "eeg-bci", updatedAt: new Date("2026-07-10") }),
      lesson({ slug: "b", cluster: "eeg-bci", updatedAt: new Date("2026-07-09") }),
      lesson({ slug: "c", cluster: "power-batteries", updatedAt: new Date("2026-07-08") }),
    ];
    const picked = pickFeatured(lessons);
    expect(new Set(picked.map((l) => l.cluster)).size).toBe(2);
  });
});

describe("pickFreshRail", () => {
  it("caps to one per cluster, newest first, with correct NEW/UPD tags", () => {
    const lessons = [
      lesson({ slug: "eeg-new", cluster: "eeg-bci", createdAt: new Date("2026-07-10"), updatedAt: new Date("2026-07-10") }),
      lesson({ slug: "eeg-older", cluster: "eeg-bci", updatedAt: new Date("2026-07-05") }),
      lesson({ slug: "fund-upd", cluster: "fundamentals", createdAt: new Date("2026-07-01"), updatedAt: new Date("2026-07-09") }),
    ];
    const rail = pickFreshRail(lessons, { limit: 6, perCluster: 1 });
    expect(rail.map((l) => l.slug)).toEqual(["eeg-new", "fund-upd"]);
    expect(rail[0].freshTag).toBe("NEW"); // created == updated
    expect(rail[1].freshTag).toBe("UPD"); // updated after created
  });

  it("respects the limit", () => {
    const lessons = ["a", "b", "c", "d"].map((slug, i) =>
      lesson({ slug, cluster: slug, updatedAt: new Date(2026, 6, 10 - i) }),
    );
    expect(pickFreshRail(lessons, { limit: 2 })).toHaveLength(2);
  });
});
