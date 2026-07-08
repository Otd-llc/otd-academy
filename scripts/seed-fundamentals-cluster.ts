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
import katex from "katex";
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
      { type: "prose", md: "Ohm's law relates voltage, current, and resistance in one equation. Rearranged, it gives you current or resistance, and the power follows. Know any two and you have the rest. Georg Ohm published the relationship in 1827, and it holds for the resistive parts on every board here." },
      { type: "image", src: "/guide-diagrams/fund-ohms-wheel.svg", alt: "Two mnemonic triangles: V over I and R for Ohm's law, and P over V and I for power. Cover the quantity you want and the triangle shows its formula.", caption: "Cover the quantity you want: the triangle gives its formula." },
      { type: "math", tex: "V = I \\cdot R", plain: "V = I x R" },
      { type: "calculator", slug: "ohms-law", caption: "Solve for voltage, current, or resistance, and read the power." },
      { type: "heading", text: "The three forms" },
      { type: "prose", md: "They are one equation, written for whatever you are missing. Know the current and the resistance and you want the voltage. Know the voltage and the resistance and you want the current. Know the voltage and the current and you want the resistance. Keep the units honest, volts and amps and ohms, and the arithmetic is exact." },
      { type: "math", tex: "I = \\frac{V}{R} \\qquad R = \\frac{V}{I} \\qquad P = V \\cdot I", plain: "I = V / R,   R = V / I,   P = V x I" },
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
      { type: "prose", md: "Power is the rate a part uses energy, measured in watts. For a resistor it takes three equivalent forms, shown below. Whatever form you use, the power a resistive part burns leaves as heat, and that heat is what sets the part you buy." },
      { type: "math", tex: "P = V \\cdot I = I^2 R = \\frac{V^2}{R}", plain: "P = V x I = I^2 R = V^2 / R" },
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

  // ── 4. resistors ─────────────────────────────────────────────────────────
  {
    slug: "resistors",
    title: "Resistors",
    seoTitle: "Resistors explained: E-series values, tolerance, and ratings",
    seoDescription:
      "What a resistor does, the standard E-series values you can actually buy (IEC 60063), tolerance, and power rating. With real board examples.",
    clusterOrdinal: 4,
    contentBlocks: [
      { type: "prose", md: "A resistor is a part built to have a chosen, stable resistance, and almost every board is covered in them. What they do, the standard values you can actually buy, and how to read one off a schematic, is most of what you need." },
      { type: "heading", text: "What does a resistor do?" },
      { type: "prose", md: "A resistor limits current, sets a voltage when paired with another resistor as a divider, pulls a signal line to a known level, or senses a current by the small voltage it drops. Each use is the same part chosen for a different value." },
      { type: "heading", text: "The standard values: the E-series" },
      { type: "prose", md: "You cannot buy just any resistance. Manufacturers make a fixed set of values in each decade, spaced so their tolerance bands overlap, and this set is the E-series defined by IEC 60063. The E24 series has 24 values per decade for 5 percent parts; the E12 series has 12 for 10 percent parts. So you compute the value you want, then pick the nearest standard one." },
      { type: "sourceRef", label: "IEC 60063:2015. Preferred number series for resistors and capacitors (the E-series).", href: "https://webstore.iec.ch/publication/650" },
      { type: "heading", text: "Tolerance and power rating" },
      { type: "prose", md: "Tolerance is how close the real value sits to the printed one, commonly 1 or 5 percent. The power rating is how much heat the part can shed before it drifts or fails, so size it above the power it dissipates. On a small board these are surface-mount chips in `0402` and `0603` sizes." },
      { type: "sourceRef", label: "Vishay. D/CRCW e3 Standard Thick Film Chip Resistors datasheet (E-series values, tolerance, ratings).", href: "https://www.vishay.com/docs/20035/dcrcwe3.pdf" },
      { type: "image", src: "/guide-diagrams/fund-resistor-eseries.svg", alt: "A resistor symbol and the E24 standard values in one decade laid out on a logarithmic scale.", caption: "The E-series: the standard values you can actually buy, spaced so their tolerances overlap." },
      { type: "prose", md: "A One Thousand Drones board's bill of materials is mostly `0402` and `0603` chip resistors at E24 values, `5.1 kΩ`, `10 kΩ`, `330 Ω`, chosen because they are standard and in stock." },
      { type: "quiz", questions: [
        { q: "Why can't you buy a resistor of any exact value?", options: ["Manufacturers make a fixed set of standard values per decade", "Resistors are only made in whole ohms", "Only round numbers are physically possible"], answer: 0, explain: "The E-series (IEC 60063) fixes the standard values; you pick the nearest one." },
        { q: "A resistor's tolerance tells you what?", options: ["How much power it can dissipate", "How close its real value is to the printed value", "How fast it responds to a signal"], answer: 1, explain: "Tolerance is the value spread, commonly 1 or 5 percent; the power rating is separate." },
        { q: "The E24 series has how many standard values per decade?", options: ["12", "100", "24"], answer: 2, explain: "E24 has 24 values per decade (5 percent parts); E12 has 12 (10 percent)." },
      ] },
      { type: "sourceRef", label: "Prerequisite: Ohm's law", href: "/library/ohms-law" },
      { type: "sourceRef", label: "Next: voltage dividers", href: "/library/voltage-dividers" },
    ],
  },

  // ── 5. voltage-dividers ──────────────────────────────────────────────────
  {
    slug: "voltage-dividers",
    title: "Voltage dividers",
    seoTitle: "Voltage dividers explained: Vout = Vin R2 / (R1 + R2)",
    seoDescription:
      "How a voltage divider splits a voltage, why it sags under load, and how to scale a higher voltage into an ADC. With a live calculator.",
    clusterOrdinal: 5,
    contentBlocks: [
      { type: "prose", md: "A voltage divider is two resistors in series that split a voltage. The output, tapped between them, is a fixed fraction of the input set by the two resistor values." },
      { type: "math", tex: "V_{out} = V_{in} \\cdot \\frac{R_2}{R_1 + R_2}", plain: "Vout = Vin x R2 / (R1 + R2)" },
      { type: "calculator", slug: "voltage-divider", caption: "Compute a divider's output and the current it draws." },
      { type: "heading", text: "Why it sags under load" },
      { type: "prose", md: "The divider only holds its ratio while almost nothing draws current from the tap. Connect a real load and it pulls the output down, because the load acts like a third resistor. So a divider suits a high-impedance input that draws almost no current, and it is a poor way to power anything." },
      { type: "heading", text: "Scaling a voltage into an ADC" },
      { type: "prose", md: "An ESP32-S3 analog input reads roughly 0 to 3100 mV with its highest attenuation, near the `3.3 V` rail (Espressif ESP-IDF). To read a higher voltage, say a battery above the rail, a divider scales it down into that range so the ADC can measure it safely. The ADC pin draws almost no current, which is exactly the light load a divider needs." },
      { type: "sourceRef", label: "Espressif. ESP-IDF Programming Guide: ESP32-S3 Analog to Digital Converter (ADC), input range and attenuation.", href: "https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-reference/peripherals/adc.html" },
      { type: "image", src: "/guide-diagrams/fund-voltage-divider.svg", alt: "A two-resistor voltage divider with the output tapped between R1 and R2, and the output-fraction formula.", caption: "The output is a fixed fraction of the input, set by R1 and R2." },
      { type: "quiz", questions: [
        { q: "A voltage divider's output is what?", options: ["Always half the input", "A fixed fraction of the input set by the two resistors", "The same as the input"], answer: 1, explain: "Vout = Vin x R2 / (R1 + R2); the ratio depends on the resistor values." },
        { q: "What happens when you draw significant current from a divider's output?", options: ["The output rises", "Nothing changes", "The output sags below its no-load value"], answer: 2, explain: "The load acts like a third resistor and pulls the output down, so dividers suit high-impedance inputs." },
        { q: "A voltage divider is a good way to do what?", options: ["Scale a voltage into an ADC's input range", "Power a motor from a higher rail", "Store energy for later"], answer: 0, explain: "Its light-load fraction is ideal for a high-impedance ADC input, not for powering a load." },
      ] },
      { type: "sourceRef", label: "Prerequisite: resistors", href: "/library/resistors" },
      { type: "sourceRef", label: "Calculate it: the voltage divider calculator", href: "/tools/voltage-divider" },
      { type: "sourceRef", label: "Next: capacitors and decoupling", href: "/library/capacitors" },
    ],
  },

  // ── 6. capacitors ────────────────────────────────────────────────────────
  {
    slug: "capacitors",
    title: "Capacitors and decoupling",
    seoTitle: "Capacitors and decoupling explained",
    seoDescription:
      "What a capacitor does, why a decoupling cap sits beside every chip, and the difference between ceramic and electrolytic. With real board examples.",
    clusterOrdinal: 6,
    contentBlocks: [
      { type: "prose", md: "A capacitor stores charge and releases it, which makes it the part that steadies a power rail. The decoupling capacitor beside almost every chip is the most common one you will place." },
      { type: "heading", text: "What does a capacitor do?" },
      { type: "prose", md: "A capacitor stores an amount of charge for each volt across it, which is its capacitance in farads. It resists a sudden change in voltage, and it passes a changing signal while blocking steady DC. Those two behaviors cover almost every use." },
      { type: "heading", text: "Decoupling: the cap at every chip" },
      { type: "prose", md: "A chip's current draw jumps the instant it switches. A small capacitor placed right at its power pins supplies that sudden demand locally, so the rail does not dip and the chip stays fed. That job is decoupling, also called bypass, and a `100 nF` ceramic is the default choice." },
      { type: "heading", text: "Ceramic and electrolytic" },
      { type: "prose", md: "Ceramic capacitors are small and fast, and the X7R type is temperature-stable (an EIA Class II dielectric), which is why X7R is the workhorse for decoupling (Murata). Electrolytic capacitors hold far more charge for bulk energy storage where power enters the board, at the cost of size and speed." },
      { type: "sourceRef", label: "Murata. Ceramic Capacitor overview (X7R Class II dielectric for decoupling).", href: "https://www.murata.com/products/capacitor/ceramiccapacitor" },
      { type: "image", src: "/guide-diagrams/fund-decoupling-cap.svg", alt: "A decoupling capacitor placed at a chip's power pin, supplying the chip's sudden current demand so the rail stays steady.", caption: "The decoupling cap sits right at the power pin and feeds the chip's instant demand." },
      { type: "prose", md: "On a One Thousand Drones L1.01 board a `100 nF` ceramic sits right at the module's power pins, and larger bulk capacitors sit where USB power enters." },
      { type: "quiz", questions: [
        { q: "What does a decoupling capacitor do?", options: ["Raises the supply voltage", "Blocks the chip from drawing current", "Supplies a chip's sudden current demand so the rail stays steady"], answer: 2, explain: "It is a local charge reservoir right at the chip's power pins for the instant it switches." },
        { q: "Which capacitor type is the usual choice for decoupling?", options: ["A small X7R ceramic", "A large electrolytic", "A variable capacitor"], answer: 0, explain: "X7R ceramics are small, fast, and temperature-stable, ideal for decoupling." },
        { q: "A capacitor stores charge in proportion to what?", options: ["The current through it", "The voltage across it", "The resistance beside it"], answer: 1, explain: "Capacitance is the charge stored per volt across the part." },
      ] },
      { type: "sourceRef", label: "Prerequisite: voltage, current, and resistance", href: "/library/voltage-current-resistance" },
      { type: "sourceRef", label: "See it on a real board: the L1.01 build", href: "/courses/l1-01-wroom-breakout" },
      { type: "sourceRef", label: "Next: diodes and LEDs", href: "/library/diodes-and-leds" },
    ],
  },

  // ── 7. diodes-and-leds ───────────────────────────────────────────────────
  {
    slug: "diodes-and-leds",
    title: "Diodes and LEDs",
    seoTitle: "Diodes and LEDs explained: forward voltage and current limiting",
    seoDescription:
      "How a diode passes current one way, why an LED needs a current-limiting resistor, and the forward voltage by color. With a live calculator.",
    clusterOrdinal: 7,
    contentBlocks: [
      { type: "prose", md: "A diode lets current flow one way and blocks it the other. An LED is a diode that emits light, and like any diode it drops a roughly fixed forward voltage, so it needs a resistor to set its current." },
      { type: "heading", text: "A one-way valve" },
      { type: "prose", md: "In the forward direction a diode conducts with a small voltage drop; in reverse it blocks. A common use is reverse-polarity protection: a diode in the power path passes current only when the supply is connected the right way round, so a reversed battery cannot damage the board." },
      { type: "heading", text: "The LED forward voltage" },
      { type: "prose", md: "An LED drops a forward voltage that depends on its color, roughly `1.8 V` for red and `3.0 V` to `3.4 V` for blue and white at a typical 20 mA (see the forward-voltage reference below, and always read the specific LED's datasheet at your current). Because that drop is roughly fixed, you set the current with a series resistor sized from the supply, the forward voltage, and your target current." },
      { type: "math", tex: "R = \\frac{V_{supply} - V_f}{I}", plain: "R = (Vsupply - Vf) / I" },
      { type: "calculator", slug: "led-series-resistor", caption: "Size an LED's current-limiting resistor." },
      { type: "sourceRef", label: "CircuitBread. The forward voltages of different LEDs (typical Vf by color at 20 mA).", href: "https://www.circuitbread.com/ee-faq/the-forward-voltages-of-different-leds" },
      { type: "image", src: "/guide-diagrams/fund-diode-led.svg", alt: "A diode symbol showing forward conduction and reverse blocking, and an LED with its series current-limiting resistor.", caption: "A diode conducts one way; an LED needs a series resistor to set its current." },
      { type: "prose", md: "On a One Thousand Drones board a diode in the power input path is reverse-polarity protection: it only conducts when the supply is the right way round, and its direction and its forward drop are the whole point." },
      { type: "quiz", questions: [
        { q: "A diode does what?", options: ["Passes current one way and blocks the other", "Passes current in both directions equally", "Stores charge like a capacitor"], answer: 0, explain: "A diode is a one-way valve: forward it conducts, reverse it blocks." },
        { q: "Why does an LED need a series resistor?", options: ["To raise its brightness above the supply", "To set its current, since its forward voltage is roughly fixed", "To store energy between blinks"], answer: 1, explain: "The LED drop is roughly fixed, so the resistor sets the current." },
        { q: "A red LED's forward voltage is closest to which value?", options: ["0.2 V", "12 V", "1.8 V"], answer: 2, explain: "Red is about 1.8 V; blue and white are nearer 3.0 to 3.4 V, at 20 mA." },
      ] },
      { type: "sourceRef", label: "Prerequisite: Ohm's law", href: "/library/ohms-law" },
      { type: "sourceRef", label: "Calculate it: the LED series resistor calculator", href: "/tools/led-series-resistor" },
      { type: "sourceRef", label: "Next: reactive parts and filtering", href: "/library/reactive-and-filtering" },
    ],
  },

  // ── 8. reactive-and-filtering ────────────────────────────────────────────
  {
    slug: "reactive-and-filtering",
    title: "Reactive parts and filtering",
    seoTitle: "Reactance and RC filters explained: fc = 1 / 2 pi RC",
    seoDescription:
      "How capacitors and inductors react to changing signals, and how an RC filter's cutoff frequency picks what passes. With a live calculator.",
    clusterOrdinal: 8,
    contentBlocks: [
      { type: "prose", md: "Resistors treat every frequency the same. Capacitors and inductors do not: they react to how fast a signal changes, and that lets you build a filter that passes some frequencies and blocks others." },
      { type: "heading", text: "Reactance" },
      { type: "prose", md: "A capacitor's opposition to current falls as the frequency rises, and an inductor's opposition rises. That frequency-dependent opposition is reactance. It is why a capacitor blocks steady DC but passes a fast signal." },
      { type: "heading", text: "The RC filter and its cutoff" },
      { type: "prose", md: "A resistor and a capacitor together set a cutoff frequency, the point where the filter starts to roll off. In a low-pass filter, frequencies below the cutoff pass and frequencies above it are attenuated. The cutoff comes straight from the R and C values." },
      { type: "math", tex: "f_c = \\frac{1}{2 \\pi R C}", plain: "fc = 1 / (2 x pi x R x C)" },
      { type: "calculator", slug: "rc-filter-cutoff", caption: "Find an RC filter's cutoff frequency and time constant." },
      { type: "heading", text: "Where you meet it" },
      { type: "prose", md: "An RC low-pass in front of an ADC is an anti-alias filter: it removes fast noise the converter would otherwise fold into the signal (Espressif ESP-IDF). The same RC also sets how fast a line settles, which is why a reset or button line often carries one." },
      { type: "sourceRef", label: "Espressif. ESP-IDF Programming Guide: ESP32-S3 Analog to Digital Converter (ADC).", href: "https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-reference/peripherals/adc.html" },
      { type: "image", src: "/guide-diagrams/fund-rc-filter.svg", alt: "An RC low-pass filter and its response curve rolling off above the cutoff frequency.", caption: "An RC low-pass passes low frequencies and rolls off above the cutoff." },
      { type: "quiz", questions: [
        { q: "Reactance is what?", options: ["A resistor's fixed opposition to current", "A frequency-dependent opposition to current", "The heat a part gives off"], answer: 1, explain: "A capacitor's and inductor's opposition changes with frequency; that is reactance." },
        { q: "In a low-pass RC filter, which frequencies pass?", options: ["Those above the cutoff", "All frequencies equally", "Those below the cutoff"], answer: 2, explain: "Low-pass passes below the cutoff and attenuates above it." },
        { q: "An RC filter in front of an ADC does what?", options: ["Removes fast noise before the converter samples it", "Amplifies the signal", "Stores the reading"], answer: 0, explain: "It is an anti-alias filter: it strips high-frequency noise the ADC would otherwise fold in." },
      ] },
      { type: "sourceRef", label: "Prerequisite: capacitors and decoupling", href: "/library/capacitors" },
      { type: "sourceRef", label: "Calculate it: the RC filter cutoff calculator", href: "/tools/rc-filter-cutoff" },
      { type: "sourceRef", label: "Next: grounds and power rails", href: "/library/grounds-and-power-rails" },
    ],
  },

  // ── 9. grounds-and-power-rails ───────────────────────────────────────────
  {
    slug: "grounds-and-power-rails",
    title: "Grounds and power rails",
    seoTitle: "Grounds and power rails explained",
    seoDescription:
      "Why ground is the shared reference, what a power rail is, and why a ground plane beats a thin trace for a quiet board.",
    clusterOrdinal: 9,
    contentBlocks: [
      { type: "prose", md: "Ground is the shared zero that every voltage on the board is measured against, and the power rails are the fixed voltages that feed the parts. Getting both right is what makes a board quiet and reliable." },
      { type: "heading", text: "Ground is the reference" },
      { type: "prose", md: "Voltage is always measured between two points, so a board agrees on one point as zero, called ground. A `3.3 V` rail means 3.3 volts above ground. Every current that flows out to a part also flows back through ground, so ground carries all the return current." },
      { type: "heading", text: "Power rails" },
      { type: "prose", md: "A rail is a net held at a fixed voltage that feeds many parts at once, such as `5 V` from USB or `3.3 V` from the regulator. Parts tap the rail they need, and decoupling capacitors keep each rail steady where it is used." },
      { type: "heading", text: "Why a plane beats a thin trace" },
      { type: "prose", md: "Return current follows the path of lowest impedance, not the shortest line. A wide ground plane gives that current a low-inductance path right under the signal it returns, which a thin ground trace cannot, so a plane keeps noise and interference down (All About Circuits)." },
      { type: "sourceRef", label: "All About Circuits. How to use return paths for better PCB design (ground plane impedance).", href: "https://www.allaboutcircuits.com/technical-articles/better-pcb-design-return-paths-impedance/" },
      { type: "image", src: "/guide-diagrams/fund-grounds-rails.svg", alt: "A power rail feeding parts and their return current flowing back through a ground plane under the signal traces.", caption: "Rails feed the parts; return current flows back through the ground plane." },
      { type: "prose", md: "On a One Thousand Drones L1.01 board the ground is a filled copper plane and the rails are wide, so return current has a quiet, low-impedance path back to the source." },
      { type: "quiz", questions: [
        { q: "What is ground on a board?", options: ["The most negative battery terminal only", "A part that stores charge", "The shared zero every voltage is measured against"], answer: 2, explain: "Ground is the agreed reference; a 3.3 V rail is 3.3 V above it, and return current flows through it." },
        { q: "A power rail is what?", options: ["A net held at a fixed voltage that feeds many parts", "A single wire to one part", "The edge of the board"], answer: 0, explain: "A rail is a fixed-voltage net (5 V, 3.3 V) that many parts tap." },
        { q: "Why does a ground plane beat a thin ground trace?", options: ["It uses less copper", "It gives return current a low-impedance path and keeps noise down", "It makes the board lighter"], answer: 1, explain: "The wide plane offers a low-inductance return right under the signal, cutting noise." },
      ] },
      { type: "sourceRef", label: "Prerequisite: voltage, current, and resistance", href: "/library/voltage-current-resistance" },
      { type: "sourceRef", label: "See it on a real board: the L1.01 build", href: "/courses/l1-01-wroom-breakout" },
      { type: "sourceRef", label: "Next: reading a schematic", href: "/library/reading-a-schematic" },
    ],
  },

  // ── 10. reading-a-schematic ──────────────────────────────────────────────
  {
    slug: "reading-a-schematic",
    title: "Reading a schematic",
    seoTitle: "How to read a schematic: symbols, nets, and reference designators",
    seoDescription:
      "A schematic is the circuit as a diagram. How to read its symbols, reference designators, and nets, so any board's design opens up.",
    clusterOrdinal: 10,
    contentBlocks: [
      { type: "prose", md: "A schematic is the circuit drawn as a diagram: symbols for the parts, lines for the connections, and labels that name them. Read it in that order and any board's design opens up." },
      { type: "heading", text: "Symbols" },
      { type: "prose", md: "Each part is drawn as a standard symbol: a zigzag or rectangle for a resistor, two lines for a capacitor, a triangle-and-bar for a diode, a box for an integrated circuit. The symbol shows the pins and how they connect, not what the part physically looks like." },
      { type: "heading", text: "Reference designators" },
      { type: "prose", md: "Each symbol carries a unique reference designator, `R1`, `C3`, `U2`, that ties the symbol to one real part on the board and one line on the bill of materials. Assigning them is called annotation (KiCad). Find `U2` on the schematic and you know exactly which part and which footprint it is." },
      { type: "heading", text: "Nets" },
      { type: "prose", md: "A wire, or a shared label, is a net: one electrical node. Every pin on the same net is connected. Power and ground are usually drawn as named labels rather than wires, so the sheet stays readable, and two pins with the same power label are joined even without a line between them." },
      { type: "sourceRef", label: "KiCad. Schematic Editor documentation (symbols, annotation and reference designators, nets).", href: "https://docs.kicad.org/9.0/en/eeschema/eeschema.html" },
      { type: "image", src: "/guide-diagrams/fund-schematic-anatomy.svg", alt: "A small annotated schematic pointing out a symbol, a reference designator, a net label, and a wire.", caption: "Symbols, reference designators, and nets: the three things to read on any schematic." },
      { type: "prose", md: "Open the schematic for a One Thousand Drones L1.01 board and the same three things are there: symbols for each part, reference designators tying them to the BOM, and named nets for power, ground, and the USB signals." },
      { type: "quiz", questions: [
        { q: "A reference designator like `U2` does what?", options: ["Ties one symbol to one real part and its BOM line", "Sets the part's voltage", "Names the net it connects to"], answer: 0, explain: "Reference designators (R1, C3, U2) uniquely identify each part; assigning them is annotation." },
        { q: "A net on a schematic is what?", options: ["The outline of the board", "One electrical node that connects every pin on it", "A single part's package"], answer: 1, explain: "A net is one node; wires and shared labels put pins on the same net." },
        { q: "How are power and ground usually drawn?", options: ["As long wires across the sheet", "They are left off the schematic", "As named labels, so the same label means the same net"], answer: 2, explain: "Power and ground are drawn as labels to keep the sheet readable; the same label is the same net." },
      ] },
      { type: "sourceRef", label: "Prerequisite: resistors", href: "/library/resistors" },
      { type: "sourceRef", label: "See it on a real board: the L1.01 build", href: "/courses/l1-01-wroom-breakout" },
      { type: "sourceRef", label: "Next: reading a datasheet", href: "/library/reading-a-datasheet" },
    ],
  },

  // ── 11. reading-a-datasheet ──────────────────────────────────────────────
  {
    slug: "reading-a-datasheet",
    title: "Reading a datasheet",
    seoTitle: "How to read a datasheet: absolute max, typical, pinout, package",
    seoDescription:
      "A datasheet is the manufacturer's contract for a part. The four sections to read, worked from a real 3.3 V regulator.",
    clusterOrdinal: 11,
    contentBlocks: [
      { type: "prose", md: "A datasheet is the manufacturer's contract for a part: what it does, its limits, its pinout, and its package. Learn to read four sections and you can pick and use almost any part with confidence." },
      { type: "heading", text: "Absolute maximum vs typical" },
      { type: "prose", md: "The absolute maximum ratings are the do-not-exceed limits; past them the part may be damaged, even if only briefly. The typical or recommended operating conditions are where it actually works as specified. Design to the recommended conditions and treat the absolute maximums as a fence you never lean on." },
      { type: "heading", text: "Pinout and package" },
      { type: "prose", md: "The pinout maps each numbered pin to a function, so you know which pin is input, output, ground, or enable. The package, such as `SOT-23-5` or a `QFN`, tells you the physical footprint, the size, and how you will solder it. Both have to match your board." },
      { type: "heading", text: "A real example" },
      { type: "prose", md: "The AP2112K on a One Thousand Drones L1.01 board is a `3.3 V` low-dropout regulator rated for 600 mA with a 250 mV dropout at that current (Diodes AP2112 datasheet). Its datasheet gives the `SOT-23-5` pinout, the recommended input range, and the absolute-maximum input voltage you must stay under. Read those and you can drop it into a design safely." },
      { type: "sourceRef", label: "Diodes Incorporated. AP2112 600mA CMOS LDO Regulator datasheet (DS39724): ratings, pinout, package.", href: "https://www.diodes.com/assets/Datasheets/AP2112.pdf" },
      { type: "image", src: "/guide-diagrams/fund-datasheet-anatomy.svg", alt: "A datasheet page with its four key sections called out: absolute maximum ratings, typical operating conditions, pinout, and package drawing.", caption: "Four sections to read on any datasheet: absolute max, typical, pinout, and package." },
      { type: "quiz", questions: [
        { q: "The absolute maximum ratings on a datasheet are what?", options: ["The values the part runs at normally", "The manufacturer's suggested price", "The do-not-exceed limits past which it may be damaged"], answer: 2, explain: "Absolute max is a fence, not an operating point; design to the recommended conditions." },
        { q: "The package (like `SOT-23-5`) tells you what?", options: ["The physical footprint and how to solder it", "The part's output voltage", "The absolute maximum current"], answer: 0, explain: "The package is the physical form and footprint; it must match your board." },
        { q: "Where should you set your design's operating point?", options: ["At the absolute maximum ratings", "Within the recommended operating conditions", "Above the absolute maximum, briefly"], answer: 1, explain: "Design to the recommended conditions and never lean on the absolute maximums." },
      ] },
      { type: "sourceRef", label: "Prerequisite: reading a schematic", href: "/library/reading-a-schematic" },
      { type: "sourceRef", label: "See it on a real board: the L1.01 build", href: "/courses/l1-01-wroom-breakout" },
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
