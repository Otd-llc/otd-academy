"use client";

// GuideHoneycomb — the build-guide hub as a VERTICAL SPINE of big info-hexes: a
// single file, laced edge to edge, alternating left and right down the page. Each hex
// is the full stage button (ordinal watermark · the stage's artifact · title · lead ·
// status chip) and the whole hex is the link. The current stage pulses, ahead stays
// dim, done takes the gold wash.
//
// The geometry and the camera live in `lib/comb-spine.ts`; the prisms are drawn by
// `SpineCombScene`. Read the notes in those two before changing anything here: the
// projection is ONE-POINT, which is what lets a cell carry upright HTML at its true
// size, and the scene is a silhouette rather than a wireframe because its slab layer
// is masked by every face.
//
// There is NO direction indicator. A staggered single file has exactly one reading
// order, so the shape says it once instead of a mark repeating it on every seam.
//
// This replaced a wide 3-up TESSELLATED grid under the three-point camera S5 (sandbox
// rounds at /sandbox/comb, owner pick 2026-08-13). `computeLayout`, `HexPrism` and
// `buildCombScene` below are that grid's machinery. NO PRODUCTION SURFACE CALLS THEM
// any more — all three combs are one-point now — and they are kept only because
// `/sandbox/comb` draws them as the control the vertical cuts were judged against.
// `HexShell` and `RATIO` are the exceptions: those the live fallbacks still use.

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { GuideStage } from "@/lib/guide-templates/stage-skeletons";
import { stageArt, stageArtGhost } from "@/lib/guide-stage-art";
import { SpineCombScene } from "@/components/guide/SpineCombScene";
import { fitCellWidth, placeSpine, projectSpine, SPINE_CLIP } from "@/lib/comb-spine";
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

/**
 * A flat hex outline for the PRE-MEASURE state.
 *
 * The measured combs get their hexes from `SpineCombScene`, but that needs a measured
 * container, so before hydration (and forever, with JS off) there is no scene. This is
 * what the SSR fallback draws into. Deliberately flat: the ortho prism shell below is
 * the three-point comb's, and its CSS now lives in the sandbox.
 */
export function HexShell({ className }: { className: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 115.47"
      preserveAspectRatio="none"
      aria-hidden
    >
      <polygon points={HEX_POINTS} />
    </svg>
  );
}

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

// The stage's artifact tile. Grown about a fixed centre at 27% of the cell so the
// size knob does not also walk the tile up the face (sandbox round L, scale 1.60).
// `pointer-events: none` — the whole hex stays the link.
const TILE_SCALE = 1.6;
const TILE_W = 94 * TILE_SCALE;
const TILE_H = 58 * TILE_SCALE;

function StageTile({ stage, kind }: { stage: GuideStage; kind: HoneycombStage["kind"] }) {
  const src = stageArt(stage);
  const ghostSrc = stageArtGhost(stage);
  if (!src || !ghostSrc) return null;
  const box: React.CSSProperties = {
    left: `${(100 - TILE_W) / 2}%`,
    right: `${(100 - TILE_W) / 2}%`,
    top: `${27 - TILE_H / 2}%`,
    height: `${TILE_H}%`,
  };

  // A stage the learner has reached draws its artifact. One they have not draws
  // the SAME artifact as a gold GHOST — the thing itself, drawn in one colour at
  // low weight. That tells them what the phase produces without handing it over,
  // and it matches the stand-in language the skill tree uses for a board with no
  // render yet.
  //
  // The ghost masks against `stageArtGhost`, NOT against the artifact PNG. Masking
  // the PNG's own alpha was the shipped behaviour and it was wrong twice over: on
  // the four kicad renders that alpha carries a baked contact shadow, which came
  // through as a smear offset below the board, and on the four svg plots it is a
  // solid sheet rectangle, so the fill flooded it into a featureless slab. The
  // ghost maps are built from luminance, where the drawing actually lives.
  if (kind === "done" || kind === "current") {
    return (
      <span aria-hidden className="gh-art" style={{ ...box, backgroundImage: `url(${src})` }} />
    );
  }
  return (
    <span aria-hidden className="gh-art gh-art-soon" style={box}>
      <span
        className="gh-art-soon-fill"
        style={{ WebkitMaskImage: `url(${ghostSrc})`, maskImage: `url(${ghostSrc})` }}
      />
    </span>
  );
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
  // container width; the spine solves everything else from it
  const [cw, setCw] = useState(0);
  // the hovered/focused cell, which lights its own outline in the scene
  const [hot, setHot] = useState<number | null>(null);

  const measure = useCallback(() => {
    const el = ref.current;
    if (el) setCw(el.clientWidth);
  }, []);

  useIsoLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, [measure]);

  const w = cw > 0 ? fitCellWidth(stages.length, cw) : 0;
  const { boxes, height } = placeSpine(stages.length, w, cw);
  const solids = projectSpine(boxes, cw, height);

  // A comb with every stage done has no current cell, so nothing sits at full
  // size and nothing anchors it. That end state gets its own treatment: the
  // tiles all rest a size larger, and the hexes drop the gold wash for the
  // verified channel, so a finished build reads as finished at a glance rather
  // than as a comb waiting for its next step. Both live in CSS off this class.
  const allDone = stages.length > 0 && stages.every((s) => s.kind === "done");

  return (
    <div
      ref={ref}
      className={`gh${allDone ? " comb-complete" : ""}`}
      style={{ position: "relative", height }}
    >
      {solids.length > 0 ? (
        <SpineCombScene
          solids={solids}
          sceneW={cw}
          sceneH={height}
          cellW={w}
          cells={stages.map((s) => ({ kind: s.kind }))}
          hot={hot}
        />
      ) : null}
      {stages.map((s, i) => {
        const b = boxes[i];
        if (!b) return null;
        return (
          <Link
            key={s.stage}
            href={href(s.stage)}
            aria-current={s.kind === "current" ? "step" : undefined}
            aria-label={`Stage ${s.num} — ${s.title} (${s.statusText})`}
            className={`gh-node ${s.kind}`}
            // The hex itself lives in the scene svg below this; what sits here is the
            // cell's content, at exactly its measured box. No transform and no scale:
            // an unforeshortened one-point face carries upright HTML at true size,
            // which is the whole reason this projection replaced the three-point grid.
            style={{
              position: "absolute",
              left: b.left,
              top: b.top,
              width: b.w,
              height: b.h,
              zIndex: 2,
              // Clipped to the hex, and this is a HIT-TEST fix, not a cosmetic one:
              // the cells are rectangles that overlap their neighbours, all at the
              // same z-index, so without it part of each cell's own visible face
              // navigates to the NEXT stage. Never applied to the art layer, which
              // deliberately overflows its hex.
              clipPath: SPINE_CLIP,
            }}
            onMouseEnter={() => setHot(i)}
            onMouseLeave={() => setHot((h) => (h === i ? null : h))}
            onFocus={() => setHot(i)}
            onBlur={() => setHot((h) => (h === i ? null : h))}
          >
            <span
              className="comb-num"
              aria-hidden
              // The ordinal is a watermark spanning the whole face rather than the
              // old top-third hero: the stage's artifact now owns that space.
              // Saira's two digits run about one em wide, so a font-size of the
              // cell width fills the cell; the class clips it to the hex.
              style={{ fontSize: Math.round(b.w * 0.98) }}
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

      {/* The artwork, in a LAYER of its own rather than inside each cell.
          It has to sit above every hex in the comb, not just its own, and a cell is an
          absolutely-positioned z-indexed box, which is a stacking context: art
          parented inside one can never rise above the next cell's outline, so at spine
          sizes those outlines cut straight across the boards. The layer takes no
          pointer events and reads its hover state from the same `hot` index the scene
          does, so hoisting it costs nothing behaviourally.

          A locked stage still stays type-only on purpose: showing the artifact of work
          not yet done gives away the answer and flattens the ladder into a gallery
          (sandbox round K, owner pick K5). */}
      <div className="gh-art-layer">
        {stages.map((s, i) => {
          const b = boxes[i];
          if (!b) return null;
          return (
            <div
              key={s.stage}
              className={`gh-node ${s.kind}${hot === i ? " hot" : ""}`}
              style={{
                position: "absolute",
                left: b.left,
                top: b.top,
                width: b.w,
                height: b.h,
              }}
            >
              <StageTile stage={s.stage} kind={s.kind} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
