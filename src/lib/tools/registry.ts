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
  {
    slug: "led-series-resistor",
    title: "LED series resistor calculator (Ω from supply, Vf, current)",
    hero: "LED series resistor",
    h1: "What resistor does my LED need?",
    summary:
      "Size an LED's current-limiting resistor from supply voltage, forward voltage, and target current. Gives the nearest E24 standard value and the power it burns.",
    keywords: [
      "led resistor calculator",
      "led series resistor",
      "current limiting resistor led",
      "led resistor value",
    ],
    relatedCourses: ["l1-01-wroom-breakout", "l2-04-power-led-driver"],
    published: "2026-06-30",
    modified: "2026-06-30",
  },
  {
    slug: "voltage-divider",
    title: "Voltage divider calculator (Vout, R1, R2)",
    hero: "Voltage divider",
    h1: "What does my voltage divider output?",
    summary:
      "Compute a resistive divider's output voltage and quiescent current from Vin, R1, and R2. Sized for fitting a higher voltage into an ESP32's 3.3 V ADC.",
    keywords: [
      "voltage divider calculator",
      "resistor divider calculator",
      "voltage divider output voltage",
      "adc voltage divider esp32",
    ],
    relatedCourses: [
      "l1-05-internal-adc",
      "l2-02-ads1220-sense",
      "bn-01-usb-c-power-meter",
    ],
    published: "2026-06-30",
    modified: "2026-06-30",
  },
  {
    slug: "ldo-headroom",
    title: "LDO headroom + dissipation calculator (linear regulator)",
    hero: "LDO headroom",
    h1: "Will my LDO regulate, and how hot will it get?",
    summary:
      "Check a linear regulator's headroom against its dropout and find the power it dissipates as heat, from Vin, Vout, dropout, and load current.",
    keywords: [
      "ldo dropout calculator",
      "ldo power dissipation calculator",
      "linear regulator heat calculator",
      "ldo headroom",
    ],
    relatedCourses: [
      "l1-01-wroom-breakout",
      "l1-04-single-servo",
      "l2-01-battery-power-module",
    ],
    published: "2026-06-30",
    modified: "2026-06-30",
  },
  {
    slug: "rc-filter-cutoff",
    title: "RC filter cutoff frequency calculator (first-order)",
    hero: "RC filter cutoff",
    h1: "What's my RC filter's cutoff frequency?",
    summary:
      "Find a first-order RC filter's −3 dB cutoff (fc = 1 / 2πRC) and time constant from R and C. For ADC anti-alias and noise filtering.",
    keywords: [
      "rc filter calculator",
      "rc cutoff frequency calculator",
      "low pass filter calculator",
      "rc time constant calculator",
    ],
    relatedCourses: [
      "l1-05-internal-adc",
      "l2-02-ads1220-sense",
      "l3-de-ads1292r",
    ],
    published: "2026-06-30",
    modified: "2026-06-30",
  },
  {
    slug: "pcb-trace-width",
    title: "PCB trace width calculator (IPC-2221)",
    hero: "PCB trace width",
    h1: "How wide does my PCB trace need to be?",
    summary:
      "Find the minimum trace width for a current at a chosen temperature rise (IPC-2221), for external or internal copper. Grounded in a real high-current board.",
    keywords: [
      "pcb trace width calculator",
      "ipc-2221 trace width",
      "trace width for current",
      "pcb trace current capacity",
    ],
    relatedCourses: [
      "l1-03-ws2812-node",
      "l2-01-battery-power-module",
      "l2-03-motor-driver",
      "l2-04-power-led-driver",
    ],
    published: "2026-06-30",
    modified: "2026-06-30",
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
