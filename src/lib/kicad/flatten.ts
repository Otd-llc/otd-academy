// src/lib/kicad/flatten.ts
// Flatten a KiCad symbol's `extends` chain into a self-contained `(symbol ...)`.
//
// KiCad symbols are often DERIVED: `(symbol "AP2112K-3.3" (extends "AP2112K") ...)`
// — the variant only overrides properties; graphics + pins live in the base. An
// embedded derived symbol with no base in lib_symbols renders BLANK, so we merge
// the (recursively resolved) base body with the derived's property overrides into
// one self-contained symbol (no extends). PURE: no DB/env/network/fs.
//
// Extracted verbatim from scripts/vendor-kicad-symbols.ts so the ingest, the
// export resolver, and the vendor script share one typed implementation.
import {
  parseSexpr,
  serializeSexpr,
  findChild,
  findChildren,
  head,
  isList,
  isStr,
  type SList,
  type SNode,
} from "@/lib/kicad/sexpr";
import { renameSymbol } from "@/lib/kicad/symbol-lib";

/** A deep clone of a node (round-trips through the serializer). */
function clone(node: SNode): SNode {
  return parseSexpr(serializeSexpr(node));
}

/** The first top-level `(symbol "<name>" ...)` in a `(kicad_symbol_lib ...)`. */
export function symbolByName(libNode: SList, name: string): SList | undefined {
  return findChildren(libNode, "symbol").find(
    (s) => isStr(s.items[1]) && s.items[1].value === name,
  );
}

/** The name of a `(property "<name>" ...)` node, or undefined for anything else. */
function propName(n: SNode): string | undefined {
  if (isList(n) && head(n) === "property" && isStr(n.items[1])) {
    return n.items[1].value;
  }
  return undefined;
}

/**
 * Resolve `name` in `libNode` to a self-contained (no-`extends`) `(symbol ...)`:
 * the fully-resolved base body, renamed to `name` (parent + `_<u>_<s>` unit
 * sub-symbols, per KiCad's prefix rule), with the derived symbol's property
 * overrides applied (replace by property name, else insert before the first unit
 * sub-symbol). Throws on a missing symbol or an `extends` cycle.
 */
export function flattenSymbol(
  libNode: SList,
  name: string,
  seen: Set<string> = new Set(),
): SList {
  if (seen.has(name)) throw new Error(`extends cycle at ${name}`);
  seen.add(name);

  const sym = symbolByName(libNode, name);
  if (!sym) throw new Error(`symbol "${name}" not found`);

  const ext = findChild(sym, "extends");
  if (!ext || !isStr(ext.items[1])) return clone(sym) as SList; // already self-contained

  // Flatten: fully-resolved base body, renamed to `name`, with derived overrides.
  const base = flattenSymbol(libNode, ext.items[1].value, seen);
  renameSymbol(base, name);

  // Apply the derived symbol's property overrides (replace by name, else insert
  // before the first unit sub-symbol).
  const firstUnit = base.items.findIndex((c) => isList(c) && head(c) === "symbol");
  for (const child of sym.items) {
    const pn = propName(child);
    if (pn === undefined) continue;
    const idx = base.items.findIndex((c) => propName(c) === pn);
    const fresh = clone(child);
    if (idx >= 0) base.items[idx] = fresh;
    else base.items.splice(firstUnit >= 0 ? firstUnit : base.items.length, 0, fresh);
  }
  return base;
}
