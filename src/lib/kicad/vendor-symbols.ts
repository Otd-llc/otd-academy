// Resolve a KiCad standard-library symbol lib-id (e.g. "Device:R") to its
// vendored symbol definition (a bare `(symbol "R" ...)` text), so the export can
// EMBED it in the schematic's lib_symbols — KiCad 6+ schematics are
// self-contained and won't resolve an unembedded reference on open (it shows
// "??"). Only the defs parts actually reference are vendored; regenerate the
// JSON with `scripts/vendor-kicad-symbols.ts` after adding new references.
//
// This is ONE shared snapshot of KiCad's standard symbols (not per-part copies):
// the parts list still references purely by lib-id; this snapshot lives only in
// the export engine to make the generated schematic self-contained.
import standardSymbols from "./vendor/standard-symbols.json";

const DEFS = standardSymbols as Record<string, string>;

/** The vendored `(symbol ...)` def text for a lib-id, or undefined if not vendored. */
export function resolveVendoredSymbol(libId: string): string | undefined {
  return DEFS[libId];
}

/** lib-ids we have a vendored def for (sorted). */
export function vendoredSymbolIds(): string[] {
  return Object.keys(DEFS).sort();
}
