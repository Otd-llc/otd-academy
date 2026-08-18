// Does every part the slicer flagged actually receive its support tripwire?
//
// Run:  pnpm tsx scripts/hex-paint-check.ts
//
// WHY THIS IS A SCRIPT AND NOT A UNIT TEST. The check has to run against the
// REAL published meshes, which live outside this repo (`../hex-cluster/build`).
// A unit test can only use fixtures, and a fixture cannot tell you that
// `Hex-TB-Corner-F-Solid` -- re-oriented in the 2026-08-17 cut -- still has an
// upward-facing facet to paint. `hex-3mf.ts` degrades SILENTLY when it finds
// none, which is the right call at request time (a missing tripwire must not
// cost someone their download) and exactly why it needs a loud check somewhere.
//
// RUN IT AFTER ANY RE-CUT, beside the calibration plate. A re-orientation
// changes which facets face up, and the whole cost argument rests on the
// painted facet facing up: a DOWNWARD painted facet generates real support,
// silently, on every plate carrying that part.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import JSZip from "jszip";

import { buildPlate3mf } from "@/lib/hex-3mf";
import { HEX_PART_BOX, HEX_PART_NAME } from "@/lib/hex-geometry";
import { PART_REMEDY } from "@/lib/hex-support";

const DIR = "c:\\zzz\\hex-cluster\\build\\printables\\3mf";

async function meshOf(slug: string): Promise<string> {
  const z = await JSZip.loadAsync(
    readFileSync(join(DIR, `${HEX_PART_NAME[slug]}.3mf`)),
  );
  return z.file("3D/3dmodel.model")!.async("string");
}

let failures = 0;

async function main() {
  // EVERY part the slicer flagged, plus one it did not -- the negative case
  // matters as much: a tripwire on a part needing no support fires the modal on
  // a plate that is already correct.
  const slugs = [
    ...Object.keys(PART_REMEDY).filter((s) => PART_REMEDY[s]?.support),
    "hex-tb-spike-platform-lrg",
  ];
  const sources = new Map<string, string>();
  for (const s of slugs) sources.set(s, await meshOf(s));

  for (const slug of slugs) {
    const buf = await buildPlate3mf(
      [{ slug, name: HEX_PART_NAME[slug], box: HEX_PART_BOX[slug], x: 4, y: 4 }],
      sources,
      { bed: { x: 350, y: 350 }, release: "2026-08-17" },
    );
    const model = await (await JSZip.loadAsync(buf))
      .file("3D/3dmodel.model")!
      .async("string");
    const painted = model.match(/<triangle paint_supports="4" v1="(\d+)" v2="(\d+)" v3="(\d+)"/);
    const want = PART_REMEDY[slug]?.support === true;

    let verdict = "no paint";
    if (painted) {
      // Recompute the normal of the painted facet from the emitted document, so
      // this checks the BYTES rather than agreeing with the painter's own math.
      const xs: number[] = [], ys: number[] = [], zs: number[] = [];
      for (const m of model.matchAll(/<vertex\s+x="([^"]+)"\s+y="([^"]+)"\s+z="([^"]+)"/g)) {
        xs.push(+m[1]); ys.push(+m[2]); zs.push(+m[3]);
      }
      const [a, b, c] = [+painted[1], +painted[2], +painted[3]];
      const ux = xs[b]-xs[a], uy = ys[b]-ys[a], uz = zs[b]-zs[a];
      const vx = xs[c]-xs[a], vy = ys[c]-ys[a], vz = zs[c]-zs[a];
      const nz = ux*vy - uy*vx;
      const len = Math.hypot(uy*vz-uz*vy, uz*vx-ux*vz, nz);
      verdict = `painted 1, normal.z=${(nz/len).toFixed(4)}`;
    }
    const count = (model.match(/paint_supports/g) ?? []).length;
    const ok = want ? count === 1 && Number(verdict.split("normal.z=")[1]) >= 0.9 : count === 0;
    if (!ok) failures += 1;
    console.log(
      `${ok ? "PASS" : "FAIL"}  ${slug.padEnd(28)} needs=${String(want).padEnd(5)} count=${count}  ${verdict}`,
    );
  }
}

void main().then(() => {
  if (failures > 0) {
    console.error(``);
    console.error(`${failures} part(s) FAILED -- see above.`);
    process.exitCode = 1;
  } else {
    console.log("");
    console.log("all parts OK");
  }
});
