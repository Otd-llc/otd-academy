// Build a REALISTIC download locally, from the code on this branch.
//
// Run:  pnpm tsx scripts/hex-sample-pack.ts c:\zzz\probes
//
// WHY THIS EXISTS. The live endpoint serves whatever is on `main`, so it cannot
// be used to check work that has not merged. This runs the SAME functions the
// route runs -- `packPlates`, `buildPlate3mf`, `plateReadme`, the same
// `platePath` naming -- against the published meshes on disk, so the archive it
// writes is the archive the endpoint would serve if this branch were deployed.
//
// It is not a mock: the only things it substitutes are where the meshes come
// from (local `hex-cluster/build` instead of R2) and the LICENSE.txt body, which
// the real route copies out of the bucket.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import JSZip from "jszip";

import { buildPlate3mf, ZIP_EPOCH } from "@/lib/hex-3mf";
import { HEX_PART_BOX, HEX_PART_NAME } from "@/lib/hex-geometry";
import { platePath } from "@/lib/hex-pack";
import { plateReadme } from "@/lib/hex-pack-readme";
import { packPlates } from "@/lib/hex-plate";
import { HEX_GEOMETRY_RELEASE } from "@/lib/hex-geometry";
import { HEX_LICENSE } from "@/lib/hex-spec";

const OUT = process.argv[2] ?? "c:\\zzz\\probes";
const MESH_DIR =
  process.env.PRINTABLES_DIR ?? "c:\\zzz\\hex-cluster\\build\\printables";

/**
 * A build someone would plausibly configure and take.
 *
 * CHOSEN TO SPAN EVERY CASE THE WRITER HAS, so one slice exercises all of it:
 *   - a base and two halves        -> support, no brim  (the commonest case)
 *   - six dovetail caps            -> neither, and repeated, so the per-copy
 *                                     naming and per-copy settings are visible
 *   - a corner                     -> support on a part with 417 sq mm on the
 *                                     bed, i.e. support WITHOUT a brim
 *   - the solid spike              -> support AND brim, the only part with both
 *   - the zip single               -> brim WITHOUT support, the mirror case
 *   - the large platform           -> neither: the negative control. If this
 *                                     one carries a painted facet, the tripwire
 *                                     is firing on parts that do not need it.
 */
const BUILD: { slug: string; qty: number }[] = [
  { slug: "hex-tb-main", qty: 1 },
  { slug: "hex-tb-half-top-solid", qty: 1 },
  { slug: "hex-tb-half-bot-solid", qty: 1 },
  { slug: "hex-tb-corner-m-solid", qty: 1 },
  { slug: "dovetail-cap-single-m-solid", qty: 3 },
  { slug: "dovetail-cap-single-f-solid", qty: 3 },
  { slug: "hex-tb-spike-solid", qty: 1 },
  { slug: "hex-tb-spike-ball-zip-single", qty: 1 },
  { slug: "hex-tb-spike-platform-lrg", qty: 1 },
];

/** The bed most people have. Larger beds mean fewer plates, never a failure. */
const BED = { x: 220, y: 220 };
const STEM = "OTD-Hex-Sample";

async function meshOf(slug: string): Promise<string> {
  const name = HEX_PART_NAME[slug];
  if (!name) throw new Error(`no published name for ${slug}`);
  const zip = await JSZip.loadAsync(
    readFileSync(join(MESH_DIR, "3mf", `${name}.3mf`)),
  );
  const f = zip.file("3D/3dmodel.model");
  if (!f) throw new Error(`no 3dmodel.model for ${name}`);
  return f.async("string");
}

async function main(): Promise<void> {
  const sources = new Map<string, string>();
  for (const line of BUILD) sources.set(line.slug, await meshOf(line.slug));

  const lines = BUILD.map((l) => ({
    slug: l.slug,
    qty: l.qty,
    name: HEX_PART_NAME[l.slug],
    box: HEX_PART_BOX[l.slug],
  }));
  const plates = packPlates(lines, BED);

  const zip = new JSZip();
  const built: string[] = [];
  for (let i = 0; i < plates.length; i += 1) {
    const path = platePath(i + 1, plates.length, STEM);
    const buf = await buildPlate3mf(plates[i], sources, {
      bed: BED,
      release: HEX_GEOMETRY_RELEASE,
    });
    zip.file(path, buf, { date: ZIP_EPOCH });
    built.push(path);

    const model = await (await JSZip.loadAsync(buf))
      .file("3D/3dmodel.model")!
      .async("string");
    const painted = (model.match(/paint_supports/g) ?? []).length;
    console.log(
      `  ${path}  ${plates[i].length} objects, ${painted} painted facet(s)`,
    );
  }

  zip.file(
    "README.txt",
    plateReadme({
      release: HEX_GEOMETRY_RELEASE,
      bed: BED,
      plates,
      credit: HEX_LICENSE.credit,
      specUrl: "https://academy.onethousanddrones.com/hex",
      stem: STEM,
    }),
    { date: ZIP_EPOCH },
  );
  // The real route copies this out of R2. Stated rather than faked, so nobody
  // mistakes this sample's licence file for the published one.
  zip.file(
    "LICENSE.txt",
    `${HEX_LICENSE.credit}\n\nSAMPLE BUILD -- the published archive carries the full ${HEX_LICENSE.name} text from R2.\n`,
    { date: ZIP_EPOCH },
  );

  const out = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  mkdirSync(OUT, { recursive: true });
  const file = join(OUT, `${STEM}.zip`);
  writeFileSync(file, out);

  const instances = plates.reduce((n, p) => n + p.length, 0);
  console.log(
    `\n${file}  ${(out.length / 1024 / 1024).toFixed(2)} MB` +
      `\n${instances} objects on ${plates.length} plate(s), bed ${BED.x}x${BED.y}` +
      `\nrelease ${HEX_GEOMETRY_RELEASE}`,
  );
}

void main();
