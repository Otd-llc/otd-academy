// KiCad `.kicad_sch` generation + power-rail GEOMETRIC wiring
// (export-engine Task 7, design §3.4 / §5 — the crux, highest risk).
//
// PURE (no React/DB/env/network/fs). Builds a valid KiCad 10 schematic that:
//   1. registers every part's symbol in `lib_symbols`,
//   2. places one symbol instance per part at its grid placement,
//   3. for each GROUND/POWER net node (the caller passes only verified nets),
//      drops a POWER-PORT symbol
//      (`power:GND` / `power:+3V3` / `power:+5V` / …) at that pin's absolute
//      connection coordinate — so KiCad treats the pin as wired to the rail.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY POWER PORTS (carrier choice). KiCad connects schematics GEOMETRICALLY: a
// pin joins a net when a net-carrying element sits at the pin's exact connection
// point (design §3.4). Two mechanisms can carry a net to a point: a power-port
// symbol, or a `(global_label)`. We use POWER PORTS because:
//   • they are the conventional, learner-recognisable way to show GND/+3V3/+5V;
//   • a KiCad power-port symbol's own pin sits at the symbol ORIGIN (0,0) — see
//     the port definitions below, each has `(pin ... (at 0 0 …) (length 0))`.
//     Placing the port instance `(at X Y rot)` at the component pin's connection
//     point therefore makes the port's pin geometrically COINCIDE with the
//     component pin. No connecting wire is needed: the two pins share a point,
//     which is exactly KiCad's connectivity rule. (If a port pin were offset
//     from origin we'd add a short `(wire)`; ours aren't, so we don't.)
//
// COORDINATE / PIN conventions are defined+tested in pin-geometry.ts. We wire to
// the transformed pin `(at)` (the connection node), Y-down, mm.
//
// DETERMINISM. No `crypto.randomUUID()` / `Math.random()` (golden tests must be
// reproducible). UUIDs are derived from a stable seed string (projectName + a
// per-element key) via a small FNV-1a hash expanded into a v5-shaped UUID. Same
// input → byte-identical output. Net nodes are wired in a stable order (net
// name, then refDes natural-ish, then pin).
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
import { extractSymbolPins, pinConnectionPoint } from "@/lib/kicad/pin-geometry";
import type { Placement } from "@/lib/kicad/placement";

// KiCad 10 schematic format version. The `.kicad_sch` format has drifted across
// 6→10; 20230121 is the KiCad 7/8-era stamp that KiCad 10 still reads. Verify
// against a real KiCad-10 reference project at manual acceptance and bump here
// if needed (see fidelity risks in the task report).
const SCH_VERSION = "20230121";
const GENERATOR = "project-foundry";

export type NetClass = "GROUND" | "POWER" | "SIGNAL";

export type SchematicPart = {
  /** Single physical designator, e.g. "U2". */
  refDes: string;
  /** The part's `.kicad_sym` body (bare symbol or kicad_symbol_lib wrapper). */
  symbolText: string;
  /** KiCad library id `<nick>:<symbolName>` used on the instance + lib_symbols. */
  libId: string;
};

export type SchematicNet = {
  /** Net name, e.g. "GND", "+3V3", "+5V". */
  name: string;
  netClass: NetClass;
  /** Pins on this net; `pin` matches a symbol pin number OR name. */
  nodes: { refDes: string; pin: string }[];
};

export type BuildSchematicInput = {
  projectName: string;
  parts: SchematicPart[];
  placements: Map<string, Placement>;
  nets: SchematicNet[];
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

// ── Power-port symbol definitions (for lib_symbols) ─────────────────────────

/**
 * Map a (verified, non-signal) net to the KiCad power-port `lib_id` to drop at
 * each of its pins. GROUND → `power:GND`. POWER → a port keyed by the net name
 * (`+3V3`, `+5V`, `+3.3V`, …) so the schematic shows the rail's real name; the
 * port symbol is synthesized on demand. SIGNAL returns undefined (skipped).
 */
function portLibIdForNet(net: SchematicNet): string | undefined {
  if (net.netClass === "GROUND") return "power:GND";
  if (net.netClass === "POWER") return `power:${net.name}`;
  return undefined; // SIGNAL — never carried in v1.
}

/** The short port label shown next to a power port (its Value). */
function portLabel(libId: string): string {
  // "power:GND" → "GND", "power:+3V3" → "+3V3".
  const idx = libId.indexOf(":");
  return idx >= 0 ? libId.slice(idx + 1) : libId;
}

/**
 * A KiCad power-port `(symbol "power:<label>" ...)` lib definition. Crucially the
 * port's single `(pin power_in line (at 0 0 ...) (length 0) ...)` sits at the
 * symbol ORIGIN, so an instance placed `(at X Y rot)` puts the pin exactly at
 * (X, Y) — guaranteeing geometric coincidence with the component pin we target.
 * `power:` symbols carry `(power)` and a hidden Reference "#PWR".
 */
function buildPowerSymbolDef(libId: string): SNode {
  const label = portLabel(libId);
  return list([
    sym("symbol"),
    str(libId),
    list([sym("power")]),
    list([sym("pin_names"), list([sym("offset"), sym("0")])]),
    list([sym("in_bom"), sym("no")]),
    list([sym("on_board"), sym("yes")]),
    // Reference "#PWR" (hidden) — KiCad's power-symbol convention.
    list([
      sym("property"),
      str("Reference"),
      str("#PWR"),
      list([sym("at"), sym("0"), sym("0"), sym("0")]),
      list([
        sym("effects"),
        list([sym("font"), list([sym("size"), sym("1.27"), sym("1.27")])]),
        sym("hide"),
      ]),
    ]),
    // Value = the rail label (visible).
    list([
      sym("property"),
      str("Value"),
      str(label),
      list([sym("at"), sym("0"), sym("0"), sym("0")]),
      list([
        sym("effects"),
        list([sym("font"), list([sym("size"), sym("1.27"), sym("1.27")])]),
      ]),
    ]),
    // The drawable unit: just the connection pin at the origin (length 0 so the
    // pin's connection point == the symbol origin == the instance placement).
    list([
      sym("symbol"),
      str(`${libId}_0_1`),
      list([
        sym("pin"),
        sym("power_in"),
        sym("line"),
        // Angle (90) is irrelevant: the pin is at the origin with length 0, so
        // its connection point is the origin regardless of orientation — the
        // instance placement alone fixes geometric coincidence.
        list([sym("at"), sym("0"), sym("0"), sym("90")]),
        list([sym("length"), sym("0")]),
        list([
          sym("name"),
          str(label),
          list([sym("effects"), list([sym("font"), list([sym("size"), sym("1.27"), sym("1.27")])])]),
        ]),
        list([
          sym("number"),
          str("1"),
          list([sym("effects"), list([sym("font"), list([sym("size"), sym("1.27"), sym("1.27")])])]),
        ]),
      ]),
    ]),
  ]);
}

// ── lib_symbols assembly ────────────────────────────────────────────────────

/**
 * Re-key a part's `(symbol ...)` definition so its name == the instance `lib_id`
 * (KiCad requires the `lib_symbols` entry's name to match the instance lib_id).
 * Unwraps a `kicad_symbol_lib` wrapper. Returns a fresh node (the input text is
 * re-parsed, so callers can't mutate shared state).
 */
function symbolDefForPart(part: SchematicPart): SList {
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
  // Re-name the symbol to the lib_id (items[1] is the name string).
  symbolNode.items[1] = str(part.libId);
  return symbolNode;
}

// ── Geometry: resolve a node to its absolute connection point ───────────────

type ResolvedNode = {
  net: SchematicNet;
  refDes: string;
  pin: string;
  libId: string; // power-port lib_id
  x: number;
  y: number;
};

/**
 * For each verified GROUND/POWER net node, find the part's pin and compute its
 * absolute sheet connection coordinate. SIGNAL nets and nodes whose part/pin
 * can't be resolved are skipped. Output is sorted (net name, refDes, pin) for a
 * deterministic, reproducible emission order.
 */
function resolveNodes(input: BuildSchematicInput): ResolvedNode[] {
  // Pre-parse each part's pins once (keyed by refDes).
  const pinsByRef = new Map<string, ReturnType<typeof extractSymbolPins>>();
  const placementByRef = input.placements;
  for (const part of input.parts) {
    pinsByRef.set(part.refDes, extractSymbolPins(part.symbolText));
  }

  const resolved: ResolvedNode[] = [];
  for (const net of input.nets) {
    const libId = portLibIdForNet(net);
    if (!libId) continue; // SIGNAL or unknown class → no carrier.
    for (const node of net.nodes) {
      const pins = pinsByRef.get(node.refDes);
      const placement = placementByRef.get(node.refDes);
      if (!pins || !placement) continue; // unknown part / no placement.
      const pin = pins.find(
        (p) => p.number === node.pin || p.name === node.pin,
      );
      if (!pin) continue; // unknown pin on this part.
      const pt = pinConnectionPoint(pin, placement);
      resolved.push({
        net,
        refDes: node.refDes,
        pin: node.pin,
        libId,
        x: pt.x,
        y: pt.y,
      });
    }
  }

  resolved.sort((a, b) => {
    if (a.net.name !== b.net.name) return a.net.name < b.net.name ? -1 : 1;
    if (a.refDes !== b.refDes) return a.refDes < b.refDes ? -1 : 1;
    return a.pin < b.pin ? -1 : a.pin > b.pin ? 1 : 0;
  });
  return resolved;
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

// ── Power-port instance ─────────────────────────────────────────────────────

function buildPowerPortInstance(rn: ResolvedNode, projectName: string): SNode {
  // Deterministic per (project, net, refDes, pin) — unique + reproducible.
  const seed = `${projectName}|pwr|${rn.net.name}|${rn.refDes}|${rn.pin}`;
  const refSeed = `${projectName}|pwrref|${rn.net.name}|${rn.refDes}|${rn.pin}`;
  return list([
    sym("symbol"),
    list([sym("lib_id"), str(rn.libId)]),
    // The port instance sits AT the component pin's connection point; the port's
    // own pin is at its origin (length 0), so the two pins coincide → wired.
    list([sym("at"), num(rn.x), num(rn.y), sym("0")]),
    list([sym("unit"), sym("1")]),
    list([sym("in_bom"), sym("no")]),
    list([sym("on_board"), sym("yes")]),
    uuidNode(seed),
    // Hidden #PWR reference, deterministic instance ref via the seed hash so two
    // ports never collide.
    list([
      sym("property"),
      str("Reference"),
      str(`#PWR_${hex8(fnv1a(refSeed)).toUpperCase()}`),
      list([sym("at"), num(rn.x), num(rn.y), sym("0")]),
      list([
        sym("effects"),
        list([sym("font"), list([sym("size"), sym("1.27"), sym("1.27")])]),
        sym("hide"),
      ]),
    ]),
    list([
      sym("property"),
      str("Value"),
      str(portLabel(rn.libId)),
      list([sym("at"), num(rn.x), num(rn.y), sym("0")]),
      list([sym("effects"), list([sym("font"), list([sym("size"), sym("1.27"), sym("1.27")])])]),
    ]),
  ]);
}

// ── Top-level builder ───────────────────────────────────────────────────────

/**
 * Build a complete `.kicad_sch` for a revision: header + lib_symbols (component
 * symbols + every power-port definition used) + one symbol instance per part +
 * a power-port symbol at each verified GROUND/POWER pin's computed connection
 * coordinate. SIGNAL nets and unresolved nodes are skipped. Deterministic.
 */
export function buildSchematic(input: BuildSchematicInput): string {
  const resolved = resolveNodes(input);

  // Distinct power-port lib_ids actually used (stable order for lib_symbols).
  const portLibIds = Array.from(new Set(resolved.map((r) => r.libId))).sort();

  // lib_symbols: component definitions (in part order) + power-port defs.
  const libSymbolItems: SNode[] = [sym("lib_symbols")];
  for (const part of input.parts) {
    libSymbolItems.push(symbolDefForPart(part));
  }
  for (const libId of portLibIds) {
    libSymbolItems.push(buildPowerSymbolDef(libId));
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

  // Power-port instances at each resolved connection point.
  const portInstances: SNode[] = resolved.map((rn) =>
    buildPowerPortInstance(rn, input.projectName),
  );

  const top = list([
    sym("kicad_sch"),
    list([sym("version"), sym(SCH_VERSION)]),
    list([sym("generator"), str(GENERATOR)]),
    uuidNode(`${input.projectName}|sheet`),
    list([sym("paper"), str("A4")]),
    list(libSymbolItems),
    ...componentInstances,
    ...portInstances,
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
