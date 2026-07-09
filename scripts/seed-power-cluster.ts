// Seeds the Power & Batteries cluster of public /library mini-lessons (docs/plans/
// 2026-07-09-power-library-cluster.md + the parallel handoff). Generic electronics
// education, true-beginner bar, cited per claim, first-hand to real One Thousand
// Drones boards. cluster = "power-batteries"; clusterOrdinal = list order.
//
// Content lives in the PROD DB; this committed seed is the reviewable source and
// re-runs idempotently (upsert on the unique slug). Diagram `image` blocks point
// at their PLANNED /guide-diagrams/power-<name>.svg registry key; they render
// caption-only until the diagram-export sandbox phase builds those components +
// rasters (same key, so no re-seed for figures).
//
// Voice: otd-content-writing house rules (no em-dashes; answer-first; no
// antithesis flourish). Assessment: 3 options, real same-register distractors,
// answer key spread, no math/edge-cases in stems (L1 beginner bar). Academy =
// generic only (no coined vocabulary, no paid-build values).
//
// CITATIONS ARE PROVISIONAL. Per the blueprint ("citations unfetched, pull on
// go"), the sourceRef URLs below are canonical best-effort references; verify each
// one on Josh's go BEFORE the PROD seed. The --check does not fetch URLs.
//
// Run:
//   npx tsx scripts/seed-power-cluster.ts --check   (validate blocks, NO DB)
//   npx tsx scripts/seed-power-cluster.ts           (seed PROD)
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import katex from "katex";
import { guideContentBlocksSchema, type ContentBlock } from "@/lib/schemas/guide";
import { LIBRARY_BLOCK_TYPES } from "@/lib/library/block-allowlist";
import { PDF_SAIRA_FALLBACK } from "@/lib/pdf/pdf-fallback-set";
import { pdfGlyphIssues } from "@/lib/pdf/pdf-glyph-coverage";

const BYLINE = "One Thousand Drones engineering team · verified 2026-07";
const VERIFIED_AT = new Date("2026-07-09T00:00:00.000Z");

type Lesson = {
  slug: string;
  title: string;
  seoTitle: string;
  seoDescription: string;
  clusterOrdinal: number;
  contentBlocks: ContentBlock[];
};

const LESSONS: Lesson[] = [
  // ── 0. power-budget ──────────────────────────────────────────────────────
  {
    slug: "power-budget",
    title: "Power rails and a power budget",
    seoTitle: "How to make a power budget for a board",
    seoDescription:
      "Add up every part's current draw, add margin, then pick a supply. How to budget power for an ESP32 or any small board before you choose a regulator or a battery.",
    clusterOrdinal: 0,
    contentBlocks: [
      { type: "prose", md: "A power rail is a net held at one fixed voltage that feeds many parts at once. Before you pick the supply that drives a rail, you add up what everything on it draws and leave room to spare. Budget the load first, choose the source second." },
      { type: "heading", text: "What is a power rail?" },
      { type: "prose", md: "A rail is a shared voltage line, like the `3.3 V` a regulator puts out or the `5 V` that arrives over USB. Every part that needs that voltage taps the same rail. The Fundamentals guide on grounds and rails covers the idea; here you use it to size a supply." },
      { type: "heading", text: "Peak draw and average draw" },
      { type: "prose", md: "A part draws two numbers worth knowing. Its average current sets how long a battery lasts. Its peak current, the brief spike when a radio transmits or a motor starts, sets how much the supply must deliver without sagging. An ESP32-S3 sips a few milliamps most of the time but pulls a spike toward `500 mA` when its WiFi radio bursts (Espressif). Size the supply for the peak and the battery for the average." },
      { type: "sourceRef", label: "Espressif. ESP32-S3 Series Datasheet (current consumption, RF transmit peaks).", href: "https://www.espressif.com/sites/default/files/documentation/esp32-s3_datasheet_en.pdf" },
      { type: "heading", text: "Summing the board's draw" },
      { type: "prose", md: "A budget is a table: every part, the rail it sits on, and its worst-case current, added down the column. The microcontroller, each sensor, every LED, the pull-ups. Total the current on each rail and you know what that rail must supply." },
      { type: "math", tex: "I_{total} = I_1 + I_2 + \\cdots + I_n", plain: "I_total = I_1 + I_2 + ... + I_n" },
      { type: "heading", text: "Leave margin, then pick the source" },
      { type: "prose", md: "Never size a supply to exactly the total. Add margin, commonly 20 to 30 percent, for the parts you forgot, the peaks that overlap, and the aging that lifts current over time. Then pick a source whose voltage matches the rail and whose current rating clears the budget with that margin in hand." },
      { type: "math", tex: "I_{supply} \\ge 1.3 \\cdot I_{total}", plain: "I_supply >= 1.3 x I_total" },
      { type: "image", src: "/guide-diagrams/power-power-budget.svg", alt: "A power rail feeding several loads, each load's current added into a running total, with a margin added on top to set the supply.", caption: "Add every load on a rail, then add margin: that sets the supply." },
      { type: "deepDive", summary: "Where a budget quietly goes wrong", body: "Two things break a budget that looks fine on paper. First, peaks overlap: if the radio bursts while an LED is full-on, the two spikes add, and a supply sized for the average browns out at the worst moment. Second, a regulator burns a little current just to run itself, its quiescent current, which is negligible under load but dominant on a sleeping battery board where the real load is almost nothing. Budget the worst simultaneous case, not the sum of typical numbers, and on a low-power design read the regulator's quiescent current as carefully as its efficiency." },
      { type: "quiz", questions: [
        { q: "What should you do before choosing a supply for a board?", options: ["Pick the smallest battery that fits", "Add up every part's current draw and add margin", "Set the output voltage as high as possible"], answer: 1, explain: "Budget the total current with margin first, then choose a source that clears it." },
        { q: "Peak current on a rail sets what?", options: ["How much the supply must deliver without sagging", "The color of the indicator LEDs", "How long the battery lasts"], answer: 0, explain: "Peak sizes the supply; average current sizes the battery's runtime." },
        { q: "Why add margin to a power budget?", options: ["To make the board heavier", "To cover forgotten parts, overlapping peaks, and aging", "Because supplies are sold only in fixed sizes"], answer: 1, explain: "Margin, often 20 to 30 percent, absorbs the real-world excess a bare total misses." },
      ] },
      { type: "sourceRef", label: "Prerequisite: grounds and power rails", href: "/library/grounds-and-power-rails" },
      { type: "sourceRef", label: "Prerequisite: power and heat", href: "/library/power-and-heat" },
      { type: "sourceRef", label: "Next: batteries 101", href: "/library/batteries-101" },
    ],
  },

  // ── 1. batteries-101 ─────────────────────────────────────────────────────
  {
    slug: "batteries-101",
    title: "Batteries 101",
    seoTitle: "Battery basics: capacity, voltage, and C-rate explained",
    seoDescription:
      "What mAh, Wh, nominal voltage, and C-rate actually mean, the common chemistries at a glance, and a rough runtime from capacity and draw. With a live calculator.",
    clusterOrdinal: 1,
    contentBlocks: [
      { type: "prose", md: "A battery stores energy chemically and hands it back as current. Three numbers tell you almost everything about one: how much charge it holds, its voltage, and the current it can safely deliver. Learn those and a datasheet full of cells stops being a mystery." },
      { type: "heading", text: "Capacity: mAh and Wh" },
      { type: "prose", md: "Capacity in milliamp-hours (`mAh`) is how much charge a cell holds: a `2000 mAh` cell can deliver `2000 mA` for one hour, or `200 mA` for ten. Energy in watt-hours (`Wh`) folds in the voltage, so it compares cells of different voltages fairly. Multiply charge by voltage to get energy." },
      { type: "math", tex: "E_{Wh} = \\frac{Q_{mAh}}{1000} \\cdot V_{nom}", plain: "Wh = (mAh / 1000) x Vnom" },
      { type: "calculator", slug: "battery-watt-hours", caption: "Convert a cell's mAh and voltage to watt-hours and size a pack." },
      { type: "heading", text: "Nominal, full, and empty voltage" },
      { type: "prose", md: "A cell's voltage is not one number but a range that falls as it drains. A single Li-ion cell reads about `4.2 V` full, sits near its `3.7 V` nominal for most of the discharge, and is empty around `3.0 V`. The nominal figure is the one printed on the cell and the one used for the energy math." },
      { type: "heading", text: "C-rate: how hard you can push it" },
      { type: "prose", md: "C-rate expresses a current as a multiple of the capacity. `1 C` is the current that drains the whole cell in one hour, so `1 C` of a `2000 mAh` cell is `2000 mA`. A cell rated for a `2 C` discharge can safely deliver twice that. Exceed the rating and the cell overheats." },
      { type: "math", tex: "I = C_{rate} \\cdot Q", plain: "I = C-rate x Q" },
      { type: "heading", text: "The common chemistries" },
      { type: "table", columns: ["Chemistry", "Nominal cell", "At a glance"], rows: [
        [{ text: "LiPo / Li-ion" }, { text: "3.7 V" }, { text: "High energy density, needs a protection circuit" }],
        [{ text: "NiMH" }, { text: "1.2 V" }, { text: "Robust, self-discharges, no protection needed" }],
        [{ text: "Alkaline" }, { text: "1.5 V" }, { text: "Cheap, single-use, high internal resistance" }],
      ] },
      { type: "sourceRef", label: "Battery University. BU-107: Comparison Table of Secondary Batteries (chemistries, nominal voltage).", href: "https://batteryuniversity.com/article/bu-107-comparison-table-of-secondary-batteries" },
      { type: "image", src: "/guide-diagrams/power-discharge-curve.svg", alt: "A lithium-ion discharge curve: cell voltage starts near 4.2 volts full, stays flat near 3.7 volts nominal for most of the discharge, then drops toward 3.0 volts empty as the last charge is used.", caption: "A Li-ion cell holds near its nominal voltage for most of the discharge, then falls off a cliff near empty." },
      { type: "prose", md: "A rough runtime is capacity divided by average draw. A `2000 mAh` cell feeding a board that averages `100 mA` lasts about twenty hours before the safe voltage window runs out. Lesson eleven does this honestly, with the usable fraction and the regulator loss folded in." },
      { type: "deepDive", summary: "Why you never get the whole printed capacity", body: "A cell's printed capacity is measured all the way down to its empty voltage under gentle conditions, but a real board cannot use all of it. The regulator stops working once the cell falls below its dropout, and a lithium cell is called empty at `3.0 V`, not `0 V`, with useful charge still chemically inside it that you must not touch. Draw harder than the test current and internal resistance costs you more still. So a real design reaches perhaps 80 percent of the label, and honest runtime math starts by discounting the capacity to the fraction you can actually reach. (Battery University)" },
      { type: "sourceRef", label: "Battery University. BU-402: What Is C-rate? (current as a multiple of capacity).", href: "https://batteryuniversity.com/article/bu-402-what-is-c-rate" },
      { type: "quiz", questions: [
        { q: "A `2000 mAh` capacity tells you roughly what?", options: ["The cell's physical size", "How much charge it holds, so its runtime at a given draw", "The cell's maximum voltage"], answer: 1, explain: "mAh is charge: a 2000 mAh cell gives 2000 mA for an hour, or 200 mA for ten." },
        { q: "What does a watt-hours figure add over milliamp-hours?", options: ["The voltage, so cells of different voltages compare fairly", "The color of the cell", "The number of charge cycles"], answer: 0, explain: "Wh = charge x voltage, an energy figure that is fair across different voltages." },
        { q: "`1 C` of a `2000 mAh` cell is what current?", options: ["`200 mA`", "`20 mA`", "`2000 mA`"], answer: 2, explain: "1 C drains the capacity in one hour, so 2000 mAh at 1 C is 2000 mA." },
      ] },
      { type: "sourceRef", label: "Prerequisite: voltage, current, and resistance", href: "/library/voltage-current-resistance" },
      { type: "sourceRef", label: "Calculate it: the battery watt-hours calculator", href: "/tools/battery-watt-hours" },
      { type: "sourceRef", label: "Next: LiPo and Li-ion safety", href: "/library/lithium-battery-safety" },
    ],
  },

  // ── 2. lithium-battery-safety ────────────────────────────────────────────
  {
    slug: "lithium-battery-safety",
    title: "LiPo and Li-ion safety",
    seoTitle: "LiPo and Li-ion battery safety: the rules that matter",
    seoDescription:
      "Lithium cells are energy-dense and unforgiving. The 4.2 V ceiling, the empty limit, the protection circuit every cell needs, and the physical care that prevents a fire.",
    clusterOrdinal: 2,
    contentBlocks: [
      { type: "prose", md: "Lithium cells pack more energy into less mass than any common battery, and that density cuts both ways. Charged too high, drained too low, shorted, or physically damaged, a lithium cell can vent, catch fire, or worse. A few firm rules keep it safe." },
      { type: "callout", severity: "critical", label: "Respect the voltage window and never bypass protection", body: "A single lithium cell lives between about `4.2 V` full and `3.0 V` empty. Charging past `4.2 V` or draining below its cutoff damages the cell and can start a fire. Never charge a pack unattended, never puncture or crush a cell, and never use a bare cell without a protection circuit." },
      { type: "heading", text: "The safe voltage window" },
      { type: "prose", md: "`4.2 V` is the hard ceiling for a standard single cell, and `3.0 V` is the floor. Above the ceiling the chemistry breaks down and can go into thermal runaway. Below the floor the cell is damaged and may short internally on the next charge. A charger and a protection circuit exist to keep the cell inside that band." },
      { type: "heading", text: "Over-charge, over-discharge, and short" },
      { type: "prose", md: "Three faults do the damage. Over-charge pushes the voltage past the ceiling and overheats the cell. Over-discharge drops it below the floor and ruins it. A short circuit dumps enormous current in an instant, and a lithium cell can deliver hundreds of amps into a dead short. Each fault is exactly what the protection circuit watches for." },
      { type: "heading", text: "The protection circuit" },
      { type: "prose", md: "A bare lithium cell has no brain of its own. A protection circuit, a small board called a PCM, or part of a larger battery management system, sits on the cell and disconnects it on over-charge, over-discharge, or over-current. Most protected cells and every good pack have one built in. A raw cell is only safe behind a circuit that provides that protection." },
      { type: "image", src: "/guide-diagrams/power-safe-window.svg", alt: "A vertical voltage bar for a lithium cell marking 4.2 volts full at the top and 3.0 volts empty at the bottom, with the protection circuit cutoff thresholds sitting just outside that band.", caption: "The protection circuit trips just outside the 4.2 V to 3.0 V window." },
      { type: "deepDive", summary: "What thermal runaway actually is", body: "The danger word for a lithium fire is thermal runaway. A cell pushed too hard heats up; the heat speeds the internal reaction; the faster reaction makes more heat. Past a tipping point the loop feeds itself and the cell vents flammable gas and can ignite, with no outside energy needed to keep it going. That self-sustaining loop is why a lithium fault is not gentle and why the voltage and current limits are hard rules rather than suggestions. (Battery University)" },
      { type: "sourceRef", label: "Battery University. BU-304a: Safety Concerns with Li-ion (voltage limits, thermal runaway).", href: "https://batteryuniversity.com/article/bu-304a-safety-concerns-with-li-ion" },
      { type: "prose", md: "On a real build, the L2.01 battery power module course puts these rules into hardware, adding a charger and a protection circuit to a single cell the right way." },
      { type: "quiz", questions: [
        { q: "What is the danger of charging a single Li-ion cell past `4.2 V`?", options: ["Nothing, it just charges faster", "Over-charge that overheats the cell and risks a fire", "The cell reports a lower capacity"], answer: 1, explain: "4.2 V is the hard ceiling; above it the chemistry breaks down toward thermal runaway." },
        { q: "Why does a bare lithium cell need a protection circuit?", options: ["To make it charge faster", "To change its nominal voltage", "Because the cell cannot stop over-charge, over-discharge, or a short on its own"], answer: 2, explain: "A PCM or BMS disconnects the cell on the faults it cannot survive by itself." },
        { q: "The safe window for a standard single lithium cell is about what?", options: ["`4.2 V` full down to `3.0 V` empty", "`5 V` full down to `1 V` empty", "`3.3 V` full down to `0 V` empty"], answer: 0, explain: "Full is about 4.2 V and empty about 3.0 V; the charger and protection keep it there." },
      ] },
      { type: "sourceRef", label: "Prerequisite: batteries 101", href: "/library/batteries-101" },
      { type: "sourceRef", label: "See it on a real board: the L2.01 battery power module", href: "/courses/l2-01-battery-power-module" },
      { type: "sourceRef", label: "Next: battery charging", href: "/library/battery-charging" },
    ],
  },

  // ── 3. battery-charging ──────────────────────────────────────────────────
  {
    slug: "battery-charging",
    title: "Battery charging",
    seoTitle: "How lithium battery charging works: CC/CV explained",
    seoDescription:
      "A lithium cell charges in two phases, constant current then constant voltage. What CC/CV means, charge current and termination, and why a single-cell charger IC does it for you.",
    clusterOrdinal: 3,
    contentBlocks: [
      { type: "prose", md: "A lithium cell charges in two phases: constant current until it nears full, then constant voltage while the current tapers off. A single-cell charger chip runs that profile for you, and using one is the only safe way to charge a lithium cell. Do not improvise it." },
      { type: "heading", text: "Constant current, then constant voltage" },
      { type: "prose", md: "In the first phase the charger pushes a fixed current into the cell and the voltage climbs. Once the cell reaches its `4.2 V` ceiling, the charger holds that voltage steady and lets the current fall on its own as the cell fills. This constant-current then constant-voltage profile, CC/CV, is how every lithium cell is charged." },
      { type: "image", src: "/guide-diagrams/power-cc-cv.svg", alt: "A CC/CV charge curve over time: the current is flat then tapers while the voltage rises to 4.2 volts and holds, with the graph split into a constant-current phase and a constant-voltage phase.", caption: "Constant current lifts the voltage to 4.2 V; constant voltage then holds while the current tapers." },
      { type: "heading", text: "Charge current and termination" },
      { type: "prose", md: "The charge current is set as a C-rate, often `0.5 C` to `1 C` for a standard cell, and the specific cell's datasheet is the authority. Charging ends not at a fixed time but when the constant-voltage current falls below a small termination threshold, typically around `0.1 C`, which signals the cell is full." },
      { type: "math", tex: "t_{cc} \\approx \\frac{Q}{I_{charge}}", plain: "t_cc = Q / I_charge (roughly)" },
      { type: "heading", text: "A single-cell charger IC" },
      { type: "prose", md: "A dedicated charger chip, such as the Microchip MCP73831 or the widely used TP4056, contains the whole CC/CV state machine, the `4.2 V` reference, and the termination logic in one part. You set the charge current with a single resistor and feed the chip `5 V` from USB. It handles the rest, safely, which is exactly why you never charge a lithium cell from a bare bench supply." },
      { type: "callout", severity: "warn", label: "The charge current is set by a resistor, and the datasheet sets its value", body: "A single-cell charger IC picks its charge current from one programming resistor. Fit the wrong value and you can push a cell past its rated charge current. Read the specific charger's datasheet, compute the resistor for a safe C-rate for your cell, and check it before you apply power." },
      { type: "deepDive", summary: "The pre-charge phase for a deeply drained cell", body: "A cell drained well below its floor is fragile, and slamming full current into it is dangerous. A good charger IC starts with a third, quieter phase: pre-charge, a small trickle current that gently lifts a deeply discharged cell back above a safe threshold before the full constant-current phase begins. It is why a quality charger revives a flat cell safely instead of stressing it, and one more reason to reach for a real charger chip rather than a bench supply." },
      { type: "sourceRef", label: "Battery University. BU-409: Charging Lithium-ion (CC/CV, termination current).", href: "https://batteryuniversity.com/article/bu-409-charging-lithium-ion" },
      { type: "sourceRef", label: "Microchip. MCP73831 single-cell Li-ion/LiPo charge management controller (programmable charge current).", href: "https://www.microchip.com/en-us/product/MCP73831" },
      { type: "quiz", questions: [
        { q: "What are the two main phases of lithium charging?", options: ["Constant voltage, then constant current", "Constant current, then constant voltage", "Fast charge, then reverse charge"], answer: 1, explain: "CC lifts the voltage to the ceiling; CV then holds it while the current tapers." },
        { q: "Charging ends when what happens in the constant-voltage phase?", options: ["The current falls below a small termination threshold", "A fixed timer runs out", "The cell reaches 5 V"], answer: 0, explain: "Termination is by current, about 0.1 C, not by a clock." },
        { q: "Why use a dedicated single-cell charger IC?", options: ["It charges from any voltage with no limit", "It makes the cell hold more than its capacity", "It runs the whole CC/CV profile and termination safely"], answer: 2, explain: "The chip carries the reference, the state machine, and the termination logic you must not improvise." },
      ] },
      { type: "sourceRef", label: "Prerequisite: LiPo and Li-ion safety", href: "/library/lithium-battery-safety" },
      { type: "sourceRef", label: "See it on a real board: the L2.01 battery power module", href: "/courses/l2-01-battery-power-module" },
      { type: "sourceRef", label: "Next: linear regulators (LDO)", href: "/library/linear-regulators-ldo" },
    ],
  },

  // ── 4. linear-regulators-ldo ─────────────────────────────────────────────
  {
    slug: "linear-regulators-ldo",
    title: "Linear regulators (LDO)",
    seoTitle: "LDO linear regulators explained: dropout, dissipation, heat",
    seoDescription:
      "A linear regulator drops a higher voltage to a fixed lower one by burning the difference as heat. Dropout, the dissipation that sets a thermal limit, and when an LDO is right.",
    clusterOrdinal: 4,
    contentBlocks: [
      { type: "prose", md: "A linear regulator, or LDO, turns a higher voltage into a fixed lower one by acting as a smart, self-adjusting resistor. It is simple and quiet, but the voltage it drops leaves as heat, and that heat sets a hard limit on how much it can do. This is the design-depth version of the Fundamentals power and heat lesson." },
      { type: "heading", text: "How an LDO holds its output" },
      { type: "prose", md: "An LDO watches its own output and continuously adjusts a pass transistor to hold that output at a fixed voltage, no matter how the input wanders or the load shifts. The `3.3 V` AP2112K on an L1.01 board does exactly this, taking a `5 V` USB input down to a steady `3.3 V`." },
      { type: "heading", text: "Dropout: the minimum you must give it" },
      { type: "prose", md: "An LDO needs the input to sit at least a little above the output to keep regulating. That minimum gap is the dropout voltage. The AP2112K needs about `250 mV` of headroom at full load (Diodes AP2112). Give it less and the output falls out of regulation and follows the input down. Low-dropout means that gap is small, which is what lets a `3.3 V` LDO run from a `3.7 V` cell." },
      { type: "heading", text: "Dissipation: where the heat comes from" },
      { type: "prose", md: "An LDO passes the full load current while dropping the voltage difference across itself, so it burns that difference times the current as heat, every second. Drop `1.7 V` at `200 mA` and the regulator sheds `0.34 W`. Raise either the drop or the current and it runs hotter." },
      { type: "math", tex: "P = (V_{in} - V_{out}) \\cdot I_{load}", plain: "P = (Vin - Vout) x Iload" },
      { type: "calculator", slug: "ldo-headroom", caption: "Check an LDO's headroom against its dropout and find the heat it dissipates." },
      { type: "heading", text: "The thermal limit" },
      { type: "prose", md: "That heat raises the chip's temperature above the air around it, by an amount set by its junction-to-ambient thermal resistance from the datasheet. A small `SOT-23-5` package has a high thermal resistance and little copper to shed heat into, so an LDO's real ceiling is thermal: the point where the die would exceed its rated temperature. It is the same relationship the Fundamentals power and heat guide sets out." },
      { type: "math", tex: "T_J = T_A + P \\cdot R_{\\theta JA}", plain: "Tj = Ta + P x R(theta-JA)" },
      { type: "image", src: "/guide-diagrams/power-ldo-dissipation.svg", alt: "An LDO passing load current from a higher input to a lower output, with the dropped voltage times the current shown leaving as heat into the copper plane.", caption: "An LDO burns (Vin minus Vout) times the load current as heat." },
      { type: "deepDive", summary: "When an LDO is exactly the right part", body: "An LDO is not always a compromise; it is the correct choice in three cases. When the drop is small, the wasted power is small, so a `3.3 V` LDO from a `3.7 V` cell is efficient. When the current is low, even a larger drop makes little heat. And when a rail feeds noise-sensitive analog parts, an LDO's quiet, ripple-free output beats a switching regulator's chopped one. Reach for a switcher when the drop is large and the current is high; reach for an LDO when the drop is small, the current is low, or the rail must be clean." },
      { type: "sourceRef", label: "Diodes Incorporated. AP2112 600mA CMOS LDO Regulator datasheet (dropout, thermal resistance, SOT-23-5).", href: "https://www.diodes.com/assets/Datasheets/AP2112.pdf" },
      { type: "sourceRef", label: "Texas Instruments. Understanding the Terms and Definitions of LDO Voltage Regulators (SLVA079).", href: "https://www.ti.com/lit/an/slva079/slva079.pdf" },
      { type: "quiz", questions: [
        { q: "What limits how much an LDO can step down at high current?", options: ["The heat from (Vin minus Vout) times the current", "The color of its package", "The length of its output wire"], answer: 0, explain: "The dropped voltage times the current becomes heat, and the thermal ceiling is the real limit." },
        { q: "What is an LDO's dropout voltage?", options: ["The output voltage it produces", "The minimum input-to-output gap it needs to keep regulating", "The voltage it gives off as light"], answer: 1, explain: "Below the dropout the output falls out of regulation and follows the input down." },
        { q: "When is an LDO a good choice?", options: ["A large drop at high current", "A small drop, low current, or a rail that must be quiet", "Only above 100 volts"], answer: 1, explain: "Small drop, low current, or a noise-sensitive rail: those favor an LDO over a switcher." },
      ] },
      { type: "sourceRef", label: "Prerequisite: power and heat", href: "/library/power-and-heat" },
      { type: "sourceRef", label: "Calculate it: the LDO headroom calculator", href: "/tools/ldo-headroom" },
      { type: "sourceRef", label: "Next: buck regulators (step-down)", href: "/library/buck-converters" },
    ],
  },

  // ── 5. buck-converters ───────────────────────────────────────────────────
  {
    slug: "buck-converters",
    title: "Buck regulators (step-down)",
    seoTitle: "Buck converter basics: efficient step-down explained",
    seoDescription:
      "A buck regulator steps voltage down efficiently by switching instead of burning the difference as heat. The topology, how duty cycle sets the output, and when to pick a buck.",
    clusterOrdinal: 5,
    contentBlocks: [
      { type: "prose", md: "A buck regulator steps a voltage down without cooking a regulator. Instead of burning the excess voltage as heat, it switches the input on and off fast and filters the result, so almost all the energy reaches the output. It is how you get `3.3 V` from a `12 V` input efficiently." },
      { type: "heading", text: "Switching, not burning" },
      { type: "prose", md: "An LDO wastes the voltage it drops as heat. A buck does not drop voltage across a resistor at all. It chops the input into pulses with a fast switch, then smooths those pulses back into a steady lower voltage with an inductor and a capacitor. Little is wasted, so a buck can be over 90 percent efficient where an LDO doing the same big step-down would be far worse." },
      { type: "heading", text: "The basic buck" },
      { type: "prose", md: "A buck is a switch, an inductor, a second switch or a diode, and an output capacitor. The switch feeds the inductor in pulses; the inductor stores energy in its magnetic field and hands it to the output smoothly; the capacitor holds the output steady between pulses. The controller adjusts the timing to keep the output on target." },
      { type: "heading", text: "Duty cycle sets the output" },
      { type: "prose", md: "The fraction of each cycle the main switch is on is the duty cycle, and for a buck it sets the output as that fraction of the input. Fifty percent of `12 V` gives `6 V`; a smaller duty cycle gives a lower output. The controller trims the duty cycle continuously to hold the output fixed as the input and load move." },
      { type: "math", tex: "V_{out} = D \\cdot V_{in}", plain: "Vout = D x Vin" },
      { type: "image", src: "/guide-diagrams/power-buck-topology.svg", alt: "A buck converter topology: a switch chopping the input, an inductor and a diode or second switch, and an output capacitor, with the switched waveform smoothed into a lower steady voltage.", caption: "The switch chops the input; the inductor and capacitor smooth it into a lower steady voltage." },
      { type: "deepDive", summary: "Ripple, and why the inductor and capacitor matter", body: "A buck's output is not perfectly flat. Each switching cycle leaves a small sawtooth called ripple riding on the DC. The inductor and the output capacitor set how large that ripple is: a bigger inductor holds the current steadier, a bigger capacitor absorbs more of the wobble. The same fast switching that makes a buck efficient also radiates noise, which is why a switching supply needs careful layout and sometimes a filter, and why a noise-sensitive analog rail is sometimes fed by a small LDO placed downstream of the buck." },
      { type: "sourceRef", label: "Texas Instruments. Basic Calculation of a Buck Converter's Power Stage (SLVA477).", href: "https://www.ti.com/lit/an/slva477b/slva477b.pdf" },
      { type: "quiz", questions: [
        { q: "Why is a buck more efficient than an LDO for a big step-down?", options: ["It runs at a higher temperature", "It switches and filters instead of burning the difference as heat", "It uses a larger resistor"], answer: 1, explain: "A buck stores and transfers energy through an inductor rather than dropping it across a pass element." },
        { q: "Which two parts smooth a buck's chopped input into a steady output?", options: ["An inductor and a capacitor", "Two resistors", "A battery and an LED"], answer: 0, explain: "The inductor stores energy and the output capacitor holds the voltage steady between pulses." },
        { q: "In a buck, the duty cycle sets what?", options: ["The color of the ripple", "The switching frequency only", "The output as a fraction of the input"], answer: 2, explain: "Vout = D x Vin: the on-fraction of each cycle sets the output level." },
      ] },
      { type: "sourceRef", label: "Prerequisite: linear regulators (LDO)", href: "/library/linear-regulators-ldo" },
      { type: "sourceRef", label: "Next: boost regulators (step-up)", href: "/library/boost-converters" },
      { type: "sourceRef", label: "See also: LDO vs switcher, picking one", href: "/library/ldo-vs-switching-regulator" },
    ],
  },

  // ── 6. boost-converters ──────────────────────────────────────────────────
  {
    slug: "boost-converters",
    title: "Boost regulators (step-up)",
    seoTitle: "Boost converter basics: step-up voltage explained",
    seoDescription:
      "A boost regulator raises a lower voltage to a higher one, so a single 3.7 V cell can drive a 5 V rail. The topology, how duty cycle sets the output, and why input current is higher.",
    clusterOrdinal: 6,
    contentBlocks: [
      { type: "prose", md: "A boost regulator does what a buck cannot: it raises a lower voltage to a higher one. That is how a single `3.7 V` lithium cell can drive a `5 V` rail. It uses the same switching idea as a buck, with the parts rearranged so the inductor comes first." },
      { type: "heading", text: "Why you need a boost" },
      { type: "prose", md: "Sometimes the battery sits below the rail you need. A single lithium cell is about `3.7 V`, but plenty of parts want `5 V`. You cannot make `5 V` from `3.7 V` by dropping voltage, because there is nothing to drop. A boost adds voltage by switching, so the cell can feed a higher rail." },
      { type: "heading", text: "The basic boost" },
      { type: "prose", md: "A boost puts the inductor across the input first. When the switch closes, current builds in the inductor and stores energy in its magnetic field. When the switch opens, that stored energy has nowhere to go but forward, through a diode into the output capacitor, and it arrives at a voltage higher than the input. Repeat fast and the output holds above the input." },
      { type: "heading", text: "Duty cycle sets the step-up" },
      { type: "prose", md: "As with a buck, the duty cycle sets the output, but the relationship inverts: the longer the switch stays on each cycle, the higher the output climbs above the input. A larger duty cycle means a bigger step-up." },
      { type: "math", tex: "V_{out} = \\frac{V_{in}}{1 - D}", plain: "Vout = Vin / (1 - D)" },
      { type: "heading", text: "Input current is higher than output" },
      { type: "prose", md: "Energy is conserved, so a boost cannot make power from nothing. Raising the voltage means the input must supply more current than the output delivers. Push `3.7 V` up to `5 V` and the cell hands over more amps than the `5 V` rail draws, plus a little lost to the switching. A boost trades battery current for rail voltage." },
      { type: "math", tex: "I_{in} \\cdot V_{in} = I_{out} \\cdot V_{out}", plain: "Iin x Vin = Iout x Vout" },
      { type: "image", src: "/guide-diagrams/power-boost-topology.svg", alt: "A boost converter topology: an inductor across the input, a switch to ground, a diode to the output, and a capacitor, with a low input voltage arrow becoming a higher output voltage.", caption: "Inductor first: stored energy is released forward at a voltage above the input." },
      { type: "deepDive", summary: "The limit of a boost, and why a dying cell strains it", body: "A boost has a ceiling. As the input falls, the duty cycle must rise to hold the same output, and the input current climbs to deliver the same power from a smaller voltage. Near a dead cell, with `3.0 V` trying to hold `5 V` at a real load, the inductor current can get very large and the efficiency sags. That is why a boost-fed board often browns out before the cell is truly empty, and why the battery, the boost, and the load have to be sized together rather than in isolation." },
      { type: "sourceRef", label: "Texas Instruments. Basic Calculation of a Boost Converter's Power Stage (SLVA372).", href: "https://www.ti.com/lit/an/slva372c/slva372c.pdf" },
      { type: "quiz", questions: [
        { q: "What does a boost regulator let a `3.7 V` cell do?", options: ["Charge itself", "Drive a higher rail, such as `5 V`", "Run cooler than a battery"], answer: 1, explain: "A boost steps the cell's voltage up so it can feed a rail above its own voltage." },
        { q: "In a boost, how does the input current compare to the output current?", options: ["It is higher, because raising the voltage conserves power", "It is exactly equal", "It is always zero"], answer: 0, explain: "Iin x Vin = Iout x Vout: a higher output voltage means the input must supply more current." },
        { q: "Which part stores the energy that a boost releases at a higher voltage?", options: ["The output resistor", "The indicator LED", "The inductor"], answer: 2, explain: "The inductor builds current while the switch is closed and releases it forward when the switch opens." },
      ] },
      { type: "sourceRef", label: "Prerequisite: buck regulators (step-down)", href: "/library/buck-converters" },
      { type: "sourceRef", label: "Next: LDO vs switcher, picking one", href: "/library/ldo-vs-switching-regulator" },
    ],
  },

  // ── 7. ldo-vs-switching-regulator ────────────────────────────────────────
  {
    slug: "ldo-vs-switching-regulator",
    title: "LDO vs switcher: picking one",
    seoTitle: "LDO vs switching regulator: how to choose",
    seoDescription:
      "Choose a regulator by the drop, the current, and the noise budget. When an LDO wins on simplicity and quiet, when a buck or boost wins on efficiency, and the hybrid that gets both.",
    clusterOrdinal: 7,
    contentBlocks: [
      { type: "prose", md: "There is no universally best regulator, only the right one for the job. Three questions decide it: how big is the voltage drop, how much current flows, and how clean must the output be. Answer those and the choice is usually obvious." },
      { type: "heading", text: "The trade-off" },
      { type: "prose", md: "A linear regulator is simple, cheap in parts, and quiet, but it wastes the dropped voltage as heat. A switching regulator is efficient and handles big conversions, but it is more parts, more layout care, and a noisier output. You are trading efficiency against simplicity and noise." },
      { type: "heading", text: "When each one wins" },
      { type: "table", columns: ["Regulator", "Best at", "Reach for it when"], rows: [
        [{ text: "LDO" }, { text: "Simplicity, low noise, tiny drops" }, { text: "A small drop, low current, or a clean analog rail" }],
        [{ text: "Buck" }, { text: "Efficient step-down at high current" }, { text: "A big drop or high current, where an LDO would cook" }],
        [{ text: "Boost" }, { text: "Making a higher rail from a lower one" }, { text: "The supply sits below the rail you need" }],
      ] },
      { type: "heading", text: "Reading the numbers" },
      { type: "prose", md: "The math is the same as in the earlier guides. An LDO's loss is the dropped voltage times the current, so a small drop at low current is nearly free, while a large drop at high current is a furnace. A switcher's loss is roughly a fixed efficiency percentage of the power it moves, so it stays reasonable even for a big conversion. Put your numbers in and the winner shows itself." },
      { type: "math", tex: "P_{LDO} = (V_{in} - V_{out}) \\cdot I_{load}", plain: "P_LDO = (Vin - Vout) x Iload" },
      { type: "heading", text: "The hybrid: switcher then LDO" },
      { type: "prose", md: "The two are not rivals when you need both efficiency and quiet. A common pattern steps a battery down efficiently with a buck to just above the target, then feeds a small LDO that scrubs the switching noise off and delivers a clean analog rail. You pay a little efficiency at the LDO for a low-noise output. Precision sensor front-ends use exactly this." },
      { type: "image", src: "/guide-diagrams/power-regulator-choice.svg", alt: "A decision comparison of LDO, buck, and boost across efficiency, noise, and when to use each, with the hybrid buck-then-LDO path shown for a clean rail.", caption: "Pick by drop, current, and noise; combine a buck and an LDO when you need efficiency and quiet." },
      { type: "deepDive", summary: "Quiescent current: the number that decides a sleeping board", body: "For a board that spends its life asleep on a battery, the regulator's own idle draw, its quiescent current, can matter more than its efficiency at full load. A switcher that is efficient at `500 mA` may burn more just idling than a tiny LDO does, draining the cell while the board sleeps. This is why a low-power design often chooses a regulator on its quiescent current first, and why the datasheet figure to compare is not always the peak efficiency." },
      { type: "sourceRef", label: "Diodes Incorporated. AP2112 600mA CMOS LDO Regulator datasheet (low-noise linear regulation).", href: "https://www.diodes.com/assets/Datasheets/AP2112.pdf" },
      { type: "sourceRef", label: "Texas Instruments. Basic Calculation of a Buck Converter's Power Stage (SLVA477): switcher efficiency.", href: "https://www.ti.com/lit/an/slva477b/slva477b.pdf" },
      { type: "quiz", questions: [
        { q: "You need a quiet `3.3 V` analog rail from a `3.6 V` input. Which regulator?", options: ["A boost", "An LDO, for the small drop and low noise", "A high-power buck"], answer: 1, explain: "A small drop and a noise-sensitive rail is exactly where an LDO wins." },
        { q: "A switching regulator's main advantage over an LDO is what?", options: ["Efficiency, especially for a big conversion or high current", "A quieter output", "Fewer parts on the board"], answer: 0, explain: "A switcher keeps efficiency high where an LDO would waste the drop as heat." },
        { q: "What does the buck-then-LDO hybrid achieve?", options: ["A higher output than either alone", "Twice the current rating", "Efficient step-down plus a clean, low-noise final rail"], answer: 2, explain: "The buck moves the bulk power efficiently; the LDO scrubs the switching noise off it." },
      ] },
      { type: "sourceRef", label: "Prerequisite: linear regulators (LDO)", href: "/library/linear-regulators-ldo" },
      { type: "sourceRef", label: "See also: buck regulators (step-down)", href: "/library/buck-converters" },
      { type: "sourceRef", label: "Next: reverse-polarity and inrush protection", href: "/library/reverse-polarity-protection" },
    ],
  },

  // ── 8. reverse-polarity-protection ───────────────────────────────────────
  {
    slug: "reverse-polarity-protection",
    title: "Reverse-polarity and inrush protection",
    seoTitle: "Reverse-polarity and inrush protection for a board",
    seoDescription:
      "A backwards battery or a turn-on surge can destroy a board. The series diode, the P-channel MOSFET ideal diode that wastes far less, and how to tame inrush at power-on.",
    clusterOrdinal: 8,
    contentBlocks: [
      { type: "prose", md: "Two things at the power input can kill a board in an instant: a battery put in backwards, and the surge of current when power first connects. A little protection at the input handles both. This extends the ideal-diode idea from the Fundamentals diode guide into real power design." },
      { type: "heading", text: "The reverse-polarity risk" },
      { type: "prose", md: "Connect a supply backwards and current tries to flow the wrong way through parts that tolerate only one direction. Electrolytic capacitors, ICs, and the regulator can be destroyed before you notice. A reverse-polarity guard blocks that backward current so a wrong connection does nothing at all." },
      { type: "heading", text: "The series diode: simple but lossy" },
      { type: "prose", md: "The oldest guard is a diode in series with the input. It conducts when the supply is the right way round and blocks when it is reversed. It works, but it is not free: the diode drops its forward voltage, around `0.3 V` to `0.7 V`, all the time, burning that drop times the load current as heat and stealing it from a battery." },
      { type: "math", tex: "P_{diode} = V_f \\cdot I_{load}", plain: "P_diode = Vf x Iload" },
      { type: "heading", text: "The P-channel MOSFET ideal diode" },
      { type: "prose", md: "A better guard replaces the diode with a P-channel MOSFET wired to conduct only when the supply is correct. Its on-resistance is milliohms, so the voltage it drops and the heat it makes are tiny, a fraction of the diode's, for the cost of a couple more parts. This ideal diode is why good designs protect the input almost for free (TI, Basics of Ideal Diodes)." },
      { type: "math", tex: "P_{FET} = I_{load}^2 \\cdot R_{DS(on)}", plain: "P_FET = Iload^2 x Rds(on)" },
      { type: "heading", text: "Inrush at power-on" },
      { type: "prose", md: "When power first connects, every bulk capacitor on the board is empty and gulps a large spike of current as it charges, the inrush surge. It can dip the supply, weld a connector, or trip a protection circuit. Inrush control, a soft-start that ramps the input in over a few milliseconds instead of slamming it on, tames that spike." },
      { type: "image", src: "/guide-diagrams/power-input-protection.svg", alt: "A board's power input with a P-channel MOSFET blocking reverse polarity and an inrush-limiting element ramping the turn-on current into the bulk capacitors.", caption: "A P-FET blocks a reversed supply; an inrush element ramps the turn-on surge." },
      { type: "callout", severity: "info", label: "Where each guard goes", body: "Both guards sit right at the power input, before anything else. The reverse-polarity device comes first so a backward supply is blocked at the door, then the inrush element so the surge is limited as power reaches the bulk capacitors. Put either one downstream and the parts ahead of it are unprotected." },
      { type: "deepDive", summary: "How an ideal-diode controller beats even a plain P-FET", body: "A bare P-FET reverse guard already beats a diode, but a dedicated ideal-diode controller goes further. It actively drives the MOSFET gate, holds the forward drop to a few millivolts, and can switch the FET off within microseconds if the input ever goes backward or a downstream fault tries to push current back toward the source. On boards that share a supply or hot-swap, that fast, controlled turn-off is what keeps one board's fault from feeding back into the rail. Same MOSFET, a smarter driver. (TI, Basics of Ideal Diodes)" },
      { type: "sourceRef", label: "Texas Instruments. Basics of Ideal Diodes application note (SLVAE57B): P-channel MOSFET reverse-polarity protection.", href: "https://www.ti.com/lit/an/slvae57b/slvae57b.pdf" },
      { type: "quiz", questions: [
        { q: "Why prefer a P-channel MOSFET ideal diode over a series diode for reverse protection?", options: ["It looks better on the board", "It wastes far less power and heat than the diode's forward drop", "It raises the output voltage"], answer: 1, explain: "The MOSFET's milliohm on-resistance drops almost nothing, unlike the diode's steady forward-voltage loss." },
        { q: "What causes an inrush surge at power-on?", options: ["The empty bulk capacitors gulping current as they charge", "The indicator LEDs turning on", "The battery changing chemistry"], answer: 0, explain: "Discharged capacitors look like a near-short for an instant and pull a large charging spike." },
        { q: "Where should the reverse-polarity and inrush guards sit?", options: ["Anywhere convenient downstream", "Only on the output rail", "Right at the power input, before everything else"], answer: 2, explain: "Guards at the door protect the whole board; downstream, the parts ahead of them are exposed." },
      ] },
      { type: "sourceRef", label: "Prerequisite: diodes and LEDs", href: "/library/diodes-and-leds" },
      { type: "sourceRef", label: "Next: power sequencing and soft-start", href: "/library/power-sequencing" },
    ],
  },

  // ── 9. power-sequencing ──────────────────────────────────────────────────
  {
    slug: "power-sequencing",
    title: "Power sequencing and soft-start",
    seoTitle: "Power sequencing and soft-start explained",
    seoDescription:
      "Some chips need their rails to come up in order, and slamming every rail on at once can latch up. What sequencing and soft-start do, and when a board needs them.",
    clusterOrdinal: 9,
    contentBlocks: [
      { type: "prose", md: "Some chips insist their power rails arrive in a particular order, and a board that switches every rail on at once can latch up or surge. Sequencing brings the rails up in the right order; soft-start brings each one up gently. Together they make a multi-rail board turn on cleanly." },
      { type: "heading", text: "Why the order matters" },
      { type: "prose", md: "A part with more than one rail, an FPGA or a processor with a separate core and IO supply, often specifies which rail must come up first. Power the IO before the core, or the other way when the datasheet demands it, and internal protection diodes can conduct or the chip can latch into a stuck, high-current state. The datasheet's sequencing requirement is a rule, not a preference." },
      { type: "heading", text: "The latch-up and surge risk" },
      { type: "prose", md: "Latch-up is a parasitic path inside a chip that, once triggered by a bad rail order or an overshoot, shorts power to ground until you remove power entirely. Even short of a full latch-up, slamming several rails on together stacks their inrush surges into one big spike. Sequencing and soft-start defuse both." },
      { type: "heading", text: "Soft-start: ramping a rail up" },
      { type: "prose", md: "Soft-start ramps a regulator's output up smoothly over a few milliseconds instead of stepping it on instantly. The gentle ramp limits the inrush into the downstream capacitors and gives the rest of the board time to react. Many regulators have a soft-start pin or a fixed internal ramp for exactly this." },
      { type: "math", tex: "V(t) = V_{final}\\left(1 - e^{-t/RC}\\right)", plain: "V(t) = Vfinal x (1 - e^(-t/RC))" },
      { type: "heading", text: "Simple ways to sequence" },
      { type: "prose", md: "You do not always need a dedicated sequencer chip. A common trick is an enable chain: the first regulator's power-good output enables the second, which enables the third, so they come up in order by construction. An RC delay on an enable pin staggers a rail by a set time. A board with tight requirements uses a purpose-built sequencer, but many get by with an enable chain." },
      { type: "image", src: "/guide-diagrams/power-sequencing.svg", alt: "Two power rails ramping up in sequence over time, the first rail rising and reaching good before the second begins its soft-start ramp.", caption: "Rails come up in order, each with a gentle soft-start ramp rather than an instant step." },
      { type: "deepDive", summary: "Sequencing on the way down matters too", body: "Bringing rails up in order is only half the job. Some chips are just as unhappy if their rails collapse in the wrong order at power-off, with the same latch-up or back-feed risk as a bad turn-on. A careful design sequences the shutdown as well, holding one rail up until another has safely drained, often by reversing the enable chain. When a datasheet gives a power-up order, check whether it also specifies a power-down order, because ignoring the second can be as damaging as ignoring the first." },
      { type: "sourceRef", label: "Texas Instruments. Power supply sequencing overview (sequencers, enable chains, power-good).", href: "https://www.ti.com/power-management/sequencer/overview.html" },
      { type: "quiz", questions: [
        { q: "What problem does power sequencing avoid?", options: ["Rails coming up in a bad order, risking latch-up or a surge", "The battery charging too fast", "The indicator LEDs flickering"], answer: 0, explain: "Some chips require a rail order; violating it can latch the chip up or stack inrush surges." },
        { q: "What does soft-start do to a rail?", options: ["Holds it off permanently", "Ramps it up gently instead of stepping it on instantly", "Raises it above its rated voltage"], answer: 1, explain: "The smooth ramp limits inrush and gives the rest of the board time to react." },
        { q: "A simple way to sequence rails without a dedicated chip is what?", options: ["Using longer wires", "Charging the battery more slowly", "An enable chain, where one rail's power-good enables the next"], answer: 2, explain: "Chaining enables, or an RC delay on an enable pin, orders the rails by construction." },
      ] },
      { type: "sourceRef", label: "Prerequisite: power rails and a power budget", href: "/library/power-budget" },
      { type: "sourceRef", label: "Next: measuring power and battery runtime", href: "/library/battery-runtime" },
    ],
  },

  // ── 10. battery-runtime ──────────────────────────────────────────────────
  {
    slug: "battery-runtime",
    title: "Measuring power and battery runtime",
    seoTitle: "How to estimate battery runtime honestly",
    seoDescription:
      "Runtime is capacity divided by average draw, discounted for the usable fraction and the regulator loss. How to measure real current and why sleep current dominates battery life.",
    clusterOrdinal: 10,
    contentBlocks: [
      { type: "prose", md: "Runtime is capacity divided by average draw, with an honest discount for the voltage window you can actually use and the power the regulator loses. Guess the draw and you get a fantasy; measure it and you get a number you can trust. This guide, and the calculator below, do it the honest way." },
      { type: "heading", text: "Average draw, not peak" },
      { type: "prose", md: "Runtime is set by the average current, not the peaks. A board that sleeps at `20 uA` and wakes for a `100 mA` burst once a minute averages far closer to the sleep figure than the burst. Add up the current over a full cycle of the board's behavior and divide by the time to get the true average." },
      { type: "heading", text: "The runtime estimate" },
      { type: "prose", md: "Start with the capacity, multiply by the fraction of it you can actually reach before the cell hits its empty voltage, then divide by the average draw. The usable fraction is never one: a regulator stops working below its dropout, and a lithium cell is empty at `3.0 V`, not `0 V`, so a real board reaches perhaps 80 percent of the printed capacity." },
      { type: "math", tex: "t = \\frac{Q \\cdot k_{usable}}{I_{avg}}", plain: "t = (Q x usable-fraction) / Iavg" },
      { type: "calculator", slug: "lipo-battery-runtime", caption: "Estimate runtime from capacity, average draw, and the usable fraction." },
      { type: "heading", text: "Efficiency and regulator loss" },
      { type: "prose", md: "Every regulator between the cell and the load takes a cut. An LDO wastes the voltage it drops; a switcher loses a fixed percentage; a boost draws more current from the cell than the load ever sees. Fold that loss into the average draw at the battery, not at the load, or the estimate runs long." },
      { type: "heading", text: "Measuring the real current" },
      { type: "prose", md: "You cannot estimate what you have not measured. Put a meter in series with the supply and read the current in each state, asleep and awake. For the tiny sleep current a plain multimeter often lacks resolution, so a low-value sense resistor or a dedicated power analyzer reads the microamps that decide a battery board's life." },
      { type: "image", src: "/guide-diagrams/power-runtime.svg", alt: "A runtime readout computing hours from capacity divided by average draw, with the usable fraction and the regulator loss shown as discounts on the capacity.", caption: "Capacity times the usable fraction, divided by the average draw, gives the hours." },
      { type: "callout", severity: "info", label: "Why sleep current dominates battery life", body: "On most battery boards the board is asleep almost all the time and awake for a few milliseconds now and then. That means the sleep current, not the flashy active burst, sets how long the battery lasts. Halving a `100 uA` sleep current can nearly double the runtime, while shaving the active burst barely moves it. When a design must last months on a cell, the whole fight is the sleep number." },
      { type: "deepDive", summary: "Self-discharge and cold, the slow leaks", body: "Two effects erode runtime that no current meter on the load will ever show. A cell self-discharges, slowly losing charge on its own even with nothing connected, so a board that sleeps for months loses capacity to the cell as much as to the load. And cold cuts capacity: a lithium cell delivers noticeably less charge in the cold than at room temperature, because the chemistry slows down. For a board that must last a season outdoors, budget both, or the bench estimate will beat the field every time." },
      { type: "sourceRef", label: "Battery University. BU-503: How to Calculate Battery Runtime (usable capacity, load).", href: "https://batteryuniversity.com/article/bu-503-how-to-calculate-battery-runtime" },
      { type: "sourceRef", label: "Espressif. ESP32-S3 Series Datasheet (deep-sleep current consumption).", href: "https://www.espressif.com/sites/default/files/documentation/esp32-s3_datasheet_en.pdf" },
      { type: "quiz", questions: [
        { q: "What dominates the battery life of a board that is mostly asleep?", options: ["The brief active burst", "The sleep or idle current", "The color of the LED"], answer: 1, explain: "With the board asleep almost all the time, the sleep current sets the runtime." },
        { q: "Why is real runtime less than capacity divided by draw?", options: ["The usable fraction is below one and the regulator loses power", "Batteries always outperform their rating", "Current meters read high"], answer: 0, explain: "You cannot use the whole capacity, and the regulator between cell and load takes a cut." },
        { q: "How do you measure a board's true current draw?", options: ["Read the battery's printed label", "Guess from the datasheet maximums", "Put a meter in series with the supply and read each state"], answer: 2, explain: "Measure asleep and awake; the tiny sleep current often needs a sense resistor or a power analyzer." },
      ] },
      { type: "sourceRef", label: "Prerequisite: batteries 101", href: "/library/batteries-101" },
      { type: "sourceRef", label: "Calculate it: the LiPo battery runtime calculator", href: "/tools/lipo-battery-runtime" },
      { type: "sourceRef", label: "See it on a real board: the L2.01 battery power module", href: "/courses/l2-01-battery-power-module" },
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
      if (b.type === "math") {
        try {
          katex.renderToString(b.tex, { throwOnError: true });
        } catch (e) {
          ok = false;
          console.error(`[${l.slug}] BAD LaTeX \`${b.tex}\`: ${(e as Error).message}`);
        }
      }
    }
    if (JSON.stringify(l).includes(EM_DASH)) {
      ok = false;
      console.error(`[${l.slug}] CONTAINS EM-DASH`);
    }
    // Every glyph in the content must render in the field-guide PDF (a body face
    // has it, or the render fallback set + Saira do). Catches a symbol that would
    // .notdef-box in print before it ships. See pdf-glyphs.test.ts for the twin
    // guard over the tool registry.
    for (const g of pdfGlyphIssues(JSON.stringify(l.contentBlocks), PDF_SAIRA_FALLBACK)) {
      ok = false;
      console.error(`[${l.slug}] PDF-unrenderable glyph "${g.char}" (${g.codepoint}) — ${g.kind}`);
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
        cluster: "power-batteries",
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
        cluster: "power-batteries",
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
