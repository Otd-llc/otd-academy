// Per-cluster "chrome" for the Field Guide PDFs: the front-matter intro, the part
// dividers, the closing page + CTA, and the cover/header identity. This is the
// ONLY field-guide content NOT compiled from live lesson contentBlocks, so it
// lives here in code (book-specific, rarely changes) rather than on the DB
// no-drift path. One entry per Library cluster, plus a cluster-neutral entry for
// the combined all-clusters book.
//
// Voice: otd-content-writing house rules (no em-dashes; the `·` is the separator;
// answer-first; no "not X, it's Y" flourish). Disclosure: the academy surface is
// generic education only, so every CTA points to the course path, never the paid
// build recipe (OTD-AFE-001A values live in the gated L3.01 lesson only).
import { LIBRARY_CLUSTERS } from "@/lib/library/clusters";

export type FieldGuidePart = {
  n: number;
  title: string;
  blurb: string;
  /** slug of the first lesson in this part; the divider renders just before it */
  startsAtSlug: string;
};

export type FieldGuideIntro = {
  eyebrow: string;
  title: string;
  paras: string[];
};

export type FieldGuideOutro = {
  eyebrow: string;
  title: string;
  paras: string[];
  cta: {
    label: string;
    body: string;
    href: string;
    hrefLabel: string;
    secondaryLabel: string;
    secondaryHref: string;
    secondaryHrefLabel: string;
  };
};

// Everything the FieldGuidePdf needs to render a cluster's identity: the document
// title + cover numeral/label, the guide-stream running header, and the intro /
// outro / part dividers.
export type FieldGuideChrome = {
  /** <Document title> (browser tab / PDF metadata). */
  documentTitle: string;
  /** Big Saira cover numeral (decorative volume mark). */
  coverNumeral: string;
  /** Cover meta prefix: rendered as `${coverLabel} · N Guides`. */
  coverLabel: string;
  /** Running header on the guide-stream pages. */
  runningHeader: string;
  intro: FieldGuideIntro;
  outro: FieldGuideOutro;
  parts: FieldGuidePart[];
};

// The generic "start a board" CTA both books close on (course path, generic-safe).
const FIRST_BOARD_CTA = {
  label: "Start the first board",
  body: "It opens with the ESP32-S3 USB-C Breakout, the core board every project here is built on. Start there and the whole path opens from it.",
  href: "https://academy.onethousanddrones.com/courses/l1-01-wroom-breakout",
  hrefLabel: "academy.onethousanddrones.com/courses/l1-01-wroom-breakout",
  secondaryLabel: "See the whole path",
  secondaryHref: "https://academy.onethousanddrones.com/courses",
  secondaryHrefLabel: "academy.onethousanddrones.com/courses",
} as const;

// ── Fundamentals ────────────────────────────────────────────────────────────
// TODO(content): draft chrome in house voice; polish with otd-content-writing
// alongside the §5 lessons so the arc language stays consistent with them.
const FUNDAMENTALS_PARTS: FieldGuidePart[] = [
  {
    n: 1,
    title: "The Basics",
    startsAtSlug: "units-and-prefixes",
    blurb:
      "The units and the three quantities everything else is built from: voltage, current, resistance, and the law that ties them together.",
  },
  {
    n: 2,
    title: "Power and the Passives",
    startsAtSlug: "power-and-heat",
    blurb:
      "Where the energy goes and the part that shapes it: power and heat, the resistor, and the divider you reach for constantly.",
  },
  {
    n: 3,
    title: "The Components",
    startsAtSlug: "capacitors",
    blurb:
      "The parts that store, steer, and filter: capacitors and decoupling, diodes and LEDs, and how a circuit behaves once signals move.",
  },
  {
    n: 4,
    title: "Reading a Design",
    startsAtSlug: "grounds-and-power-rails",
    blurb:
      "Turning a real board into something you can read: grounds and rails, the schematic, and the datasheet behind every part.",
  },
];

const FUNDAMENTALS_CHROME: FieldGuideChrome = {
  documentTitle: "OTD Academy Field Guide · The Fundamentals Reference Library",
  coverNumeral: "02",
  coverLabel: "Fundamentals",
  runningHeader: "Fundamentals Reference Library",
  parts: FUNDAMENTALS_PARTS,
  intro: {
    eyebrow: "How to read this volume",
    title: "Start Here",
    paras: [
      "Every board in this academy runs on the same handful of ideas: voltage, current, resistance, and the parts that shape them. Get these right and the rest of electronics is detail. Get them wrong and nothing downstream makes sense.",
      "This volume is twelve short reference guides that build those ideas one at a time, in the order you actually need them: from what a volt and an amp are, through Ohm's law and power, to the passives, and on to reading a schematic and a datasheet.",
      "Read them front to back and each guide leans on the one before. Read them out of order and each still stands on its own, with a live calculator where the math matters and cross-links at its foot.",
      "The path runs in four parts: the basics, power and the passives, the components, and reading a real design.",
    ],
  },
  outro: {
    eyebrow: "Where this goes",
    title: "Now Build Something",
    paras: [
      "Twelve guides back, this started at what a volt is. Now you can size a resistor, read a divider, pick a decoupling cap, and follow a schematic from symbol to part. That is the working vocabulary every build here assumes.",
      "The next step is a real board. The courses take these ideas and turn them into hardware you design and bring up yourself, one board at a time, each a working instrument the day you finish it.",
      "You do not need to memorize any of this. Keep the guides open beside the bench and come back to them as the build demands. That is what a field guide is for.",
    ],
    cta: {
      ...FIRST_BOARD_CTA,
      body: "It opens with the ESP32-S3 USB-C Breakout, the core board every project here is built on. These fundamentals are exactly what it assumes.",
    },
  },
};

// ── EEG & BCI ─────────────────────────────────────────────────────────────
// The five narrative acts of the reading order (concept → signal → sensing →
// electronics → decode). Content unchanged from the original shipped EEG book.
const EEG_PARTS: FieldGuidePart[] = [
  {
    n: 1,
    title: "Foundations",
    startsAtSlug: "what-is-a-bci",
    blurb:
      "What a brain-computer interface is, what EEG measures, and the whole build in one map.",
  },
  {
    n: 2,
    title: "The Signal",
    startsAtSlug: "eeg-frequency-bands",
    blurb:
      "EEG is many rhythms at once. Which ones carry intent, and how the mu rhythm reveals imagined movement.",
  },
  {
    n: 3,
    title: "Sensing",
    startsAtSlug: "eeg-electrodes-10-20-system",
    blurb:
      "Getting microvolts off the scalp. Where the electrodes go, and the safety rule that comes before everything else.",
  },
  {
    n: 4,
    title: "Electronics",
    startsAtSlug: "biopotential-afe",
    blurb:
      "The amplifier that makes microvolts measurable, the chip that folds the whole front-end into one part, and how you beat mains hum.",
  },
  {
    n: 5,
    title: "Decode & Payoff",
    startsAtSlug: "eeg-classification-csp-eegnet",
    blurb:
      "Turning a noisy window of signal into a command, and closing the loop on a real drone.",
  },
];

const EEG_CHROME: FieldGuideChrome = {
  documentTitle: "OTD Academy Field Guide · The EEG & BCI Reference Library",
  coverNumeral: "01",
  coverLabel: "EEG & BCI",
  runningHeader: "EEG & BCI Reference Library",
  parts: EEG_PARTS,
  intro: {
    eyebrow: "How to read this volume",
    title: "Start Here",
    paras: [
      "A brain-computer interface reads intent straight from the scalp and turns it into a command, with no muscles in the loop. Read non-invasively, that intent arrives as a few microvolts of EEG, buried under interference far larger than itself. Everything hard about building one follows from that.",
      "This volume is twelve reference guides that take the problem apart, ordered as one build: from what the signal is, through the electronics that pull it out of the noise, to turning it into a drone's next move.",
      "Read them front to back and each guide assumes the one before. Read them out of order and each still stands on its own, with cross-links at its foot to carry you sideways.",
      "The path runs in five parts: the foundations, the signal itself, sensing it off the head, the electronics that capture it, and turning it into a command.",
    ],
  },
  outro: {
    eyebrow: "Where this goes",
    title: "You Have The Map",
    paras: [
      "Twelve guides back, this started at what a brain signal is. Now the whole chain is yours: electrodes, a quiet front-end, an ADC, a filter, a classifier, a command. The map is done. The build is the good part.",
      "You build it a board at a time, and each one is a real instrument that works the day you finish it. A USB-C breakout that talks to your computer. A power module that cuts the cord. A precision ADC that reads microvolts off a sensor. A galvanic isolator that keeps a person safe. A front-end that picks a heartbeat out of the noise. Then the eight-channel EEG board this whole library is about.",
      "By the last one you are holding a brain-computer interface you designed and brought up yourself, made of parts you understand down to the register. It reads your own brainwaves off your own scalp.",
    ],
    cta: FIRST_BOARD_CTA,
  },
};

// ── PCB Design & Fabrication ────────────────────────────────────────────────
// The four movements of the reading order (schematic to layout, the copper,
// checking + outputting, fabrication + bring-up). Dividers at clusterOrdinal
// 0 / 3 / 6 / 9 over the twelve lessons.
const PCB_PARTS: FieldGuidePart[] = [
  {
    n: 1,
    title: "From Schematic to Layout",
    startsAtSlug: "pcb-layout-workflow",
    blurb:
      "The path a schematic takes into a physical board: the fixed workflow, the footprint every part needs, and placing them so routing falls out.",
  },
  {
    n: 2,
    title: "The Copper: Routing and Planes",
    startsAtSlug: "pcb-routing-traces",
    blurb:
      "Laying the copper that carries current and quiets the board: trace width and vias, the ground plane, and the stackup they live in.",
  },
  {
    n: 3,
    title: "Checking and Outputting",
    startsAtSlug: "pcb-drc",
    blurb:
      "Turning a routed board into files a factory can build: the design-rule check, the silkscreen and mask that label and protect it, and the gerbers.",
  },
  {
    n: 4,
    title: "Fabrication and Bring-up",
    startsAtSlug: "pcb-dfm-ordering",
    blurb:
      "Getting the board made and alive: designing for manufacture and ordering, soldering the parts on, and the cold-check-then-power sequence for first light.",
  },
];

const PCB_CHROME: FieldGuideChrome = {
  documentTitle: "OTD Academy Field Guide · The PCB Design & Fabrication Reference Library",
  coverNumeral: "03",
  coverLabel: "PCB Design & Fabrication",
  runningHeader: "PCB Design & Fabrication Reference Library",
  parts: PCB_PARTS,
  intro: {
    eyebrow: "How to read this volume",
    title: "Start Here",
    paras: [
      "A schematic tells you what connects to what. A board tells the factory how to build it, and getting from one to the other is a craft with a fixed shape: assign footprints, place the parts, route the copper, check against your fabricator, and export the files. This volume teaches that craft.",
      "It is twelve short reference guides in the order the work happens: from the layout workflow and footprints, through placement, routing, planes, and stackups, to the checks, the fab files, and bringing a fresh board up on the bench.",
      "Read them front to back and each guide leans on the one before. Read them out of order and each still stands on its own, with a live trace-width calculator where the math matters and cross-links at its foot to its Fundamentals prerequisite.",
      "The path runs in four parts: from schematic to layout, the copper itself, checking and outputting, and fabrication and bring-up.",
    ],
  },
  outro: {
    eyebrow: "Where this goes",
    title: "Now Make One",
    paras: [
      "Twelve guides back, this started at a finished schematic. Now you can assign a footprint, place with intent, size a trace from its current, pour a ground plane, clear a design-rule check, and export the exact files a fab needs. That is the working craft every board here assumes.",
      "The next step is a real board. The courses take these ideas and turn them into hardware you design, order, and bring up yourself, one board at a time, each a working instrument the day you finish it.",
      "You do not need to memorize any of this. Keep the guides open beside the bench and the fab tab, and come back to them as the board demands. That is what a field guide is for.",
    ],
    cta: {
      ...FIRST_BOARD_CTA,
      body: "It opens with the ESP32-S3 USB-C Breakout, the core board every project here is built on, and it walks the same schematic-to-board path these guides map.",
    },
  },
};

// Per-cluster chrome, keyed by LIBRARY_CLUSTERS.key. The per-cluster PDF route
// looks a cluster up here; an unknown cluster 404s at the route (never renders
// the wrong book's cover/intro).
export const FIELD_GUIDE_CHROME: Record<string, FieldGuideChrome> = {
  fundamentals: FUNDAMENTALS_CHROME,
  "eeg-bci": EEG_CHROME,
  "pcb-design": PCB_CHROME,
};

// ── Combined all-clusters book ──────────────────────────────────────────────
// Cluster-neutral cover/header, and part dividers = every cluster's parts in
// REGISTRY order (derived from LIBRARY_CLUSTERS so it can't drift), renumbered
// sequentially so "Part n of TOTAL" is correct across the whole book. The
// combined book's lessons are loaded cluster-major (byClusterThenOrdinal), so a
// part divider still fires just before its cluster's first lesson.
const COMBINED_PARTS: FieldGuidePart[] = LIBRARY_CLUSTERS.flatMap(
  (c) => FIELD_GUIDE_CHROME[c.key]?.parts ?? [],
).map((p, i) => ({ ...p, n: i + 1 }));

export const COMBINED_FIELD_GUIDE_CHROME: FieldGuideChrome = {
  documentTitle: "OTD Academy Field Guide · The Reference Library",
  coverNumeral: "00",
  coverLabel: "OTD Reference Library",
  runningHeader: "OTD Reference Library",
  parts: COMBINED_PARTS,
  intro: {
    eyebrow: "How to read this volume",
    title: "Start Here",
    paras: [
      "This is the whole OTD reference library in one volume: the electronics fundamentals every build rests on, then the EEG and brain-computer interface they add up to.",
      "It reads in two movements. The Fundamentals come first: voltage, current, Ohm's law, the passives, and how to read a schematic and a datasheet. Then EEG and BCI: what the signal is, the electronics that pull it out of the noise, and turning it into a command.",
      "Read it front to back and each guide leans on the ones before. Read any guide on its own and it still stands, with live calculators where the math matters and cross-links at its foot.",
      "Each cluster is also a book of its own, if you want just one. This volume is both, back to back.",
    ],
  },
  outro: {
    eyebrow: "Where this goes",
    title: "You Have The Map",
    paras: [
      "From what a volt is to a command read straight off the scalp, the whole chain is here: the fundamentals, the front-end electronics, the decode, and the payoff.",
      "The map is done. The build is the good part. The courses take this and turn it into hardware you design and bring up yourself, one board at a time.",
    ],
    cta: FIRST_BOARD_CTA,
  },
};
