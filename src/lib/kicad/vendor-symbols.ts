// Resolve a KiCad standard-library symbol lib-id (e.g. "Device:R") to its
// flattened, self-contained `(symbol "R" ...)` text, so the export can EMBED it
// in the schematic's lib_symbols — KiCad 6+ schematics are self-contained and
// won't resolve an unembedded reference on open (it shows "??").
//
// LAYERED (Phase C), server-only (touches db + R2):
//   1. Committed `vendor/standard-symbols.json` — offline/fast path for the defs
//      already referenced by seeded parts.
//   2. `KicadSymbolDefCache` — lazily-flattened defs from prior references.
//   3. MISS → fetch the lib source from R2 (`kicad/symbols/<ver>/<Lib>.kicad_sym`),
//      flatten the symbol's extends-chain, write the cache, return. Any failure
//      (not in R2 / R2 off / symbol absent / cycle) → `undefined`, and the export
//      falls back to a stub.
import standardSymbols from "./vendor/standard-symbols.json";
import { db } from "@/lib/db";
import { getR2ObjectText } from "@/lib/part-r2";
import { parseSexpr, serializeSexpr, isList, head } from "@/lib/kicad/sexpr";
import { flattenSymbol } from "@/lib/kicad/flatten";
import { KICAD_LIB_VERSION } from "@/lib/kicad/version";

const DEFS = standardSymbols as Record<string, string>;

/** lib-ids we have a committed (offline) vendored def for (sorted). */
export function vendoredSymbolIds(): string[] {
  return Object.keys(DEFS).sort();
}

/**
 * The flattened `(symbol ...)` text for a lib-id, or undefined if it can't be
 * resolved. Async + layered: committed JSON → def cache → R2 fetch + flatten +
 * cache. Never throws — an unresolvable id returns undefined.
 */
export async function resolveVendoredSymbol(
  libId: string,
): Promise<string | undefined> {
  // 1. Committed snapshot.
  const committed = DEFS[libId];
  if (committed !== undefined) return committed;

  // 2. Def cache.
  const cached = await db.kicadSymbolDefCache.findUnique({
    where: { libId },
    select: { text: true },
  });
  if (cached) return cached.text;

  // 3. Miss → R2 fetch + flatten + cache.
  const colon = libId.indexOf(":");
  if (colon < 0) return undefined;
  const lib = libId.slice(0, colon);
  const name = libId.slice(colon + 1);

  let source: string;
  try {
    source = await getR2ObjectText(
      `kicad/symbols/${KICAD_LIB_VERSION}/${lib}.kicad_sym`,
    );
  } catch {
    return undefined; // not in R2 / R2 off → caller stubs.
  }

  let text: string;
  try {
    const libNode = parseSexpr(source);
    if (!isList(libNode) || head(libNode) !== "kicad_symbol_lib") return undefined;
    text = serializeSexpr(flattenSymbol(libNode, name));
  } catch {
    return undefined; // symbol absent / extends cycle → caller stubs.
  }

  await db.kicadSymbolDefCache.upsert({
    where: { libId },
    update: { text, version: KICAD_LIB_VERSION },
    create: { libId, text, version: KICAD_LIB_VERSION },
  });
  return text;
}
