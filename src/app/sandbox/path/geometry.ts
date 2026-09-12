// SANDBOX geometry — a HORIZONTAL laced ribbon, for the /courses go-further comb.
//
// The target is the lesson-top ribbon (`lib/phase-comb.ts`): flat-top hexes laced
// edge to edge in a zig-zag, thin outline, one-point prism converging on the centre
// of the run. That comb states its numbers inside a fixed 48-unit drawing box; this
// restates them as ratios of a MEASURED cell, the same way `lib/comb-spine.ts` does
// for the vertical spine we just shipped, so the two combs on the page are one system
// and neither is a fixed-size drawing scaled to fit.
//
// The projection rule is identical to the spine's and is not duplicated by accident:
// `projectRibbon` differs from `projectSpine` only in which six corners it uses. If
// this round gets picked, the two collapse into one function taking a corner set.

import type { HexSolid, Pt } from "@/lib/hex-perspective";

// IMPORTED, not restated. This round shipped as `lib/comb-ribbon.ts`, and that
// module's own header records why: "the first cut of the sandbox round restated
// 1.1547 and the six pointy corners locally, and the two combs then sat on the
// same page one rounding apart, which reads as a wobble rather than as a
// decision." This file was that first cut, and it kept its copies -- so the
// sandbox has been auditioning rounds against constants the shipped comb no
// longer necessarily shares.
//
// Verified identical at the time of the swap: FLAT_RATIO both sqrt(3)/2,
// POINTY_RATIO both 1.1547 (the lib aliases SPINE_RATIO), and both corner sets
// byte-for-byte the same six points. So this changes no pixel today; it removes
// the chance that it changes one tomorrow without anybody editing this file.
//
// Re-exported so this module's own consumers keep the same surface.
import {
  FLAT_RATIO,
  POINTY_RATIO,
  FLAT_CORNERS,
  POINTY_CORNERS,
} from "@/lib/comb-ribbon";

export { FLAT_RATIO, POINTY_RATIO, FLAT_CORNERS, POINTY_CORNERS };

export type RibbonBox = { left: number; top: number; w: number; h: number };

export type RibbonShape =
  /** flat-top, laced edge to edge, alternating down and up. The lesson ribbon. */
  | "laced"
  /** pointy-top, straight across on shared vertical edges. Matches the spine's hex
   *  orientation, so the page carries one hex and not two. */
  | "row";

export function ribbonRatio(shape: RibbonShape) {
  return shape === "laced" ? FLAT_RATIO : POINTY_RATIO;
}

export function ribbonCorners(shape: RibbonShape) {
  return shape === "laced" ? FLAT_CORNERS : POINTY_CORNERS;
}

/**
 * The ribbon's extent, in multiples of one cell width.
 *
 * Laced: each extra hex steps 0.75 of a width across (the flat-top neighbour step)
 * and the run is one and a half hex heights tall, because the zig-zag drops every
 * other cell by half.
 *
 * Row: each extra hex steps a full width and the run is exactly one hex tall.
 */
export function ribbonUnits(
  shape: RibbonShape,
  count: number,
): { wu: number; hu: number } {
  if (count <= 0) return { wu: 0, hu: 0 };
  const r = ribbonRatio(shape);
  if (shape === "laced") {
    return { wu: 0.75 * (count - 1) + 1, hu: r * 1.5 };
  }
  return { wu: count, hu: r };
}

/** The largest cell width that fits, capped. */
export function fitRibbonCell(
  shape: RibbonShape,
  count: number,
  availW: number,
  maxW: number | null = null,
): number {
  const { wu } = ribbonUnits(shape, count);
  if (wu <= 0 || availW <= 0) return 0;
  const w = availW / wu;
  return maxW != null ? Math.min(w, maxW) : w;
}

/** Place `count` cells of width `w`, centred horizontally in `availW`. */
export function placeRibbon(
  shape: RibbonShape,
  count: number,
  w: number,
  availW: number,
): { boxes: RibbonBox[]; width: number; height: number } {
  if (count <= 0 || w <= 0) return { boxes: [], width: 0, height: 0 };
  const h = w * ribbonRatio(shape);
  const { wu, hu } = ribbonUnits(shape, count);
  const pad = Math.max(0, (availW - wu * w) / 2);
  const boxes: RibbonBox[] = [];
  for (let i = 0; i < count; i++) {
    if (shape === "laced") {
      boxes.push({ left: pad + i * 0.75 * w, top: (i % 2) * 0.5 * h, w, h });
    } else {
      boxes.push({ left: pad + i * w, top: 0, w, h });
    }
  }
  return { boxes, width: wu * w, height: hu * w };
}

/**
 * Project a measured ribbon in one-point perspective, exactly as the spine does.
 *
 * The near faces are NOT transformed: under one-point they lie in the picture plane,
 * so a cell's HTML sits upright on it at true size. Only the rear face moves, scaled
 * toward the vanishing point, and the ratio is solved from the FAR-END cast so the
 * slab reads the same on a 3-hex run as on a 6-hex one.
 */
export function projectRibbon(
  boxes: RibbonBox[],
  shape: RibbonShape,
  sceneW: number,
  sceneH: number,
  castFar: number,
  vp: [number, number] = [0.5, 0.5],
): HexSolid[] {
  if (boxes.length === 0) return [];
  const corners = ribbonCorners(shape);
  const vx = vp[0] * sceneW;
  const vy = vp[1] * sceneH;

  let maxDist = 0;
  for (const b of boxes) {
    for (const [ux, uy] of corners) {
      const d = Math.hypot(b.left + ux * b.w - vx, b.top + uy * b.h - vy);
      if (d > maxDist) maxDist = d;
    }
  }
  const r =
    maxDist > 0
      ? Math.min(0.999, Math.max(0.5, 1 - (castFar * boxes[0]!.w) / maxDist))
      : 1;

  return boxes.map((b, i) => {
    const face: Pt[] = corners.map(([ux, uy]) => [b.left + ux * b.w, b.top + uy * b.h]);
    const rear: Pt[] = face.map(([x, y]) => [vx + (x - vx) * r, vy + (y - vy) * r]);
    return {
      i,
      face,
      rear,
      centre: [b.left + b.w / 2, b.top + b.h / 2] as Pt,
      scale: 1,
      fit: 1,
      z: 0,
    };
  });
}
