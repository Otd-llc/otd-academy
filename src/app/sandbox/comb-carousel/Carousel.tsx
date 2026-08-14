"use client";

// THE ALPHA CAROUSEL, as an audition surface.
//
// Composes the SAME primitives the shipped comb does - `fitCellWidth`,
// `placeSpine`, `projectSpine`, `SpineCombScene`, the `.gh-node` markup - rather than
// redrawing any of it, so what is on screen here is the product's comb with a window
// over it. A redrawing would drift from `GuideHoneycomb` the first time either
// changed, and the whole point of the spine landing in `lib/` was that the numbers
// live in one place.
//
// If the owner picks a treatment, this gets promoted into `GuideHoneycomb` the way
// `comb-spine.ts` was promoted out of the rounds that produced it. Until then it is a
// sandbox round and it gets deleted before the PR.
//
// WHAT VARIES between the treatments is the GHOST, because that is the genuinely open
// question. The window rule, the centring and the edge cases are the owner's and are
// fixed, tested geometry in `comb-carousel.ts`.
//
// ASCII only.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { SpineCombScene } from "@/components/guide/SpineCombScene";
import { StageTile } from "@/components/guide/GuideHoneycomb";
import type { GuideStage } from "@/lib/guide-templates/stage-skeletons";
import { placeSpine, projectSpine, spineStroke, SPINE_CLIP, SPINE_MAX_CELL, SPINE_UNIT_CORNERS } from "@/lib/comb-spine";
import { combWindow, centreOffset, fitWindowCell, ghostAlpha, isLit } from "@/lib/comb-carousel";

const GOLD_TOK = "var(--color-command-gold)";


// Same guard the shipped comb uses: it defines this locally rather than exporting it,
// so this round matches rather than reaching into it.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export type Cell = {
  /** The real stage, so the cell can draw its real artifact tile. */
  stage: GuideStage;
  num: string;
  title: string;
  lead: string;
  kind: "done" | "current" | "blocked" | "pending";
  statusText: string;
};

/**
 * What the ART does outside the window.
 *
 * The artwork is the reason a hex reads as a STAGE rather than as a numbered cell, so
 * how it ghosts is a separate question from how the type and the prism ghost.
 */
export type ArtMode = "kind" | "lit-only" | "always-ghost" | "art-only";

/** How far the veil eats the run at each end, as a share of the viewport. */
export type Veil = { top: number; bottom: number } | null;

/** The ghost treatments on audition. Only this varies between the options. */
export type Ghost = "alpha" | "narrow" | "veil";

export const GHOSTS: { id: Ghost; name: string; claim: string }[] = [
  { id: "alpha", name: "Alpha only", claim: "The ghosts keep their prism and their content and simply recede. The plainest reading of the brief, and the control the other three are judged against." },
  // `flat` / "No prism" WAS here and is deleted rather than left on the board. It
  // claimed the ghosts lose their cast and keep their outline, and it never did that:
  // `SpineCombScene` has no mode that omits the side quads, and `.ghp-cell.dim` - the
  // only recede it had - fades the whole group, sides included. Once the per-cell
  // `alpha` fix landed it got worse: an inline opacity out-specifies the `dim` class
  // rule, so the option rendered pixel-identical to `alpha`. An audition option that
  // does not do what its card says is worse than no option, because the pick it
  // produces is a pick against a description.
  { id: "narrow", name: "Type drops", claim: "Ghosts keep the hex and lose the title and chip. Says how long the course is without asking anyone to read eight things they are not on." },
  { id: "veil", name: "Veiled ends", claim: "Alpha, plus a gradient that takes the run out at the top and bottom of the viewport. The comb reads as continuing past the frame rather than stopping." },
];

export function Carousel({
  cells,
  current,
  ghost,
  viewH,
  veil,
  art = "kind",
  width,
  video = false,
  show,
  centreOn,
  complete = false,
  lock = "none",
  lockP = 1,
}: {
  cells: Cell[];
  current: number;
  ghost: Ghost;
  /**
   * Viewport height in px. OMIT IT to measure the container instead, which is what
   * any caller sized in container units must do: a fixed px height inside a
   * `cqh`-sized box is the same category of error as a fixed px width.
   */
  viewH?: number;
  /** Overrides the `veil` ghost's fixed gradient, for the veil round. */
  veil?: Veil;
  art?: ArtMode;
  /**
   * Width in px, supplied rather than measured.
   *
   * Every comb in this codebase measures its own container with a ResizeObserver and
   * renders nothing at zero. That is right on a page and wrong in a frame-grab
   * pipeline, where the size is KNOWN (1920x1080) and a render that waits for a
   * measurement is a render that can screenshot empty. Passing it in makes the frame
   * deterministic from the first paint.
   */
  width?: number;
  /** Lifts the comb's px-clamped type ceilings for a video frame. */
  video?: boolean;
  /**
   * How many cells span the viewport. Default 3.6, so the nearest ghosts break the
   * edges. Pass 3 to fill the box with the WINDOW itself: the cells come out about
   * 18% larger, which is the difference between a readable card and one under the
   * 200px floor where the comb switches to its compact layout.
   */
  show?: number;
  /**
   * A FRACTIONAL centre, for scrolling between cells.
   *
   * `current` stays an integer because the WINDOW is a set of cells - you cannot
   * light half a hex - but the run's position is continuous, so an entry that
   * travels from one stage to the next needs the two separated. Omit it and the
   * run sits on `current`, which is every static case.
   */
  centreOn?: number;
  /**
   * The finished state, which the product already owns.
   *
   * `.comb-complete` swaps every done cell onto the VERIFIED channel - green
   * strokes, green chips, a deep-space face - and lifts the artwork's rest
   * scale. It exists because a comb with nothing current has no focal point
   * otherwise, and it has a light-theme companion written specifically so the
   * finished state survives the theme flip. Reaching for it is the difference
   * between a celebration and a second one invented alongside it.
   */
  complete?: boolean;
  /** A target-lock treatment drawn over the cell the run is landing on. */
  lock?: "none" | "reticle" | "scan" | "crosshair" | "trace" | "vise" | "trace-lock" | "trace-vise";
  /** Lock progress, 0 to 1. A pure function of `t` supplied by the caller. */
  lockP?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [cw, setCw] = useState(0);
  const [ch, setCh] = useState(0);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCw(el.clientWidth);
    setCh(el.clientHeight);
  }, []);
  useIsoLayoutEffect(() => {
    if (width !== undefined && viewH !== undefined) return;
    measure();
    const ro = new ResizeObserver(measure);
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, [measure, width, viewH]);
  const cwEff = width ?? cw;
  // SHARES OF THE FRAME, NEVER PIXELS. An absolute height here is the same error
  // as an absolute width: the ladder passed 702px, computed against a 1080 frame,
  // and every treatment tile in the round is a fraction of that - so the comb laid
  // out a full-frame run inside a thumbnail and collapsed into a sliver.
  const vh = viewH ?? ch;

  // The run is laid out WHOLE - every cell at its true position - and then slid, so a
  // ghost sits exactly where it will sit when the window reaches it. Laying out only
  // the window would make the cells jump as the current one advanced.
  // Sized from the VIEWPORT, not the column: see `fitWindowCell`. Clamped to the
  // column so a narrow rail never overflows sideways.
  // Capped at the shipped maximum. Keep an eye on the 200px container-query
  // breakpoint: below it globals.css switches to the COMPACT card, which hides the
  // lead and re-places the number, title and chip. `show` is the knob that buys
  // headroom when a box is short.
  const raw = Math.min(fitWindowCell(vh, show), cwEff / 1.5, SPINE_MAX_CELL);
  const w = cwEff > 0 ? raw : 0;
  const { boxes, height } = placeSpine(cells.length, w, cwEff);
  const solids = projectSpine(boxes, cwEff, height);
  const win = combWindow(cells.length, current);
  const dy = w > 0 ? centreOffset(centreOn ?? win.current, w, vh) : 0;
  const measured = boxes.length === cells.length && height > 0;

  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        // Only set a height when one was GIVEN. A caller sized in container units
        // supplies its own via CSS and this must not overwrite it with a number.
        ...(viewH !== undefined ? { height: viewH } : { height: "100%" }),
        overflow: "hidden",
        // The veil takes the run out at both ends, so it reads as continuing past the
        // frame. A hard edge reads as the course stopping there.
        ...(() => {
          const v = veil ?? (ghost === "veil" ? { top: 22, bottom: 78 } : null);
          if (!v) return {};
          const g = `linear-gradient(to bottom, transparent 0%, #000 ${v.top}%, #000 ${v.bottom}%, transparent 100%)`;
          return { WebkitMaskImage: g, maskImage: g };
        })(),
      }}
    >
      <div className={`gh${video ? " comb-video" : ""}${complete ? " comb-complete" : ""}`} style={{ position: "absolute", left: 0, right: 0, top: dy, height }}>
        {measured && solids.length > 0 ? (
          <SpineCombScene
            solids={solids}
            sceneW={cwEff}
            sceneH={height}
            cellW={w}
            // `dim` is the scene's own recede state, so a ghost that drops its prism
            // asks the shipped component for that rather than inventing a second
            // vocabulary for the same idea.
            // The PRISMS recede too. Without an alpha here the scene is one svg and
            // the cell's HTML opacity reaches its type and its artwork and never its
            // hex, so a ghost sat outlined at full strength around faded contents -
            // which is not what any of these treatments claims to do.
            cells={cells.map((c, i) => ({ kind: c.kind, alpha: ghostAlpha(win, i) }))}
            hot={null}
          />
        ) : null}

        {measured
          ? cells.map((c, i) => {
              const b = boxes[i]!;
              const lit = isLit(win, i);
              const a = ghostAlpha(win, i);
              return (
                <div
                  key={i}
                  className={`gh-node ${c.kind}`}
                  style={{
                    position: "absolute",
                    left: b.left,
                    top: b.top,
                    width: b.w,
                    height: b.h,
                    zIndex: 2,
                    opacity: a,
                    clipPath: SPINE_CLIP,
                  }}
                >
                  <span className="comb-num" aria-hidden style={{ fontSize: Math.round(b.w * 0.98) }}>
                    {c.num}
                  </span>
                  {/* `narrow` drops the type on the ghosts: the run still says how
                      long it is, without asking anyone to read eight things they are
                      not on. */}
                  {lit || (ghost !== "narrow" && art !== "art-only") ? (
                    // A ghost's type is DECORATION - it says how long the run is, and
                    // at the falloff's own numbers it is under AA from one ring out
                    // and at 1.28:1 on the floor. Exposing unreadable text to a screen
                    // reader is the worst of both: too faint to read, fully announced.
                    // `.comb-num` is already aria-hidden for the same reason.
                    <div aria-hidden={!lit || undefined} style={{ display: "contents" }}>
                      <span className="gh-m">
                        <span className="gh-title">{c.title}</span>
                        {c.lead ? <span className="gh-lead">{c.lead}</span> : null}
                      </span>
                      <span className="gh-status">
                        <span className="gh-chip">{c.statusText}</span>
                      </span>
                    </div>
                  ) : null}
                </div>
              );
            })
          : null}

        {/* THE LOCK, over the cell the run is landing on.
            It reads the cell's REAL box out of the same `boxes` the scene was
            projected from, so the reticle cannot drift from the hex it is
            supposed to be gripping - which it would the moment anyone changed
            the nestle ratio if this were positioned by hand. */}
        {measured && lock !== "none"
          ? (() => {
              const b = boxes[win.current];
              if (!b) return null;
              // CONVERGES AS A HEX, because the thing it is gripping is one.
              // Square brackets on a hexagonal comb read as a crop marquee from
              // some other application; the lock has to be cut from the same six
              // corners the cell is, which is why it uses `SPINE_UNIT_CORNERS`
              // rather than a shape of its own.
              //
              // The bracket EFFECT comes from a dash pattern rather than from six
              // separately positioned arms: `pathLength` normalises the outline to
              // 600 regardless of cell size, so six dashes at a 100 interval land
              // one per edge and the gaps sit on the vertices. That also means the
              // gripped shape and the drawn shape can never disagree.
              const cx = b.left + b.w / 2;
              const cy = b.top + b.h / 2;
              const ptsAt = (g: number) =>
                SPINE_UNIT_CORNERS.map(([ux, uy]) => {
                  const x = b.left + ux * b.w;
                  const y = b.top + uy * b.h;
                  return `${(cx + (x - cx) * g).toFixed(2)},${(cy + (y - cy) * g).toFixed(2)}`;
                }).join(" ");
              // `vise` closes from further out, so the two halves are seen to
              // travel rather than simply resolving.
              // The trace leads and the brackets follow, so the sequence reads
              // as find-then-grip rather than as two things happening at once.
              const traceP = Math.min(1, lockP / 0.6);
              const gripP = Math.max(0, (lockP - 0.45) / 0.55);
              // The brackets REST PROUD of the outline rather than flush on it.
              // Closed all the way they merge with the traced hex and the held
              // state shows no grip at all - the whole acquisition disappears
              // into a slightly brighter outline the moment it finishes.
              const combined = lock === "trace-lock" || lock === "trace-vise";
              const viseLike = lock === "vise" || lock === "trace-vise";
              const rest = combined ? 1.07 : 1;
              const gp = combined ? gripP : lockP;
              // A vise travels from further out, so the two halves are SEEN to
              // close rather than simply resolving into place.
              const grow = rest + (1 - gp) * (viseLike ? 0.9 : 0.38);
              const pts = ptsAt(grow);
              const wgt = Math.max(2, spineStroke("face", b.w) * 1.15);
              return (
                // UNDER THE ARTWORK, over the cell. The art layer is z-index 6 and
                // deliberately overhangs its hex, so a lock at 7 drew its outline
                // straight across the front of the artifact - the grip appeared to
                // pass in front of the board it is supposed to be gripping. At 5 it
                // sits above the cell's own type and behind the tile, which is the
                // order the comb already uses for everything else.
                <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 5 }}>
                  {lock === "scan" ? (
                    <div
                      style={{
                        position: "absolute",
                        left: b.left,
                        width: b.w,
                        top: b.top + b.h * lockP,
                        height: `${Math.max(2, spineStroke("face", b.w))}px`,
                        background: GOLD_TOK,
                        opacity: lockP < 1 ? 0.9 : 0,
                      }}
                    />
                  ) : null}
                  {/* CROSSHAIR - two hairlines run in from the frame edges and
                      stop on the cell's own centre. Nothing surrounds the hex;
                      the frame points at it. */}
                  {lock === "crosshair" ? (
                    <>
                      <div style={{ position: "absolute", left: 0, top: cy - wgt / 2, width: (b.left + b.w / 2) * lockP, height: wgt, background: GOLD_TOK, opacity: lockP }} />
                      <div style={{ position: "absolute", right: 0, top: cy - wgt / 2, width: (cwEff - b.left - b.w / 2) * lockP, height: wgt, background: GOLD_TOK, opacity: lockP }} />
                      <div style={{ position: "absolute", left: cx - wgt / 2, top: 0, height: (b.top + b.h / 2) * lockP, width: wgt, background: GOLD_TOK, opacity: lockP }} />
                    </>
                  ) : null}
                  {lock === "reticle" || lock === "scan" || lock === "trace" || lock === "vise" || lock === "trace-lock" || lock === "trace-vise" ? (
                    <svg
                      viewBox={`0 0 ${cwEff} ${height}`}
                      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
                      aria-hidden
                    >
                      {/* TRACE draws the outline ONCE around the perimeter and
                          holds it - the hex is described rather than clamped.
                          VISE closes two half-hex brackets in from left and
                          right. RETICLE and SCAN keep the six corner brackets.
                          One polygon, three dash regimes: the shape can never
                          disagree with itself. */}
                      {/* TRACE + LOCK is two passes on the same six corners: the
                          outline draws itself around the perimeter at rest size,
                          and the brackets converge onto it from outside. The
                          trace describes the hex, the brackets take hold of it -
                          so the second reads as arriving on something already
                          found, rather than as two effects sharing a frame. */}
                      {lock === "trace-lock" || lock === "trace-vise" ? (
                        <polygon
                          points={ptsAt(1)}
                          fill="none"
                          stroke={GOLD_TOK}
                          strokeWidth={wgt}
                          strokeLinecap="round"
                          pathLength={600}
                          strokeDasharray={`${600 * traceP} 600`}
                          opacity={0.85}
                        />
                      ) : null}
                      <polygon
                        points={lock === "trace" ? ptsAt(1) : pts}
                        fill="none"
                        stroke={GOLD_TOK}
                        strokeWidth={wgt}
                        strokeLinecap={lock === "trace" ? "round" : "square"}
                        pathLength={600}
                        strokeDasharray={
                          lock === "trace" ? `${600 * lockP} 600` : viseLike ? "150 150" : "34 66"
                        }
                        strokeDashoffset={lock === "trace" ? 0 : viseLike ? -75 : -17}
                        opacity={lock === "trace" ? 1 : combined ? gripP : lockP}
                      />
                    </svg>
                  ) : null}
                </div>
              );
            })()
          : null}

        {/* THE ARTWORK, in a layer of its own, exactly as the shipped comb does it.
            It has to sit above EVERY hex, not just its own: a cell is an absolutely
            positioned z-indexed box, which is a stacking context, so art parented
            inside one can never rise above the next cell's outline and at spine sizes
            those outlines cut straight across the boards.

            The first cut of this round omitted the layer entirely, which is why the
            hexes had no icons - the cells carried their number, title and chip and
            nothing else. */}
        {measured ? (
          <div className="gh-art-layer">
            {cells.map((c, i) => {
              const b = boxes[i]!;
              const lit = isLit(win, i);
              if (art === "lit-only" && !lit) return null;
              // `always-ghost` forces the unreached treatment on every off-window
              // cell, so the run reads as one drawing rather than as a mix of
              // photographs and ghosts.
              const kind = !lit && art === "always-ghost" ? "pending" : c.kind;
              return (
                <div
                  key={i}
                  className={`gh-node ${kind}`}
                  style={{
                    position: "absolute",
                    left: b.left,
                    top: b.top,
                    width: b.w,
                    height: b.h,
                    opacity: ghostAlpha(win, i),
                  }}
                >
                  <StageTile stage={c.stage} kind={kind} />
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
