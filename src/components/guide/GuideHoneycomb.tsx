"use client";

// GuideHoneycomb — the build-guide hub as a page of big SYMMETRIC info-hexes that
// TESSELLATE (shared edges, offset rows) and slink through in order. Each hex is
// the full stage button: a big outline stage NUMBER owning the top third, then
// title · lead · a status chip; the whole hex is the link.
// Honey-filled when done, the current stage pulses, ahead stays dim. Each hex is
// a thin ortho-3D prism (the shared /courses shell), and a small path arrow on
// each seam shows the order: gold once the source stage is done, dim ahead.
//
// Layout is measured on the client: the hexes GROW to fill the available width
// (3-ish per row on desktop, collapsing to a single full-width column on mobile),
// so they never clip or overflow. Pointy-top regular hexes (height = width·√3⁻¹·2).

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { GuideStage } from "@/lib/guide-templates/stage-skeletons";

const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const MAXW = 360;
const PER_ROW = 3; // up to three across on wide screens
const MIN_ROW = 2; // never fewer than two — the comb never becomes a vertical strip
const MINW = 165; // drop 3→2 columns once cells would shrink below this
export const RATIO = 1.1547; // regular pointy-top: height / width

export type HoneycombStage = {
  stage: GuideStage;
  /** "01" … */
  num: string;
  title: string;
  lead: string;
  kind: "done" | "current" | "blocked" | "pending";
  statusText: string;
};

export type Box = { left: number; top: number; w: number; h: number };

// Ortho-3D hex prism shell — the /courses sandbox winner ("H4" + "K10" rounds,
// 2026-07-07): the pointy-top face plus a down-right oblique cast (6.5% of the
// face) whose side faces fill with the field color (a solid occluding slab).
// Rendered by the build-guide hub (below), SkillHoneycomb + PathHoneycomb; the
// part classes (gh-top / gh-cast / gh-side) are styled per-state in globals.css
// under the `.gh-3d` scope. Cast occlusion relies on stacking order: callers
// give each absolutely positioned cell a zIndex that grows with `left`, so every
// cell's cast is covered by its right/lower neighbour's opaque face.
export const HEX_POINTS = "50,0 100,28.87 100,86.6 50,115.47 0,86.6 0,28.87";
const PRISM_CAST = 6.5;
// visible cast silhouette for a down-right offset: TR → BR → B → BL
const PRISM_RUN: [number, number][] = [
  [100, 28.87], [100, 86.6], [50, 115.47], [0, 86.6],
];
const prismPts = (list: [number, number][]) =>
  list.map(([x, y]) => `${x},${y}`).join(" ");
const prismOff = ([x, y]: [number, number]): [number, number] => [
  x + PRISM_CAST,
  y + PRISM_CAST,
];

export function HexPrism({ className }: { className: string }) {
  return (
    <svg
      className={`${className} gh-3d`}
      viewBox="0 0 100 115.47"
      preserveAspectRatio="none"
      aria-hidden
    >
      {PRISM_RUN.slice(0, -1).map((a, i) => (
        <polygon
          key={i}
          className="gh-side"
          points={prismPts([
            a,
            PRISM_RUN[i + 1]!,
            prismOff(PRISM_RUN[i + 1]!),
            prismOff(a),
          ])}
        />
      ))}
      {PRISM_RUN.map((p, i) => (
        <polyline
          key={`v${i}`}
          className="gh-cast"
          points={prismPts([p, prismOff(p)])}
        />
      ))}
      <polyline className="gh-cast" points={prismPts(PRISM_RUN.map(prismOff))} />
      <polygon className="gh-top" points={HEX_POINTS} />
    </svg>
  );
}

// Measure-and-fill honeycomb layout: given a container width + node count, place
// `count` pointy-top hexes in offset, snaking rows that grow to fill the width
// (3-up desktop → 2-up phone, never a 1-wide strip). Shared with SkillHoneycomb
// + PathHoneycomb so the build-guide hub, /courses skill tree, and the /courses
// "go further" destinations all tessellate identically. `opts` lets a caller
// widen the row (e.g. 4-up) or cap the cell size; the defaults are the hub's.
export function computeLayout(
  cw: number,
  count: number,
  opts?: { perRow?: number; minW?: number; maxW?: number },
): { boxes: Box[]; height: number } {
  const perRowMax = opts?.perRow ?? PER_ROW;
  const minW = opts?.minW ?? MINW;
  const maxW = opts?.maxW ?? MAXW;
  if (cw <= 0 || count === 0) return { boxes: [], height: 0 };
  let perRow = Math.min(count, perRowMax);
  let off = perRow > 1 ? 0.5 : 0;
  let w = cw / (perRow + off);
  // drop a column when cells would get too small, but never below two-across
  while (w < minW && perRow > MIN_ROW) {
    perRow--;
    off = perRow > 1 ? 0.5 : 0;
    w = cw / (perRow + off);
  }
  if (w > maxW) w = maxW;
  const h = w * RATIO;
  const vstep = h * 0.75; // rows overlap by 1/4 so they nestle
  const rows = Math.ceil(count / perRow);
  const usedW = perRow * w + off * w;
  const pad = Math.max(0, (cw - usedW) / 2);
  const boxes: Box[] = [];
  for (let idx = 0; idx < count; idx++) {
    const row = Math.floor(idx / perRow);
    const pos = idx % perRow;
    const col = row % 2 === 0 ? pos : perRow - 1 - pos; // snake
    const xoff = row % 2 === 1 && perRow > 1 ? w / 2 : 0;
    boxes.push({ left: pad + col * w + xoff, top: row * vstep, w, h });
  }
  return { boxes, height: (rows - 1) * vstep + h };
}

export function GuideHoneycomb({
  slug,
  revLabel,
  stages,
}: {
  slug: string;
  revLabel: string;
  stages: HoneycombStage[];
}) {
  const href = (s: GuideStage) =>
    `/projects/${slug}/${encodeURIComponent(revLabel)}/guide/${s}`;
  const ref = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<{ boxes: Box[]; height: number }>({
    boxes: [],
    height: 0,
  });
  // cw feeds the arrow overlay's viewBox; hot is the hex whose OUTGOING arrow
  // lights (hover/focus) — same path-arrow model as SkillHoneycomb.
  const [cw, setCw] = useState(0);
  const [hot, setHot] = useState<number | null>(null);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // Lower minW than the default so phones pack 3-up (smaller, more compact
    // hexes) instead of two big ones — the build guide now has 8 stages to show.
    setCw(el.clientWidth);
    setLayout(computeLayout(el.clientWidth, stages.length, { minW: 100 }));
  }, [stages.length]);

  useIsoLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, [measure]);

  return (
    <div ref={ref} className="gh" style={{ position: "relative", height: layout.height }}>
      <svg width="0" height="0" aria-hidden className="absolute">
        <defs>
          <linearGradient id="gh-honey" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#eab94d" />
            <stop offset="1" stopColor="#b07f31" />
          </linearGradient>
        </defs>
      </svg>
      {stages.map((s, i) => {
        const b = layout.boxes[i];
        if (!b) return null;
        return (
          <Link
            key={s.stage}
            href={href(s.stage)}
            aria-current={s.kind === "current" ? "step" : undefined}
            aria-label={`Stage ${s.num} — ${s.title} (${s.statusText})`}
            className={`gh-node ${s.kind}`}
            // zIndex grows with `left` so each hex's down-right cast is covered by
            // its right/lower neighbour's opaque face (the prism occlusion model).
            style={{ left: b.left, top: b.top, width: b.w, height: b.h, zIndex: Math.round(b.left) + 1 }}
            onMouseEnter={() => setHot(i)}
            onMouseLeave={() => setHot((h) => (h === i ? null : h))}
            onFocus={() => setHot(i)}
            onBlur={() => setHot((h) => (h === i ? null : h))}
          >
            <HexPrism className="gh-hex" />
            <span
              className="gh-num"
              aria-hidden
              // hero size on big cells; eased down on small ones so it stops
              // swallowing the room the title + chip need on a phone.
              // Saira Condensed (the numeral face) renders taller/heavier than
              // Bebas at the same size, so the multiplier is eased down vs the old
              // Bebas tuning to keep the number clear of the title below it.
              style={{ fontSize: Math.round(b.w * (b.w <= 200 ? 0.32 : 0.38)) }}
            >
              {s.num}
            </span>
            <span className="gh-m">
              <span className="gh-title">{s.title}</span>
              {s.lead ? <span className="gh-lead">{s.lead}</span> : null}
            </span>
            <span className="gh-status">
              <span className="gh-chip">{s.statusText}</span>
            </span>
          </Link>
        );
      })}

      {/* Path-direction arrows (K10) — identical to SkillHoneycomb: a 12 × 10
          solid triangle on each consecutive pair's seam (midpoint of the two
          cell centers, base 7px scaled off the line on the destination face,
          rotated along the flow). Gold when the source stage is done, dim ahead;
          a hovered/focused hex lights its outgoing arrow, and they drift. */}
      {layout.boxes.length === stages.length && layout.height > 0 && cw > 0
        ? (() => {
            const arrows = stages.slice(0, -1).map((s, i) => {
              const a = layout.boxes[i]!;
              const b = layout.boxes[i + 1]!;
              const ax = a.left + a.w / 2;
              const ay = a.top + a.h / 2;
              const bx = b.left + b.w / 2;
              const by = b.top + b.h / 2;
              const ang = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
              const sc = a.w / 200; // K10 sizes were tuned on 200px cells
              const cls = [s.kind === "done" ? "on" : "off", hot === i ? "hot" : ""]
                .filter(Boolean)
                .join(" ");
              return (
                <g
                  key={s.stage}
                  className={cls}
                  transform={`translate(${(ax + bx) / 2} ${(ay + by) / 2}) rotate(${ang}) translate(${7 * sc} 0) scale(${sc})`}
                >
                  <path d="M -6 -5 L 6 0 L -6 5 Z" style={{ animationDelay: `${i * 0.25}s` }} />
                </g>
              );
            });
            return (
              <svg
                className="sk-arw"
                viewBox={`0 0 ${cw} ${layout.height}`}
                preserveAspectRatio="none"
                aria-hidden
              >
                {arrows}
              </svg>
            );
          })()
        : null}
    </div>
  );
}
