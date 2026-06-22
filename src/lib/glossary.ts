// Glossary data — pure `term → definition` map (design §6).
//
// A single source of truth for inline jargon definitions surfaced by the
// `GlossaryTerm` popover (and the `termRef` content block wired in M8). Pure
// data + a normalized lookup — NO React, NO DB, NO Prisma. Importable from
// both server and client components and unit-testable in isolation.
//
// Seed sources:
//   (a) the canonical stage / gate vocabulary from `src/lib/stages.ts`
//       (stage names, "exit gate", "stage gate", board statuses) so the
//       learner-facing copy and the gate machinery share one vocabulary.
//   (b) domain jargon the curriculum assumes (WL-CSP, drag-tin, SAC305,
//       ADC1/ADC2, RLD/right-leg-drive, tombstoning, ESP-NOW, stripboard,
//       ENIG, …).
//
// Lookup is case-insensitive and whitespace-trimmed; a small alias table maps
// long-forms / spelling variants onto a canonical key so e.g.
// `lookupTerm("right-leg-drive")` resolves to the same entry as `RLD`.

export interface GlossaryEntry {
  /** Canonical display form of the term (header in the popover). */
  term: string;
  /** Plain-text definition. Brief — one or two sentences. */
  def: string;
}

/** Normalize a term to its lookup key: trimmed + lower-cased. */
function normalize(term: string): string {
  return term.trim().toLowerCase();
}

// ─── Canonical entries ─────────────────────────────────
//
// Keyed by the normalized canonical term. `lookupTerm` normalizes its input
// before indexing, so keys here are written lower-cased.

export const GLOSSARY: Record<string, GlossaryEntry> = {
  // ── Domain jargon ──────────────────────────────────
  "wl-csp": {
    term: "WL-CSP",
    def: "Wafer-Level Chip-Scale Package — a bare-die package whose solder balls sit directly on the silicon, with no surrounding plastic body. Tiny pitch and light-sensitive; demands stencil paste, hot-air/reflow, and careful handling.",
  },
  "drag-tin": {
    term: "drag-tin",
    def: "A hand-soldering technique for fine-pitch leads: flood the row with flux, load the iron tip with solder, then drag along the pad row so surface tension wicks the right amount onto each lead while flux clears bridges.",
  },
  sac305: {
    term: "SAC305",
    def: "A lead-free solder alloy — 96.5% tin, 3.0% silver, 0.5% copper (Sn-Ag-Cu). Higher melting point (~217 °C) and a more matte joint than leaded solder; the default for RoHS-compliant assembly.",
  },
  adc1: {
    term: "ADC1",
    def: "The ESP32's first analog-to-digital converter unit. ADC1 stays usable while WiFi / ESP-NOW is active, so all sampled analog inputs should be routed to ADC1 pins.",
  },
  adc2: {
    term: "ADC2",
    def: "The ESP32's second analog-to-digital converter unit. ADC2 pins are unusable while the radio (WiFi / ESP-NOW) is active — avoid routing sampled inputs here on connected designs.",
  },
  rld: {
    term: "RLD",
    def: "Right-Leg Drive — an active feedback loop in biopotential (ECG/EEG) front-ends that injects an inverted common-mode signal back into the body to cancel 50/60 Hz mains interference and improve common-mode rejection.",
  },
  tombstoning: {
    term: "tombstoning",
    def: "A reflow defect where one end of a small two-terminal part (0402/0201 etc.) wets and lifts before the other, standing the part on end like a tombstone. Caused by uneven pad heating, asymmetric paste, or thermal imbalance.",
  },
  "esp-now": {
    term: "ESP-NOW",
    def: "Espressif's connectionless peer-to-peer 2.4 GHz protocol for ESP32/ESP8266. Low-latency, no AP/router needed; uses MAC-addressed peers and a fixed channel plan. Shares the radio with WiFi (disables ADC2).",
  },
  stripboard: {
    term: "stripboard",
    def: "A prototyping board of parallel copper strips on a perfboard grid (a.k.a. Veroboard). Used to de-risk a circuit by hand before committing to a fabricated PCB; cuts in the strips break unwanted connections.",
  },
  enig: {
    term: "ENIG",
    def: "Electroless Nickel / Immersion Gold — a PCB surface finish: a nickel barrier under a thin gold flash. Flat, solderable, long shelf life, and good for fine-pitch and press-fit; pricier than HASL.",
  },

  // ── Basic electronics (beginner) ─────────────────────
  refdes: {
    term: "refdes",
    def: "Reference designator — the unique label a schematic gives each part (R3, C7, U1) so the symbol on the diagram, the line on the BOM, and the pad on the board all point to the same physical component. The letters hint at the type: R=resistor, C=capacitor, U=IC, D=diode, J=connector, SW=switch, LED=LED, F=fuse, TP=test point.",
  },
  mpn: {
    term: "MPN",
    def: "Manufacturer Part Number — the exact catalog number that identifies one specific component from one manufacturer. It's what you actually order, and what pins a BOM line to a real, buyable part rather than a generic value.",
  },
  ldo: {
    term: "LDO",
    def: "Low-Dropout regulator — produces a steady lower voltage (here 3.3 V) from a higher input (5 V) and keeps regulating even when the input is only a little above the output. A regulator actively holds its output against a changing load, unlike a voltage divider, which sags.",
  },
  dropout: {
    term: "dropout voltage",
    def: "The minimum amount an LDO's input must stay above its output to keep regulating. Below that headroom the output just follows the input down. The RT9080's is about 0.53 V at 600 mA.",
  },
  decoupling: {
    term: "decoupling capacitor",
    def: "A small capacitor (a 'bypass' cap) placed right at a chip's power pin. It holds a tiny charge reserve and dumps it instantly when the chip's fast switching demands a current burst, so the local supply voltage doesn't dip. Proximity to the pin matters more than raw capacitance.",
  },
  "bulk capacitor": {
    term: "bulk capacitor",
    def: "A larger capacitor (here 10 µF) acting as a reservoir for a whole power rail, smoothing the slower, bigger current swings that the small decoupling caps at each pin don't cover. Bulk + bypass work together.",
  },
  "pull-up": {
    term: "pull-up resistor",
    def: "A resistor that gently ties a signal line to the positive supply so an otherwise-floating input reads a definite logic HIGH. A button or driver can still force it LOW — the resistor only sets the resting level. Made 'weak' (high value, e.g. 10 kΩ) so it wastes little current.",
  },
  "pull-down": {
    term: "pull-down resistor",
    def: "A resistor that ties a signal line to ground so a floating input reads a definite logic LOW — the mirror image of a pull-up. USB-C sink resistors (Rd) are pull-downs on the CC pins.",
  },
  rd: {
    term: "Rd",
    def: "The 5.1 kΩ resistor a USB-C device puts from each CC pin to ground to advertise itself as a power sink (a consumer). The source detects this exact resistance before it switches VBUS on.",
  },
  cc: {
    term: "CC pin",
    def: "Configuration Channel — the USB-C pins (CC1/CC2) used to detect cable orientation and negotiate power roles. A sink ties each to ground through a 5.1 kΩ Rd resistor; because Type-C is reversible, both need their own.",
  },
  vbus: {
    term: "VBUS",
    def: "The +5 V power line of a USB connection. A USB-C source keeps VBUS off until it detects a valid sink (an Rd resistor on a CC pin).",
  },
  "forward voltage": {
    term: "forward voltage (Vf)",
    def: "The roughly-fixed voltage an LED or diode drops once it's conducting — about 1.8 V for a red LED, ~2.0 V for yellow. Supply voltage minus Vf is what's left across the series resistor to set the current.",
  },
  "current-limiting resistor": {
    term: "current-limiting resistor",
    def: "A resistor in series with an LED (or similar) that sets its current. An LED barely limits its own current, so the resistor does it: I = (Vsupply − Vf) / R.",
  },
  "e-series": {
    term: "E-series values",
    def: "The standard preferred values components come in — E24 (the common 5%/1% set) steps 10, 11, 12, 13, 15, … 47, 51, 56, …, spaced so each is ~10% above the last. It's why you see 5.1 kΩ and 4.7 kΩ rather than a round 5.0 kΩ: the catalog values are fixed, so designs snap to them.",
  },
  ptc: {
    term: "PTC / polyfuse",
    def: "A resettable fuse (Positive Temperature Coefficient). On overcurrent it heats up, its resistance shoots up, and it throttles the current to a trickle — then it returns to normal once it cools. Protects without needing replacement, unlike a one-shot glass fuse.",
  },
  esd: {
    term: "ESD",
    def: "Electrostatic Discharge — a sudden zap (thousands of volts off a fingertip) that can punch through a chip's inputs. Exposed ports use ESD-protection (TVS) diodes to shunt the spike to ground.",
  },
  tvs: {
    term: "TVS diode",
    def: "Transient-Voltage-Suppression diode — clamps brief voltage spikes (like ESD) to a safe level by conducting hard above a threshold, protecting downstream pins. USB versions are low-capacitance so they don't smear the high-speed data.",
  },
  "strapping pin": {
    term: "strapping pin",
    def: "A pin the ESP32 samples once at reset to choose its boot mode (boot from flash vs. USB download). It must sit at a defined level at that instant — set by a pull-up or pull-down resistor — or boot is unreliable.",
  },
  gpio: {
    term: "GPIO",
    def: "General-Purpose Input/Output — a microcontroller pin your firmware can read or drive, used for buttons, LEDs, sensors, and buses. Some pins double as strapping pins at reset.",
  },
  mlcc: {
    term: "MLCC",
    def: "Multi-Layer Ceramic Capacitor — the small, cheap, stable surface-mount capacitors used for decoupling and filtering. Dielectric codes like X7R / X5R describe how stable they stay over temperature.",
  },
  sink: {
    term: "sink",
    def: "In USB-C, a sink is a device that draws power from the bus (your board), versus a source that supplies it. A sink advertises itself with 5.1 kΩ Rd resistors on its CC pins.",
  },
  microcontroller: {
    term: "microcontroller",
    def: "A small computer on a single chip — CPU, memory, and I/O together. The ESP32-S3 is one, with Wi-Fi and Bluetooth radios built in; your firmware runs on it directly.",
  },
  "antenna keep-out": {
    term: "antenna keep-out",
    def: "A region of the PCB — under and around a module's PCB antenna — kept clear of all copper, ground pour, and traces (often a board cut-out). Copper there detunes the antenna and wrecks wireless range, so it's a hard layout rule.",
  },
  brownout: {
    term: "brownout",
    def: "A dip in supply voltage below what a chip needs, usually when a big load (a motor/servo or a radio burst) pulls current faster than the rail can hold. It causes resets or glitches; bulk capacitance or a separate supply rail mitigates it.",
  },

  // ── PCB layout / fabrication / assembly ──────────────
  "design rule check": {
    term: "DRC (design-rule check)",
    def: "An automated check your PCB tool runs against the fab's limits — minimum trace width, copper clearance, drill sizes, unconnected or shorted nets. You clear it (or document every intentional exception) before exporting fabrication files.",
  },
  gerber: {
    term: "Gerber",
    def: "The standard fabrication file set that tells the board house exactly what to make — one file per copper / solder-mask / silkscreen layer, plus a drill file. Export them after DRC passes, then open them in a viewer to catch export mistakes.",
  },
  hasl: {
    term: "HASL",
    def: "Hot-Air Solder Leveling — a cheap, slightly lumpy tin PCB finish. Fine for through-hole and larger SMD; ENIG is flatter and better for fine-pitch parts like a module's pads.",
  },
  "solder mask": {
    term: "solder mask",
    def: "The thin lacquer coating (usually green) over the copper, with openings only where pads need to be soldered. It stops solder bridging between adjacent pads and protects the traces — molten solder beads up on the mask and refuses to stick to it.",
  },
  "differential pair": {
    term: "differential pair",
    def: "Two traces carrying equal-and-opposite signals (like USB D+ / D−) routed together and matched in length and spacing. The receiver reads the difference, which cancels noise picked up equally by both lines.",
  },
  reflow: {
    term: "reflow",
    def: "Soldering by melting pre-applied solder paste all at once — a stencil lays paste on the pads, parts are placed, then the whole board is heated past the solder's melting point. The alternative to hand/iron soldering.",
  },
  continuity: {
    term: "continuity",
    def: "A multimeter check for a complete, near-zero-ohm connection between two points — used to confirm a joint conducts, and (between power and ground) to catch a short before applying power.",
  },
  "ground pour": {
    term: "ground pour",
    def: "A large filled copper area tied to ground, poured around the traces on a layer for a low-impedance return path and shielding — but kept OUT of an antenna keep-out, where copper would detune the radio.",
  },
  moq: {
    term: "MOQ",
    def: "Minimum Order Quantity — the smallest amount a distributor will sell of a part. Cheap passives often come on reels of thousands; plan a few extras of any part you hand-place and might lose or cook.",
  },

  // ── Schematic capture (KiCad) ────────────────────────
  erc: {
    term: "ERC (Electrical Rules Check)",
    def: "KiCad's schematic checker (Inspect → Electrical Rules Checker). It flags unconnected pins, power rails nothing drives, and conflicting outputs. Run it until it's clean — or until every remaining flag is an intentional exception you've marked and understood. It's the schematic-stage cousin of the PCB's DRC.",
  },
  "pwr-flag": {
    term: "PWR_FLAG",
    def: "A special one-pin 'power-output' symbol you drop on a net to tell ERC the rail really is driven. Needed where power enters externally (a USB-C connector) or passes through a part that strips its power designation (a fuse, a regulator output) — it legitimately silences the 'input power pin not driven' error.",
  },
  "net label": {
    term: "net label",
    def: "A name you attach to a wire so that every wire sharing that name is the same connection — without drawing a line clear across the sheet. The main tool for keeping a schematic readable (KiCad hotkey: L).",
  },
  "power port": {
    term: "power port",
    def: "A power symbol (3V3, GND, VBUS) that names a power net; every matching port on the sheet is the same net. By convention supply ports point up and ground ports point down (KiCad hotkey: P).",
  },
  "no-connect": {
    term: "no-connect flag",
    def: "A small X you place on a pin you deliberately leave unconnected, so ERC stops warning about it and records that the open pin is intentional (KiCad hotkey: Q).",
  },

  // ── Stage / gate vocabulary (mirrors src/lib/stages.ts) ──
  "exit gate": {
    term: "exit gate",
    def: "The per-stage predicate that must pass before a revision can advance to the next stage. Evaluated as a pure function of the gate context (artifacts, checklists, BOM, active build) — see the stage tracker.",
  },
  "stage gate": {
    term: "stage gate",
    def: "The uniform footer on a guide card that surfaces the real exit-gate state — '✓ done / N remaining' — backed by the existing checklist, measurement, artifact, commit, or board-status substrate.",
  },
  requirements: {
    term: "REQUIREMENTS",
    def: "Stage 01. Pin down interfaces, power budget, mechanical constraints, target cost, and the discipline the board teaches. Exits when the REQUIREMENTS_REVIEW checklist is complete and a requirements artifact is attached.",
  },
  schematic: {
    term: "SCHEMATIC",
    def: "Stage 02. Capture the circuit in KiCad, attach the schematic file artifact, and pin the schematic git commit on the revision.",
  },
  "bom sourcing": {
    term: "BOM sourcing",
    def: "Stage 03. Pick every part with an MPN, verify stock and lifecycle, and (where required) pass the stripboard-validation checklist before layout freezes the BOM.",
  },
  layout: {
    term: "LAYOUT",
    def: "Stage 04. Place and route the board, pour ground, honor keep-outs (antenna, isolation), and complete the LAYOUT_REVIEW checklist. The BOM is frozen at this stage.",
  },
  "drc / gerber": {
    term: "DRC / GERBER",
    def: "Stage 05. Run design-rule check clean (or with documented exceptions), then export and inspect the Gerber fabrication set; attach the DRC report and Gerber zip.",
  },
  ordering: {
    term: "ORDERING",
    def: "Stage 06. Create the active build, then place the PCB-fab and parts orders and attach both order receipts to that build.",
  },
  assembly: {
    term: "ASSEMBLY",
    def: "Stage 07. Screen each bare board, hand-build it (hot-air first, then iron-solder passives), and pass the build's POST_ASSEMBLY_CONTINUITY checklist.",
  },
  bringup: {
    term: "BRINGUP",
    def: "Stage 08. Power each board up safely — rails first — log readings as measurements, attach the bring-up log, and mark bring-up complete (which freezes the revision on advance to REVISION).",
  },

  // ── Board / build status vocabulary ──────────────────
  quarantined: {
    term: "QUARANTINED",
    def: "A board status meaning the unit is removed from the build (e.g. unrepairable) but still counted as a resolved outcome for the bring-up gate — distinct from FAILED, which blocks advancement.",
  },
  "brought up": {
    term: "BROUGHT_UP",
    def: "A board status meaning the board has been powered and verified through the bring-up procedure. All boards must be BROUGHT_UP or QUARANTINED to clear the BRINGUP gate.",
  },
  "post-assembly continuity": {
    term: "POST_ASSEMBLY_CONTINUITY",
    def: "The build-scoped checklist run after hand-assembly: a continuity sweep, rail-resistance checks, and a no-bridge inspection. Every item must be checked or marked N/A to exit ASSEMBLY.",
  },
};

// ─── Aliases ───────────────────────────────────────────
//
// Maps alternate spellings / long-forms (normalized) onto a canonical
// glossary key (also normalized).

const ALIASES: Record<string, string> = {
  "right-leg-drive": "rld",
  "right leg drive": "rld",
  "wlcsp": "wl-csp",
  espnow: "esp-now",
  "drc": "drc / gerber",
  "drc/gerber": "drc / gerber",
  "drc gerber": "drc / gerber",
  "bom": "bom sourcing",
  // Basic-electronics long-forms / variants → canonical key.
  "reference designator": "refdes",
  "low-dropout regulator": "ldo",
  "low dropout regulator": "ldo",
  "dropout voltage": "dropout",
  "decoupling capacitor": "decoupling",
  "decoupling cap": "decoupling",
  "bypass capacitor": "decoupling",
  "bypass cap": "decoupling",
  "pull-up resistor": "pull-up",
  "pullup": "pull-up",
  "pull-down resistor": "pull-down",
  "pulldown": "pull-down",
  "configuration channel": "cc",
  "cc pin": "cc",
  "cc1": "cc",
  "cc2": "cc",
  vf: "forward voltage",
  "current limiting resistor": "current-limiting resistor",
  polyfuse: "ptc",
  "resettable fuse": "ptc",
  "tvs diode": "tvs",
  "esd diode": "tvs",
  "strapping pins": "strapping pin",
  ufp: "sink",
  // Schematic capture (KiCad) long-forms / variants.
  "electrical rules check": "erc",
  "electrical rules checker": "erc",
  "pwr_flag": "pwr-flag",
  "power flag": "pwr-flag",
  "net labels": "net label",
  "power ports": "power port",
  "no connect": "no-connect",
  "no-connect flag": "no-connect",
};

/**
 * Look up a glossary term. Case-insensitive and whitespace-trimmed; resolves
 * known aliases to their canonical entry. Returns the `{ term, def }` entry or
 * `null` when the term is unknown / blank.
 */
export function lookupTerm(term: string): GlossaryEntry | null {
  const key = normalize(term);
  if (!key) return null;
  const canonical = ALIASES[key] ?? key;
  return GLOSSARY[canonical] ?? null;
}
