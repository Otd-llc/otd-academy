// Generate `src/lib/hex-support-data.ts` from hex-cluster's support-data file
// (launch readiness 4.7).
//
// Run:  pnpm tsx scripts/gen-hex-support-data.ts [path/to/support-data-<release>.json] [--check]
//
// The input is `hex-cluster/build/support-data-<release>.json`, format
// `otd-hex-support-data/1`: the owner's calibration slice (4.4) in Creality
// Print with no settings, turned into one row per part by hex-cluster. It lives
// in hex-cluster's build folder, outside this repo, so this script is the one
// place the academy reads it. The output is committed, carries its own content
// hash, and `hex-support-data.test.ts` recomputes that hash, so a hand edit to
// the generated file fails the suite.
//
// WHAT IT REFUSES, and each is a way to ship a support list that looks right:
//   - a format or release other than the one the release tables describe;
//   - counts that disagree with the rows they summarise;
//   - a RELEASED part the slice never saw (absence of a row would then read as
//     "needs nothing" about a part nobody sliced -- the exact promise the old
//     `unknown` state existed to refuse);
//   - a flagged part with no note, or a note that is not plain ASCII (it lands
//     in a README read in Notepad and in 3MF metadata).
//
// Flagged parts the release WITHHOLDS are dropped and named on stdout: they are
// never shipped, so a remedy for them has nothing to attach to.
//
// `--check` regenerates in memory and exits 1 if the committed file differs.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

import { HEX_PART_SLUGS, HEX_TABLES_RELEASE } from "@/lib/hex-release-tables";

const OUT = join(process.cwd(), "src", "lib", "hex-support-data.ts");
const HASH_LINE = /^export const HEX_SUPPORT_DATA_HASH = "[0-9a-f]*";$/m;

type InRow = {
  slug: string;
  support: boolean;
  brim: boolean;
  warnings: string[];
  firstLayerMm2: number;
  note: string | null;
};

type InFile = {
  format: string;
  release: string;
  source: {
    slicerWarnings: string;
    slicerWarningsSha256: string;
    slicer: { name: string; version: string[] };
  };
  profile14: {
    decision: string;
    material: string;
    nozzleMm: number;
    layerMm: number;
    walls: number;
    infill: { pattern: string; densityPct: number };
    alsoWorks: { nozzleMm: number; layerMm: number }[];
  };
  counts: {
    parts: number;
    support: number;
    brim: number;
    both: number;
    neither: number;
  };
  parts: Record<string, InRow>;
};

function refuse(msg: string): never {
  console.error(`gen-hex-support-data: REFUSED -- ${msg}`);
  process.exit(1);
}

const js = (v: unknown) => JSON.stringify(v);

function contentHash(text: string): string {
  const blanked = text
    .replace(/\r\n/g, "\n")
    .replace(HASH_LINE, 'export const HEX_SUPPORT_DATA_HASH = "";');
  return createHash("sha256").update(blanked, "utf8").digest("hex");
}

function main() {
  const args = process.argv.slice(2);
  const check = args.includes("--check");
  const input = resolve(
    args.find((a) => !a.startsWith("--")) ??
      join(
        process.cwd(),
        "..",
        "hex-cluster",
        "build",
        `support-data-${HEX_TABLES_RELEASE}.json`,
      ),
  );
  const raw = readFileSync(input, "utf8");
  const inputSha = createHash("sha256")
    .update(raw.replace(/\r\n/g, "\n"), "utf8")
    .digest("hex");
  const d = JSON.parse(raw) as InFile;

  if (d.format !== "otd-hex-support-data/1")
    refuse(`format ${js(d.format)}, want "otd-hex-support-data/1"`);
  if (d.release !== HEX_TABLES_RELEASE)
    refuse(
      `release ${d.release} is not the release the tables describe (${HEX_TABLES_RELEASE})`,
    );

  const rows = Object.entries(d.parts).map(([key, r]) => {
    if (key !== r.slug) refuse(`row keyed ${key} names slug ${r.slug}`);
    return r;
  });
  const n = (f: (r: InRow) => boolean) => rows.filter(f).length;
  const want = {
    parts: rows.length,
    support: n((r) => r.support),
    brim: n((r) => r.brim),
    both: n((r) => r.support && r.brim),
    neither: n((r) => !r.support && !r.brim),
  };
  for (const k of Object.keys(want) as (keyof typeof want)[]) {
    if (d.counts[k] !== want[k])
      refuse(`counts.${k} says ${d.counts[k]}, the rows say ${want[k]}`);
  }

  const sliced = new Set(rows.map((r) => r.slug));
  const unsliced = HEX_PART_SLUGS.filter((s) => !sliced.has(s));
  if (unsliced.length)
    refuse(
      `${unsliced.length} released part(s) were never sliced: ${unsliced.join(", ")}`,
    );

  const released = new Set<string>(HEX_PART_SLUGS);
  const flagged = rows.filter((r) => r.support || r.brim);
  const kept: InRow[] = [];
  for (const r of flagged) {
    if (!released.has(r.slug)) {
      console.log(`  dropped (withheld from the release): ${r.slug}`);
      continue;
    }
    if (!r.note) refuse(`${r.slug} is flagged and has no note`);
    if (!/^[\x20-\x7e]+$/.test(r.note))
      refuse(`${r.slug}'s note is not plain ASCII`);
    kept.push(r);
  }
  kept.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));

  const p = d.profile14;
  const lines: string[] = [
    `// GENERATED by scripts/gen-hex-support-data.ts. Do not edit by hand.`,
    `//`,
    `// Launch readiness 4.7. Source: hex-cluster build/${basename(input)}`,
    `// (${d.format}), the owner's calibration slice (4.4) in`,
    `// ${d.source.slicer.name} ${d.source.slicer.version.join(", ")} with no settings.`,
    `// HEX_SUPPORT_DATA_HASH is this file's content hash (sha256 of this text,`,
    `// LF line endings, the hash line's value blanked); the test recomputes it.`,
    `//`,
    `// Rows: every RELEASED part the slicer flagged, and only those. Every other`,
    `// released part was sliced and raised nothing, so it needs neither support`,
    `// nor a brim. ${d.counts.parts} parts sliced: ${d.counts.support} support, ${d.counts.brim} brim, ${d.counts.both} both.`,
    ``,
    `/** Content hash of this file. See the header. */`,
    `export const HEX_SUPPORT_DATA_HASH = "";`,
    ``,
    `/** Where the rows came from. */`,
    `export const HEX_SUPPORT_SOURCE = {`,
    `  format: ${js(d.format)},`,
    `  release: ${js(d.release)},`,
    `  file: ${js(basename(input))},`,
    `  /** sha256 of the input, LF line endings. */`,
    `  sha256: ${js(inputSha)},`,
    `  slicerWarnings: ${js(d.source.slicerWarnings)},`,
    `  slicerWarningsSha256: ${js(d.source.slicerWarningsSha256)},`,
    `  slicer: ${js(`${d.source.slicer.name} ${d.source.slicer.version.join(", ")}`)},`,
    `} as const;`,
    ``,
    `/** The counts over every part sliced, released or not. */`,
    `export const HEX_SUPPORT_COUNTS = {`,
    `  parts: ${d.counts.parts},`,
    `  support: ${d.counts.support},`,
    `  brim: ${d.counts.brim},`,
    `  both: ${d.counts.both},`,
    `} as const;`,
    ``,
    `/** Decision ${p.decision}: the profile the slice was judged against. */`,
    `export const HEX_SUPPORT_PROFILE = {`,
    `  material: ${js(p.material)},`,
    `  nozzleMm: ${p.nozzleMm},`,
    `  layerMm: ${p.layerMm},`,
    `  walls: ${p.walls},`,
    `  infillPattern: ${js(p.infill.pattern)},`,
    `  infillDensityPct: ${p.infill.densityPct},`,
    `  alsoWorks: [`,
    ...p.alsoWorks.map(
      (a) => `    { nozzleMm: ${a.nozzleMm}, layerMm: ${a.layerMm} },`,
    ),
    `  ],`,
    `} as const;`,
    ``,
    `/** One row per released part that needs support, a brim, or both. \`note\` is`,
    ` *  completed after the part's label. Sorted by slug. */`,
    `export const HEX_SUPPORT_ROWS: readonly {`,
    `  readonly slug: string;`,
    `  readonly support: boolean;`,
    `  readonly brim: boolean;`,
    `  readonly warnings: readonly string[];`,
    `  readonly firstLayerMm2: number;`,
    `  readonly note: string;`,
    `}[] = [`,
    ...kept.flatMap((r) => [
      `  {`,
      `    slug: ${js(r.slug)},`,
      `    support: ${r.support},`,
      `    brim: ${r.brim},`,
      `    warnings: ${js(r.warnings)},`,
      `    firstLayerMm2: ${r.firstLayerMm2},`,
      `    note:`,
      `      ${js(r.note)},`,
      `  },`,
    ]),
    `];`,
    ``,
  ];
  let text = lines.join("\n");
  text = text.replace(
    HASH_LINE,
    `export const HEX_SUPPORT_DATA_HASH = "${contentHash(text)}";`,
  );

  if (check) {
    const committed = readFileSync(OUT, "utf8").replace(/\r\n/g, "\n");
    if (committed !== text) {
      console.error(`${OUT} is stale: regenerate it from ${input}`);
      process.exit(1);
    }
    console.log(`${OUT} matches ${input}`);
    return;
  }
  writeFileSync(OUT, text, "utf8");
  console.log(
    `wrote ${OUT}: ${kept.length} row(s), hash ${contentHash(text).slice(0, 12)}...`,
  );
}

main();
