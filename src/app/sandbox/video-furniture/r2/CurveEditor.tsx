"use client";

// A CURVE YOU CAN DRAG.
//
// The brief was "a mixing table where I can adjust the curves and duration of
// each effect", and the curve half is the part that decides whether this is a
// mixer or a menu. A dropdown of named easings ("outCubic", "outExpo") is a
// menu: it offers the two curves somebody already wrote and no others. So the
// curve is stored as the four control points CSS itself uses, and this is the
// surface that edits them.
//
// The stored value goes straight into `bezier()` - the same evaluator the exit
// stack uses, verified against the browser's own cubic-bezier to 5.6e-7 - so
// what you drag is exactly what renders, with no translation layer to disagree.
//
// CONSTRAINTS. CSS requires x1 and x2 in [0, 1]; a curve whose x leaves the
// unit interval is not a function of progress and cannot be evaluated. y is
// unbounded in CSS (that is how overshoot easings work) but overshoot is on the
// forbidden vocabulary list, so this clamps y to [0, 1] too. That is a
// deliberate narrowing of CSS, not an oversight: the editor should not offer a
// gesture the identity rejects.
//
// ASCII only.

import { useCallback, useRef, useState } from "react";
import { bezier } from "./exits";

const SIZE = 132; // px, the drawn square
const PAD = 14; // room for handles at the edges

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function CurveEditor({
  value,
  onChange,
  p,
}: {
  value: readonly number[];
  onChange: (next: readonly number[]) => void;
  /** Current progress, so the dot shows where the scrubber is ON the curve. */
  p?: number;
}) {
  const ref = useRef<SVGSVGElement | null>(null);
  const [drag, setDrag] = useState<0 | 1 | null>(null);
  const [x1, y1, x2, y2] = value;

  // Curve space is y-up; SVG is y-down. One conversion, stated once.
  const sx = (x: number) => PAD + x * SIZE;
  const sy = (y: number) => PAD + (1 - y) * SIZE;

  const move = useCallback(
    (ev: React.PointerEvent) => {
      if (drag === null || !ref.current) return;
      const r = ref.current.getBoundingClientRect();
      const x = clamp01((ev.clientX - r.left - PAD) / SIZE);
      const y = clamp01(1 - (ev.clientY - r.top - PAD) / SIZE);
      onChange(drag === 0 ? [x, y, x2, y2] : [x1, y1, x, y]);
    },
    [drag, onChange, x1, y1, x2, y2],
  );

  // The curve, sampled. 48 segments is past the point where more is visible at
  // this size, and it keeps the path a pure function of the control points.
  const d = Array.from({ length: 49 }, (_, i) => {
    const t = i / 48;
    return `${i === 0 ? "M" : "L"} ${sx(t).toFixed(2)} ${sy(bezier(value, t)).toFixed(2)}`;
  }).join(" ");

  const handle = (i: 0 | 1, hx: number, hy: number) => (
    <g key={i}>
      <line
        x1={sx(i === 0 ? 0 : 1)}
        y1={sy(i === 0 ? 0 : 1)}
        x2={sx(hx)}
        y2={sy(hy)}
        stroke="var(--color-panel-border)"
        strokeWidth={1}
      />
      <circle
        cx={sx(hx)}
        cy={sy(hy)}
        r={6}
        fill="var(--color-deep-space)"
        stroke="var(--color-command-gold)"
        strokeWidth={1.5}
        style={{ cursor: "grab" }}
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture(e.pointerId);
          setDrag(i);
        }}
      />
    </g>
  );

  return (
    <div>
      <svg
        ref={ref}
        width={SIZE + PAD * 2}
        height={SIZE + PAD * 2}
        onPointerMove={move}
        onPointerUp={() => setDrag(null)}
        onPointerCancel={() => setDrag(null)}
        style={{ touchAction: "none", display: "block" }}
      >
        <rect
          x={PAD}
          y={PAD}
          width={SIZE}
          height={SIZE}
          fill="none"
          stroke="var(--color-panel-border)"
          strokeWidth={1}
        />
        {/* Linear reference. Without it there is nothing to read the curve's
            departure against, and "is this actually eased" becomes a guess. */}
        <line
          x1={sx(0)}
          y1={sy(0)}
          x2={sx(1)}
          y2={sy(1)}
          stroke="var(--color-panel-border)"
          strokeWidth={1}
          strokeDasharray="2 3"
        />
        <path d={d} fill="none" stroke="var(--color-command-gold)" strokeWidth={2} />
        {handle(0, x1, y1)}
        {handle(1, x2, y2)}
        {/* Where the transport is, ON the curve. This is the whole reason the
            editor lives next to the scrubber rather than in a dialog. */}
        {p !== undefined ? (
          <circle cx={sx(clamp01(p))} cy={sy(bezier(value, clamp01(p)))} r={3.5} fill="var(--color-gold-light)" />
        ) : null}
      </svg>
      <p
        className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted"
        style={{ marginTop: 4 }}
      >
        cubic-bezier({value.map((v) => v.toFixed(2)).join(", ")})
      </p>
    </div>
  );
}
