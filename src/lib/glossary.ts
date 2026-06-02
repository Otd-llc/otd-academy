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
