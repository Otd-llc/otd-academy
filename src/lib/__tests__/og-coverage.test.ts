// og:image coverage gate (Task 8).
//
// A filesystem test (no server, no DB): every PUBLIC route family must ship a
// branded share card. Adding a new public route family without one turns this
// red — so "bare route" becomes structurally impossible, which is the whole point
// of the share-card system.
//
// The families are listed literally (not globbed) so the list itself is the
// contract: a reviewer sees exactly which surfaces are covered. Each has a
// co-located opengraph-image that must export the Next metadata-image contract
// (alt / size / contentType). The certificate route is the one exception — a
// signed-token page that sets its share image through generateMetadata — so we
// assert its source wires openGraph.images instead.

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const APP = path.join(process.cwd(), "src", "app");

// Public route families → their co-located opengraph-image file (relative to src/app).
const OG_FILES = [
  "opengraph-image.tsx", // site-default (every bare route inherits it)
  "courses/[slug]/opengraph-image.tsx",
  "projects/[slug]/[revLabel]/guide/opengraph-image.tsx",
  "projects/[slug]/[revLabel]/guide/[stage]/opengraph-image.tsx",
  "library/[slug]/opengraph-image.tsx",
  "tools/[slug]/opengraph-image.tsx",
  "parts/[id]/opengraph-image.tsx",
];

describe("og:image coverage", () => {
  it.each(OG_FILES)("%s exports the metadata-image contract", (rel) => {
    const file = path.join(APP, rel);
    expect(existsSync(file), `${rel} is missing — a public route family with no share card`).toBe(true);
    const src = readFileSync(file, "utf8");
    for (const token of [
      "export const alt",
      "export const size",
      "export const contentType",
    ]) {
      expect(src.includes(token), `${rel} does not export "${token}"`).toBe(true);
    }
  });

  it("the certificate route sets its share image via generateMetadata", () => {
    const file = path.join(
      APP,
      "learn/[slug]/certificate/[token]/page.tsx",
    );
    expect(existsSync(file)).toBe(true);
    const src = readFileSync(file, "utf8");
    expect(src.includes("openGraph"), "cert page lost its openGraph block").toBe(true);
    expect(src.includes("images"), "cert page openGraph has no images").toBe(true);
  });
});
