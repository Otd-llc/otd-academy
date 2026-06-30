// Metadata registry for the public /tools EE calculators.
//
// PURE DATA — no React, no client imports — so the sitemap (src/app/sitemap.ts)
// and the /tools hub can import the slug list without pulling a client bundle.
// The page bodies (prose + the calculator island) live in
// src/components/tools/* and are mapped by slug in src/app/tools/[slug]/page.tsx.
//
// `published`/`modified` are fixed ISO dates (workflow/runtime has no clock); bump
// `modified` by hand on a substantive edit.

export type ToolMeta = {
  slug: string;
  /** <title> + hub card title. */
  title: string;
  /** Short visible hero H1 (a few words — .bench-hero scales huge). */
  hero: string;
  /** Answer-first question — the JSON-LD TechArticle headline (SEO), not the visible hero. */
  h1: string;
  /** Meta description + hub blurb (~150 chars). */
  summary: string;
  keywords: string[];
  /**
   * Course slugs this tool is load-bearing for. Rendered as a "Tools for this
   * build" link on `/courses/[slug]` (cluster-wiring: the tool earns inbound
   * internal-link equity, the course gains a useful resource). Reuse a tool
   * across EVERY course where it genuinely applies; never force an irrelevant
   * link — relevance is the SEO signal, not link count.
   */
  relatedCourses: string[];
  published: string;
  modified: string;
};

export const TOOLS: ToolMeta[] = [
  {
    slug: "lipo-battery-runtime",
    title: "LiPo battery runtime calculator (ESP32 / microcontroller)",
    hero: "LiPo battery runtime",
    h1: "How long will a LiPo run my ESP32 board?",
    summary:
      "Estimate runtime from battery capacity, average current draw, and usable capacity. Worked from a real ESP32-S3 board's measured budget.",
    keywords: [
      "lipo battery runtime calculator",
      "esp32 battery life",
      "battery life calculator mah",
      "microcontroller runtime",
    ],
    relatedCourses: [
      "l1-01-wroom-breakout",
      "l2-01-battery-power-module",
      "l3-04-bms",
    ],
    published: "2026-06-29",
    modified: "2026-06-29",
  },
  {
    slug: "ws2812-power-supply",
    title: "WS2812 / NeoPixel power supply calculator",
    hero: "WS2812 power supply",
    h1: "What size power supply does my WS2812 strip need?",
    summary:
      "Size a 5 V supply for an addressable LED string from pixel count, per-pixel draw, and headroom. Grounded in the WS2812B datasheet figure.",
    keywords: [
      "ws2812 power supply calculator",
      "neopixel power calculator",
      "led strip current calculator",
      "ws2812b power",
    ],
    relatedCourses: ["l1-03-ws2812-node", "l3-03-lighting-array"],
    published: "2026-06-29",
    modified: "2026-06-29",
  },
];

export function getTool(slug: string): ToolMeta | undefined {
  return TOOLS.find((t) => t.slug === slug);
}

/**
 * Tools that are load-bearing for a given course — the course-page cluster link.
 * Empty for a course with no genuinely-relevant tool (that's fine; don't force).
 */
export function toolsForCourse(slug: string): ToolMeta[] {
  return TOOLS.filter((t) => t.relatedCourses.includes(slug));
}
