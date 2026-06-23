import { describe, it, expect } from "vitest";
import { buildImageSitemapXml } from "../build";
import { mapDiagramsToPages, mapLessonDiagramsToPages } from "@/lib/diagram-usage";

describe("buildImageSitemapXml", () => {
  it("emits an image entry per diagram bound to its page url", () => {
    const xml = buildImageSitemapXml([
      {
        pageUrl: "https://x/projects/l1-01/v1/guide/SCHEMATIC",
        images: [{ loc: "https://x/guide-diagrams/a.webp", caption: "alt text" }],
      },
    ]);
    expect(xml).toContain('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"');
    expect(xml).toContain("<loc>https://x/projects/l1-01/v1/guide/SCHEMATIC</loc>");
    expect(xml).toContain("<image:loc>https://x/guide-diagrams/a.webp</image:loc>");
    expect(xml).toContain("<image:caption>alt text</image:caption>");
  });

  it("escapes XML-significant characters in captions", () => {
    const xml = buildImageSitemapXml([
      { pageUrl: "https://x/p", images: [{ loc: "https://x/a.webp", caption: "A & B < C" }] },
    ]);
    expect(xml).toContain("A &amp; B &lt; C");
  });
});

describe("mapDiagramsToPages", () => {
  const projects = [
    { slug: "l1-01", accessTier: "PUBLIC", label: "v1", publishedRevisionId: "rev_pub" },
    { slug: "l2-01", accessTier: "PREMIUM", label: "v1", publishedRevisionId: "rev_prem" },
  ];

  it("maps a diagram in a published PUBLIC card to its stage URL", () => {
    const out = mapDiagramsToPages(
      projects,
      [{ revisionId: "rev_pub", stage: "SCHEMATIC", blocks: [{ type: "image", src: "/guide-diagrams/adc1-pin-map.svg" }] }],
      "https://x",
    );
    expect(out["adc1-pin-map"]).toEqual(["https://x/projects/l1-01/v1/guide/SCHEMATIC"]);
  });

  it("ignores cards from a non-published revision", () => {
    const out = mapDiagramsToPages(
      projects,
      [{ revisionId: "rev_OLD", stage: "SCHEMATIC", blocks: [{ src: "/guide-diagrams/adc1-pin-map.svg" }] }],
      "https://x",
    );
    expect(out).toEqual({});
  });

  it("omits PREMIUM non-REQUIREMENTS stages (paywalled / noindex)", () => {
    const out = mapDiagramsToPages(
      projects,
      [{ revisionId: "rev_prem", stage: "SCHEMATIC", blocks: [{ src: "/guide-diagrams/adc1-pin-map.svg" }] }],
      "https://x",
    );
    expect(out).toEqual({});
  });

  it("includes the PREMIUM REQUIREMENTS preview", () => {
    const out = mapDiagramsToPages(
      projects,
      [{ revisionId: "rev_prem", stage: "REQUIREMENTS", blocks: [{ src: "/guide-diagrams/mpn-anatomy.svg" }] }],
      "https://x",
    );
    expect(out["mpn-anatomy"]).toEqual(["https://x/projects/l2-01/v1/guide/REQUIREMENTS"]);
  });

  it("ignores non-diagram image srcs", () => {
    const out = mapDiagramsToPages(
      projects,
      [{ revisionId: "rev_pub", stage: "SCHEMATIC", blocks: [{ src: "/api/shot/foo.webp" }, { src: "/guide-diagrams/x.png" }] }],
      "https://x",
    );
    expect(out).toEqual({});
  });
});

describe("mapLessonDiagramsToPages", () => {
  it("maps a library lesson's diagram to its /library/<slug> url", () => {
    const out = mapLessonDiagramsToPages(
      [{ slug: "motor-imagery-bci", blocks: [{ type: "prose", md: "x" }, { type: "image", src: "/guide-diagrams/mu-rhythm-erd.svg" }] }],
      "https://x",
    );
    expect(out["mu-rhythm-erd"]).toEqual(["https://x/library/motor-imagery-bci"]);
  });

  it("collects the same diagram from multiple lessons and ignores non-diagram srcs", () => {
    const out = mapLessonDiagramsToPages(
      [
        { slug: "a", blocks: [{ type: "image", src: "/guide-diagrams/eeg-bci-pipeline.svg" }] },
        { slug: "b", blocks: [{ type: "image", src: "/guide-diagrams/eeg-bci-pipeline.svg" }, { src: "/api/shot/z.webp" }] },
      ],
      "https://x",
    );
    expect(out["eeg-bci-pipeline"].sort()).toEqual(["https://x/library/a", "https://x/library/b"]);
    expect(Object.keys(out)).toEqual(["eeg-bci-pipeline"]);
  });
});
