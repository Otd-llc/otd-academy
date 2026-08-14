"use client";

// THE CURRENT-CELL LOCK: the outline finds the hex, then two half-hex jaws close
// on it.
//
// Picked in the video-furniture round (`ladder-trace-vise`) and promoted here, the
// same way `comb-spine.ts` was promoted out of the rounds that produced it. The
// drawing is identical; only what drives it changes.
//
// WHAT CHANGES ON A PAGE. In a frame the lock is a pure function of `t`, because the
// renderer seeks. A page has no `t`, so this runs ONCE on mount as a CSS animation
// with `forwards` fill - and once is the whole point. It marks the CURRENT cell, so
// it fires when the comb appears and then holds; it is not a hover affordance. A
// reticle that re-acquires every time focus crosses an eight-cell comb reads as
// noise on a hub page in a way it never does in a ten-second outro.
//
// AND IT MUST NOT LOOP. The comb already carries one infinite wall-clock animation
// (`gh-pulse`), which is why every frame grab of a comb differs from the last until
// reduced motion is forced. This one ends.
//
// Under `prefers-reduced-motion` it paints its SETTLED state with no animation at
// all, rather than disappearing: the marker is information - which stage you are on -
// and information does not get switched off with the motion.
//
// ASCII only.

import { SPINE_UNIT_CORNERS, spineStroke, type SpineBox } from "@/lib/comb-spine";

/** How far the jaws stand off before they close, in cell widths. */
const STANDOFF = 0.9;
/** Where they rest: just proud of the outline, never flush on it. Flush and the
 *  grip merges with the cell's own stroke and the marker vanishes into it. */
const REST = 1.07;

const ptsAt = (b: SpineBox, g: number) => {
  const cx = b.left + b.w / 2;
  const cy = b.top + b.h / 2;
  return SPINE_UNIT_CORNERS.map(([ux, uy]) => {
    const x = b.left + ux * b.w;
    const y = b.top + uy * b.h;
    return `${(cx + (x - cx) * g).toFixed(2)},${(cy + (y - cy) * g).toFixed(2)}`;
  }).join(" ");
};

export function CombLock({
  box,
  sceneW,
  sceneH,
}: {
  box: SpineBox;
  sceneW: number;
  sceneH: number;
}) {
  const w = Math.max(2, spineStroke("face", box.w) * 1.15);
  const cx = box.left + box.w / 2;
  const cy = box.top + box.h / 2;
  return (
    <svg
      className="comb-lock"
      viewBox={`0 0 ${sceneW} ${sceneH}`}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      aria-hidden
    >
      {/* The trace: describes the hex, drawn once around its own perimeter. */}
      <polygon
        className="comb-lock-trace"
        points={ptsAt(box, 1)}
        fill="none"
        stroke="var(--color-command-gold)"
        strokeWidth={w}
        strokeLinecap="round"
        pathLength={600}
      />
      {/* The jaws: two half-hex brackets, `pathLength` normalised so the dash
          pattern is the same shape at every cell size. They scale about the
          cell's own centre, which is why the transform origin is set in user
          units rather than left to the default. */}
      <polygon
        className="comb-lock-jaws"
        points={ptsAt(box, REST)}
        fill="none"
        stroke="var(--color-command-gold)"
        strokeWidth={w}
        strokeLinecap="square"
        pathLength={600}
        strokeDasharray="150 150"
        strokeDashoffset={-75}
        style={
          {
            transformOrigin: `${cx}px ${cy}px`,
            "--lock-from": (1 + STANDOFF) / REST,
          } as React.CSSProperties
        }
      />
    </svg>
  );
}
