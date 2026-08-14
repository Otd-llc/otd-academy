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
import { placeSpine, projectSpine, SPINE_CLIP, SPINE_MAX_CELL } from "@/lib/comb-spine";
import { combWindow, centreOffset, fitWindowCell, ghostAlpha, isLit } from "@/lib/comb-carousel";


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
      <div className={`gh${video ? " comb-video" : ""}`} style={{ position: "absolute", left: 0, right: 0, top: dy, height }}>
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
