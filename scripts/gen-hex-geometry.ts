// Regenerates `src/lib/hex-geometry.ts` AND `src/lib/hex-outlines.ts` from the
// published mesh set:
//
//   pnpm tsx scripts/gen-hex-geometry.ts
//
// TWO FILES, ONE PASS, and that is the point rather than an accident. Both are
// keyed by the same slugs and derived from the same directory, so generating
// them separately would create a way for them to describe different mesh sets.
// They are separate FILES because `hex-geometry.ts` is mirrored by the
// configurator and compared against by a test over there: a field added to it is
// a field a second repo has to carry, and none of the outline data is geometry
// the packer needs.
//
// RUN IT IN THE SAME COMMIT that re-cuts the meshes and bumps HEX_RELEASE and
// HEX_PART_SLUGS. A stale table packs against sizes the meshes no longer have,
// and the symptom is parts overlapping on a plate in someone else's slicer --
// nothing about which points back at a committed data file. The generated file
// carries a release stamp and the guard test pins it to HEX_RELEASE, so the
// commonest half of that mistake (bump, forget to regenerate) fails a test
// instead of shipping.
//
// WHY A COMMITTED TABLE AT ALL. The meshes are not in this repo -- `hex-cluster`
// is a sibling checkout and its build output never ships here -- so there is no
// build step that could reach them, and the app only ever sees the objects in
// R2. Reading them back to measure would mean pulling ~20 MB and parsing about
// 130,000 vertices per request, to learn six numbers per part that change once a
// release.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import JSZip from "jszip";

import { HEX_PART_FAMILIES, type HexPartFamily } from "@/lib/hex-parts";
import { HEX_RELEASE } from "@/lib/hex-spec";

// Paths are resolved from this FILE, not from the shell's working directory, so
// the script writes the same output whichever directory it is invoked from.
const REPO = fileURLToPath(new URL("..", import.meta.url));

/** The published printables tree. Overridable so a re-cut can be measured from
 *  a build directory elsewhere; the default assumes `hex-cluster` sits beside
 *  this repo, which is how both are checked out. */
const PRINTABLES = resolve(
  REPO,
  process.env.PRINTABLES_DIR ?? "../hex-cluster/build/printables",
);
const MESHES = join(PRINTABLES, "3mf");
const MANIFEST = join(PRINTABLES, "manifest.json");
const OUT = join(REPO, "src", "lib", "hex-geometry.ts");

/** The second output: the top-down OUTLINE of every part, and what family it
 *  belongs to. See the header this script writes into it for why it is a
 *  separate file rather than three more fields on `HEX_PART_BOX`. */
const OUT_OUTLINES = join(REPO, "src", "lib", "hex-outlines.ts");

/**
 * How far the two derivations of a part's size may differ before it counts as a
 * disagreement.
 *
 * They are NOT the same computation, which is the point of comparing them. This
 * script measures the tessellated vertices inside the shipped 3MF; the manifest
 * records `printBboxMm`, the FreeCAD B-Rep solid's own BoundBox taken before it
 * was ever meshed (`tools/export_printables.py` in hex-cluster). Two things can
 * separate them honestly: the MANIFEST rounds to 3 dp (up to 0.0005), and the
 * 3MF stores coordinates as roughly 6-significant-figure text (up to ~0.0002
 * across an 88 mm part). Anything past that is a real divergence -- a mesh that
 * no longer matches the solid it was cut from, or a manifest describing a
 * different cut than the files sitting beside it -- and either way the table
 * would be wrong about a part.
 *
 * ONE SIDE ROUNDS NOW, NOT TWO. This script used to round its own measurements
 * to 3 dp as well, which made the two sides agree EXACTLY on all 53 parts x 3
 * axes -- a suspiciously perfect result that was really just both sides landing
 * on the same coarse grid. Carrying full precision (the seat fix; see `measure`)
 * costs that exact agreement and buys a check that can actually see a
 * sub-millimetre divergence. Measured 2026-08-15 against release 2026-08-03: the
 * largest disagreement is 0.0005 mm (`Hex-TB-Spike-Ball-Zip-Single` dx, mesh
 * 17.3205 vs manifest 17.321), i.e. exactly the manifest's own rounding, and
 * nothing is near this bound.
 */
const TOLERANCE_MM = 0.002;

// ---------------------------------------------------------------------------
// OUTLINE CONSTANTS
//
// Every one of these is a choice about a 256 px thumbnail, so every one is
// expressed against the coarsest thing that will ever look at the result: one
// output pixel. The smallest bed the pack endpoint accepts is 100 mm (BED_MIN),
// which is the WORST case for detail because it is the most magnified -- a
// 256 px frame less two 6 px margins over 100 mm is 2.44 px/mm. Anything finer
// than that is detail nobody can be shown.
// ---------------------------------------------------------------------------

/** Cell size of the grid the shadow is rasterised into, in mm.
 *
 *  A quarter of the simplification tolerance, so the staircase the raster
 *  inevitably makes of a diagonal edge is well inside the tolerance that
 *  straightens it out again. Finer would cost generation time and change
 *  nothing; coarser and a hexagon's flanks come out as visible steps. The
 *  largest part is 87.76 mm, i.e. an 878 x 780 grid -- the whole set rasterises
 *  and traces in under two seconds. */
const OUTLINE_CELL_MM = 0.1;

/** Douglas-Peucker tolerance, in mm.
 *
 *  0.35 mm is 0.85 px at the most magnified bed we accept and 0.39 px at the
 *  default 220 mm one -- i.e. SUB-PIXEL either way. It is the number that turns
 *  ~4,000 staircase corners per part into ~20 real ones, and everything it
 *  removes is smaller than the pixel it would have been drawn in. */
const OUTLINE_SIMPLIFY_MM = 0.35;

/** Outline coordinates are integers 0..1000 across the part's own bounding box:
 *  per-mille of the footprint, on both axes.
 *
 *  NORMALISED rather than absolute, so the drawing code needs no millimetres --
 *  it already knows where the footprint landed and how big it is, from the same
 *  `Placement` it used to draw the rectangle. One unit is 0.088 mm on the widest
 *  part, which is a quarter of the simplification tolerance, so the quantiser
 *  never becomes the thing limiting fidelity. */
const OUTLINE_SCALE = 1000;

/** Smallest ring worth carrying, in mm^2.
 *
 *  0.8 mm^2 is about a 1 mm hole: half a pixel across at the default bed. A ring
 *  that small cannot be drawn -- at best it removes one pixel from the middle of
 *  a part, which reads as damage rather than as a hole -- and it costs the same
 *  bytes as a real one. Every actual through-hole in the set is an order of
 *  magnitude bigger than this. */
const OUTLINE_MIN_RING_MM2 = 0.8;

/** How far a part's outline may fall short of its own bounding box, in outline
 *  units, before the two are treated as describing different parts.
 *
 *  The silhouette of a solid is EXACTLY as wide and as deep as the solid, so
 *  every part's rings must touch all four sides of its box. This is the guard
 *  that would catch a projection done in the wrong plane, a mesh whose triangles
 *  are wound inconsistently, or a rings-to-box mismatch introduced by a later
 *  edit -- all of which produce a plausible-looking table full of shapes that do
 *  not fill their footprints. 8/1000 allows the half-cell the raster samples at
 *  its centre plus the quantiser's rounding, and nothing else. */
const OUTLINE_EXTENT_SLACK = 8;

/** The share of its bounding box a part's silhouette must cover, as a fraction.
 *
 *  A second, independent shape of the same failure: an outline that touches all
 *  four sides can still be a thin cross or a pair of slivers. Measured on the
 *  2026-08-03 set the range is 0.61 (the corner cap, a wedge) to 1.00 (the solid
 *  dovetail caps, which really are rectangles), so 0.30 is far below anything
 *  real and far above a fragment. The upper bound is 1 plus the quantiser's
 *  rounding, because a silhouette cannot exceed its own bounding box. */
const OUTLINE_MIN_FILL = 0.3;
const OUTLINE_MAX_FILL = 1.02;

/** Most points one part's outline may carry.
 *
 *  A budget, not a limit anything is near: the busiest part on the 2026-08-03 set
 *  is `Hex-TB-Main` at 50. It exists because the failure mode of a simplifier is
 *  QUIET -- a tolerance typo, or a mesh whose facets no longer fall on the grid,
 *  yields a correct-looking outline with two thousand points in it, and the only
 *  symptom is a data file that got twenty times bigger and a fill loop that got
 *  twenty times slower. */
const OUTLINE_MAX_POINTS = 200;

/** The tessellated mesh, projected to the two axes this file cares about.
 *
 *  Parallel arrays rather than objects: the largest part is 16,692 vertices and
 *  33,404 triangles, and the whole set is read twice (once to measure, once to
 *  trace) inside one process. */
type Mesh = {
  vx: Float64Array;
  vy: Float64Array;
  /** Vertex indices, three per triangle, flat. */
  tri: Int32Array;
};

/** A closed ring, as flat `x, y, x, y, ...` integers in 0..OUTLINE_SCALE. The
 *  closing edge is implied: the last point joins the first. */
type Ring = number[];

type Box = {
  x0: number;
  y0: number;
  z0: number;
  dx: number;
  dy: number;
  dz: number;
  /** The VERBATIM `z` attribute of the lowest vertex in the mesh -- the source
   *  text, never turned into a number on its way here.
   *
   *  Carried separately from `z0` on purpose. `z0` is that text parsed, and the
   *  point of keeping both is that a rounding introduced anywhere in the numeric
   *  path cannot reach the string: the two stop agreeing, and the check in
   *  `main` says so. A table derived from one source and checked against nothing
   *  agrees with itself forever, which is the same argument the manifest
   *  cross-check is built on. */
  z0Text: string;
};

type ManifestPart = {
  part: string;
  printBboxMm: { x: number; y: number; z: number };
};

/** The R2 key spelling. Same transform `scripts/upload-printables.ts` applies,
 *  so the table is keyed by the name the endpoint is asked for.
 *
 *  A LOCAL COPY of `slug()` in `src/lib/r2.ts` rather than an import of it: that
 *  module pulls in `@/env`, which validates the whole server environment at
 *  module-eval time, and this script deliberately needs nothing but a directory
 *  of meshes. The copy is not left to drift -- `__tests__/hex-geometry.test.ts`
 *  runs every emitted display name through the REAL `slug()` and insists it
 *  lands back on its own key, so a divergence between the two transforms fails a
 *  test rather than mislabelling a mesh. */
const slugOf = (file: string) =>
  file
    .replace(/\.3mf$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-");

/** Three significant figures, for a HUMAN-READABLE disagreement message only.
 *  Nothing measured passes through here -- rounding a measurement is what this
 *  file was fixed for. */
const brief = (v: number) => v.toPrecision(3);

/**
 * What class of part a mesh file is, from its published name.
 *
 * ORDERED, FIRST MATCH WINS, and the order is the whole specification -- every
 * rule below is a prefix of the one before it, so reordering them silently
 * reclassifies parts. Read top to bottom.
 *
 * THE FILENAME IS THE ONLY IDENTITY AVAILABLE. The configurator derives the same
 * six families from the glTF path a configured cell resolved to
 * (`familyForPath` in `bs-cap-hex/src/hex/export/bom.ts`), but a printable is a
 * file in a bucket: there is no cell, no slot and no template behind it. So the
 * rules are written to agree with that function's tables part for part, and the
 * two places they LOOK like they disagree are places where they do not:
 *
 *   - `Hex-TB-Corner-{F,M}-Solid` is a CAP, not a base. It is in `CAP_MODEL`
 *     over there, under the `corner` cap variant, however much its name reads
 *     like a structural piece.
 *   - `Hex-TB-Carrier-*-Parts-Tray-Lid` is a PCB, not an insert. The lid slot is
 *     `CARRIER_BOARD_MODEL`: it is the plate a board mounts to, and the tray it
 *     closes is the insert. This is why the lid rule has to precede the general
 *     carrier rule.
 *
 * TWO PARTS ARE IN NEITHER of the configurator's tables --
 * `Hex-TB-Spike-Ball-Platform-Solid` and `Hex-TB-Spike-Ball-Zip-1H`. They ship as
 * printables and the configurator cannot place them, so nothing over there
 * classifies them at all. They are read the way their names read: something that
 * fits ONTO a spike's ball is an accessory, and the ball JOINT itself is a spike
 * variant (`SPIKE_MODEL['ball-joint']`), which is why the joint gets an exact
 * rule of its own ahead of the general ball rule.
 *
 * NO FALLBACK, and that is the difference from the configurator's copy, which
 * ends `return 'base'` so an unrecognised part still lands on a drawing. Here an
 * unrecognised part means a re-cut introduced something these rules have never
 * seen, and the honest answer is to stop: the alternative is fifty-three parts
 * quietly becoming fifty-two families and one wrong one, in a data file nobody
 * re-reads.
 */
function familyOf(name: string): HexPartFamily {
  if (/^Dovetail-Cap-/.test(name)) return "cap";
  if (/^Hex-TB-Corner-/.test(name)) return "cap";
  // `.*` with no anchor between it and `Parts-Tray-Lid`, because the full-cell
  // carrier is spelled `Hex-TB-Carrier-Parts-Tray-Lid` with NO middle segment
  // at all, while the four halves are `Hex-TB-Carrier-Top-Parts-Tray-Lid` and
  // friends. Requiring a hyphen there matched the four and missed the one, and
  // the miss was invisible: it fell through to the next rule and became an
  // insert. The per-family counts in the guard test are what pin it.
  if (/^Hex-TB-Carrier-.*Parts-Tray-Lid$/.test(name)) return "pcb";
  if (/^Hex-TB-Carrier-/.test(name)) return "insert";
  if (/^Hex-TB-Spike-Ball-Joint$/.test(name)) return "spike";
  if (/^Hex-TB-Spike-Ball-/.test(name)) return "accessory";
  if (/^Hex-TB-Spike-/.test(name)) return "spike";
  if (/^Hex-TB-Half-/.test(name)) return "base";
  if (/^Hex-TB-Main$/.test(name)) return "base";
  throw new Error(
    `${name}: no family rule matches this part. A re-cut has introduced a part ` +
      `shape these rules have never seen, and guessing would put it in the ` +
      `wrong band on every thumbnail. Add a rule in familyOf() -- do NOT add a ` +
      `catch-all.\n\nNothing was written.`,
  );
}

/**
 * The part's vertical shadow, rasterised into a grid of `cols` x `rows` cells
 * spanning exactly its bounding box.
 *
 * THE SHADOW IS EXACTLY THE UP-FACING TRIANGLES UNDER A NONZERO WINDING RULE,
 * and that is a proof rather than an approximation. Every vertical line through
 * a watertight solid enters and leaves it the same number of times, so over any
 * point inside the silhouette the count of triangles whose projection covers it
 * AND whose normal points up is at least one; over any point outside it is zero.
 * Project only those triangles (positive signed area once flattened to XY),
 * treat their edges as one big polygon, and fill by nonzero winding: the result
 * is the union of the projections, with no polygon-boolean library and no
 * floating-point union to get wrong. All 53 meshes in the 2026-08-03 set are
 * watertight with zero border edges, per the manifest.
 *
 * Sampled at CELL CENTRES, which is what makes the traced boundary land on cell
 * corners and therefore on a lattice a simplifier can work on.
 */
function shadowRaster(
  mesh: Mesh,
  x0: number,
  y0: number,
  dx: number,
  dy: number,
  cols: number,
  rows: number,
): Uint8Array {
  const { vx, vy, tri } = mesh;
  const ex0: number[] = [];
  const ey0: number[] = [];
  const ex1: number[] = [];
  const ey1: number[] = [];
  for (let i = 0; i < tri.length; i += 3) {
    const a = tri[i];
    const b = tri[i + 1];
    const c = tri[i + 2];
    const ax = vx[a];
    const ay = vy[a];
    const bx = vx[b];
    const by = vy[b];
    const cx = vx[c];
    const cy = vy[c];
    // Twice the signed area of the projection. Zero means the triangle is
    // vertical -- a wall -- and casts no shadow of its own; negative means it
    // faces down, and counting it would cancel the roof above it.
    if ((bx - ax) * (cy - ay) - (cx - ax) * (by - ay) <= 0) continue;
    ex0.push(ax, bx, cx);
    ey0.push(ay, by, cy);
    ex1.push(bx, cx, ax);
    ey1.push(by, cy, ay);
  }

  const cw = dx / cols;
  const ch = dy / rows;
  const grid = new Uint8Array(cols * rows);

  // An active-edge sweep, because the brute-force form is rows x edges and the
  // biggest part is 780 rows x 28,095 edges. Each edge is filed under the first
  // scanline that can reach it and dropped once passed.
  const opening: number[][] = Array.from({ length: rows + 1 }, () => []);
  for (let i = 0; i < ex0.length; i++) {
    const lo = Math.min(ey0[i], ey1[i]);
    const first = Math.max(0, Math.floor((lo - y0) / ch - 0.5) + 1);
    if (first <= rows) opening[first].push(i);
  }

  let active: number[] = [];
  for (let r = 0; r < rows; r++) {
    const yy = y0 + (r + 0.5) * ch;
    if (opening[r].length) active = active.concat(opening[r]);
    const xs: [number, number][] = [];
    let keep = 0;
    for (let j = 0; j < active.length; j++) {
      const i = active[j];
      const a = ey0[i];
      const b = ey1[i];
      if (a <= yy && b <= yy) continue; // wholly behind the sweep
      active[keep++] = i;
      // Half-open in y, so a vertex shared by two edges is counted once.
      if ((a <= yy && b > yy) || (b <= yy && a > yy)) {
        const t = (yy - a) / (b - a);
        xs.push([ex0[i] + t * (ex1[i] - ex0[i]), b > a ? 1 : -1]);
      }
    }
    active.length = keep;
    if (xs.length < 2) continue;
    xs.sort((p, q) => p[0] - q[0]);
    let wind = 0;
    for (let i = 0; i < xs.length - 1; i++) {
      wind += xs[i][1];
      if (wind === 0) continue;
      const from = Math.max(0, Math.ceil((xs[i][0] - x0) / cw - 0.5));
      const to = Math.min(cols, Math.ceil((xs[i + 1][0] - x0) / cw - 0.5));
      for (let c = from; c < to; c++) grid[r * cols + c] = 1;
    }
  }
  return grid;
}

/**
 * Trace the filled cells' boundary into closed loops of lattice corners.
 *
 * Every filled cell contributes one directed unit edge per side whose neighbour
 * is empty, wound so the filled side is always on the left. That edge set is the
 * boundary of a region, so in-degree equals out-degree at every corner and it
 * decomposes into closed loops -- which is why the walk below can never strand
 * itself, and why the "traced N of M" check at the end is a real assertion
 * rather than a formality.
 *
 * THE ONLY CHOICE IS AT A DIAGONAL PINCH, where two filled cells meet corner to
 * corner and a lattice point has two ways out. Turning as far RIGHT as possible
 * pairs the incoming and outgoing directions ADJACENTLY around that point
 * (south-then-east, north-then-west), so the two loops touch at the pinch and
 * never cross it. Turning left pairs them the other way and is equally
 * non-crossing; what would not do is choosing inconsistently, because a crossing
 * ring breaks the even-odd fill that draws this later.
 */
function traceRings(grid: Uint8Array, cols: number, rows: number): number[][][] {
  const V = cols + 1;
  const outs = new Map<number, number[]>();
  const add = (from: number, to: number) => {
    const list = outs.get(from);
    if (list) list.push(to);
    else outs.set(from, [to]);
  };
  const on = (c: number, r: number) =>
    c >= 0 && r >= 0 && c < cols && r < rows && grid[r * cols + c] === 1;

  let edges = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!grid[r * cols + c]) continue;
      if (!on(c, r - 1)) add(r * V + c, r * V + c + 1); // south, +x
      if (!on(c + 1, r)) add(r * V + c + 1, (r + 1) * V + c + 1); // east, +y
      if (!on(c, r + 1)) add((r + 1) * V + c + 1, (r + 1) * V + c); // north, -x
      if (!on(c - 1, r)) add((r + 1) * V + c, r * V + c); // west, -y
      edges +=
        (on(c, r - 1) ? 0 : 1) +
        (on(c + 1, r) ? 0 : 1) +
        (on(c, r + 1) ? 0 : 1) +
        (on(c - 1, r) ? 0 : 1);
    }
  }

  const loops: number[][][] = [];
  let walked = 0;
  for (const [start, list] of outs) {
    while (list.length) {
      const loop = [start];
      let cur = start;
      let next = list.shift() as number;
      walked++;
      let dir = next - cur;
      for (;;) {
        loop.push(next);
        cur = next;
        if (cur === start) break;
        const here = outs.get(cur);
        if (!here || here.length === 0) {
          throw new Error("boundary walk stranded: the edge set is not closed");
        }
        let pick = 0;
        if (here.length > 1) {
          const right = dir === 1 ? -V : dir === -1 ? V : dir === V ? 1 : -1;
          const i = here.findIndex((t) => t - cur === right);
          if (i >= 0) pick = i;
        }
        const step = here.splice(pick, 1)[0];
        walked++;
        dir = step - cur;
        next = step;
      }
      loops.push(loop.map((v) => [v % V, (v - (v % V)) / V]));
    }
  }
  if (walked !== edges) {
    throw new Error(`boundary walk covered ${walked} of ${edges} edges`);
  }
  return loops;
}

/** Douglas-Peucker on an OPEN polyline. Squared distances throughout, compared
 *  against a squared tolerance, so there is no square root and nothing here can
 *  disagree with itself about a borderline point. */
function douglasPeucker(
  pts: number[][],
  tol2: number,
  out: number[][],
): void {
  const n = pts.length;
  if (n < 3) {
    for (const p of pts) out.push(p);
    return;
  }
  const [ax, ay] = pts[0];
  const [bx, by] = pts[n - 1];
  const ex = bx - ax;
  const ey = by - ay;
  const len2 = ex * ex + ey * ey;
  let worst = -1;
  let at = -1;
  for (let i = 1; i < n - 1; i++) {
    const px = pts[i][0];
    const py = pts[i][1];
    let d2: number;
    if (len2 === 0) {
      const qx = px - ax;
      const qy = py - ay;
      d2 = qx * qx + qy * qy;
    } else {
      const cross = (px - ax) * ey - (py - ay) * ex;
      d2 = (cross * cross) / len2;
    }
    if (d2 > worst) {
      worst = d2;
      at = i;
    }
  }
  if (worst > tol2) {
    douglasPeucker(pts.slice(0, at + 1), tol2, out);
    out.pop();
    douglasPeucker(pts.slice(at), tol2, out);
  } else {
    out.push(pts[0], pts[n - 1]);
  }
}

/** Douglas-Peucker on a CLOSED ring, which the open form cannot do directly: it
 *  pins its two endpoints, and a ring has none. Rotated to start at its
 *  lexicographically smallest corner (always an extreme point, so always a real
 *  corner and never one the simplifier wanted to remove), then split at the
 *  point farthest from it, so the two pinned points are the ring's own diameter
 *  rather than an arbitrary pair. */
function simplifyRing(ring: number[][], tol2: number): number[][] {
  const pts = ring.slice(0, -1); // the walk repeats its first point at the end
  let s = 0;
  for (let i = 1; i < pts.length; i++) {
    if (
      pts[i][1] < pts[s][1] ||
      (pts[i][1] === pts[s][1] && pts[i][0] < pts[s][0])
    ) {
      s = i;
    }
  }
  const rot = pts.slice(s).concat(pts.slice(0, s));
  let far = 0;
  let fd = -1;
  for (let i = 1; i < rot.length; i++) {
    const qx = rot[i][0] - rot[0][0];
    const qy = rot[i][1] - rot[0][1];
    const d = qx * qx + qy * qy;
    if (d > fd) {
      fd = d;
      far = i;
    }
  }
  const head: number[][] = [];
  const tail: number[][] = [];
  douglasPeucker(rot.slice(0, far + 1), tol2, head);
  douglasPeucker(rot.slice(far).concat([rot[0]]), tol2, tail);
  return head.concat(tail.slice(1, -1));
}

/** Twice the signed area of a closed ring, by the shoelace formula. */
function shoelace2(pts: number[][]): number {
  let sum = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % n];
    sum += x0 * y1 - x1 * y0;
  }
  return sum;
}

/** Twice the signed area of a FLAT ring (`x, y, x, y, ...`). */
function shoelace2Flat(r: Ring): number {
  let sum = 0;
  for (let i = 0, n = r.length; i < n; i += 2) {
    const x0 = r[i];
    const y0 = r[i + 1];
    const x1 = r[(i + 2) % n];
    const y1 = r[(i + 3) % n];
    sum += x0 * y1 - x1 * y0;
  }
  return sum;
}

/**
 * One part's top-down outline: mesh in, closed rings in per-mille of its own
 * bounding box out. Outer boundary first is not promised and is not needed --
 * the drawing code fills by EVEN-ODD, under which a ring inside a ring is a
 * hole whichever way round either is wound.
 */
function outlineOf(mesh: Mesh, box: Box): Ring[] {
  const cols = Math.max(1, Math.round(box.dx / OUTLINE_CELL_MM));
  const rows = Math.max(1, Math.round(box.dy / OUTLINE_CELL_MM));
  const grid = shadowRaster(mesh, box.x0, box.y0, box.dx, box.dy, cols, rows);
  const tol2 = (OUTLINE_SIMPLIFY_MM / OUTLINE_CELL_MM) ** 2;
  // A cell is dx/cols by dy/rows mm, so a ring's area in cells converts to mm^2
  // by one multiplication -- the grid spans the box exactly, which is the whole
  // reason `cols`/`rows` are rounded rather than the cell size being fixed.
  const cellMm2 = (box.dx / cols) * (box.dy / rows);

  const rings: Ring[] = [];
  for (const loop of traceRings(grid, cols, rows)) {
    const simple = simplifyRing(loop, tol2);
    if (simple.length < 3) continue;
    if ((Math.abs(shoelace2(simple)) / 2) * cellMm2 < OUTLINE_MIN_RING_MM2) {
      continue;
    }
    const flat: Ring = [];
    let lastX = -1;
    let lastY = -1;
    for (const [cx, cy] of simple) {
      const u = Math.round((cx / cols) * OUTLINE_SCALE);
      const v = Math.round((cy / rows) * OUTLINE_SCALE);
      // Quantising can fold two corners onto one point. A repeated point is a
      // zero-length edge, which contributes nothing to a scanline fill but does
      // cost bytes in every copy of this table.
      if (u === lastX && v === lastY) continue;
      flat.push(u, v);
      lastX = u;
      lastY = v;
    }
    if (flat.length >= 6) rings.push(flat);
  }
  return rings;
}

/**
 * Measure one part's bounding box, asserting the source is shaped the way the
 * whole feature assumes.
 *
 * The assertions are not defensive noise. The 3MF writer lifts THE single
 * `<object>` out of each source and emits its own `<item>` transform, so a
 * source carrying two objects would have one silently dropped, and a source
 * carrying a transform of its own would be MEASURED in one frame and PLACED in
 * another -- a part off the bed, or overlapping a neighbour, with nothing in the
 * output naming the cause.
 */
async function measure(file: string): Promise<{ box: Box; mesh: Mesh }> {
  const zip = await JSZip.loadAsync(readFileSync(join(MESHES, file)));
  const entry = zip.file("3D/3dmodel.model");
  if (!entry) throw new Error(`${file}: no 3D/3dmodel.model, not a 3MF package`);
  const model = await entry.async("string");

  const objects = (model.match(/<object /g) ?? []).length;
  if (objects !== 1) throw new Error(`${file}: ${objects} objects, expected 1`);

  const items = model.match(/<item\b[^>]*>/g) ?? [];
  if (items.length !== 1) {
    throw new Error(`${file}: ${items.length} build items, expected 1`);
  }
  if (!items[0].includes('transform="1 0 0 0 1 0 0 0 1 0 0 0"')) {
    throw new Error(`${file}: build item is not an identity transform: ${items[0]}`);
  }

  let x0 = Infinity;
  let y0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  let z1 = -Infinity;
  let read = 0;
  let z0Text = "";
  // The X and Y of every vertex are kept, not just swept, because the OUTLINE
  // needs the mesh itself and re-reading a 20 MB tree a second time to get it
  // would be the same parse done twice.
  const vxs: number[] = [];
  const vys: number[] = [];
  const re = /<vertex x="([-+\d.eE]+)" y="([-+\d.eE]+)" z="([-+\d.eE]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(model))) {
    read++;
    const x = +m[1];
    const y = +m[2];
    const z = +m[3];
    vxs.push(x);
    vys.push(y);
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
    if (z < z0) {
      z0 = z;
      // The SOURCE TEXT of the same vertex, kept beside the number it parsed to.
      // Taken here rather than reconstructed afterwards: `String(z0)` would be
      // this script's own spelling of the double, which is precisely the thing
      // the cross-check in `main` is trying not to trust.
      z0Text = m[3];
    }
    if (z > z1) z1 = z;
  }

  // Count the tags, then insist we read every one. A regex that matches SOME of
  // the vertices is the dangerous failure here: it yields a box that is merely
  // too small, which looks entirely plausible in the committed table and packs
  // parts into each other. An exporter writing the attributes in another order,
  // or on separate lines, would do exactly that.
  const declared = (model.match(/<vertex /g) ?? []).length;
  if (declared === 0) throw new Error(`${file}: no vertices found`);
  if (read !== declared) {
    throw new Error(
      `${file}: read ${read} of ${declared} vertices, so the vertex spelling changed`,
    );
  }

  // The triangles, and the SAME count-the-tags-then-read-them-all argument one
  // level up. A regex that catches only some of them yields a silhouette that is
  // merely full of holes -- a perfectly plausible-looking outline for a part
  // that has none.
  const tri: number[] = [];
  const tre = /<triangle v1="(\d+)" v2="(\d+)" v3="(\d+)"/g;
  while ((m = tre.exec(model))) tri.push(+m[1], +m[2], +m[3]);
  const declaredTris = (model.match(/<triangle /g) ?? []).length;
  if (declaredTris === 0) throw new Error(`${file}: no triangles found`);
  if (tri.length / 3 !== declaredTris) {
    throw new Error(
      `${file}: read ${tri.length / 3} of ${declaredTris} triangles, so the ` +
        `triangle spelling changed`,
    );
  }
  for (const v of tri) {
    if (v >= read) {
      throw new Error(
        `${file}: a triangle references vertex ${v}, past the ${read} declared`,
      );
    }
  }

  // FULL DOUBLE PRECISION, deliberately, and this is the load-bearing line of
  // the file.
  //
  // These numbers were rounded to 3 dp until 2026-08-15. `z0` is the value the
  // 3MF writer negates to seat a part on the bed, so rounding it does not
  // "tidy" anything -- it MOVES the part. `Hex-TB-Spike-Ball-Joint`'s mesh
  // bottom is 0.144338 mm above its own origin (the upstream exporter's
  // drop-to-bed used a slightly enlarged OCC bounding box for it), so a stored
  // 0.144 left it floating 0.000338 mm while every other object on the plate sat
  // at 0. Creality Print reads one object at a different height as a different
  // OBJECT and offers to fuse the whole plate into a single multi-part body --
  // which destroys the named-parts list that is the entire reason this feature
  // ships 3MF instead of STL. Nothing about that dialog points back at a
  // committed data file.
  //
  // `x0`/`y0` for the same reason one step weaker: they set where a part lands
  // on the bed, so a 3 dp round quantised every plate's edge margin by up to
  // 0.0005 mm (`Hex-TB-Main` measures -43.8786 and was stored as -43.879). No
  // slicer notices that, but it is the same mistake and there is no reason to
  // keep it.
  //
  // The sizes go the same way for consistency: a box whose corner is exact and
  // whose size is rounded describes a maximum corner that is neither.
  //
  // COSTS NOTHING TO CARRY. Every coordinate in the source 3MF is about
  // 6-significant-figure text, so the doubles here are short -- the longest
  // number the table emits is 18 characters.
  return {
    box: { x0, y0, z0, dx: x1 - x0, dy: y1 - y0, dz: z1 - z0, z0Text },
    mesh: {
      vx: Float64Array.from(vxs),
      vy: Float64Array.from(vys),
      tri: Int32Array.from(tri),
    },
  };
}

// Wrapped in a function rather than run at the top level: this repo's package
// is CommonJS, so tsx compiles a `.ts` script to CJS and a top-level `await`
// fails to transform at all.
async function main(): Promise<void> {
  const files = readdirSync(MESHES)
    .filter((f) => f.toLowerCase().endsWith(".3mf"))
    .sort();
  if (files.length === 0) throw new Error(`no .3mf files under ${MESHES}`);

  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8")) as {
    parts: ManifestPart[];
  };
  const byPart = new Map(manifest.parts.map((p) => [p.part, p]));

  const rows: {
    slug: string;
    name: string;
    box: Box;
    family: HexPartFamily;
    rings: Ring[];
  }[] = [];
  const bySlug = new Map<string, string>();
  const disagreements: string[] = [];

  for (const file of files) {
    const name = file.replace(/\.3mf$/i, "");
    const slug = slugOf(file);

    // Two filenames folding onto one slug would put one part in the table and
    // drop the other with no other trace -- the table would simply be short, and
    // the guard test would blame the wrong thing.
    const seen = bySlug.get(slug);
    if (seen) throw new Error(`${file} and ${seen} both slugify to "${slug}"`);
    bySlug.set(slug, file);

    const { box, mesh } = await measure(file);

    // THE SEAT GATE, and it is the reason nothing rounds in `measure` any more.
    //
    // `z0` is what the 3MF writer negates to drop a part onto the bed, so the
    // whole feature rests on it being the mesh's real minimum rather than a
    // tidied version of it. Held to the SOURCE TEXT of the same vertex, which no
    // arithmetic in this file touches: reintroduce a rounding anywhere in the
    // numeric path and `0.144` stops equalling `Number("0.144338")` here, at
    // generation time, before a wrong table can be committed.
    //
    // It fires on a REAL past defect rather than a hypothetical one. Stored as
    // 0.144, `Hex-TB-Spike-Ball-Joint` seated 3.38e-4 mm above a bed every other
    // object on the plate sat exactly on, and Creality Print answered by offering
    // to fuse fifteen named parts into one multi-part body. The only symptom was
    // a dialog in someone else's slicer.
    if (Number(box.z0Text) !== box.z0) {
      throw new Error(
        `${file}: the mesh's lowest vertex reads z="${box.z0Text}" but the table ` +
          `would record ${box.z0}. Something in this script is rounding a ` +
          `measurement, and a part that does not seat at exactly zero is what ` +
          `makes a slicer treat a plate as one multi-part object.\n\n` +
          `Nothing was written.`,
      );
    }

    // The cross-check is part of the contract, not a nicety: a table derived
    // from one source, checked against nothing, agrees with itself forever. A
    // mesh with no manifest entry cannot be cross-checked at all, so it is
    // refused rather than emitted unverified.
    const mf = byPart.get(name);
    if (!mf) throw new Error(`${file}: no "${name}" entry in ${MANIFEST}`);
    const axes: [string, number, number][] = [
      ["dx", box.dx, mf.printBboxMm.x],
      ["dy", box.dy, mf.printBboxMm.y],
      ["dz", box.dz, mf.printBboxMm.z],
    ];
    for (const [axis, mine, theirs] of axes) {
      const delta = Math.abs(mine - theirs);
      if (delta > TOLERANCE_MM) {
        disagreements.push(
          `${name} ${axis}: mesh ${mine} vs manifest ${theirs} (off by ${brief(delta)} mm)`,
        );
      }
    }
    byPart.delete(name);

    // The OUTLINE, and the three guards that make it checkable rather than
    // merely plausible. Each catches a different way the projection can be
    // wrong while still producing a shape:
    //
    //   EXTENT   A solid's shadow is exactly as wide and as deep as the solid,
    //            so the rings must reach all four sides of the box. Projecting
    //            in the wrong plane, or dropping a whole face group, leaves a
    //            shape that fits comfortably inside its footprint -- and looks
    //            fine until you notice every part is drawn slightly small.
    //   FILL     A shape can touch all four sides and still be a cross or two
    //            slivers. This is the answer to "did the winding rule work".
    //   BUDGET   A simplifier that stops simplifying is silent: the outline is
    //            RIGHT, and twenty times bigger and slower than it should be.
    const rings = outlineOf(mesh, box);
    if (rings.length === 0) {
      throw new Error(`${file}: the projection produced no outline at all`);
    }
    let uMin = OUTLINE_SCALE;
    let uMax = 0;
    let vMin = OUTLINE_SCALE;
    let vMax = 0;
    let points = 0;
    let area2 = 0;
    for (const ring of rings) {
      points += ring.length / 2;
      // Signed, and summed across rings on purpose: a hole is wound the other
      // way by the tracer, so it SUBTRACTS. That is what makes the fill check
      // read the drawn area rather than the outer boundary's.
      area2 += shoelace2Flat(ring);
      for (let i = 0; i < ring.length; i += 2) {
        if (ring[i] < uMin) uMin = ring[i];
        if (ring[i] > uMax) uMax = ring[i];
        if (ring[i + 1] < vMin) vMin = ring[i + 1];
        if (ring[i + 1] > vMax) vMax = ring[i + 1];
      }
    }
    const short = OUTLINE_SCALE - OUTLINE_EXTENT_SLACK;
    if (
      uMin > OUTLINE_EXTENT_SLACK ||
      vMin > OUTLINE_EXTENT_SLACK ||
      uMax < short ||
      vMax < short
    ) {
      throw new Error(
        `${file}: the outline spans ${uMin}..${uMax} x ${vMin}..${vMax} of ` +
          `0..${OUTLINE_SCALE}, so it does not fill its own bounding box. A ` +
          `silhouette is exactly as big as the part that casts it.\n\n` +
          `Nothing was written.`,
      );
    }
    const fill = Math.abs(area2) / 2 / (OUTLINE_SCALE * OUTLINE_SCALE);
    if (fill < OUTLINE_MIN_FILL || fill > OUTLINE_MAX_FILL) {
      throw new Error(
        `${file}: the outline covers ${(100 * fill).toFixed(1)}% of its ` +
          `bounding box, outside ${100 * OUTLINE_MIN_FILL}..` +
          `${100 * OUTLINE_MAX_FILL}%. Either the winding rule collapsed or the ` +
          `rings are inside out.\n\nNothing was written.`,
      );
    }
    if (points > OUTLINE_MAX_POINTS) {
      throw new Error(
        `${file}: the outline needs ${points} points, over the ` +
          `${OUTLINE_MAX_POINTS} budget. The simplifier has stopped ` +
          `simplifying.\n\nNothing was written.`,
      );
    }

    // The BASENAME travels with the box, and this is the only place it can be
    // picked up: the slug is a lossy projection of it (`Hex-TB-Main` and
    // `hex_tb_main` both land on `hex-tb-main`), so nothing downstream can
    // recover the published spelling once this loop has thrown it away. It is
    // what a slicer shows in its object list, and carrying it is the whole
    // argument for 3MF over STL.
    //
    // The FAMILY is picked up here for the same reason -- it is read off the
    // filename, which nothing downstream still has.
    rows.push({ slug, name, box, family: familyOf(name), rings });
  }

  // EVERY FAMILY MUST BE OCCUPIED. `familyOf` already refuses a part it does not
  // recognise, which stops a part falling into no band; this stops the opposite
  // and quieter fault -- a rule edited so that it shadows another, folding six
  // bands into five and repainting a whole class of parts with no error
  // anywhere. Both directions, because neither check sees the other's.
  const counts = new Map<string, number>(HEX_PART_FAMILIES.map((f) => [f, 0]));
  for (const r of rows) counts.set(r.family, (counts.get(r.family) ?? 0) + 1);
  const empty = [...counts].filter(([, n]) => n === 0).map(([f]) => f);
  if (empty.length > 0) {
    throw new Error(
      `no part was classified as: ${empty.join(", ")}. A family rule is ` +
        `shadowing another one.\n\nNothing was written.`,
    );
  }

  // A manifest part with no mesh means the two halves of the release disagree
  // about what it contains, the same class of fault as a size mismatch.
  if (byPart.size > 0) {
    throw new Error(
      `${MANIFEST} lists parts with no .3mf: ${[...byPart.keys()].join(", ")}`,
    );
  }

  // REPORTED, never reconciled. A disagreement means one of the two is measuring
  // something other than what we think, and picking a winner here would bury
  // exactly the question that needs answering -- so nothing is written at all.
  if (disagreements.length > 0) {
    throw new Error(
      `manifest cross-check FAILED for ${disagreements.length} value(s):\n` +
        disagreements.map((d) => `  ${d}`).join("\n") +
        "\n\nNothing was written. One of the mesh set and the manifest is measuring\n" +
        "something other than what we think; find out which before regenerating.",
    );
  }

  // Sorted by SLUG rather than by filename, so the table reads in the same order
  // as HEX_PART_SLUGS and the two can be diffed against each other by eye.
  rows.sort((a, b) => a.slug.localeCompare(b.slug));

  const body = rows
    .map(
      ({ slug, box }) =>
        `  "${slug}": { x0: ${box.x0}, y0: ${box.y0}, z0: ${box.z0}, ` +
        `dx: ${box.dx}, dy: ${box.dy}, dz: ${box.dz} },`,
    )
    .join("\n");

  // `JSON.stringify` rather than `"${name}"`, because this is the one value here
  // that is not already constrained to a safe alphabet. A slug is `[a-z0-9.-]`
  // by construction; a display name is whatever the exporter called the file, so
  // a quote or a backslash in one would emit a TypeScript file that does not
  // parse -- or, worse, one that parses as something else.
  const names = rows
    .map(({ slug, name }) => `  "${slug}": ${JSON.stringify(name)},`)
    .join("\n");

  // `JSON.stringify` for the same reason as the names: this is text lifted out
  // of an XML attribute, not a number this script formatted.
  const bottoms = rows
    .map(({ slug, box }) => `  "${slug}": ${JSON.stringify(box.z0Text)},`)
    .join("\n");

  writeFileSync(
    OUT,
    `// GENERATED by scripts/gen-hex-geometry.ts. Do not edit by hand.
//
// Axis-aligned bounding box of every published part, in the PRINT orientation
// the mesh ships in: the minimum corner and the size, in millimetres. The packer
// needs both -- the size to place, the minimum corner to turn a target position
// into the translation that gets it there. \`z0\` is not always zero (one part's
// mesh rests 0.144338 mm above its own origin), which is why the 3MF writer
// translates by \`-z0\` instead of assuming a part is already seated.
//
// NOT ROUNDED, and that is a fix rather than an accident. Every value here is
// the FULL double the mesh text parsed to. The writer seats a part by emitting
// \`-z0\`, so a rounded \`z0\` does not tidy the table -- it leaves that one part
// hanging above the bed while its neighbours sit on it, and Creality Print reads
// a plate with one object at a different height as a multi-part body it offers
// to fuse. Sixteen of the 53 parts have a non-zero \`z0\`; fifteen of those are
// the exporter's own float noise (1e-19 to 2e-12 mm) and one, the spike ball
// joint, is real. Long decimals below are that precision, not damage.
//
// REGENERATE THIS IN THE SAME COMMIT that re-cuts the meshes and bumps
// HEX_RELEASE and HEX_PART_SLUGS:
//
//   pnpm tsx scripts/gen-hex-geometry.ts
//
// A stale table packs against sizes the meshes no longer have. The symptom is
// parts overlapping on a plate in someone else's slicer, and nothing about that
// points back at a committed data file -- so the rule is gated rather than
// trusted: \`__tests__/hex-geometry.test.ts\` holds this table to HEX_PART_SLUGS
// and the stamp below to HEX_RELEASE.
//
// Every size here was cross-checked at generation time against \`printBboxMm\` in
// the hex-cluster manifest, which is the same geometry taken from the FreeCAD
// solid rather than from the mesh. A table that agrees with itself and with
// nothing else cannot get committed.
//
// The second table is the published SPELLING of each part, which the 3MF writer
// puts on the \`<object>\` so a slicer's object list reads \`Hex-TB-Main\` rather
// than \`hex-tb-main\`. It is recoverable at generation time and nowhere else.
//
// The third is the verbatim source text of each part's lowest vertex, kept so
// the seat can be tested against what the MESH says rather than against what
// this table believes. Nothing in the app reads it; the test suite does.
import type { PartBox } from "@/lib/hex-plate";

/** The mesh release these boxes were measured from.
 *
 *  Pinned to HEX_RELEASE by the guard test. It catches the half of staleness
 *  this file cannot notice on its own: a release bumped without the generator
 *  being re-run leaves every number here describing the previous cut. */
export const HEX_GEOMETRY_RELEASE = "${HEX_RELEASE}";

export const HEX_PART_BOX: Record<string, PartBox> = {
${body}
};

/** The PUBLISHED spelling of each part -- what a slicer shows in its object list
 *  once a plate is opened.
 *
 *  Kept here because this is the only place it survives. The slug is a LOSSY
 *  projection of the filename (lowercased, with everything outside
 *  \`[a-z0-9.-]\` collapsed to a hyphen), so \`hex-tb-main\` cannot be turned back
 *  into \`Hex-TB-Main\` by any rule -- only looked up. Measured against the
 *  known-good reference plate: all 15 names survive a Creality Print round trip,
 *  and carrying them is the whole argument for 3MF over STL.
 *
 *  A SEPARATE table rather than a field on the box, because \`PartBox\` is the
 *  geometry the packer needs and a name is not geometry. Sharing a row would not
 *  protect the pairing anyway -- a wrong name in the right row is still a wrong
 *  name. What protects it is the guard test that runs every name back through
 *  the R2 uploader's own \`slug()\` and insists it lands on its own key. */
export const HEX_PART_NAME: Record<string, string> = {
${names}
};

/** The VERBATIM \`z\` attribute of each part's LOWEST VERTEX, as the published
 *  mesh spells it.
 *
 *  A SECOND TRANSCRIPTION of the fact \`z0\` records, and the redundancy is the
 *  whole point. \`z0\` is this text parsed into a double by a script that used to
 *  round it; this is the text, which no arithmetic can reach. The generator
 *  refuses to write the pair if they disagree, and \`__tests__/hex-3mf.test.ts\`
 *  builds a plate whose lowest vertex is THIS string and insists every part
 *  lands at exactly z = 0 -- so the seat is checked against what the mesh says
 *  rather than against what the table believes. Without it that test would be
 *  circular: a table that quantised a part's floor would produce a fixture at
 *  the same wrong height and seat perfectly against itself, which is precisely
 *  how the real defect would have passed.
 *
 *  TEXT and not a number, because a number here would be this script's spelling
 *  of the double and the spelling is what is under test. The exponential forms
 *  (\`8.13152e-19\`) are the exporter's, not ours.
 *
 *  Nothing in the app reads this. The test suite does. */
export const HEX_PART_MESH_BOTTOM: Record<string, string> = {
${bottoms}
};
`,
  );

  // ---------------------------------------------------------------------
  // The second file. Written from the SAME pass over the SAME directory, so
  // the two tables cannot describe different mesh sets -- which is the whole
  // reason this is one script writing two files rather than two scripts.
  // ---------------------------------------------------------------------
  const families = rows
    .map(({ slug, family }) => `  "${slug}": "${family}",`)
    .join("\n");

  const outlines = rows
    .map(
      ({ slug, rings }) =>
        `  "${slug}": [${rings.map((r) => `[${r.join(",")}]`).join(", ")}],`,
    )
    .join("\n");

  writeFileSync(
    OUT_OUTLINES,
    `// GENERATED by scripts/gen-hex-geometry.ts. Do not edit by hand.
//
// What each published part LOOKS LIKE from above, and what CLASS of part it is.
// Both exist for one reader: the 3MF package thumbnail (\`src/lib/hex-thumbnail.ts\`),
// which used to draw every part as its bounding box and therefore drew a hex
// tile, a carrier tray and a dovetail cap as three rectangles differing only in
// aspect ratio.
//
// A SEPARATE FILE FROM \`hex-geometry.ts\`, deliberately. That table is MIRRORED
// by the configurator (\`bs-cap-hex/src/hex/hex-geometry.ts\`) and compared against
// this repo's copy by a test over there, so every field it carries is a field
// that repo has to carry too. None of this is geometry the packer needs, so
// putting it in the same object would make a second repo track a table it does
// not read, and trip its drift guard on a change that cannot affect it.
//
// THE OUTLINE IS A TRUE SILHOUETTE, not a convex hull. The hull of a carrier
// tray and the hull of a solid hex tile are the same hexagon; the silhouette
// keeps the dovetail notches cut INTO a tile and the dovetail tabs standing OUT
// of a tray, which is the difference you can actually see at 256 px. It is the
// union of the up-facing triangles projected to XY -- exactly the part's
// vertical shadow -- traced off a 0.1 mm raster and simplified to 0.35 mm, which
// is sub-pixel at every bed size the endpoint accepts (the most magnified is a
// 100 mm bed at 2.44 px/mm).
//
// WHAT A SHADOW LOSES, stated plainly because it is not recoverable from the
// data: depth. A pocket that does not go all the way through casts no shadow, so
// a tray reads as solid inside its own rim, and the 1H/2H/3H variants of a half
// tile are drawn identically because their holes are blind. Through-holes DO
// survive -- the dovetail caps' fastener holes are real rings below.
//
// Coordinates are integers 0..${OUTLINE_SCALE}: PER-MILLE of the part's own bounding box on
// each axis, with y measured from the box's MINIMUM corner the same way
// \`PartBox\` is. So the drawing code needs no millimetres -- it already knows
// where the footprint landed and how big it is. Rings are closed implicitly (the
// last point joins the first) and are filled EVEN-ODD, under which a ring inside
// a ring is a hole however either is wound.
//
// REGENERATE THIS IN THE SAME COMMIT that re-cuts the meshes and bumps
// HEX_RELEASE and HEX_PART_SLUGS -- it comes out of the same command as
// \`hex-geometry.ts\`:
//
//   pnpm tsx scripts/gen-hex-geometry.ts
//
// Every outline here was checked at generation time against three things it
// could not satisfy by accident: that it reaches all four sides of its own
// bounding box, that it covers a believable share of it, and that it costs fewer
// than ${OUTLINE_MAX_POINTS} points. \`__tests__/hex-outlines.test.ts\` holds the tables to
// HEX_PART_SLUGS and the stamp below to HEX_RELEASE.
import type { HexPartFamily } from "@/lib/hex-parts";

/** The mesh release these outlines were traced from. Pinned to HEX_RELEASE by
 *  the guard test, for the same reason HEX_GEOMETRY_RELEASE is: a release bumped
 *  without the generator being re-run leaves every shape here describing the
 *  previous cut. */
export const HEX_OUTLINE_RELEASE = "${HEX_RELEASE}";

/** Outline coordinates run 0..this, on both axes, across the part's own bounding
 *  box. Exported so the drawing code divides by the number the generator
 *  multiplied by, rather than by its own copy of it. */
export const HEX_OUTLINE_SCALE = ${OUTLINE_SCALE};

/** What class of part each slug is. See \`HexPartFamily\` for the vocabulary and
 *  \`familyOf()\` in the generator for the rules -- which have NO catch-all, so a
 *  part this table does not name is a part the generator refused to write. */
export const HEX_PART_FAMILY: Record<string, HexPartFamily> = {
${families}
};

/** Each part's top-down outline, as closed rings of \`x, y, x, y, ...\` integers
 *  in 0..HEX_OUTLINE_SCALE.
 *
 *  FLAT NUMBERS rather than points, because the fill loop walks them in pairs
 *  and an array of two-element arrays would be ${OUTLINE_SCALE} small objects the garbage
 *  collector has to care about, per request, for no gain in readability at this
 *  density. */
export const HEX_PART_OUTLINE: Record<string, readonly (readonly number[])[]> = {
${outlines}
};
`,
  );

  console.log(`wrote ${rows.length} parts to ${OUT}`);
  console.log(
    `manifest cross-check: ${rows.length} parts x 3 axes agree within ${TOLERANCE_MM} mm`,
  );
  const totalRings = rows.reduce((n, r) => n + r.rings.length, 0);
  const totalPoints = rows.reduce(
    (n, r) => n + r.rings.reduce((k, ring) => k + ring.length / 2, 0),
    0,
  );
  console.log(
    `wrote ${totalRings} rings / ${totalPoints} points to ${OUT_OUTLINES}`,
  );
  console.log(
    `families: ${[...counts].map(([f, n]) => `${f} ${n}`).join(", ")}`,
  );
}

main().catch((err: unknown) => {
  // The failures above are all deliberate, message-carrying ones, and the
  // message IS the finding -- printing a stack over it would bury the sentence
  // that says which part disagreed and by how much.
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
