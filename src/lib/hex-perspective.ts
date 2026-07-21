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
   * Which cell the projection is anchored on, if not the comb's own centre.
   *
   * The anchor is the point that lands ON the vanishing point, so the cell sitting
   * there shows no depth of its own and every other prism aims at it. Left unset,
   * the comb anchors on its horizontal centre and the central row — the neutral
   * choice, where the geometry says nothing about which stage matters.
   *
   * "last" and "first" are RULES, resolved against the measured layout on every
   * pass, so they hold at any comb size: five hexes anchors on the fifth, fifty
   * anchors on the fiftieth. Never pass a hardcoded index for those — a constant
   * computed by a caller is a rule that silently stops being true when the comb
   * changes length.
   */
  anchor?: number | "last" | "first";
  /**
   * Whether an anchor moves the horizon too, or only the horizontal centre.
   * "x" keeps the horizon on the central row, so the comb still reads as level and
   * only its convergence shifts sideways. "both" puts the vanishing point squarely
   * on the anchor cell, horizon included.
   */
  anchorAxis?: "both" | "x";
  /**
   * Make one cell BE the vanishing point: the comb recedes into it.
   *
   * This is a different thing from `anchor`. Anchoring puts a cell at the centre of
   * the projection but leaves it full size. Vanishing ranks the whole comb in depth
   * along its own order, so the first cell is nearest and largest, every cell after
   * it is further and smaller, and the target cell sits at the point they all
   * converge on — the road running away to the horizon, with the horizon on the
   * final hex.
   *
   * `finalScale` is how small the target draws, as a fraction of the near end, and
   * the per-step falloff is derived from it and the comb's LENGTH. That is what
   * makes the rule count-independent: five hexes and fifty hexes both put their last
   * cell at the same apparent distance, rather than fifty hexes collapsing to
   * nothing because a fixed per-step ratio compounded fifty times.
   *
   * Faces stay parallel to the picture plane, so nothing is skewed — a receding cell
   * is just a smaller one, and its label shrinks with it rather than distorting.
   */
  vanish?: { at: number | "last" | "first"; finalScale?: number };
  /**
   * Put the DEPTH vanishing point on a cell: every prism's depth edges converge on
   * that hex.
   *
   * This is the one that needed saying properly. In a three-point projection the
   * depth axis converges on a point fixed entirely by yaw, pitch and focal length —
   * `depthVanishingPoint` below. Moving the projection's origin (`anchor`) slides
   * the comb around underneath that point but never puts a cell ON it, which is why
   * anchoring on the last hex still left every slab aiming somewhere off in space.
   *
   * Setting this solves for the comb placement where the named cell's centre lands
   * exactly on that point. The projection stays three-point — rows, columns and
   * depth each keep their own vanishing point — and the named hex becomes the one
   * the depth converges into. Its own prism collapses to nothing, because a cell at
   * the vanishing point has no depth left to show.
   */
  vpOn?: number | "last" | "first";
  /**
   * Curve the comb around the viewer, with ONE cell square-on to the camera.
   *
   * This is the family the rigid-plane cameras above cannot express. A flat comb has
   * every cell parallel to the picture plane, so either nothing foreshortens or, if
   * the plane is turned, nothing is square-on — including the cell you are standing
   * in. Bending the comb onto a cylinder or a sphere breaks that trade: the cell at
   * the pole faces the camera dead on and stays undistorted, and every other cell
   * curves away from it by however far around the surface it sits. Perspective
   * radiates FROM the active cell instead of being imposed across the whole comb.
   *
   * `at` names the pole and is resolved per layout, so when the active stage moves,
   * the comb turns to face it. `radius` is in cell widths: small means a tight barrel
   * where the second ring is already turning hard, large means a gentle bow.
   */
  curve?: { mode: "cylinder" | "sphere"; radius: number; at: number | "last" | "first" };
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

/** The camera the owner picked (sandbox "T3", 2026-07-20): both rotations pushed far
 *  enough that all three vanishing points read, on a comb whose cells carry type. */
export const HEX_CAM_T3: HexCam = {
  yaw: 0.34,
  pitch: 0.3,
  f: 4.1,
  dist: 4.1,
  depth: 0.23,
};

/**
 * The camera the owner picked (sandbox "R13i", 2026-07-20). THIS is the comb.
 *
 * A gently bowed sphere with its pole on the ACTIVE stage: that hex sits square-on to
 * the camera, full size and undistorted, and every other stage curves away from it by
 * however far around the surface it sits. Perspective radiates from where the learner
 * is standing rather than being imposed across the comb, and when the active stage
 * moves the comb turns to face the new one.
 *
 * Radius 8 is deliberately the gentle end of the range. Tighter barrels (R13k–m) show
 * far more of the prisms, but they turn the outer cells far enough that their labels
 * stop being readable — and these cells carry a title, a lead and a chip. The prism
 * depth of 1.0 is generous but mostly implied at this radius, because a camera looking
 * square-on at the pole is also looking down the extrusion axis and a prism pointing
 * at the viewer shows no walls. Depth here is a reserve that reveals itself toward the
 * comb's edges, not a slab you see everywhere.
 *
 * `at` must be set per comb — it is the active cell's index.
 */
export const HEX_CAM_R13I: HexCam = {
  ...HEX_CAM_T3,
  yaw: 0,
  pitch: 0,
  depth: 1,
  curve: { mode: "sphere", radius: 8, at: 0 },
};

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

/**
 * R13i aimed at a particular cell — the comb turns to face it.
 *
 * Callers pass the index of whatever their comb's "you are here" is: the current
 * stage on the build-guide hub, the recommended next course on the skill tree, the
 * flagship on the go-further comb (which has no active state of its own, so its
 * primary destination takes the pole instead). A negative or missing index falls back
 * to the first cell rather than throwing, because the comb must still render for a
 * viewer who has not started anything.
 */
export function camFacing(activeIndex: number): HexCam {
  return {
    ...HEX_CAM_R13I,
    curve: { ...HEX_CAM_R13I.curve!, at: Math.max(0, activeIndex) },
  };
}

/** Three-point, with the depth vanishing point ON the comb's final hex: every prism
 *  in the comb aims its depth at the last cell, whatever the comb's length. */
export const HEX_CAM_VP_LAST: HexCam = { ...HEX_CAM_T3, vpOn: "last" };

/** The comb recedes into its FINAL hex, whatever the comb's length: the last cell IS
 *  the vanishing point. First cell nearest and full size, every one after it a step
 *  further away, the last one small and dead on the point they all converge to. */
export const HEX_CAM_VANISH_LAST: HexCam = {
  ...HEX_CAM_T3,
  vanish: { at: "last", finalScale: 0.12 },
};

/** T3 with the vanishing point on the comb's FINAL hex, whatever the comb's length.
 *  The build converges on its own finish: the last cell sits at the vanishing point
 *  with no depth of its own, and every prism before it aims there. The rule is
 *  resolved from the measured layout, so a five-stage comb anchors on the fifth and
 *  a fifty-stage comb on the fiftieth with no per-caller arithmetic. */
export const HEX_CAM_LAST: HexCam = { ...HEX_CAM_T3, anchor: "last" };

/** The same camera mirrored, for the go-further comb. That comb is a SINGLE row whose
 *  flagship sits at the left, and T3's positive yaw sends the left end AWAY — so the
 *  most important destination on the page would render smallest and flattest.
 *  Mirroring the yaw puts the near end under the flagship. Same projection, opposite
 *  hand: not a second design, and the only camera value that differs anywhere. */
export const HEX_CAM_T3_MIRROR: HexCam = { ...HEX_CAM_T3, yaw: -HEX_CAM_T3.yaw };

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

/**
 * Where the DEPTH axis converges, in scene units.
 *
 * A prism's depth runs along the comb plane's normal, (0,0,1). Rotate it by yaw then
 * pitch and it becomes (sin y, -cos y · sin p, cos y · cos p); a direction's vanishing
 * point is the focal length times its x and y over its z. So the point depends only
 * on the camera's angles and focal length — NOT on where the comb sits. Which is the
 * whole reason moving the comb's origin never lands a cell on it, and why `vpOn`
 * solves for a placement instead.
 */
export function depthVanishingPoint(cam: HexCam, cellWidth: number): Pt {
  const f = cam.f * cellWidth;
  return [(f * Math.tan(cam.yaw)) / Math.cos(cam.pitch), -f * Math.tan(cam.pitch)];
}

/** Turn an anchor rule into a cell index for a comb of `n` cells. */
export function resolveAnchor(
  anchor: HexCam["anchor"],
  n: number,
): number | undefined {
  if (anchor == null || n === 0) return undefined;
  if (anchor === "last") return n - 1;
  if (anchor === "first") return 0;
  return anchor;
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
  if (cam.curve) return projectCurved(boxes, cam);
  if (cam.vanish) return projectVanishing(boxes, cam);
  // Unit of measure for the camera: the cell width. Everything below is expressed in
  // it, which is what keeps the projection identical at every layout width.
  const u = boxes[0]!.w;
  const f = cam.f * u;
  const dist = cam.dist * u;
  const depth = cam.depth * u;
  const anchor = boxes[resolveAnchor(cam.anchor, boxes.length) ?? -1];
  const originX = anchor
    ? anchor.left + anchor.w / 2
    : boxes.reduce((a, b) => a + b.left + b.w / 2, 0) / boxes.length;
  const originY =
    anchor && cam.anchorAxis !== "x" ? anchor.top + anchor.h / 2 : centralRowY(boxes);

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

  // `vpOn` slides the comb (in its own plane) until the named cell's centre lands on
  // the depth vanishing point. The projection is nonlinear — a point's screen
  // position depends on its own depth — so this is solved by iteration rather than
  // algebra. It converges in a handful of steps and runs once per layout.
  let shiftX = 0;
  let shiftY = 0;
  const vpIdx = resolveAnchor(cam.vpOn, boxes.length);
  if (vpIdx != null && boxes[vpIdx]) {
    const target = boxes[vpIdx]!;
    const tx = target.left + target.w / 2;
    const ty = target.top + target.h / 2;
    const [vpx, vpy] = depthVanishingPoint(cam, u);
    const cy = Math.cos(cam.yaw);
    const cp = Math.cos(cam.pitch);
    for (let step = 0; step < 60; step++) {
      const [X, Y, Z] = rotate(tx - originX + shiftX, ty - originY + shiftY, 0, cam);
      const k = f / (distEff + Z);
      const ex = vpx - X * k;
      const ey = vpy - Y * k;
      if (Math.abs(ex) < 1e-7 && Math.abs(ey) < 1e-7) break;
      // Screen error back to plane coordinates through the dominant Jacobian terms;
      // damped so the depth feedback (moving the cell changes its own scale) cannot
      // overshoot into oscillation.
      shiftX += (0.6 * ex) / (k * cy);
      shiftY += (0.6 * ey) / (k * cp);
    }
  }

  const project = (x: number, y: number, z: number): { p: Pt; z: number } => {
    const [X, Y, Z] = rotate(x - originX + shiftX, y - originY + shiftY, z, cam);
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

/**
 * The comb bent around the viewer, with one cell square-on to the camera.
 *
 * The layout is wrapped onto a cylinder or a sphere whose near pole sits on the
 * chosen cell. A point `px` to the right of that pole travels `px / R` radians around
 * the surface, so it both moves back in depth and turns away from the camera by the
 * same angle. At the pole the surface is perpendicular to the view axis: the active
 * cell is flat on, full size, undistorted, and everything else falls away from it.
 *
 * Each hex's corners are mapped individually rather than as a rigid tile, so cells
 * genuinely wrap with the surface instead of faceting off it. Prism depth runs along
 * the surface normal at each point, which is why the slabs splay outward from the
 * active cell rather than all pointing one way.
 */
function projectCurved(boxes: HexBox[], cam: HexCam): HexSolid[] {
  const n = boxes.length;
  const { mode, radius, at } = cam.curve!;
  const pole = boxes[resolveAnchor(at, n) ?? 0]!;
  const px0 = pole.left + pole.w / 2;
  const py0 = pole.top + pole.h / 2;
  const u = boxes[0]!.w;
  const R = Math.max(1e-3, radius * u);
  const f = cam.f * u;
  const dist = cam.dist * u;
  const depth = cam.depth * u;

  /** plane point → point on the curved surface, with its outward normal. */
  const onSurface = (x: number, y: number) => {
    const a = (x - px0) / R;
    const b = mode === "sphere" ? (y - py0) / R : 0;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const cb = Math.cos(b);
    const sb = Math.sin(b);
    const p =
      mode === "sphere"
        ? { x: R * sa * cb, y: R * sb, z: R - R * ca * cb }
        : { x: R * sa, y: y - py0, z: R - R * ca };
    // Away from the camera at the pole this is (0,0,1), so a prism extrudes back.
    const nrm = mode === "sphere" ? { x: sa * cb, y: sb, z: ca * cb } : { x: sa, y: 0, z: ca };
    return { p, nrm };
  };

  const shoot = (x: number, y: number, along: number): { p: Pt; z: number } => {
    const { p, nrm } = onSurface(x, y);
    const wx = p.x + nrm.x * along;
    const wy = p.y + nrm.y * along;
    const wz = p.z + nrm.z * along;
    const k = f / Math.max(dist + wz, 1);
    return { p: [wx * k, wy * k], z: wz };
  };

  return boxes.map((b, i) => {
    const corners = (along: number) =>
      HEX_UNIT_CORNERS.map(([ux, uy]) =>
        shoot(b.left + ux * b.w, b.top + uy * b.h, along),
      );
    const face = corners(0);
    const rear = corners(depth);
    const centre = shoot(b.left + b.w / 2, b.top + b.h / 2, 0);
    const w = Math.hypot(face[1]!.p[0] - face[5]!.p[0], face[1]!.p[1] - face[5]!.p[1]);
    return {
      i,
      face: face.map((c) => c.p),
      rear: rear.map((c) => c.p),
      centre: centre.p,
      scale: w / b.w,
      fit: w / b.w,
      z: centre.z,
    };
  });
}

/**
 * The comb receding INTO one cell. That cell is the vanishing point: the first cell
 * is nearest and full size, each one after it is a step further away and smaller, and
 * the target draws at `finalScale` right where every line converges.
 *
 * The maths is a scale about the vanishing point, which is what one-point perspective
 * on a plane parallel to the picture plane reduces to. A cell `d` steps back from the
 * near end draws at `k^d`, with `k` derived from the comb's length so the far end
 * lands on `finalScale` whether the comb is five cells or fifty. The prism's far face
 * is one more step toward the same point, so the depth edges converge there too.
 */
function projectVanishing(boxes: HexBox[], cam: HexCam): HexSolid[] {
  const n = boxes.length;
  const idx = resolveAnchor(cam.vanish!.at, n) ?? n - 1;
  const target = boxes[idx]!;
  const vp = { x: target.left + target.w / 2, y: target.top + target.h / 2 };
  const finalScale = cam.vanish!.finalScale ?? 0.1;
  // Steps away from the viewer. The target is the far end, so the cell at the OTHER
  // end of the run is the near one.
  const steps = (i: number) => (idx >= n - 1 - idx ? i : n - 1 - i);
  const maxStep = Math.max(1, ...boxes.map((_, i) => steps(i)));
  const k = Math.pow(finalScale, 1 / maxStep);
  // One extra step's worth of recession gives the prism its depth, so the slabs
  // converge on the same point the run does.
  const depthRatio = cam.f / (cam.f + cam.depth);

  const toward = (p: { x: number; y: number }, s: number): Pt => [
    vp.x + (p.x - vp.x) * s,
    vp.y + (p.y - vp.y) * s,
  ];

  return boxes.map((b, i) => {
    const s = Math.pow(k, steps(i));
    const corners = (mul: number) =>
      HEX_UNIT_CORNERS.map(([ux, uy]) =>
        toward({ x: b.left + ux * b.w, y: b.top + uy * b.h }, s * mul),
      );
    return {
      i,
      face: corners(1),
      rear: corners(depthRatio),
      centre: toward({ x: b.left + b.w / 2, y: b.top + b.h / 2 }, s),
      scale: s,
      fit: s,
      // Bigger means nearer, and near must paint last.
      z: -s,
    };
  });
}

/** A viewBox that contains every projected point, with a little air. */
export function sceneBox(solids: HexSolid[], pad = 6) {
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
