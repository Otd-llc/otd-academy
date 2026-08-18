// Probe generator for the two things still unmeasured about the support fail-safe.
//
// Run:  pnpm tsx scripts/hex-enforcer-probe.ts c:\zzz\probes
//
// ===========================================================================
// WHAT IS ALREADY MEASURED -- do not re-probe these
// ===========================================================================
// The 2026-08-17 battery in `c:\zzz\probes` settled, on Creality Print 7.2.1:
//   probe-4-enforcer            enforcer volume, support OFF  -> modal FIRES
//   probe-9-enforcer-supports-ON enforcer volume + enable_support -> NO modal
//   probe-5-painted             420 painted facets, support OFF -> modal FIRES
// So "does a painted facet fire the warning" is ANSWERED: yes.
//
// ===========================================================================
// WHAT IS NOT, AND WHY THESE TWO FILES EXIST
// ===========================================================================
// probe-5 painted EVERY facet of the cap. A fully painted part generates real
// support, so it cannot answer the question the shipping design turns on:
//
//   Can we paint ONE facet, fire the modal, and change the sliced print by
//   NOTHING AT ALL?
//
// Source says yes. OrcaSlicer `PrintObject.cpp`:
//
//   // Support blockers or enforcers. Project downward facing painted areas
//   // upwards to their respective slicing plane.
//   slice_mesh_slabs(custom_facets, zs, trafo, nullptr, &projected, ...);
//
// `nullptr` is `out_top`. Only DOWNWARD-facing painted area projects into the
// enforcer layers. Paint an UPWARD-facing facet and `enforcers_layers` is empty
// on every layer -- zero support -- while `has_facets(ENFORCER)` stays true, so
// `Print::validate()` still raises the modal (it is an `||`, checked in source).
//
// That is a source reading, not a measurement, and this project has been wrong
// twice while equally certain. These two files settle it in one sitting.
//
// A SECOND UNKNOWN, worth watching for while you are in there: does the paint
// survive `File > Import`? Painted facets live on `ModelVolume::supported_facets`,
// which the import-path `config.reset()` does not touch -- but "should" is the
// word that cost us twice. If the paint does NOT survive, the whole fail-safe is
// dead and we ship prose instead.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import JSZip from "jszip";

import { HEX_PART_NAME } from "@/lib/hex-geometry";

const OUT = process.argv[2] ?? "c:\\zzz\\probes";
const MESH_DIR =
  process.env.PRINTABLES_DIR ?? "c:\\zzz\\hex-cluster\\build\\printables";

/** The fixture. Smallest published mesh (420 triangles), so the emitted probe is
 *  a few KB and the object list is trivially readable. It is also the part
 *  probe-5 used, which keeps this comparable to the measurement on record. */
const SLUG = "dovetail-cap-single-m-solid";

type Tri = { a: number; b: number; c: number };
type Vert = { x: number; y: number; z: number };

/** Pull the single object's mesh out of a published 3MF. */
async function loadMesh(slug: string): Promise<string> {
  const name = HEX_PART_NAME[slug];
  if (!name) throw new Error(`no published name for ${slug}`);
  const buf = readFileSync(join(MESH_DIR, "3mf", `${name}.3mf`));
  const zip = await JSZip.loadAsync(buf);
  const f = zip.file("3D/3dmodel.model");
  if (!f) throw new Error(`no 3dmodel.model in ${name}.3mf`);
  return f.async("string");
}

function parse(model: string): { verts: Vert[]; tris: Tri[] } {
  const verts: Vert[] = [];
  for (const m of model.matchAll(
    /<vertex\s+x="([^"]+)"\s+y="([^"]+)"\s+z="([^"]+)"/g,
  )) {
    verts.push({ x: +m[1], y: +m[2], z: +m[3] });
  }
  const tris: Tri[] = [];
  for (const m of model.matchAll(
    /<triangle\s+v1="(\d+)"\s+v2="(\d+)"\s+v3="(\d+)"/g,
  )) {
    tris.push({ a: +m[1], b: +m[2], c: +m[3] });
  }
  return { verts, tris };
}

/**
 * The index of the MOST UPWARD-FACING triangle.
 *
 * THIS IS EXACT ARITHMETIC, NOT A HEURISTIC, and the distinction matters here
 * because a facet-normal metric has already been wrong once in this project.
 * That one tried to PREDICT WHERE SUPPORT WAS NEEDED from normals, and scored a
 * curved contact at zero. This asks only "which way does this triangle point",
 * which a cross product answers exactly. Nothing downstream depends on it being
 * the *best* choice -- only on it facing up, so its downward projection is empty.
 */
function mostUpwardTriangle(verts: Vert[], tris: Tri[]): number {
  let best = -1;
  let bestNz = -Infinity;
  tris.forEach((t, i) => {
    const p = verts[t.a];
    const q = verts[t.b];
    const r = verts[t.c];
    if (!p || !q || !r) return;
    // z of the cross product (q-p) x (r-p), normalised by the triangle's area
    // so a big sloped facet cannot outscore a small flat one.
    const ux = q.x - p.x;
    const uy = q.y - p.y;
    const uz = q.z - p.z;
    const vx = r.x - p.x;
    const vy = r.y - p.y;
    const vz = r.z - p.z;
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    if (len === 0) return;
    const unit = nz / len;
    if (unit > bestNz) {
      bestNz = unit;
      best = i;
    }
  });
  if (best < 0) throw new Error("no non-degenerate triangle found");
  return best;
}

/** Paint exactly ONE triangle, by index, with a whole-facet enforcer.
 *
 *  `paint_supports="4"` is the whole-facet ENFORCER literal: nibble 4 gives
 *  `num_of_split_sides = 4 & 0b11 = 0` and `state = 4 >> 2 = 1 = ENFORCER`.
 *  Confirmed in `TriangleSelector`, and already measured in probe-5. */
function paintOne(model: string, index: number): string {
  let seen = -1;
  const out = model.replace(/<triangle\b/g, (m) => {
    seen += 1;
    return seen === index ? '<triangle paint_supports="4"' : m;
  });
  if (seen < index) throw new Error(`only ${seen + 1} triangles; wanted ${index}`);
  return out;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
 <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
 <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
 <Default Extension="config" ContentType="text/xml"/>
</Types>
`;

const RELS = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
 <Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>
`;

/** Deterministic zip timestamp, matching `hex-3mf.ts`'s ZIP_EPOCH. */
const EPOCH = new Date(Date.UTC(1980, 0, 1));

async function write(
  file: string,
  model: string,
  config: string,
): Promise<void> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", CONTENT_TYPES, { date: EPOCH });
  zip.file("_rels/.rels", RELS, { date: EPOCH });
  zip.file("3D/3dmodel.model", model, { date: EPOCH });
  zip.file("Metadata/model_settings.config", config, { date: EPOCH });
  const buf = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, file), buf);
  console.log(`  wrote ${file}  ${buf.length} bytes`);
}

const cfg = (name: string) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<config>\n  <object id="1">\n   <metadata key="name" value="${name}"/>\n   <metadata key="extruder" value="1"/>\n  </object>\n</config>\n`;

async function main(): Promise<void> {
  const model = await loadMesh(SLUG);
  const { verts, tris } = parse(model);
  const idx = mostUpwardTriangle(verts, tris);
  const t = tris[idx];
  console.log(`fixture: ${HEX_PART_NAME[SLUG]}`);
  console.log(`  vertices ${verts.length}, triangles ${tris.length}`);
  console.log(`  painting triangle #${idx} (the most upward-facing facet)`);
  console.log(
    `    v=(${t.a},${t.b},${t.c})  z=${[verts[t.a].z, verts[t.b].z, verts[t.c].z].join(", ")}`,
  );

  await write(
    "enforcer-A-paint-one-UP-facet-EXPECT-MODAL.3mf",
    paintOne(model, idx).replace(
      /(<object[^>]*\bid="1"[^>]*)>/,
      '$1 name="A-ONE-UPWARD-FACET-PAINTED">',
    ),
    cfg("A-ONE-UPWARD-FACET-PAINTED"),
  );

  await write(
    "enforcer-B-control-unpainted-EXPECT-NO-MODAL.3mf",
    model.replace(
      /(<object[^>]*\bid="1"[^>]*)>/,
      '$1 name="B-CONTROL-UNPAINTED">',
    ),
    cfg("B-CONTROL-UNPAINTED"),
  );

  console.log(`
=========================================================================
WHAT TO DO, in Creality Print 7.2.1. Open the app FIRST, empty plate.
=========================================================================
1. Open  enforcer-B-control-unpainted-EXPECT-NO-MODAL.3mf  and Slice.
     EXPECT: no modal. This is the control -- it proves any modal in step 2
     came from the paint and not from the part or the profile.

2. Open  enforcer-A-paint-one-UP-facet-EXPECT-MODAL.3mf  and Slice.
     EXPECT: the modal "Support enforcers are used but support is not
     enabled", naming A-ONE-UPWARD-FACET-PAINTED.
     THEN DISMISS IT and look at the sliced preview.
     EXPECT: NO support anywhere. That is the whole question -- a tripwire
     that costs the print nothing. If support appears, the upward-facet
     argument is wrong and the fail-safe needs a different placement.

3. Still in A: File > Import the same file into a fresh project.
     EXPECT: the modal still fires on Slice. Painted facets are mesh data,
     so they should survive the import-path config reset. If they do NOT,
     the fail-safe cannot work on the one path it exists for -- say so and
     we ship prose instead.

Report three yes/no answers: (1) control silent, (2) A fires + zero support,
(3) A still fires after Import.
=========================================================================`);
}

void main();
