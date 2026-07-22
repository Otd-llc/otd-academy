// Static data for the public brief pages (/briefs/[key]).
//
// These are gate-less, crawlable marketing one-pagers. There is NO database
// behind them: every fact and line of copy is drawn verbatim from the academy
// sales kit (docs/sales/messaging-house.md + docs/sales/fact-sheet.md +
// docs/sales/pricing.md), the single source of truth for academy positioning.
// Voice rules are absolute: no em-dashes, sentence-case headers, answer-first,
// concrete. No fabricated metrics or testimonials.
//
// Two briefs ship: `overview` (the master one-pager, audience-neutral) and
// `learner` (the self-serve learner pitch). The page (src/app/briefs/[key]/
// page.tsx) renders one shared layout over this data, and the index
// (src/app/briefs/page.tsx) lists them.

export type BriefKey = "overview" | "learner";

export interface BriefCta {
  /** Button label (sentence-case, action-first). */
  label: string;
  /** Internal href (down-funnel). */
  href: string;
  /** Whether this is the primary (solid gold) CTA. */
  primary: boolean;
}

export interface BriefProofPoint {
  /** A short bold lead-in (e.g. "You ship boards, not quizzes."). */
  lead: string;
  /** The supporting sentence. */
  body: string;
}

export interface BriefStat {
  /** The figure (e.g. "22"). */
  value: string;
  /** What it counts (e.g. "boards in the curriculum"). */
  label: string;
}

export interface BriefData {
  key: BriefKey;
  /** Mono eyebrow above the hero (e.g. "BRIEF / OVERVIEW"). */
  eyebrow: string;
  /** Bebas hero title. */
  title: string;
  /** Optional trailing word of `title` rendered in gold. */
  accentWord?: string;
  /** Lora-italic lead under the hero (answer-first). */
  lead: string;
  /** Meta-strip key/value pairs (mono). */
  meta: { label: string; value: string }[];
  /** SEO title + description (used by generateMetadata). */
  seoTitle: string;
  seoDescription: string;
  /** The value-proposition section: heading + one or two paragraphs. */
  valueHeading: string;
  valueBody: string[];
  /** The differentiators / proof points. */
  proofHeading: string;
  proofPoints: BriefProofPoint[];
  /** Down-funnel CTAs. */
  ctas: BriefCta[];

  // ── Capability-brief document fields (the one-pager layout) ──
  /** Top-right brief label, e.g. "Capability brief · 00 / Overview". */
  briefLabel: string;
  /** Mono gold sub-headline under the hero. */
  subhead: string;
  /** The document body paragraph (verbatim from the one-pager). */
  docBody: string;
  /** A substring of docBody rendered in italic (the closing emphasis). */
  docEmphasis: string;
  /** The four headline stats: big figure, short caps label, one-line gloss. */
  stats: { value: string; label: string; desc: string }[];
}

// The system-spec block (top-right of the document hero). Shared by both briefs.
export const SYSTEM_SPEC: { label: string; value: string }[] = [
  { label: "Platform", value: "ESP32-S3" },
  { label: "Toolchain", value: "KiCad 10" },
  { label: "Program", value: "Brain-to-Swarm" },
  { label: "Structure", value: "4 tracks / 3 levels" },
  { label: "Access", value: "Public → Premium" },
];

// The document's primary CTA (the gold button), shared by both briefs.
export const DOC_CTA = {
  label: "Start free at L1.01",
  href: "/projects/l1-01-wroom-breakout/v1/guide",
};

// The four headline proof stats, shared across both briefs (fact-sheet "by the
// numbers" + "what makes a completion real"). Rendered as the stat strip.
export const PROOF_STATS: BriefStat[] = [
  { value: "22", label: "boards across four tracks and three levels" },
  { value: "8", label: "build stages on every project, requirements to bring-up" },
  { value: "DRC = 0", label: "a clean design-rule check is the real gate, not quizzes" },
  { value: "$0", label: "no subscription, one-time purchase per project, the first board free" },
];

// The curriculum system map: a root node fanning to the four tracks and two
// capstones. Rendered as a clean, responsive inline element (not a PCB graphic).
export const SYSTEM_MAP = {
  root: { label: "ESP32-S3", sub: "one platform, KiCad 10" },
  tracks: [
    { code: "SENSE", blurb: "read real-world signals" },
    { code: "ACT", blurb: "drive motors and lighting" },
    { code: "COMMS", blurb: "wireless links and meshes" },
    { code: "POWER", blurb: "batteries, charging, clean rails" },
  ],
  capstones: [
    { code: "EEG", blurb: "8-channel brain-computer-interface front-end" },
    { code: "HUB", blurb: "ESP-NOW wireless fleet hub" },
  ],
} as const;

export const BRIEFS: Record<BriefKey, BriefData> = {
  overview: {
    key: "overview",
    eyebrow: "BRIEF / OVERVIEW",
    title: "One mind. Many machines.",
    accentWord: "machines.",
    lead: "One Thousand Drones Academy teaches printed-circuit-board engineering through hands-on projects on the Espressif ESP32-S3, designed in KiCad 10. You take a real board from requirements to fab-ready gerbers, and you advance only when your design passes a clean design-rule check.",
    meta: [
      { label: "Platform", value: "ESP32-S3" },
      { label: "Tool", value: "KiCad 10" },
      { label: "Curriculum", value: "22 boards" },
    ],
    seoTitle: "Overview brief · One Thousand Drones Academy",
    seoDescription:
      "One Thousand Drones Academy teaches PCB engineering through real boards on the ESP32-S3 in KiCad 10. You advance only by passing a clean design-rule check, and each completed board earns a verifiable certificate.",
    valueHeading: "What it is",
    valueBody: [
      "You design a real circuit board end to end and walk away able to fabricate it. Each project runs the full engineering arc on the Espressif ESP32-S3 in KiCad 10: requirements, bill of materials, schematic capture, electrical-rules check, PCB layout, design-rule check, gerber export, and bring-up.",
      "You advance only by passing the same checks a working engineer passes, and each finished board earns a certificate anyone can verify. The catalog is 22 boards across four tracks and three levels, wired as one skill tree of 33 dependencies, converging on two capstones: an 8-channel EEG brain-computer-interface front-end and an ESP-NOW wireless fleet hub. The academy is the talent and hardware pipeline beneath One Thousand Drones LLC and its Brain-to-Swarm program.",
    ],
    proofHeading: "What makes it different",
    proofPoints: [
      {
        lead: "You ship boards, not quizzes.",
        body: "Progress is gated on a clean DRC and valid gerbers, not points or XP.",
      },
      {
        lead: "The full engineering arc, every project.",
        body: "Requirements through bring-up on the ESP32-S3 in KiCad 10, the same path a hardware team uses.",
      },
      {
        lead: "Buyable bills of materials.",
        body: "Each board's BOM is priced against live DigiKey stock and is one click to a cart.",
      },
      {
        lead: "Certificates you can check.",
        body: "Every completed project issues a sealed certificate, independently verifiable at /verify.",
      },
      {
        lead: "Designs are validated before you build.",
        body: "Each board passes a recursive design-validation protocol of 10 or more audit passes before any part is bought, and BOMs are re-checked nightly against live distributor stock.",
      },
    ],
    ctas: [
      { label: "See the courses", href: "/courses", primary: true },
      { label: "View pricing", href: "/pricing", primary: false },
    ],
    briefLabel: "Capability brief · 00 / Overview",
    subhead: "ESP32 hardware engineering · breakout to brain-computer interface",
    docBody:
      "Every project ends in a board you designed, fabricated, and brought up yourself, with the design files and a verifiable certificate to keep. Twenty-two builds carry you from a USB-C breakout to a brain-computer interface that reads a mind and commands a fleet.",
    docEmphasis: "reads a mind and commands a fleet",
    stats: [
      {
        value: "22",
        label: "Boards",
        desc: "Sense, Act, Comms, and Power, wired as one skill tree of 33 dependencies.",
      },
      {
        value: "8",
        label: "Stages each",
        desc: "Requirements, BOM, schematic, ERC, layout, DRC, gerbers, bring-up in KiCad.",
      },
      {
        value: "DRC = 0",
        label: "The real gate",
        desc: "You advance only on a clean check and fab-ready gerbers. Not points, not streaks.",
      },
      {
        value: "1×",
        label: "No subscription",
        desc: "Buy a project once and keep it. The first board is free.",
      },
    ],
  },
  learner: {
    key: "learner",
    eyebrow: "BRIEF / LEARNERS",
    title: "Design real boards, not watch videos about them.",
    accentWord: "them.",
    lead: "Tutorials teach concepts but never produce a manufacturable board, and there is no credible proof of the skill. At One Thousand Drones Academy you design a real PCB on the ESP32-S3 in KiCad 10, from requirements through schematic, layout, and gerber export, and you finish with a certificate anyone can verify. The first board is free.",
    meta: [
      { label: "Start at", value: "L1.01 (free)" },
      { label: "Platform", value: "ESP32-S3" },
      { label: "Tool", value: "KiCad 10" },
    ],
    seoTitle: "Learner brief · One Thousand Drones Academy",
    seoDescription:
      "Design a real PCB on the ESP32-S3 in KiCad 10, from requirements to fab-ready gerbers. You advance only by passing a clean design-rule check, and each board earns a verifiable certificate. The first board is free.",
    valueHeading: "Who it is for",
    valueBody: [
      "You can write firmware but you have never laid out a board. You hit a project that needs custom hardware, or you want a portfolio piece that proves you can ship a PCB. Most hardware courses stop at theory, so the skill stays unproven.",
      "At the academy you design a real PCB on the ESP32-S3 in KiCad 10, from requirements through schematic, layout, and gerber export. You advance only by passing a clean design-rule check, the same gate a working engineer passes. The board's parts are priced against live DigiKey stock and one click to a cart, so you can order and build it. The first board is free, and you pay once per project after that, with no subscription.",
    ],
    proofHeading: "What you get",
    proofPoints: [
      {
        lead: "A board you can hold.",
        body: "You take a board from requirements to fab-ready gerbers, order its priced BOM with one click, and bring up real hardware.",
      },
      {
        lead: "A gate that means something.",
        body: "You move on by producing a clean DRC and valid gerbers, which means you have actually designed a manufacturable board.",
      },
      {
        lead: "Proof you can show.",
        body: "Each finished project issues a sealed certificate that anyone can independently check at /verify.",
      },
      {
        lead: "A path that starts free.",
        body: "The first board is free, and paid projects start at $49. You pay once per project, with no subscription.",
      },
    ],
    ctas: [
      {
        label: "Start free at L1.01",
        href: "/projects/l1-01-wroom-breakout/v1/guide",
        primary: true,
      },
      { label: "Create a free account", href: "/sign-in", primary: false },
    ],
    briefLabel: "Learner brief · 01 / The build",
    subhead: "Learn to design real circuit boards · no prior PCB experience needed",
    docBody:
      "Start with a USB-C breakout and a real parts list. Each project takes you from a checklist to a finished board: schematic, layout, checks, gerbers, build. The path runs to a brain-computer interface that reads a mind and commands a fleet.",
    docEmphasis: "reads a mind and commands a fleet",
    stats: [
      {
        value: "22",
        label: "Boards you build",
        desc: "Real PCBs across sense, act, comms, and power. Not breadboards.",
      },
      {
        value: "8",
        label: "Stages each",
        desc: "Requirements, BOM, schematic, ERC, layout, DRC, gerbers, bring-up in KiCad.",
      },
      {
        value: "L1.01",
        label: "Free flagship",
        desc: "The first board is public and free. Buy later projects once.",
      },
      {
        value: "1×",
        label: "Yours to keep",
        desc: "Every design file and a verifiable certificate, checkable at /verify.",
      },
    ],
  },
};

export function getBrief(key: string): BriefData | null {
  // Object.hasOwn (not `in`) so prototype keys like "__proto__"/"constructor"
  // resolve to null rather than walking the prototype chain.
  return Object.hasOwn(BRIEFS, key) ? BRIEFS[key as BriefKey] : null;
}

export const BRIEF_KEYS: BriefKey[] = ["overview", "learner"];
