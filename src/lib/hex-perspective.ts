// Three-point perspective for the honeycomb grids — the build-guide hub
// (GuideHoneycomb), the /courses skill tree (SkillHoneycomb) and the go-further comb
// (PathHoneycomb), all three of which share one measured layout and one prism shell.
//
// Pure geometry: no React, no DOM, no DB, so it unit-tests in the fast project. The
// components own the markup; this file owns the numbers.
//
// WHY THREE-POINT. The lesson ribbon (PhaseComb) uses ONE-point: its hex faces stay
// parallel to the picture plane, so nothing foreshortens. That does not carry to a
// grid. On a tessellated comb a vanishing point inside the grid aims every prism's
// depth straight into the neighbour that occludes it, so the projection is invisible
// everywhere except the comb's outer silhouette (sandbox round 1, options H1 vs H2).
// Turning the whole comb as one rigid plane fixes that: rows converge on one
// vanishing point, columns on a second, prism depth on a third, and every cell shows
// its geometry. The cost is that faces foreshorten, so cell labels are billboarded —
// laid upright over each face and scaled to it. A turned face cannot carry upright
// HTML, so that is the family's price, not an implementation shortcut.
//
// THE HORIZON. The projection origin sits on the CENTRAL ROW: the middle row's centre
// line when the row count is odd, the midpoint between the middle pair when it is
// even, that row when there is only one. It is derived from the measured rows on
// every layout pass rather than from the bounding box, because the comb reflows 3-up
// to 2-up and the row count changes underneath it.
//
// SCALE INVARIANCE. Focal length, camera distance and prism depth are all expressed
// as multiples of the measured cell width, so the comb projects identically at 360px
// and at 1100px. A fixed pixel focal length would make the phone layout look like a
// different camera.

/** One measured cell, as `computeLayout` returns it. */
export interface HexBox {
  left: number;
  top: number;
  w: number;
  h: number;
}

export type Pt = [number, number];

export interface HexCam {
  /** rotation about the vertical axis, radians. Gives the row axis its vanishing
   *  point. POSITIVE sends the LEFT end of the comb away and brings the right end
   *  forward (a positive x maps to a negative depth). Verified by test, because the
   *  sign is easy to reason backwards about and it decides which end of a comb gets
   *  the visual weight. */
  yaw: number;
  /** rotation about the horizontal axis, radians. The one that makes verticals
   *  converge, and therefore the one that makes this three-point rather than two. */
  pitch: number;
  /** focal length, in cell widths. */
  f: number;
  /** camera distance to the comb's plane, in cell widths. */
  dist: number;
  /** prism depth along the plane normal, in cell widths. */
  depth: number;
  /**
   * Lean the prism's extrusion axis sideways instead of running it straight back.
   *
   * This is what makes a near-head-on comb show any depth at all. Extruded along the
   * plane normal, a prism under a near-head-on camera points at the viewer and shows
   * no walls — the slab is geometrically there and invisible, which is exactly why a
   * gentle three-point comb looked flat. The live comb dodges that by not being a
   * projection: its cast is a fixed down-right OFFSET, so the slab is always visible
   * from the side.
   *
   * Setting a skew keeps that trick and adds the thing the offset cannot do. The cast
   * direction becomes `(x, y, 1)`, so it leans across the face the way the original
   * does, and because it is a real direction in the scene, perspective converges it:
   * every cast points at a vanishing point of its own at `f · (x, y)`. Parallel casts
   * become converging ones without the comb having to turn.
   *
   * Values are in units of the prism depth: `[0.9, 0.9]` casts down-right at roughly
   * 45 degrees, matching the shipped comb's direction.
   */
  castSkew?: [number, number];
}

/**
 * The camera the owner picked (sandbox "S5", 2026-07-20). THIS is the comb.
 *
 * The orthogonal comb that ships, with its parallel cast turned into a converging one.
 * The hexes stay flat, tessellating, upright and all but identical in size — the
 * spread between the largest and smallest cell is a few percent — so nothing is
 * foreshortened enough to distort a label or a hit target. What changes is that the
 * slabs no longer all lean the same way: they aim at a common vanishing point below
 * and to the right, so the comb reads as a sheet of prisms sitting in space instead of
 * a pattern printed on the page.
 *
 * The cast is SKEWED rather than run along the plane normal, and that is load-bearing
 * rather than stylistic. Under a near-head-on camera an along-the-normal prism points
 * at the viewer and shows no walls at all, which is why gentler versions of this
 * rendered flat no matter how the angles were pushed. Skewing the axis keeps the
 * shipped comb's visible down-right lean and makes it a real direction in the scene,
 * which is what lets perspective converge it.
 *
 * The short focal length is what sets the strength of that convergence. The yaw and
 * pitch are deliberately tiny and mostly serve to keep the vanishing point low-right;
 * a POSITIVE pitch would throw the casts up-left, which is the same geometry wearing
 * the wrong face.
 */
export const HEX_CAM_S5: HexCam = {
  yaw: (3 * Math.PI) / 180,
  pitch: (-2 * Math.PI) / 180,
  f: 2.8,
  dist: 2.8,
  depth: 0.09,
  castSkew: [0.95, 0.95],
};

/** Pointy-top hex corners in a unit cell (0..1 on both axes), matching HEX_POINTS in
 *  GuideHoneycomb: the shell and the projection are cut from one set of numbers. */
export const HEX_UNIT_CORNERS: Pt[] = [
  [0.5, 0],
  [1, 0.25],
  [1, 0.75],
  [0.5, 1],
  [0, 0.75],
  [0, 0.25],
];

/**
 * The horizon line: the central row of a measured layout.
 *
 * Odd row count gives the middle row's centre; even gives the midpoint between the
 * middle pair; one row gives that row. Rows are identified by their `top`, rounded,
 * because a snaking layout puts every cell in a row at the same top.
 */
export function centralRowY(boxes: HexBox[]): number {
  if (boxes.length === 0) return 0;
  const h = boxes[0]!.h;
  // Group by a rounded top so sub-pixel drift cannot split one row into two, but
  // take the centre from the REAL top: rounding the value you return moves the
  // horizon by up to half a pixel, and the horizon is what everything else is
  // measured from.
  const rows = new Map<number, number>();
  for (const b of boxes) if (!rows.has(Math.round(b.top))) rows.set(Math.round(b.top), b.top);
  const centres = [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, t]) => t + h / 2);
  const n = centres.length;
  return n % 2 === 1
    ? centres[(n - 1) / 2]!
    : (centres[n / 2 - 1]! + centres[n / 2]!) / 2;
}

export interface HexSolid {
  /** index into the caller's cell list. */
  i: number;
  /** the near face, projected, in scene units. */
  face: Pt[];
  /** the far face — the near face pushed one prism depth along the plane normal. */
  rear: Pt[];
  /** projected centre of the near face: where a billboarded label is anchored. */
  centre: Pt;
  /** projected width over measured width. Drives stroke weight. */
  scale: number;
  /** the scale a BILLBOARDED label may safely use. A foreshortened hex is a
   *  trapezoid, so no single factor fits it: scaling by the widest span pushes the
   *  title out over the narrow side. This is the tighter of the horizontal and
   *  vertical spans, so a centred label stays inside the face on both. */
  fit: number;
  /** depth after rotation. LOWER paints first: a nearer cell's prism must cover a
   *  farther cell's face, and once the plane is turned every cell has its own depth,
   *  so a whole-prism sort is correct here (unlike the one-point ribbon, where every
   *  hex shared a depth and slabs had to be layered under faces instead). */
  z: number;
}

function rotate(x: number, y: number, z: number, cam: HexCam): [number, number, number] {
  const cy = Math.cos(cam.yaw);
  const sy = Math.sin(cam.yaw);
  const X = x * cy + z * sy;
  let Z = -x * sy + z * cy;
  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);
  const Y = y * cp - Z * sp;
  Z = y * sp + Z * cp;
  return [X, Y, Z];
}

/** Project every cell of a measured layout. Scene units are pixels at the plane, so
 *  the result drops straight into an svg viewBox fitted with `sceneBox`. */
export function projectComb(boxes: HexBox[], cam: HexCam): HexSolid[] {
  if (boxes.length === 0) return [];
  // Unit of measure for the camera: the cell width. Everything below is expressed in
  // it, which is what keeps the projection identical at every layout width.
  const u = boxes[0]!.w;
  const f = cam.f * u;
  const dist = cam.dist * u;
  const depth = cam.depth * u;
  // The comb projects about its own horizontal centre and its CENTRAL ROW, so the
  // horizon runs through the middle of the run and the comb stays level.
  const originX = boxes.reduce((a, b) => a + b.left + b.w / 2, 0) / boxes.length;
  const originY = centralRowY(boxes);

  // A camera distance fixed in CELL widths is fine for a comb a few rows tall, but a
  // long one is deep enough that its far corners swing past the camera plane once the
  // plane is rotated — `dist + Z` goes to zero, the divide explodes, and the near
  // cells render enormous. So the distance is pushed out far enough to keep every
  // point comfortably in front of the lens. For short combs the tuned value still
  // dominates and the approved camera is untouched; it only takes over when the comb
  // is long enough to need it.
  let zMin = Infinity;
  let zMax = -Infinity;
  for (const b of boxes) {
    for (const [ux, uy] of HEX_UNIT_CORNERS) {
      for (const dz of [0, depth]) {
        const z = rotate(b.left + ux * b.w - originX, b.top + uy * b.h - originY, dz, cam)[2];
        if (z < zMin) zMin = z;
        if (z > zMax) zMax = z;
      }
    }
  }
  const span = zMax - zMin;
  const distEff = Math.max(dist, 0.75 * span - zMin);

  const project = (x: number, y: number, z: number): { p: Pt; z: number } => {
    const [X, Y, Z] = rotate(x - originX, y - originY, z, cam);
    const k = f / (distEff + Z);
    return { p: [X * k, Y * k], z: Z };
  };

  // The cast direction. Straight back by default; leaned across the face when a skew
  // is set, which is the only way a near-head-on comb shows a slab at all.
  const [skx, sky] = cam.castSkew ?? [0, 0];
  return boxes.map((b, i) => {
    const corners = (dz: number) =>
      HEX_UNIT_CORNERS.map(([ux, uy]) =>
        project(
          b.left + ux * b.w + skx * dz,
          b.top + uy * b.h + sky * dz,
          dz,
        ),
      );
    const face = corners(0);
    const rear = corners(depth);
    const centre = project(b.left + b.w / 2, b.top + b.h / 2, 0);
    // Across the hex's widest span (corner 5 to corner 1 sit on the same y), and
    // down its axis (corner 0 to corner 3).
    const w = Math.hypot(face[1]!.p[0] - face[5]!.p[0], face[1]!.p[1] - face[5]!.p[1]);
    const hgt = Math.hypot(face[3]!.p[0] - face[0]!.p[0], face[3]!.p[1] - face[0]!.p[1]);
    const scale = w / b.w;
    return {
      i,
      face: face.map((c) => c.p),
      rear: rear.map((c) => c.p),
      centre: centre.p,
      scale,
      fit: Math.min(scale, hgt / b.h),
      z: centre.z,
    };
  });
}

/** A viewBox that contains every projected point, with a little air. */
export function sceneBox(solids: HexSolid[], pad = 2) {
  if (solids.length === 0) return { x: 0, y: 0, w: 1, h: 1 };
  const pts = solids.flatMap((s) => [...s.face, ...s.rear]);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x = Math.min(...xs) - pad;
  const y = Math.min(...ys) - pad;
  return {
    x,
    y,
    w: Math.max(...xs) + pad - x,
    h: Math.max(...ys) + pad - y,
  };
}

/** Far to near — the order the prisms must paint in. */
export function paintOrder(solids: HexSolid[]): HexSolid[] {
  return [...solids].sort((a, b) => b.z - a.z);
}

/** The six side faces of one prism, each a near edge swept to its far counterpart.
 *  All six are emitted; the opaque near face covers whichever fall behind it, so the
 *  silhouette stays correct whichever way the cell is turned. */
export function prismSides(s: HexSolid): Pt[][] {
  return s.face.map((a, k) => [a, s.face[(k + 1) % 6]!, s.rear[(k + 1) % 6]!, s.rear[k]!]);
}

/** Scene units are pixels at the comb's plane, so an svg fitted to `sceneBox` and
 *  drawn at the container's width maps back with one scalar. Callers need it to park
 *  a billboarded label on a projected face. */
export const sceneUnit = (vb: { w: number }, containerW: number) => containerW / vb.w;

/** The height that svg will occupy once it is drawn at the container's width. */
export const sceneHeight = (vb: { w: number; h: number }, containerW: number) =>
  (containerW * vb.h) / vb.w;

/** A projected point, in container pixels. */
export function sceneToPx(
  vb: { x: number; y: number; w: number },
  containerW: number,
  p: Pt,
): { x: number; y: number } {
  const u = sceneUnit(vb, containerW);
  return { x: (p[0] - vb.x) * u, y: (p[1] - vb.y) * u };
}

export const svgPath = (pts: Pt[]) =>
  pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`).join(" ") + "Z";
