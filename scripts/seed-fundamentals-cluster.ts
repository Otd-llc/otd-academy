// Seeds the Fundamentals cluster of public /library mini-lessons (docs/plans/
// 2026-07-07-fundamentals-library-clusters.md + the content-phase plan). Generic
// electronics education, true-beginner bar, cited per claim, first-hand to real
// One Thousand Drones boards. cluster = "fundamentals"; clusterOrdinal = list order.
//
// Content lives in the PROD DB; this committed seed is the reviewable source and
// re-runs idempotently (upsert on the unique slug). Diagram `image` blocks point
// at their PLANNED /guide-diagrams/<name>.svg registry key; they render caption-
// only until the diagram-export sandbox phase builds those components + rasters
// (same key, so no re-seed for figures).
//
// Voice: otd-content-writing house rules (no em-dashes; answer-first; no
// antithesis flourish). Assessment: 3 options, real same-register distractors,
// answer key spread, no math/edge-cases in stems (L1 beginner bar). Academy =
// generic only (no coined vocabulary, no paid-build values).
//
// Run:
//   npx tsx scripts/seed-fundamentals-cluster.ts --check   (validate blocks, NO DB)
//   npx tsx scripts/seed-fundamentals-cluster.ts           (seed PROD)
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { guideContentBlocksSchema, type ContentBlock } from "@/lib/schemas/guide";
import { LIBRARY_BLOCK_TYPES } from "@/lib/library/block-allowlist";

const BYLINE = "One Thousand Drones engineering team · verified 2026-07";
const VERIFIED_AT = new Date("2026-07-08T00:00:00.000Z");

type Lesson = {
  slug: string;
  title: string;
  seoTitle: string;
  seoDescription: string;
  clusterOrdinal: number;
  contentBlocks: ContentBlock[];
};

const LESSONS: Lesson[] = [
  // ── 0. units-and-prefixes ────────────────────────────────────────────────
  {
    slug: "units-and-prefixes",
    title: "Units and prefixes",
    seoTitle: "Electronics units and metric prefixes explained",
    seoDescription:
      "Volts, amps, ohms, farads, watts, and the metric prefixes (k, M, m, u, n, p) you read off every part. A plain-English start to electronics.",
    clusterOrdinal: 0,
    contentBlocks: [
      { type: "prose", md: "Electronics runs on a small set of quantities and a ladder of prefixes. Get comfortable with volts, amps, and ohms, and with reading `4.7 uF` or `5.1 kΩ` off a part, and every later guide has a foundation to stand on. This is that foundation." },
      { type: "heading", text: "What are the basic units?" },
      { type: "prose", md: "A volt (V) measures electrical push, the pressure that moves charge. An amp (A) measures current, the rate charge flows. An ohm (Ω) measures resistance, how strongly a material fights that flow. A farad (F) measures capacitance, how much charge a part stores per volt. A watt (W) measures power, the rate energy is used. These five cover almost everything on a small board. Each is an SI unit with a fixed international definition set by the 2019 revision of the SI (BIPM 2019)." },
      { type: "sourceRef", label: "BIPM. The International System of Units (SI), 9th edition (2019).", href: "https://www.bipm.org/en/publications/si-brochure" },
      { type: "heading", text: "What do the prefixes mean?" },
      { type: "prose", md: "A prefix scales a unit up or down by powers of ten, so you rarely write a long string of zeros. Going down: milli (m) is a thousandth, micro (u) a millionth, nano (n) a billionth, pico (p) a trillionth. Going up: kilo (k) is a thousand, mega (M) a million. So `4.7 uF` is 4.7 millionths of a farad, and `5.1 kΩ` is 5100 ohms. Read the prefix first and the value stops being intimidating." },
      { type: "sourceRef", label: "NIST SP 330. The International System of Units (SI), 2019 edition.", href: "https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.330-2019.pdf" },
      { type: "image", src: "/guide-diagrams/fund-prefix-ladder.svg", alt: "The metric prefix ladder from pico up to mega, each step a factor of a thousand, with example part values.", caption: "The prefix ladder: each step up or down is a factor of a thousand." },
      { type: "heading", text: "Reading a real part value" },
      { type: "prose", md: "On a One Thousand Drones bill of materials you meet values like `100 nF`, `4.7 uF`, and `5.1 kΩ` next to real parts. A `100 nF` capacitor sits beside almost every chip. A `5.1 kΩ` resistor sets a USB-C port's role. Same units, same ladder, on parts you actually order and solder." },
      { type: "quiz", questions: [
        { q: "What does `kΩ` mean?", options: ["A thousand ohms", "A thousandth of an ohm", "A thousand volts"], answer: 0, explain: "kilo (k) means a thousand, so 1 kΩ is 1000 ohms." },
        { q: "Which of these prefixes is the smallest?", options: ["milli (m)", "micro (u)", "pico (p)"], answer: 2, explain: "pico is a trillionth, far smaller than milli (a thousandth) or micro (a millionth)." },
        { q: "`4.7 uF` is a measure of what?", options: ["Resistance", "Capacitance", "Current"], answer: 1, explain: "The farad (F) is the unit of capacitance; uF is microfarads." },
      ] },
      { type: "sourceRef", label: "Next: voltage, current, and resistance", href: "/library/voltage-current-resistance" },
    ],
  },

  // ── 1. voltage-current-resistance ────────────────────────────────────────
  {
    slug: "voltage-current-resistance",
    title: "Voltage, current, resistance",
    seoTitle: "Voltage, current, and resistance explained",
    seoDescription:
      "What voltage, current, and resistance actually are, and how they trade off. The three quantities every circuit is built from, in plain terms.",
    clusterOrdinal: 1,
    contentBlocks: [
      { type: "prose", md: "Voltage is the push, current is the flow, and resistance is what slows the flow. Those three, and how they trade off, are the core of every circuit you will build." },
      { type: "heading", text: "What is voltage?" },
      { type: "prose", md: "Voltage is a difference in electrical potential between two points, measured in volts. It is the push that moves charge from one place to another. With no difference there is no push and no current. On a board you measure it between a node and ground, so a `3.3 V` rail means that node sits 3.3 volts above ground." },
      { type: "heading", text: "What is current?" },
      { type: "prose", md: "Current is the rate charge flows past a point, measured in amps, or milliamps on a small board. Push harder or lower the resistance and more current flows. Current is the same all the way around a simple series loop, which is why one fuse in the loop protects the whole loop." },
      { type: "heading", text: "What is resistance?" },
      { type: "prose", md: "Resistance is how strongly a material opposes current, measured in ohms. A resistor is a part built to have a chosen, stable resistance. More resistance means less current for the same voltage. All three quantities have fixed SI definitions (BIPM 2019)." },
      { type: "sourceRef", label: "BIPM. The International System of Units (SI), 9th edition (2019).", href: "https://www.bipm.org/en/publications/si-brochure" },
      { type: "image", src: "/guide-diagrams/fund-vir-relationship.svg", alt: "Voltage pushing current through a resistance, showing how the three quantities relate in a simple loop.", caption: "Voltage pushes current through resistance." },
      { type: "heading", text: "How they trade off" },
      { type: "prose", md: "Raise the voltage and the current rises. Raise the resistance and the current falls. That trade-off has an exact form, Ohm's law, which the next guide covers. On a One Thousand Drones L1.01 board you can probe the `3.3 V` rail with a meter and read the voltage directly; the current the board draws depends on what it is doing at that moment." },
      { type: "quiz", questions: [
        { q: "Voltage is best described as what?", options: ["The flow of charge", "The push that moves charge", "The opposition to flow"], answer: 1, explain: "Voltage is the potential difference that pushes charge; current is the flow itself." },
        { q: "For the same voltage, higher resistance means what?", options: ["Less current", "More current", "No change in current"], answer: 0, explain: "More opposition means less current flows for the same push." },
        { q: "Current is measured in what unit?", options: ["Volts", "Ohms", "Amps"], answer: 2, explain: "Amps (or milliamps) measure current; volts measure voltage and ohms measure resistance." },
      ] },
      { type: "sourceRef", label: "Next: Ohm's law", href: "/library/ohms-law" },
    ],
  },

  // ── 2. ohms-law ──────────────────────────────────────────────────────────
  {
    slug: "ohms-law",
    title: "Ohm's law",
    seoTitle: "Ohm's law explained: V = IR",
    seoDescription:
      "What Ohm's law is, how to rearrange V = I x R for voltage, current, or resistance, and the power it sets. With a live calculator and a worked board example.",
    clusterOrdinal: 2,
    contentBlocks: [
      { type: "prose", md: "Ohm's law is V = I x R: voltage equals current times resistance. Rearranged, it gives you current (I = V / R) or resistance (R = V / I), and the power follows as P = V x I. Know any two and you have the rest. Georg Ohm published the relationship in 1827, and it holds for the resistive parts on every board here." },
      { type: "calculator", slug: "ohms-law", caption: "Solve for voltage, current, or resistance, and read the power." },
      { type: "heading", text: "The three forms" },
      { type: "prose", md: "They are one equation, written for whatever you are missing. Know the current and the resistance and you want the voltage: V = I x R. Know the voltage and the resistance and you want the current: I = V / R. Know the voltage and the current and you want the resistance: R = V / I. Keep the units honest, volts and amps and ohms, and the arithmetic is exact." },
      { type: "heading", text: "Why it matters" },
      { type: "prose", md: "Almost every small design decision is an Ohm's-law step. Sizing a pull-up resistor on a One Thousand Drones L1.01 board is one: the resistor sits between the `3.3 V` rail and a signal pin, and its value sets how much current flows when the pin pulls low. Pick the resistance and Ohm's law tells you the current; pick a target current and it tells you the resistance." },
      { type: "quiz", questions: [
        { q: "Ohm's law says voltage equals what?", options: ["Current divided by resistance", "Current times resistance", "Resistance divided by current"], answer: 1, explain: "V = I x R: voltage is current multiplied by resistance." },
        { q: "To find the current when you know the voltage and resistance, you divide what by what?", options: ["Resistance by voltage", "Current by voltage", "Voltage by resistance"], answer: 2, explain: "I = V / R, voltage divided by resistance." },
        { q: "The power a simple resistive part uses is which of these?", options: ["Voltage times current", "Voltage plus current", "Voltage minus current"], answer: 0, explain: "P = V x I for a resistive load." },
      ] },
      { type: "sourceRef", label: "Prerequisite: voltage, current, and resistance", href: "/library/voltage-current-resistance" },
      { type: "sourceRef", label: "Calculate it: the Ohm's law calculator", href: "/tools/ohms-law" },
      { type: "sourceRef", label: "Next: power and heat", href: "/library/power-and-heat" },
    ],
  },

  // ── 3. power-and-heat ────────────────────────────────────────────────────
  {
    slug: "power-and-heat",
    title: "Power and heat",
    seoTitle: "Power and heat in a circuit: P = VI",
    seoDescription:
      "How much power a part dissipates (P = V x I = I squared R), why it leaves as heat, and how to pick a part rated for it. Worked from a real regulator.",
    clusterOrdinal: 3,
    contentBlocks: [
      { type: "prose", md: "Power is the rate a part uses energy, P = V x I, measured in watts. For a resistor that also equals I squared times R, or V squared divided by R. Whatever form you use, the power a resistive part uses leaves as heat, and that heat is what sets the part you buy." },
      { type: "calculator", slug: "resistor-power", caption: "Find a resistor's dissipation and the wattage rating to buy." },
      { type: "heading", text: "Where the power goes" },
      { type: "prose", md: "A part carrying current at a voltage is turning electrical energy into heat at a rate of V x I watts. A voltage regulator is the clearest case. On a One Thousand Drones L1.01 board the AP2112K regulator takes the USB `5 V` input down to `3.3 V`; the `1.7 V` it drops, times the current the board draws, becomes heat in the regulator. Draw more current and it runs hotter." },
      { type: "heading", text: "Picking a part rated for the heat" },
      { type: "prose", md: "A resistor's power rating is the point where it sits near its maximum temperature in still air. A common thick-film chip resistor is rated at 70 C ambient and must not exceed a 155 C film temperature (Vishay CRCW e3 datasheet). Run one at its rating and it is hot, drifting, and short-lived, so pick a part rated above the power it dissipates, with margin, and check the datasheet's derating curve, which pulls the allowed power down as the ambient rises." },
      { type: "sourceRef", label: "Vishay. D/CRCW e3 Standard Thick Film Chip Resistors datasheet (power derating, 70 C rated, 155 C max film temperature).", href: "https://www.vishay.com/docs/20035/dcrcwe3.pdf" },
      { type: "image", src: "/guide-diagrams/fund-power-heat.svg", alt: "Power dissipated in a part becoming heat, with a resistor derating curve of allowed power falling as ambient temperature rises.", caption: "Dissipated power becomes heat; the datasheet derating curve pulls the allowed power down as it gets hotter." },
      { type: "quiz", questions: [
        { q: "The power a resistor dissipates turns mostly into what?", options: ["Light", "Heat", "Sound"], answer: 1, explain: "A resistor turns the power it cannot pass into heat." },
        { q: "What resistor power rating should you pick?", options: ["Above the power it dissipates, with margin", "Exactly the power it dissipates", "Below the power it dissipates"], answer: 0, explain: "A part run at its rating sits near its maximum temperature, so leave margin." },
        { q: "A resistor's datasheet power rating assumes what?", options: ["A maximum temperature it must not exceed", "That it never gets warm", "That it runs in a vacuum"], answer: 0, explain: "The rating holds only while the film stays under its maximum temperature; the derating curve shows the rest." },
      ] },
      { type: "sourceRef", label: "Prerequisite: Ohm's law", href: "/library/ohms-law" },
      { type: "sourceRef", label: "Calculate it: the resistor power calculator", href: "/tools/resistor-power" },
    ],
  },
];

// ── validation (no DB) ──────────────────────────────────────────────────────
function validate(): void {
  const EM_DASH = "—";
  let ok = true;
  const answerPositions: number[] = [];
  for (const l of LESSONS) {
    const parsed = guideContentBlocksSchema.safeParse(l.contentBlocks);
    if (!parsed.success) {
      ok = false;
      console.error(`[${l.slug}] INVALID blocks:`, JSON.stringify(parsed.error.issues, null, 2));
      continue;
    }
    for (const b of l.contentBlocks) {
      if (!LIBRARY_BLOCK_TYPES.has(b.type)) {
        ok = false;
        console.error(`[${l.slug}] non-library block type: ${b.type}`);
      }
      if (b.type === "quiz") for (const q of b.questions) answerPositions.push(q.answer);
    }
    if (JSON.stringify(l).includes(EM_DASH)) {
      ok = false;
      console.error(`[${l.slug}] CONTAINS EM-DASH`);
    }
  }
  const spread = answerPositions.reduce<Record<number, number>>((m, a) => ((m[a] = (m[a] ?? 0) + 1), m), {});
  console.log(`answer-key spread across ${answerPositions.length} questions:`, JSON.stringify(spread));
  if (!ok) process.exit(1);
  console.log(`validated ${LESSONS.length} lessons OK`);
}

// ── seed (PROD) ─────────────────────────────────────────────────────────────
async function seed(): Promise<void> {
  const { db } = await import("@/lib/db");
  const admin = await db.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });
  if (!admin) throw new Error("No ADMIN user found to own the lessons");
  for (const l of LESSONS) {
    const row = await db.miniLesson.upsert({
      where: { slug: l.slug },
      update: {
        title: l.title,
        summary: l.seoDescription,
        contentBlocks: l.contentBlocks,
        seoTitle: l.seoTitle,
        seoDescription: l.seoDescription,
        byline: BYLINE,
        lastVerifiedAt: VERIFIED_AT,
        cluster: "fundamentals",
        clusterOrdinal: l.clusterOrdinal,
        published: true,
        accessTier: "PUBLIC",
      },
      create: {
        slug: l.slug,
        title: l.title,
        summary: l.seoDescription,
        contentBlocks: l.contentBlocks,
        seoTitle: l.seoTitle,
        seoDescription: l.seoDescription,
        byline: BYLINE,
        lastVerifiedAt: VERIFIED_AT,
        cluster: "fundamentals",
        clusterOrdinal: l.clusterOrdinal,
        published: true,
        accessTier: "PUBLIC",
        createdById: admin.id,
      },
      select: { slug: true, clusterOrdinal: true },
    });
    console.log(`seeded ${row.slug} (clusterOrdinal ${row.clusterOrdinal})`);
  }
}

if (process.argv.includes("--check")) {
  validate();
  process.exit(0);
}
validate();
seed().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
