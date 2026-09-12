"use client";

// SANDBOX — one variant's comb, measured and drawn.
//
// Everything the round varies passes through here: the layout family (single-file
// ribbon vs portrait grid), the projection (one-point vs the shipped three-point
// control), how the cell size is solved (fill the width and scroll, or fit the whole
// comb into the visible box), and whether the cells' type is clamped the way it ships
// or left free to grow with the hex.
//
// The two projections differ in more than their numbers, so they take different
// paths through the component:
//
//   ONE-POINT   faces lie in the picture plane, so a cell's content is positioned at
//               its measured box and nothing is scaled. Slabs paint in a pass before
//               faces, masked by every face (see OnePointScene).
//   THREE-POINT the shipped `buildCombScene` + `HexPrismScene`: faces foreshorten, so
//               content is BILLBOARDED onto each projected face and the prisms sort
//               by depth. Kept here as the control the vertical cuts are judged
//               against, drawn from the same measured boxes so only the camera
//               differs.
//
// FOUR LAYERS, in this order, and the order is the point:
//
//   0  the prism scene   the hexes themselves
//   2  the cells' text   number watermark, title, lead, detail, chip
//   6  the artwork       the board / stage tile, over everything
//
// There is no direction indicator. The comb used to carry one (a triangle on each
// seam, then a Hex Cluster dovetail), and on a STAGGERED SPINE it is redundant: a
// single-file run that alternates left and right already has exactly one way to read
// it, and a mark on every seam is eight marks saying what the shape says once.
//
// The artwork is a LAYER rather than a child of each cell. It has to sit above every
// hex in the comb, not just its own, and a cell is an absolutely-positioned,
// z-indexed box, which is a stacking context: art inside one can never rise above the
// next cell's outline, so at the sizes a vertical comb uses, edges cut across the
// boards. Hoisting the art into a sibling layer is the only fix that does not depend
// on which cell happens to be painted last. It is `pointer-events: none` and takes
// its hover state from the same `hot` index the scene does, so lifting it out of the
// cell costs nothing behaviourally.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Stage } from "@prisma/client";
import { stageArt, stageArtGhost } from "@/lib/guide-stage-art";
import { COMB_STANDIN_GHOST, combPoster } from "@/lib/board-posters";
import { buildCombScene } from "@/components/guide/GuideHoneycomb";
import { HexPrismScene } from "@/components/guide/HexPrismScene";
import { OnePointScene } from "./OnePointScene";
import {
  fitCellWidth,
  layoutUnits,
  MAX_CELL,
  placeBoxes,
  projectOnePoint,
  type Box,
  type LayoutSpec,
  type OnePointCam,
} from "./geometry";
import { COURSE_CELLS, GUIDE_CELLS, TRACK_COLOR, type CellKind } from "./fixtures";

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export type CombId = "guide" | "courses";
export type FitMode = "width" | "box";

export interface Variant {
  id: string;
  label: string;
  note: string;
  layout: LayoutSpec;
  /** null = the shipped three-point camera (the control). */
  cam: OnePointCam | null;
}

// ── the artwork ───────────────────────────────────────────────────────

const TILE_SCALE = 1.6;
const TILE_W = 94 * TILE_SCALE;
const TILE_H = 58 * TILE_SCALE;

function StageTile({ stage, kind }: { stage: string; kind: CellKind }) {
  const src = stageArt(stage as Stage);
  const ghost = stageArtGhost(stage as Stage);
  if (!src || !ghost) return null;
  const box: React.CSSProperties = {
    left: `${(100 - TILE_W) / 2}%`,
    right: `${(100 - TILE_W) / 2}%`,
    top: `${27 - TILE_H / 2}%`,
    height: `${TILE_H}%`,
  };
  if (kind === "done" || kind === "current") {
    return <span aria-hidden className="gh-art" style={{ ...box, backgroundImage: `url(${src})` }} />;
  }
  return (
    <span aria-hidden className="gh-art gh-art-soon" style={box}>
      <span
        className="gh-art-soon-fill"
        style={{ WebkitMaskImage: `url(${ghost})`, maskImage: `url(${ghost})` }}
      />
    </span>
  );
}

const ART_SCALE = 1.3;

function BoardArt({ slug, isCurrent }: { slug: string; isCurrent: boolean }) {
  const poster = combPoster(slug);
  const w = (isCurrent ? 96 : 82) * ART_SCALE;
  const h = (isCurrent ? 56 : 46) * ART_SCALE;
  const inset = (100 - w) / 2;
  const box: React.CSSProperties = {
    position: "absolute",
    pointerEvents: "none",
    left: `${inset}%`,
    right: `${inset}%`,
    top: `${26 - h / 2}%`,
    height: `${h}%`,
  };
  if (poster) {
    return <span aria-hidden className="sk-art gh-art" style={{ ...box, backgroundImage: `url(${poster})` }} />;
  }
  return (
    <span aria-hidden className="sk-art-soon gh-art" style={box}>
      <span
        className="sk-art-soon-fill"
        style={{ WebkitMaskImage: `url(${COMB_STANDIN_GHOST})`, maskImage: `url(${COMB_STANDIN_GHOST})` }}
      />
    </span>
  );
}

function CellArt({ comb, i }: { comb: CombId; i: number }) {
  if (comb === "guide") {
    const c = GUIDE_CELLS[i]!;
    return <StageTile stage={c.stage} kind={c.kind} />;
  }
  const c = COURSE_CELLS[i]!;
  return <BoardArt slug={c.slug} isCurrent={c.kind === "current"} />;
}

// ── the cell's type ───────────────────────────────────────────────────
// The shipped `.gh-*` element names in the shipped order, so the shipped stylesheet
// sizes them. A third "detail" tier lived here briefly and is gone: the cells were
// already carrying a number watermark, a board, a title, a lead and a chip, and a
// fourth string is what tipped the stack from dense to unreadable.

function CellInner({ comb, i, cellW }: { comb: CombId; i: number; cellW: number }) {
  // Saira's two digits run about one em wide, so a font-size of the cell width fills
  // the face; `.comb-num` clips it to the hex.
  const numSize = Math.round(cellW * 0.98);
  if (comb === "guide") {
    const c = GUIDE_CELLS[i]!;
    return (
      <>
        <span className="comb-num" aria-hidden style={{ fontSize: numSize }}>
          {c.num}
        </span>
        <span className="gh-m">
          <span className="gh-title">{c.title}</span>
          <span className="gh-lead">{c.lead}</span>
        </span>
        <span className="gh-status">
          <span className="gh-chip">{c.statusText}</span>
        </span>
      </>
    );
  }
  const c = COURSE_CELLS[i]!;
  return (
    <>
      <span className="comb-num" aria-hidden style={{ fontSize: numSize }}>
        {String(i + 1).padStart(2, "0")}
      </span>
      <span className="gh-m">
        <span className="gh-title">
          <span
            aria-hidden
            className={`mr-1.5 inline-block h-[0.5em] w-[0.5em] shrink-0 rounded-full align-middle ${TRACK_COLOR[c.track]}`}
            style={{ backgroundColor: "currentColor" }}
          />
          {c.title}
          {c.starred ? (
            <span aria-hidden className="ml-1 text-command-gold">
              ★
            </span>
          ) : null}
        </span>
      </span>
      <span className="gh-status">
        <span className="gh-chip">{c.statusText}</span>
      </span>
    </>
  );
}

// ── the variant ───────────────────────────────────────────────────────

export function CombStage({
  variant,
  comb,
  fit,
  stageH,
  maxCell = MAX_CELL,
  strokeMult = 1,
  numAlpha = 32,
  onSolve,
}: {
  variant: Variant;
  comb: CombId;
  fit: FitMode;
  /** the visible box the comb is judged inside, in px. 0 means no box: the comb is
   *  as tall as it is and the page scrolls, which is what the real routes do. */
  stageH: number;
  /** the shipped cell cap. null lifts it. */
  maxCell?: number | null;
  /** live trim on the hex outline weight, 1 = the lesson comb's ratios. */
  strokeMult?: number;
  /** the ordinal watermark's strength, as a percentage. Shipped is 32. */
  numAlpha?: number;
  /** the solved cell width, reported back so a caller can show which disclosure
   *  tier actually fired instead of asserting one in prose. */
  onSolve?: (cellW: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [cw, setCw] = useState(0);
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

  // One shape for both combs, so the layout / projection / paint path below never has
  // to know which one it is drawing.
  const cells: { kind: CellKind; dim: boolean; goal: boolean }[] =
    comb === "guide"
      ? GUIDE_CELLS.map((c) => ({ kind: c.kind, dim: false, goal: false }))
      : COURSE_CELLS.map((c) => ({ kind: c.kind, dim: c.dim, goal: c.starred }));
  const count = cells.length;
  const kinds = cells.map((c) => ({ kind: c.kind, dim: c.dim }));
  const cls = (i: number) => {
    const c = cells[i]!;
    return `gh-node ${c.kind}${c.dim ? " sk-dim" : ""}${c.goal ? " sk-goal" : ""}`;
  };
  const artCls = (i: number) => `${cls(i)}${hot === i ? " hot" : ""}`;

  const hoverProps = (i: number) => ({
    onMouseEnter: () => setHot(i),
    onMouseLeave: () => setHot((h) => (h === i ? null : h)),
  });

  // The whole point of the round's fit toggle. "box" solves the cell width against
  // BOTH the container width and the height it is allowed to occupy, so the comb
  // fills the space it is given; "width" is the shipped rule, where the cell fills
  // the width and the run is as tall as it is.
  const w =
    cw > 0 ? fitCellWidth(variant.layout, count, cw, fit === "box" ? stageH : null, maxCell) : 0;
  const { boxes, height } = placeBoxes(variant.layout, count, w, cw);

  // Reported in an effect rather than during render: the caller stores it, and a
  // setState during render is a loop waiting for a resize to trigger it. Declared
  // here and not lower down because every early return below this point is a return,
  // and a hook after one of them would not run on every render.
  useEffect(() => {
    onSolve?.(w);
  }, [w, onSolve]);

  // ── three-point control ──
  if (variant.cam === null) {
    // The control cannot use the fit solve above, and the reason is worth stating
    // because it is the first thing that goes wrong when you try to make the shipped
    // comb fill a box. Its scene svg is drawn at the CONTAINER's width and scaled to
    // fit, so the rendered height is `containerWidth x aspect` and shrinking the
    // cells does not shrink it at all: smaller cells in the same container just
    // redraw the same scene at the same size. The only lever is the container.
    //
    // So: probe the aspect once with the comb filling its container, then set the
    // container to the width that makes `width x aspect` equal the box. Exact in one
    // step, because the projection is scale-invariant in the cell width.
    const { wu } = layoutUnits(variant.layout, count);
    const probeW = Math.min(cw / wu, maxCell ?? Infinity);
    const probe = buildCombScene(placeBoxes(variant.layout, count, probeW, cw).boxes, cw);
    const aspect = cw > 0 && probe.height > 0 ? probe.height / cw : 0;
    const cW = fit === "box" && aspect > 0 ? Math.min(cw, stageH / aspect) : cw;
    const cellBoxes = placeBoxes(
      variant.layout,
      count,
      Math.min(cW / wu, maxCell ?? Infinity),
      cW,
    ).boxes;
    const scene = buildCombScene(cellBoxes, cW);
    return (
      <Frame
        outerRef={ref}
        comb={comb}
        stageH={stageH}
        width={cW}
        height={scene.height}
        centred={fit === "box"}
        numAlpha={numAlpha}
      >
        {scene.solids.length > 0 ? (
          <HexPrismScene solids={scene.solids} vb={scene.vb} cells={kinds} hot={hot} />
        ) : null}
        {cellBoxes.map((b, i) => {
          const style = scene.place(i);
          if (!style) return null;
          return (
            <div key={i} className={cls(i)} style={style} {...hoverProps(i)}>
              <CellInner comb={comb} i={i} cellW={b.w} />
            </div>
          );
        })}
        <ArtLayer boxes={cellBoxes} comb={comb} artCls={artCls} place={scene.place} />
      </Frame>
    );
  }

  // ── one-point ──
  const solids = boxes.length > 0 ? projectOnePoint(boxes, variant.cam, cw, height) : [];
  return (
    <Frame
      outerRef={ref}
      comb={comb}
      stageH={stageH}
      width={cw}
      height={height}
      centred={fit === "box"}
      numAlpha={numAlpha}
    >
      {solids.length > 0 ? (
        <OnePointScene
          solids={solids}
          sceneW={cw}
          sceneH={height}
          cellW={w}
          cells={kinds}
          hot={hot}
          strokeMult={strokeMult}
        />
      ) : null}
      {boxes.map((b, i) => (
        <div
          key={i}
          className={cls(i)}
          // No transform and no scale: an unforeshortened face carries its content at
          // exactly the size the layout says. This is the difference the round is
          // really about.
          style={{ position: "absolute", left: b.left, top: b.top, width: b.w, height: b.h, zIndex: 2 }}
          {...hoverProps(i)}
        >
          <CellInner comb={comb} i={i} cellW={b.w} />
        </div>
      ))}
      <ArtLayer boxes={boxes} comb={comb} artCls={artCls} />
    </Frame>
  );
}

/**
 * The artwork, hoisted out of the cells so it paints over the whole comb.
 *
 * `place` is the three-point control's billboard transform; the one-point combs pass
 * nothing and the art sits on the measured box, because their faces do not
 * foreshorten. Either way the z-index is forced above every other layer, overriding
 * the depth ordering `place` supplies for the prisms.
 */
function ArtLayer({
  boxes,
  comb,
  artCls,
  place,
}: {
  boxes: Box[];
  comb: CombId;
  artCls: (i: number) => string;
  place?: (i: number) => React.CSSProperties | null;
}) {
  return (
    <div className="cv-art-layer">
      {boxes.map((b, i) => {
        const style = place ? place(i) : null;
        if (place && !style) return null;
        return (
          <div
            key={i}
            className={artCls(i)}
            style={
              style
                ? { ...style, zIndex: undefined }
                : { position: "absolute", left: b.left, top: b.top, width: b.w, height: b.h }
            }
          >
            <CellArt comb={comb} i={i} />
          </div>
        );
      })}
    </div>
  );
}

function Frame({
  outerRef,
  comb,
  stageH,
  width,
  height,
  centred,
  numAlpha,
  children,
}: {
  /** The measured element is the STAGE, not the comb: the three-point control sizes
   *  its own comb narrower than the stage to fit the box, and measuring that would
   *  feed the narrowed width straight back into the next solve. */
  outerRef: React.RefObject<HTMLDivElement | null>;
  comb: CombId;
  stageH: number;
  width: number;
  height: number;
  centred: boolean;
  numAlpha: number;
  children: React.ReactNode;
}) {
  // stageH 0 means "no judging box": the comb is as tall as it is and the PAGE
  // scrolls, which is what the real routes do. The bordered fixed-height scroll box
  // is a sandbox affordance for comparing variants side by side, and rendering it
  // around a comb that is meant to look shipped would put a rule and a scrollbar into
  // the thing being judged.
  const framed = stageH > 0;
  return (
    <div
      ref={outerRef}
      className={framed ? "overflow-auto border-t border-panel-border/60" : undefined}
      style={{
        height: framed ? stageH : undefined,
        display: "flex",
        justifyContent: "center",
        alignItems: framed && centred ? "center" : "flex-start",
      }}
    >
      <div
        className={`gh${comb === "courses" ? " sk-lean" : ""}`}
        style={
          {
            position: "relative",
            width,
            height,
            flex: "0 0 auto",
            "--num-alpha": `${numAlpha}%`,
          } as React.CSSProperties
        }
      >
        {children}
      </div>
    </div>
  );
}
