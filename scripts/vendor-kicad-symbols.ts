// Extract the KiCad standard-library symbol defs that parts reference (via
// Part.kicadSymbol) from a local copy of KiCad's symbol libs, into a small
// committed JSON the export embeds in lib_symbols. Re-run when references change.
//
// Derived symbols (`(symbol "X" (extends "Base") ...)`) are FLATTENED via the
// shared `@/lib/kicad/flatten` so an embedded variant carries the base's graphics
// + pins (otherwise it renders blank).
//
// Source dir: c:\tmp\kicad-symbols (copied from the KiCad install).
// Run: pnpm exec tsx scripts/vendor-kicad-symbols.ts
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

import {
  parseSexpr,
  serializeSexpr,
  findChild,
  isList,
  head,
  type SList,
} from "@/lib/kicad/sexpr";
import { flattenSymbol, symbolByName } from "@/lib/kicad/flatten";

const SRC = "c:\\tmp\\kicad-symbols";
const OUT = "src/lib/kicad/vendor/standard-symbols.json";

async function main() {
  const { db } = await import("@/lib/db");

  const rows = await db.part.findMany({
    where: { kicadSymbol: { not: null } },
    select: { kicadSymbol: true },
    distinct: ["kicadSymbol"],
  });
  const libIds = rows.map((r) => r.kicadSymbol!).sort();
  await db.$disconnect();

  const libCache = new Map<string, SList>();
  const loadLib = (lib: string): SList => {
    if (!libCache.has(lib)) {
      const p = join(SRC, `${lib}.kicad_sym`);
      if (!existsSync(p)) throw new Error(`vendored lib not found: ${p}`);
      const node = parseSexpr(readFileSync(p, "utf8"));
      if (!isList(node) || head(node) !== "kicad_symbol_lib") {
        throw new Error(`${lib}.kicad_sym is not a kicad_symbol_lib`);
      }
      libCache.set(lib, node);
    }
    return libCache.get(lib)!;
  };

  const out: Record<string, string> = {};
  const flattened: string[] = [];
  for (const libId of libIds) {
    const idx = libId.indexOf(":");
    const lib = libId.slice(0, idx);
    const name = libId.slice(idx + 1);
    const libNode = loadLib(lib);
    const sym = symbolByName(libNode, name);
    if (!sym) {
      console.warn(`!! ${libId}: symbol "${name}" not found`);
      continue;
    }
    const wasDerived = !!findChild(sym, "extends");
    out[libId] = serializeSexpr(flattenSymbol(libNode, name));
    if (wasDerived) flattened.push(libId);
  }

  if (!existsSync("src/lib/kicad/vendor")) mkdirSync("src/lib/kicad/vendor", { recursive: true });
  writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n", "utf8");
  const kb = Math.round(Buffer.byteLength(JSON.stringify(out)) / 1024);
  console.log(`wrote ${OUT}: ${Object.keys(out).length} symbol defs, ~${kb} KB`);
  console.log(`flattened (extends resolved): ${flattened.join(", ") || "none"}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
