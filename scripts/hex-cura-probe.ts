// Probe for the Cura payload — the one dialect nobody here has opened.
//
// Run:  pnpm tsx scripts/hex-cura-probe.ts c:\zzz\probes
//
// ===========================================================================
// WHAT IS ALREADY SETTLED, so nobody re-checks it
// ===========================================================================
// The RISK side is measured. Adding `<metadatagroup>` to `3D/3dmodel.model`
// cannot fail a load in the Orca family or PrusaSlicer: their element dispatch
// has no `else` branch and their metadata handlers contain zero `return false`
// paths, and a real 13-object pack carrying all three payloads loaded in
// PrusaSlicer 2.9.6 at exit 0 with its own per-object settings still intact.
//
// What is NOT measured is the BENEFIT: that Cura actually applies these. That is
// a source reading from `libSavitar` and `fdmprinter.def.json`, and this file is
// what turns it into an observation.
//
// ===========================================================================
// THE PLATE: three objects, and the third is the control
// ===========================================================================
//   Dovetail-Cap-Single-M-Solid   configured, NOT on the support list
//                                 -> gyroid, 30%, 4 walls, support OFF
//   Hex-TB-Spike-Solid            configured, ON the support list
//                                 -> gyroid, 30%, 4 walls, support ON
//   Dovetail-Cap-Single-F-Solid   THE CONTROL: its `<metadatagroup>` is stripped
//                                 -> whatever the profile says (Cura ships grid,
//                                    20%, 2 walls, support off)
//
// The control is the whole point. Without it, "the objects show gyroid at 30%"
// cannot be told apart from "the profile is set to gyroid at 30%", and those have
// nothing to do with each other. With it, any DIFFERENCE between the first two
// and the third came from our file and from nowhere else.
//
// The two caps are the male and female halves of the same part, so they sit
// side by side at nearly the same size -- easy to compare, and impossible to
// confuse with each other in the object list because their names differ.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import JSZip from "jszip";

import { buildPlate3mf, ZIP_EPOCH } from "@/lib/hex-3mf";
import { HEX_GEOMETRY_RELEASE, HEX_PART_BOX, HEX_PART_NAME } from "@/lib/hex-geometry";
import { packPlates } from "@/lib/hex-plate";
import { curaRowsFor } from "@/lib/hex-cura";
import { PART_REMEDY } from "@/lib/hex-support";

const OUT = process.argv[2] ?? "c:\\zzz\\probes";
const MESH_DIR =
  process.env.PRINTABLES_DIR ?? "c:\\zzz\\hex-cluster\\build\\printables";

const CONFIGURED_PLAIN = "dovetail-cap-single-m-solid";
const CONFIGURED_SUPPORT = "hex-tb-spike-solid";
const CONTROL = "dovetail-cap-single-f-solid";

const BED = { x: 170, y: 170 };

async function meshOf(slug: string): Promise<string> {
  const zip = await JSZip.loadAsync(
    readFileSync(join(MESH_DIR, "3mf", `${HEX_PART_NAME[slug]}.3mf`)),
  );
  return zip.file("3D/3dmodel.model")!.async("string");
}

/** Remove one object's `<metadatagroup>`, by the object's NAME.
 *
 *  By name rather than by index, because the packer decides document order and
 *  an index would silently strip the wrong object the moment a part's size
 *  changed -- which would invert the control and make the probe read as a pass. */
function stripGroupByName(model: string, name: string): string {
  const re = new RegExp(
    `(<object\\b[^>]*name="${name}"[^>]*>)\\s*<metadatagroup>[\\s\\S]*?</metadatagroup>`,
  );
  if (!re.test(model)) {
    throw new Error(`no metadatagroup found on the object named ${name}`);
  }
  return model.replace(re, "$1");
}

async function main(): Promise<void> {
  const slugs = [CONFIGURED_PLAIN, CONFIGURED_SUPPORT, CONTROL];
  const sources = new Map<string, string>();
  for (const s of slugs) sources.set(s, await meshOf(s));

  const plates = packPlates(
    slugs.map((slug) => ({
      slug,
      qty: 1,
      name: HEX_PART_NAME[slug],
      box: HEX_PART_BOX[slug],
    })),
    BED,
  );
  if (plates.length !== 1) throw new Error(`expected 1 plate, got ${plates.length}`);

  const buf = await buildPlate3mf(plates[0], sources, {
    bed: BED,
    release: HEX_GEOMETRY_RELEASE,
  });

  // Strip the control's group AFTER the writer has run, so the only difference
  // between it and the others is this one block.
  const zip = await JSZip.loadAsync(buf);
  const model = await zip.file("3D/3dmodel.model")!.async("string");
  zip.file("3D/3dmodel.model", stripGroupByName(model, HEX_PART_NAME[CONTROL]), {
    date: ZIP_EPOCH,
  });

  const out = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  mkdirSync(OUT, { recursive: true });
  const file = join(OUT, "cura-probe.3mf");
  writeFileSync(file, out);

  const groups = (
    (await JSZip.loadAsync(out).then((z) => z.file("3D/3dmodel.model")!.async("string")))
      .match(/<metadatagroup>/g) ?? []
  ).length;

  console.log(`${file}  ${(out.length / 1024).toFixed(0)} KB`);
  console.log(`  metadatagroups: ${groups} (expected 2 -- the control has none)\n`);
  for (const slug of slugs) {
    const rows =
      slug === CONTROL
        ? []
        : curaRowsFor({
            support: PART_REMEDY[slug]?.support === true,
            brim: PART_REMEDY[slug]?.brim === true,
          });
    const label = slug === CONTROL ? "CONTROL, no metadatagroup" : "configured";
    console.log(`  ${HEX_PART_NAME[slug]}  (${label})`);
    for (const r of rows) console.log(`      cura:${r.key} = ${r.value}`);
    if (rows.length === 0) console.log("      (nothing -- profile defaults apply)");
  }

  console.log(`
=========================================================================
WHAT TO CHECK IN CURA
=========================================================================
Open cura-probe.3mf normally. Cura applies per-object settings on an ORDINARY
import -- there is no open-as-project distinction here, unlike the Orca family.

1. OBJECT LIST -- three objects, named Dovetail-Cap-Single-M-Solid,
   Hex-TB-Spike-Solid and Dovetail-Cap-Single-F-Solid.

2. PER-OBJECT OVERRIDES. Select an object, then the per-model settings tool in
   the left toolbar (the wrench / slider icon). For the two CONFIGURED objects it
   should list our settings; for Dovetail-Cap-Single-F-Solid -- THE CONTROL -- it
   should list NOTHING.
     Infill Pattern      Gyroid
     Infill Density      30
     Wall Line Count     4
     Generate Support    on   <- Hex-TB-Spike-Solid ONLY
   The control is what makes this mean anything: if all three look the same, the
   values came from your profile and not from our file.

3. SLICE IT. Support under Hex-TB-Spike-Solid and NOTHING under either cap. That
   difference cannot come from a profile -- a profile applies to the whole plate.

4. WORTH A GLANCE: the control should visibly differ. Cura ships grid infill at
   20% with 2 walls, so in the layer view the two configured objects should look
   denser and thicker-walled than Dovetail-Cap-Single-F-Solid.

WHAT I EXPECT TO BE WRONG, if anything: the density. Cura types it as a FLOAT and
we write a bare "30" -- if it shows 3000% or 0.3%, the format is wrong and I need
to know. Everything else is a name, and a wrong name in Cura is silent: it gets
parked in node metadata and never applied, so it would show as the setting simply
not appearing in the list.

FOUR ANSWERS: (1) three objects named right, (2) overrides on the two and NONE on
the control, (3) support on the spike only, (4) density reads 30.
=========================================================================`);
}

void main();
