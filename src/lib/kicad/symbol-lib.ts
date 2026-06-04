// KiCad symbol-library assembly (export-engine Task 4, design §3.1).
//
// Two jobs, both PURE (no React/DB/env/network/fs):
//   1. `setSymbolFootprint` — pre-wire a symbol's `(property "Footprint" ...)`
//      to `<nick>:<fpName>` so KiCad opens with the symbol↔footprint pairing
//      already done (normally a manual step). Foundry already pairs symbol+
//      footprint per part, so we hand them over connected.
//   2. `buildSymbolLib` — merge N uploaded `.kicad_sym` bodies into ONE
//      `(kicad_symbol_lib ...)` library. Tolerant of the two real-world upload
//      shapes: a full `kicad_symbol_lib` wrapper around a single symbol, or a
//      bare `(symbol ...)` node.
//
// Target format KiCad 10. Anchored to the sample symbol in kicad-meta.test.ts.

import {
  parseSexpr,
  serializeSexpr,
  sym,
  str,
  list,
  isList,
  isSym,
  isStr,
  head,
  findChild,
  findChildIndex,
  type SNode,
  type SList,
} from "@/lib/kicad/sexpr";

// KiCad 10 still stamps the symbol-lib format version as 20211014 (the format
// has been stable across 6→10 for symbol libs). Bump here if a KiCad-10
// reference project shows otherwise at manual acceptance.
const SYMBOL_LIB_VERSION = "20211014";
const GENERATOR = "project-foundry";

/**
 * The `(symbol ...)` node out of an uploaded `.kicad_sym` body, tolerating both
 * real-world shapes:
 *   - a `(kicad_symbol_lib ... (symbol ...))` wrapper → return the inner symbol
 *   - a bare `(symbol ...)` → return it as-is
 * Throws if neither is found (caller controls error surfacing).
 */
function extractSymbolNode(kicadSymText: string): SList {
  const node = parseSexpr(kicadSymText);
  if (!isList(node)) {
    throw new Error("extractSymbolNode: input is not an S-expression list");
  }
  if (head(node) === "symbol") {
    return node;
  }
  if (head(node) === "kicad_symbol_lib") {
    const inner = findChild(node, "symbol");
    if (inner) return inner;
    throw new Error(
      "extractSymbolNode: kicad_symbol_lib wrapper contains no (symbol ...)",
    );
  }
  throw new Error(
    `extractSymbolNode: expected (symbol ...) or (kicad_symbol_lib ...), got (${head(node) ?? "?"} ...)`,
  );
}

/**
 * Set (or insert) a symbol node's `(property "Footprint" "<value>" ...)`.
 * Mutates and returns the passed `SList`. Preserves any existing `(at ...)` /
 * `(effects ...)` sub-nodes on the property; on insert, places the new property
 * after the last existing `(property ...)` (or after the head atoms if none).
 */
function setFootprintOnSymbolNode(symbolNode: SList, footprintRef: string): SList {
  // Find an existing (property "Footprint" ...).
  for (const child of symbolNode.items) {
    if (
      isList(child) &&
      head(child) === "property" &&
      isStr(child.items[1]) &&
      child.items[1].value === "Footprint"
    ) {
      // items: [sym(property), str("Footprint"), <value>, ...rest]
      child.items[2] = str(footprintRef);
      return symbolNode;
    }
  }
  // No Footprint property — synthesize one. Mirror the sample's property shape
  // (value + (at ...) + (effects ... hide)). Place after the last property, or
  // after leading head atoms if the symbol has no properties.
  const newProp = list([
    sym("property"),
    str("Footprint"),
    str(footprintRef),
    list([sym("at"), sym("0"), sym("0"), sym("0")]),
    list([
      sym("effects"),
      list([sym("font"), list([sym("size"), sym("1.27"), sym("1.27")])]),
      sym("hide"),
    ]),
  ]);
  let insertAt = symbolNode.items.length;
  for (let i = symbolNode.items.length - 1; i >= 0; i--) {
    if (isList(symbolNode.items[i]) && head(symbolNode.items[i]!) === "property") {
      insertAt = i + 1;
      break;
    }
  }
  symbolNode.items.splice(insertAt, 0, newProp);
  return symbolNode;
}

/**
 * Set/replace the `Footprint` property of a `.kicad_sym` body and re-serialize.
 * `footprintRef` is `"<nick>:<fpName>"` (KiCad library-reference form). Works on
 * both a `kicad_symbol_lib` wrapper and a bare `(symbol ...)`; the output keeps
 * the input's outer shape.
 */
export function setSymbolFootprint(symbolText: string, footprintRef: string): string {
  const node = parseSexpr(symbolText);
  if (!isList(node)) {
    throw new Error("setSymbolFootprint: input is not an S-expression list");
  }
  if (head(node) === "symbol") {
    setFootprintOnSymbolNode(node, footprintRef);
  } else if (head(node) === "kicad_symbol_lib") {
    const inner = findChild(node, "symbol");
    if (!inner) {
      throw new Error("setSymbolFootprint: no (symbol ...) inside kicad_symbol_lib");
    }
    setFootprintOnSymbolNode(inner, footprintRef);
  } else {
    throw new Error(
      `setSymbolFootprint: expected symbol or kicad_symbol_lib, got (${head(node) ?? "?"} ...)`,
    );
  }
  return serializeSexpr(node);
}

export type BuildSymbolLibInput = { name: string; kicadSymText: string };

export type BuildSymbolLibOpts = {
  /**
   * Per-symbol footprint reference `<nick>:<fpName>`. Called with the symbol's
   * `name`; return undefined to leave that symbol's Footprint property untouched.
   */
  footprintFor?: (name: string) => string | undefined;
  /** Override the emitted format version (defaults to KiCad-stable 20211014). */
  version?: string;
};

/**
 * Merge N parsed `.kicad_sym` bodies into one
 * `(kicad_symbol_lib (version ...) (generator "project-foundry") (symbol ...) ...)`.
 * Each input is unwrapped (a `kicad_symbol_lib` wrapper is stripped so the inner
 * symbol is re-hosted, never nested), optionally has its Footprint set via
 * `opts.footprintFor(name)`, and is appended in input order.
 */
export function buildSymbolLib(
  symbols: BuildSymbolLibInput[],
  opts: BuildSymbolLibOpts = {},
): string {
  const version = opts.version ?? SYMBOL_LIB_VERSION;
  const items: SNode[] = [
    sym("kicad_symbol_lib"),
    list([sym("version"), sym(version)]),
    list([sym("generator"), str(GENERATOR)]),
  ];
  for (const { name, kicadSymText } of symbols) {
    const symbolNode = extractSymbolNode(kicadSymText);
    const ref = opts.footprintFor?.(name);
    if (ref !== undefined) {
      setFootprintOnSymbolNode(symbolNode, ref);
    }
    items.push(symbolNode);
  }
  return serializeSexpr(list(items)) + "\n";
}

/**
 * The declared `name` of a `(symbol "<name>" ...)` node, if its first arg is a
 * quoted string. Exposed for callers that assemble symbols and need the name
 * back out (e.g. to key footprint association). Returns undefined otherwise.
 */
export function symbolName(symbolNode: SNode): string | undefined {
  if (!isList(symbolNode) || head(symbolNode) !== "symbol") return undefined;
  const nameNode = symbolNode.items[1];
  return isStr(nameNode) || isSym(nameNode) ? nameNode.value : undefined;
}

// Re-export for callers that want the index helper without importing sexpr too.
export { findChildIndex };
