// Ingest the full KiCad 10 standard library into the searchable index
// (KicadLibSymbol / KicadLibFootprint) that powers the create-form pickers.
//
// Reads the local install, parses each lib, and REPLACES the index (delete-all +
// batched createMany) so a re-run after a KiCad bump re-syncs cleanly. Footprints
// are indexed for the picker only — their files are never bundled (they stay
// referenced from the learner's local fp-lib-table at PCB time).
//
// Run: pnpm exec tsx scripts/ingest-kicad-libs.ts
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import {
  parseSexpr,
  findChild,
  findChildren,
  head,
  isList,
  isStr,
  type SList,
} from "@/lib/kicad/sexpr";

const KICAD = "C:\\Program Files\\KiCad\\10.0\\share\\kicad";
const SYM_DIR = join(KICAD, "symbols");
const FP_DIR = join(KICAD, "footprints");

type SymRow = {
  libId: string;
  lib: string;
  name: string;
  keywords: string | null;
  description: string | null;
  datasheet: string | null;
  fpFilters: string | null;
};
type FpRow = {
  libId: string;
  lib: string;
  name: string;
  description: string | null;
  tags: string | null;
  padCount: number;
};

function nonEmpty(v: string | undefined): string | null {
  const t = (v ?? "").trim();
  return t.length > 0 ? t : null;
}

/** Parse a file to a top-level SList, or null (logged) on read/parse failure. */
function tryParse(path: string): SList | null {
  try {
    const node = parseSexpr(readFileSync(path, "utf8"));
    return isList(node) ? node : null;
  } catch (e) {
    console.warn(`!! parse ${path}: ${(e as Error).message}`);
    return null;
  }
}

/** A symbol/footprint `(property "<key>" "<value>" ...)` value, or null. */
function getProp(node: SList, key: string): string | null {
  const p = findChildren(node, "property").find(
    (n) => isStr(n.items[1]) && n.items[1].value === key,
  );
  return p && isStr(p.items[2]) ? nonEmpty(p.items[2].value) : null;
}

/** A direct `(<key> "<value>")` child's string value, or null. */
function childStr(node: SList, key: string): string | null {
  const c = findChild(node, key);
  return c && isStr(c.items[1]) ? nonEmpty(c.items[1].value) : null;
}

function parseSymbols(): SymRow[] {
  const byId = new Map<string, SymRow>();
  for (const file of readdirSync(SYM_DIR).filter((f) => f.endsWith(".kicad_sym"))) {
    const lib = file.slice(0, -".kicad_sym".length);
    const node = tryParse(join(SYM_DIR, file));
    if (!node || head(node) !== "kicad_symbol_lib") continue;
    // Top-level symbols only — unit sub-symbols are nested inside each parent.
    for (const sym of findChildren(node, "symbol")) {
      const name = isStr(sym.items[1]) ? sym.items[1].value : undefined;
      if (!name) continue;
      const libId = `${lib}:${name}`;
      byId.set(libId, {
        libId,
        lib,
        name,
        keywords: getProp(sym, "ki_keywords"),
        description: getProp(sym, "ki_description"),
        datasheet: getProp(sym, "Datasheet"),
        fpFilters: getProp(sym, "ki_fp_filters"),
      });
    }
  }
  return [...byId.values()];
}

function parseFootprints(): FpRow[] {
  const byId = new Map<string, FpRow>();
  for (const dir of readdirSync(FP_DIR).filter((d) => d.endsWith(".pretty"))) {
    const lib = dir.slice(0, -".pretty".length);
    const dirPath = join(FP_DIR, dir);
    let files: string[];
    try {
      files = readdirSync(dirPath).filter((f) => f.endsWith(".kicad_mod"));
    } catch {
      continue;
    }
    for (const file of files) {
      const node = tryParse(join(dirPath, file));
      if (!node || head(node) !== "footprint") continue;
      const name = isStr(node.items[1])
        ? node.items[1].value
        : file.slice(0, -".kicad_mod".length);
      const libId = `${lib}:${name}`;
      byId.set(libId, {
        libId,
        lib,
        name,
        description: childStr(node, "descr"),
        tags: childStr(node, "tags"),
        padCount: findChildren(node, "pad").length,
      });
    }
  }
  return [...byId.values()];
}

async function main() {
  const { db } = await import("@/lib/db");

  console.log("parsing symbols…");
  const symbols = parseSymbols();
  console.log(`  ${symbols.length} symbols`);
  console.log("parsing footprints…");
  const footprints = parseFootprints();
  console.log(`  ${footprints.length} footprints`);

  // Replace the index. Batches of 1000 keep each createMany under the Postgres
  // ~65k-parameter limit (7 cols × 1000 = 7000 params).
  await db.kicadLibSymbol.deleteMany({});
  for (let i = 0; i < symbols.length; i += 1000) {
    await db.kicadLibSymbol.createMany({ data: symbols.slice(i, i + 1000) });
  }
  await db.kicadLibFootprint.deleteMany({});
  for (let i = 0; i < footprints.length; i += 1000) {
    await db.kicadLibFootprint.createMany({ data: footprints.slice(i, i + 1000) });
  }

  const symCount = await db.kicadLibSymbol.count();
  const fpCount = await db.kicadLibFootprint.count();
  console.log(`ingested: ${symCount} symbols, ${fpCount} footprints (index replaced).`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
