// Probes for the PrusaSlicer payload, which is BUILT AND NOT WIRED IN.
//
// Run:  pnpm tsx scripts/hex-prusa-probe.ts c:\zzz\probes
//
// ===========================================================================
// WHY THE EXISTING MEASUREMENT DOES NOT COVER THIS
// ===========================================================================
// `hex-prusa-config.ts` cites "a plate carrying both configs loaded fine in
// Creality Print 7.2.1" as its safety evidence. That was
// `c:\zzz\probes\probe-6-dualconfig.3mf`, and its Prusa config is:
//
//   <config><object id="1" type="ModelObject"><metadata type="object" .../>
//   ...4 lines...</object></config>
//
// NO `<volume>` ELEMENT. Which is the one element whose entire documented power
// is to replace an object's volume list -- the thing that, written wrong, makes
// PrusaSlicer arrive with no mesh, delete the object as zero-volume, and blame
// the user's model. `prusaModelConfig` now emits it. So the measurement on
// record is about a materially different file, and the Creality regression
// question is open rather than closed.
//
// ===========================================================================
// THREE FILES, ONE JOB EACH
// ===========================================================================
// They cannot be one file. A fatal defect aborts the whole import, so the
// control cannot ride along; and a deliberately broken range can block slicing,
// so the range instrument cannot ride on the plate that has to slice.
//
//   A  the shipping shape. Must load, must slice, must show per-object settings.
//      Carries one object with NO config block, as the geometry comparator: same
//      mesh, same size, adjacent on the bed. If a config block deletes geometry,
//      that object survives and its twin vanishes. Nothing else on the plate can
//      produce that asymmetry.
//
//   B  the range instrument. Three copies of ONE mesh, with lastid correct,
//      deliberately halved, and off by one. Q2 answers "is the range honoured at
//      all" by eye. Q3 answers "would an off-by-one be visible" -- and if Q3
//      looks like Q1, the honest conclusion is that the INSTRUMENT is blunt, not
//      that the range is fine.
//
//   C  the control: file A with one `<object id>` duplicated. Per source that is
//      `add_error("Found duplicated object id")` and a refused load. Its REFUSAL
//      is the only evidence PrusaSlicer read, parsed and validated our file at
//      all -- without it, "A loaded and showed no settings" cannot be told apart
//      from "A loaded and the file was never opened", and those have opposite
//      consequences.
//
// Duplicate-id was chosen for the control over an unknown key on purpose: that
// error comes from the 3MF XML handler, not the config system, so it does not
// depend on whether 2.9.6 still throws for keys outside `PrintConfigDef` -- which
// is itself a source reading rather than a measurement.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import JSZip from "jszip";

import { buildPlate3mf, ZIP_EPOCH } from "@/lib/hex-3mf";
import { HEX_GEOMETRY_RELEASE, HEX_PART_BOX, HEX_PART_NAME } from "@/lib/hex-geometry";
import { packPlates } from "@/lib/hex-plate";
import {
  PRUSA_CONFIG_PATH,
  countTriangles,
  prusaModelConfig,
  type PrusaObject,
} from "@/lib/hex-prusa-config";
import { PART_REMEDY } from "@/lib/hex-support";

const OUT = process.argv[2] ?? "c:\\zzz\\probes";
const MESH_DIR =
  process.env.PRINTABLES_DIR ?? "c:\\zzz\\hex-cluster\\build\\printables";

/** 170 x 170 so file A fits one plate on any common bed, including a Mini --
 *  it has to be sliceable, not merely loadable. */
const BED = { x: 170, y: 170 };

async function meshOf(slug: string): Promise<string> {
  const zip = await JSZip.loadAsync(
    readFileSync(join(MESH_DIR, "3mf", `${HEX_PART_NAME[slug]}.3mf`)),
  );
  return zip.file("3D/3dmodel.model")!.async("string");
}

/** Read the ids and triangle counts back OUT of the emitted document, never
 *  from this script's own bookkeeping. `lastid` describes triangles in
 *  `3D/3dmodel.model`, so it has to be counted from the string that BECOMES
 *  that file -- anything else is a second derivation that can drift. */
function objectsFromModel(model: string): { id: number; count: number; name: string }[] {
  const out: { id: number; count: number; name: string }[] = [];
  for (const m of model.matchAll(/<object id="(\d+)"([^>]*)>([\s\S]*?)<\/object>/g)) {
    const name = /name="([^"]*)"/.exec(m[2])?.[1] ?? "";
    out.push({ id: Number(m[1]), count: countTriangles(m[3]), name });
  }
  return out;
}

type Line = { slug: string; label: string };

async function buildPlate(lines: readonly Line[]) {
  const sources = new Map<string, string>();
  for (const l of lines) sources.set(l.slug, await meshOf(l.slug));
  // One placement per LINE, so same-slug copies can carry different labels.
  const placements = lines.map((l) => ({
    slug: l.slug,
    qty: 1,
    name: l.label,
    box: HEX_PART_BOX[l.slug],
  }));
  const plates = packPlates(placements, BED);
  if (plates.length !== 1) {
    throw new Error(`expected 1 plate, packed ${plates.length} -- widen BED`);
  }
  const buf = await buildPlate3mf(plates[0], sources, {
    bed: BED,
    release: HEX_GEOMETRY_RELEASE,
  });
  const model = await (await JSZip.loadAsync(buf)).file("3D/3dmodel.model")!.async("string");
  return { buf, model, order: plates[0].map((p) => p.slug) };
}

async function writeWith(file: string, buf: Buffer, cfg: string): Promise<void> {
  const zip = await JSZip.loadAsync(buf);
  zip.file(PRUSA_CONFIG_PATH, cfg, { date: ZIP_EPOCH });
  const out = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, file), out);
  console.log(`  wrote ${file}  ${(out.length / 1024).toFixed(0)} KB`);
}

async function main(): Promise<void> {
  // ---------------------------------------------------------------- FILE A
  // PUBLISHED NAMES, not probe labels. An earlier version used P1..P5 tags so
  // each object could be identified on screen; they read as shipping names in
  // the slicer's object list, which is exactly the confusion a probe should not
  // introduce. Every object below is named the way a real download names it.
  //
  // The geometry comparator is therefore two DIFFERENT caps rather than the same
  // mesh twice -- identical meshes would give identical names and be
  // indistinguishable in the list. They are the male and female halves of the
  // same cap, 420 and 404 triangles, adjacent on the bed: if a config block
  // deletes geometry, the CONFIGURED one is missing and its unconfigured
  // neighbour is not, which is still the only asymmetry on the plate.
  const CONFIGURED = "dovetail-cap-single-m-solid";
  const UNCONFIGURED = "dovetail-cap-single-f-solid";
  const aLines: Line[] = [
    { slug: CONFIGURED, label: HEX_PART_NAME[CONFIGURED] },
    { slug: UNCONFIGURED, label: HEX_PART_NAME[UNCONFIGURED] },
    { slug: "hex-tb-spike-ball-zip-single", label: HEX_PART_NAME["hex-tb-spike-ball-zip-single"] },
    { slug: "hex-tb-spike-ball-joint", label: HEX_PART_NAME["hex-tb-spike-ball-joint"] },
    { slug: "hex-tb-spike-solid", label: HEX_PART_NAME["hex-tb-spike-solid"] },
  ];
  const a = await buildPlate(aLines);
  const aObjs = objectsFromModel(a.model);
  const prusa: PrusaObject[] = aObjs.map((o, i) => {
    const slug = a.order[i];
    const remedy = PART_REMEDY[slug] ?? { support: false, brim: false };
    return { id: o.id, name: o.name, triangleCount: o.count, ...remedy };
  });

  console.log("\nFILE A -- the shipping shape");
  console.log(`  ${"id".padEnd(3)} ${"object".padEnd(24)} ${"tri".padEnd(6)} range        support brim`);
  for (let i = 0; i < prusa.length; i += 1) {
    const o = prusa[i];
    console.log(
      `  ${String(o.id).padEnd(3)} ${o.name.padEnd(24)} ${String(o.triangleCount).padEnd(6)} ` +
        `0..${String(o.triangleCount - 1).padEnd(9)} ${String(o.support).padEnd(7)} ${o.brim}`,
    );
  }

  const full = prusaModelConfig(prusa);
  // P2 loses its whole block -- the geometry comparator.
  const p2 = prusa.find((o) => o.name === HEX_PART_NAME[UNCONFIGURED])!;
  const aCfg = full.replace(
    new RegExp(`\\s*<object id="${p2.id}"[\\s\\S]*?</object>`),
    "",
  );
  if (aCfg === full) throw new Error("failed to strip P2's config block");
  await writeWith("prusa-A-plate.3mf", a.buf, aCfg);

  // ---------------------------------------------------------------- FILE B
  const bLines: Line[] = [
    // File B is a measuring instrument, never a stand-in for a download: three
    // copies of ONE mesh whose only difference is a deliberately wrong range.
    // These keep tags because the whole point is telling them apart.
    { slug: "dovetail-cap-single-m-solid", label: "Q1-FULL-RANGE" },
    { slug: "dovetail-cap-single-m-solid", label: "Q2-HALF-RANGE" },
    { slug: "dovetail-cap-single-m-solid", label: "Q3-SHORT-BY-ONE" },
  ];
  const b = await buildPlate(bLines);
  const bObjs = objectsFromModel(b.model);
  let bCfg = prusaModelConfig(
    bObjs.map((o) => ({
      id: o.id,
      name: o.name,
      triangleCount: o.count,
      support: false,
      brim: false,
    })),
  );
  const q2 = bObjs.find((o) => o.name.startsWith("Q2"))!;
  const q3 = bObjs.find((o) => o.name.startsWith("Q3"))!;
  const setLast = (cfg: string, id: number, last: number) => {
    const re = new RegExp(`(<object id="${id}"[\\s\\S]*?<volume firstid="0" lastid=")\\d+(")`);
    if (!re.test(cfg)) throw new Error(`no volume range for object ${id}`);
    return cfg.replace(re, `$1${last}$2`);
  };
  bCfg = setLast(bCfg, q2.id, Math.floor(q2.count / 2) - 1);
  bCfg = setLast(bCfg, q3.id, q3.count - 2);
  console.log(
    `\nFILE B -- range instrument (all ${bObjs[0].count} triangles)` +
      `\n  Q1 lastid ${bObjs.find((o) => o.name.startsWith("Q1"))!.count - 1}  (correct -- a whole cap)` +
      `\n  Q2 lastid ${Math.floor(q2.count / 2) - 1}  (half -- must LOOK like half a cap)` +
      `\n  Q3 lastid ${q3.count - 2}  (short by one -- is it even visible?)`,
  );
  await writeWith("prusa-B-range-control.3mf", b.buf, bCfg);

  // ---------------------------------------------------------------- FILE C
  // Duplicated by STRING SURGERY, outside `prusaModelConfig`, because that
  // function throws on a duplicate id -- the guard working. The control exists
  // to show what the guard stands in front of.
  const ids = prusa.map((o) => o.id);
  const cCfg = aCfg.replace(
    new RegExp(`<object id="${ids[ids.length - 1]}"`),
    `<object id="${ids[0]}"`,
  );
  if (cCfg === aCfg) throw new Error("failed to duplicate an object id");
  await writeWith("prusa-C-dupid-EXPECT-FAIL.3mf", a.buf, cCfg);

  console.log(`
=========================================================================
WHAT EACH FILE ANSWERS
=========================================================================
C FIRST. prusa-C-dupid-EXPECT-FAIL.3mf must be REFUSED. If it loads clean,
  PrusaSlicer is not reading our config at all and every other result on
  this page is meaningless.

A  prusa-A-plate.3mf -- must load, all 5 objects present and named.
     P1 vs P2 is the geometry comparator: same-size caps, adjacent. If a
     config block deletes geometry, P1 vanishes and P2 stays.
     Slice it: brim under exactly P3 and P5, support under exactly P4 and
     P5. That 2x2 pattern cannot come from an inherited profile, so it is
     the per-object proof and needs no settings-panel archaeology.

B  prusa-B-range-control.3mf -- do NOT slice (Q2/Q3 are deliberately
     non-manifold and may trigger repair prompts that mask the numbers).
     Look at Q2: it must be visibly HALF a cap. Then compare Q3 to Q1 in
     the Info box's facet count.

THEN A ONCE MORE, IN CREALITY PRINT 7.2.1 -- the regression check that the
  old probe never covered: 5 objects, names intact, geometry intact, and
  the Orca settings (gyroid / 30% / 4) still applied.
=========================================================================`);
}

void main();
