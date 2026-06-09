// KiCad `.kicad_sch` generation — placed-parts (UNWIRED) export
// (export-engine Task 7, design §5).
//
// PURE (no React/DB/env/network/fs). Builds a valid KiCad 10 schematic that:
//   1. registers every part's symbol in `lib_symbols`,
//   2. places one symbol instance per part at its grid placement.
//
// The export is deliberately UNWIRED: no nets, no power ports, no connections —
// wiring the canvas (power rails included) is the student's lesson. Each instance
// carries Reference/Value/Footprint/Datasheet/Description fields + an (instances)
// block so KiCad annotates and opens it correctly.
//
// DETERMINISM. No `crypto.randomUUID()` / `Math.random()` (golden tests must be
// reproducible). UUIDs are derived from a stable seed string (projectName + a
// per-element key) via a small FNV-1a hash expanded into a v5-shaped UUID. Same
// input → byte-identical output.
// ─────────────────────────────────────────────────────────────────────────────

import {
  parseSexpr,
  serializeSexpr,
  sym,
  str,
  list,
  isList,
  head,
  findChild,
  type SNode,
  type SList,
} from "@/lib/kicad/sexpr";
import { renameSymbol, setFootprintOnSymbolNode } from "@/lib/kicad/symbol-lib";
import type { Placement } from "@/lib/kicad/placement";

// KiCad 10 schematic format version, taken from a KiCad 10.0 RELEASE-saved
// .kicad_sch. NOT the doxygen/master value (20260512) — master is ahead of the
// release and KiCad rejected it as "created with a more recent version".
const SCH_VERSION = "20260306";
const GENERATOR = "otd-academy";
// generator_version stamp KiCad 8+ writes; "10.0" marks the file as KiCad 10.
const GENERATOR_VERSION = "10.0";

export type SchematicPart = {
  /** Single physical designator, e.g. "U2". */
  refDes: string;
  /** The part's `.kicad_sym` body (bare symbol or kicad_symbol_lib wrapper).
   *  OPTIONAL: a *referenced* part (symbol resolved from a KiCad standard library
   *  via its `libId`) carries NO symbolText — we emit only its instance and never
   *  embed a `lib_symbols` definition (KiCad resolves the def from the global lib). */
  symbolText?: string;
  /** KiCad library id used on the instance + (for embedded parts) the
   *  `lib_symbols` def. For an uploaded/stub part this is `<nick>:<symbolName>`;
   *  for a referenced part it is the standard-library symbol lib-id (e.g.
   *  `"Device:R"`). */
  libId: string;
  /** Footprint library reference emitted in the instance's Footprint property.
   *  Resolved INDEPENDENTLY of the symbol: it may be a project `<nick>:<fpName>`
   *  (uploaded/stub footprint) OR a KiCad standard footprint lib-id (e.g.
   *  `"Resistor_SMD:R_0805_2012Metric"`), regardless of how the symbol resolved.
   *  Falls back to `libId` when omitted (legacy behaviour). */
  footprintRef?: string;
  /** Visible Value field. Defaults to the bare name after the last ":" of `libId`. */
  value?: string;
  /** Datasheet URL (`Part.datasheetUrl`). KiCad-mandatory Datasheet field — the
   *  instance always emits it (empty string when absent). */
  datasheet?: string;
  /** Human-readable part description (`Part.description`). Emitted as the
   *  instance's Description field. */
  description?: string;
};

export type BuildSchematicInput = {
  projectName: string;
  parts: SchematicPart[];
  placements: Map<string, Placement>;
  /** Title-block revision label (e.g. the revision's `label`). Emitted as
   *  `(rev "<rev>")` when non-empty; omitted otherwise. */
  rev?: string;
  /** Title-block date, formatted "YYYY-MM-DD". Emitted as `(date "<date>")`
   *  when non-empty; omitted otherwise. */
  date?: string;
  /** Title-block company name. Emitted as `(company "<company>")` when non-empty. */
  company?: string;
};

// ── Deterministic UUID ──────────────────────────────────────────────────────

/** FNV-1a 32-bit hash of a string (deterministic, fast, no deps). */
function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    // h *= 16777619, kept in 32-bit unsigned space.
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Eight lowercase hex chars from a 32-bit number. */
function hex8(n: number): string {
  return (n >>> 0).toString(16).padStart(8, "0");
}

/**
 * Derive a STABLE, v5-shaped UUID from a seed. Not a real RFC-4122 hash (we
 * don't need cryptographic uuids — only reproducibility), but it is well-formed:
 * `xxxxxxxx-xxxx-5xxx-yxxx-xxxxxxxxxxxx` with version nibble 5 and a 8/9/a/b
 * variant nibble. Four FNV-1a passes over salted copies of the seed fill it.
 */
function deterministicUuid(seed: string): string {
  const a = fnv1a(seed + "|0");
  const b = fnv1a(seed + "|1");
  const c = fnv1a(seed + "|2");
  const d = fnv1a(seed + "|3");
  const h = hex8(a) + hex8(b) + hex8(c) + hex8(d); // 32 hex chars
  const timeLow = h.slice(0, 8);
  const timeMid = h.slice(8, 12);
  // version 5 in the high nibble of time_hi.
  const timeHi = "5" + h.slice(13, 16);
  // variant: top two bits 10 → first nibble ∈ {8,9,a,b}.
  const variantNibble = "89ab"[parseInt(h[16]!, 16) & 0x3];
  const clockSeq = variantNibble + h.slice(17, 20);
  const node = h.slice(20, 32);
  return `${timeLow}-${timeMid}-${timeHi}-${clockSeq}-${node}`;
}

function uuidNode(seed: string): SNode {
  return list([sym("uuid"), str(deterministicUuid(seed))]);
}

// ── lib_symbols assembly ────────────────────────────────────────────────────

/**
 * Re-key a part's `(symbol ...)` definition so its name == the instance `lib_id`
 * (KiCad requires the `lib_symbols` entry's name to match the instance lib_id).
 * Unwraps a `kicad_symbol_lib` wrapper. Returns a fresh node (the input text is
 * re-parsed, so callers can't mutate shared state).
 */
function symbolDefForPart(part: SchematicPart): SList {
  if (part.symbolText === undefined) {
    // A referenced part has no project symbol body — it must never reach here
    // (buildSchematic skips referenced parts when assembling lib_symbols).
    throw new Error(
      `symbolDefForPart(${part.refDes}): referenced part has no symbolText to embed`,
    );
  }
  const node = parseSexpr(part.symbolText);
  if (!isList(node)) {
    throw new Error(`symbolDefForPart(${part.refDes}): not an S-expression`);
  }
  let symbolNode: SList | undefined;
  if (head(node) === "symbol") {
    symbolNode = node;
  } else if (head(node) === "kicad_symbol_lib") {
    const inner = findChild(node, "symbol");
    if (inner) symbolNode = inner;
  }
  if (!symbolNode) {
    throw new Error(
      `symbolDefForPart(${part.refDes}): no (symbol ...) in symbolText`,
    );
  }
  // Re-name the symbol to the lib_id AND its nested unit sub-symbols so the unit
  // prefix matches the parent's unqualified name (KiCad rejects a mismatch, e.g.
  // parent "<slug>:USB4110-GF-A" with a unit "STUB-USB4110-GF-A_0_1").
  renameSymbol(symbolNode, part.libId);
  // The export names each part's footprint identically to its symbol lib_id
  // (`<slug>:<mpn>`), so the embedded lib_symbols definition must carry
  // `(property "Footprint" "<part.libId>" ...)` — this is what the symbol
  // chooser shows and what "Update PCB from Schematic" reads. setFootprint…
  // replaces an existing Footprint property's value in place (no double-set) or
  // synthesizes a hidden one if absent.
  setFootprintOnSymbolNode(symbolNode, part.libId);
  return symbolNode;
}

// ── Number formatting (match KiCad's coordinate style) ──────────────────────

function num(n: number): SNode {
  const s = Number.isInteger(n) ? String(n) : String(Number(n.toFixed(6)));
  // normalise "-0"
  return sym(s === "-0" ? "0" : s);
}

// ── Component instance ──────────────────────────────────────────────────────

function buildComponentInstance(
  part: SchematicPart,
  placement: Placement,
  projectName: string,
): SNode {
  const seed = `${projectName}|inst|${part.refDes}`;
  // The visible Value defaults to the bare name after the last ":" of the symbol
  // lib_id (whole libId if no colon) unless an explicit value is supplied.
  const colon = part.libId.lastIndexOf(":");
  const bare = colon >= 0 ? part.libId.slice(colon + 1) : part.libId;
  const value = part.value ?? bare;
  // The Footprint property carries the footprint library reference, resolved
  // INDEPENDENTLY of the symbol (uploaded/stub project footprint OR a KiCad
  // standard footprint lib-id). Falls back to the symbol lib_id when absent.
  const footprintRef = part.footprintRef ?? part.libId;
  return list([
    sym("symbol"),
    list([sym("lib_id"), str(part.libId)]),
    list([
      sym("at"),
      num(placement.x),
      num(placement.y),
      num(placement.rotation),
    ]),
    list([sym("unit"), sym("1")]),
    list([sym("in_bom"), sym("yes")]),
    list([sym("on_board"), sym("yes")]),
    uuidNode(seed),
    // Reference property = the refDes (this is what KiCad annotates on).
    list([
      sym("property"),
      str("Reference"),
      str(part.refDes),
      list([sym("at"), num(placement.x), num(placement.y - 5.08), sym("0")]),
      list([sym("effects"), list([sym("font"), list([sym("size"), sym("1.27"), sym("1.27")])])]),
    ]),
    // Value = the bare part name (visible) — so the part is identifiable.
    list([
      sym("property"),
      str("Value"),
      str(value),
      list([sym("at"), num(placement.x), num(placement.y - 2.54), sym("0")]),
      list([sym("effects"), list([sym("font"), list([sym("size"), sym("1.27"), sym("1.27")])])]),
    ]),
    // Footprint = the resolved footprint lib reference (hidden, KiCad
    // convention) — carries the symbol↔footprint association to the instance so
    // "Update PCB from Schematic" can assign footprints. Resolved independently
    // of the symbol (project `<nick>:<fp>` OR a standard footprint lib-id).
    list([
      sym("property"),
      str("Footprint"),
      str(footprintRef),
      list([sym("at"), num(placement.x), num(placement.y), sym("0")]),
      list([
        sym("effects"),
        list([sym("font"), list([sym("size"), sym("1.27"), sym("1.27")])]),
        sym("hide"),
      ]),
    ]),
    // Datasheet (hidden) — KiCad-MANDATORY field. The uploaded symbols don't
    // carry it, so we populate it from `Part.datasheetUrl`. Always emitted (empty
    // string when absent) so KiCad's Symbol Properties dialog always has the field.
    list([
      sym("property"),
      str("Datasheet"),
      str(part.datasheet ?? ""),
      list([sym("at"), num(placement.x), num(placement.y), sym("0")]),
      list([
        sym("effects"),
        list([sym("font"), list([sym("size"), sym("1.27"), sym("1.27")])]),
        sym("hide"),
      ]),
    ]),
    // Description (hidden) — populated from `Part.description`. Emitted always for
    // consistency (empty string when absent).
    list([
      sym("property"),
      str("Description"),
      str(part.description ?? ""),
      list([sym("at"), num(placement.x), num(placement.y), sym("0")]),
      list([
        sym("effects"),
        list([sym("font"), list([sym("size"), sym("1.27"), sym("1.27")])]),
        sym("hide"),
      ]),
    ]),
    // NOTE (KiCad-10 fidelity): KiCad 7+/10 require a per-symbol (instances ...)
    // block — without it the schematic won't annotate/open correctly. The
    // root-sheet path is "/". This shape is anchored to documented KiCad
    // structure and CANNOT be validated against a real KiCad here; the
    // (instances)/(sheet_instances) path format MUST be confirmed against a real
    // KiCad-10-saved schematic at manual acceptance.
    list([
      sym("instances"),
      list([
        sym("project"),
        str(projectName),
        list([
          sym("path"),
          str("/"),
          list([sym("reference"), str(part.refDes)]),
          list([sym("unit"), sym("1")]),
        ]),
      ]),
    ]),
  ]);
}

// ── Title block ─────────────────────────────────────────────────────────────

/**
 * `(title_block (title <project>) [(date <date>)] [(rev <rev>)])`. The `date`
 * and `rev` sub-nodes are emitted ONLY when their value is a non-empty string,
 * so an absent value yields no `(date "")` / `(rev "")` node at all. KiCad's own
 * order is title, then date, then rev.
 */
function buildTitleBlock(input: BuildSchematicInput): SNode {
  const items: SNode[] = [
    sym("title_block"),
    list([sym("title"), str(input.projectName)]),
  ];
  if (input.date) items.push(list([sym("date"), str(input.date)]));
  if (input.rev) items.push(list([sym("rev"), str(input.rev)]));
  if (input.company) items.push(list([sym("company"), str(input.company)]));
  return list(items);
}

// ── Top-level builder ───────────────────────────────────────────────────────

/**
 * Build a complete `.kicad_sch` for a revision: header + lib_symbols (component
 * symbols) + one symbol instance per part at its placement. The export is
 * UNWIRED (no nets / power ports) — wiring is the student's lesson. Deterministic.
 */
export function buildSchematic(input: BuildSchematicInput): string {
  // lib_symbols: component definitions (in part order). A REFERENCED part (no
  // symbolText) is skipped — its symbol lives in the user's KiCad standard
  // library and is resolved from `lib_id`, so embedding a def would be wrong.
  const libSymbolItems: SNode[] = [sym("lib_symbols")];
  for (const part of input.parts) {
    if (part.symbolText === undefined) continue;
    libSymbolItems.push(symbolDefForPart(part));
  }

  // Component instances (one per part, placement order = sorted by placement map
  // which is already deterministic from Task 5's gridPlacement).
  const componentInstances: SNode[] = [];
  for (const part of input.parts) {
    const placement = input.placements.get(part.refDes);
    if (!placement) continue; // a part with no placement can't be drawn.
    componentInstances.push(
      buildComponentInstance(part, placement, input.projectName),
    );
  }

  const top = list([
    sym("kicad_sch"),
    list([sym("version"), sym(SCH_VERSION)]),
    list([sym("generator"), str(GENERATOR)]),
    list([sym("generator_version"), str(GENERATOR_VERSION)]),
    uuidNode(`${input.projectName}|sheet`),
    list([sym("paper"), str("A4")]),
    // Title block (KiCad position: after paper, before lib_symbols). Title is
    // the project name; date + rev are optional sub-nodes — emitted only when a
    // non-empty value is supplied (no empty `(date "")`/`(rev "")` nodes).
    buildTitleBlock(input),
    list(libSymbolItems),
    ...componentInstances,
    // NOTE (KiCad-10 fidelity): KiCad 7+/10 require a root (sheet_instances ...)
    // node alongside the per-symbol (instances ...) blocks for the schematic to
    // annotate/open correctly. The single root sheet has path "/" and page "1".
    // This shape is documented-KiCad-anchored and CANNOT be validated here; the
    // path/page format MUST be confirmed against a real KiCad-10-saved schematic
    // at manual acceptance.
    list([
      sym("sheet_instances"),
      list([sym("path"), str("/"), list([sym("page"), str("1")])]),
    ]),
  ]);

  return serializeSexpr(top) + "\n";
}
