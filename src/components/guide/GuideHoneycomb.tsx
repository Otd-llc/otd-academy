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
import { CombArrows, HexPrismScene } from "@/components/guide/HexPrismScene";
import {
  HEX_CAM_S5,
  paintOrder,
  projectComb,
  sceneBox,
  sceneHeight,
  sceneToPx,
  type HexCam,
} from "@/lib/hex-perspective";

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

/**
 * Shared plumbing for a three-point comb: project the measured boxes, fit a scene
 * box, and hand back everything a caller needs to park billboarded HTML on the
 * projected faces. Used by this hub, SkillHoneycomb and PathHoneycomb so all three
 * stay one camera and one paint order.
 */
export function buildCombScene(boxes: Box[], cw: number, cam: HexCam = HEX_CAM_S5) {
  const solids = boxes.length > 0 && cw > 0 ? projectComb(boxes, cam) : [];
  const vb = sceneBox(solids);
  // Depth order, as an inline z-index: a nearer cell's LABEL must sit above a
  // farther one's the same way its prism does. Inline beats any class rule, which
  // is why `.gh-node.current { z-index }` had to go rather than be worked around.
  const depthZ = new Map<number, number>();
  paintOrder(solids).forEach((s, k) => depthZ.set(s.i, k + 1));
  return {
    solids,
    vb,
    height: solids.length > 0 ? sceneHeight(vb, cw) : 0,
    /** where cell `i`'s billboarded content sits, and how big it draws. */
    place(i: number): React.CSSProperties | null {
      const s = solids[i];
      const b = boxes[i];
      if (!s || !b) return null;
      const p = sceneToPx(vb, cw, s.centre);
      const u = cw / vb.w;
      return {
        position: "absolute",
        left: p.x,
        top: p.y,
        width: b.w,
        height: b.h,
        // `fit`, not `scale`: a turned face is a trapezoid and the label has to stay
        // inside its narrow side too.
        transform: `translate(-50%, -50%) scale(${(s.fit * u).toFixed(4)})`,
        zIndex: depthZ.get(i) ?? 1,
      };
    },
  };
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

  const scene = buildCombScene(layout.boxes, cw);

  return (
    <div ref={ref} className="gh" style={{ position: "relative", height: scene.height }}>
      {scene.solids.length > 0 ? (
        <HexPrismScene
          solids={scene.solids}
          vb={scene.vb}
          cells={stages.map((s) => ({ kind: s.kind }))}
          hot={hot}
        />
      ) : null}
      {stages.map((s, i) => {
        const b = layout.boxes[i];
        const style = scene.place(i);
        if (!b || !style) return null;
        return (
          <Link
            key={s.stage}
            href={href(s.stage)}
            aria-current={s.kind === "current" ? "step" : undefined}
            aria-label={`Stage ${s.num} — ${s.title} (${s.statusText})`}
            className={`gh-node ${s.kind}`}
            // The hex itself lives in the scene svg below this; what sits here is the
            // cell's content, billboarded onto its projected face.
            style={style}
            onMouseEnter={() => setHot(i)}
            onMouseLeave={() => setHot((h) => (h === i ? null : h))}
            onFocus={() => setHot(i)}
            onBlur={() => setHot((h) => (h === i ? null : h))}
          >
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

      {/* Path-direction arrows — now drawn on the PROJECTED centres (see CombArrows),
          because a seam that moved with the perspective takes its arrow with it. */}
      <CombArrows
        solids={scene.solids}
        vb={scene.vb}
        on={stages.map((s) => s.kind === "done")}
        hot={hot}
      />
    </div>
  );
}
