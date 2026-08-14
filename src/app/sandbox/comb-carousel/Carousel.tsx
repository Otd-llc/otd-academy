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
import { placeSpine, projectSpine, SPINE_CLIP } from "@/lib/comb-spine";
import { combWindow, centreOffset, fitWindowCell, ghostAlpha, isLit } from "@/lib/comb-carousel";


// Same guard the shipped comb uses: it defines this locally rather than exporting it,
// so this round matches rather than reaching into it.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export type Cell = {
  num: string;
  title: string;
  lead: string;
  kind: "done" | "current" | "blocked" | "pending";
  statusText: string;
};

/** The ghost treatments on audition. Only this varies between the options. */
export type Ghost = "alpha" | "flat" | "narrow" | "veil";

export const GHOSTS: { id: Ghost; name: string; claim: string }[] = [
  { id: "alpha", name: "Alpha only", claim: "The ghosts keep their prism and their content and simply recede. The plainest reading of the brief, and the control the other three are judged against." },
  { id: "flat", name: "No prism", claim: "Ghosts lose the cast and keep the outline, so depth belongs to the window alone. The three lit cells are the only solid objects on screen." },
  { id: "narrow", name: "Type drops", claim: "Ghosts keep the hex and lose the title and chip. Says how long the course is without asking anyone to read eight things they are not on." },
  { id: "veil", name: "Veiled ends", claim: "Alpha, plus a gradient that takes the run out at the top and bottom of the viewport. The comb reads as continuing past the frame rather than stopping." },
];

export function Carousel({
  cells,
  current,
  ghost,
  viewH = 520,
}: {
  cells: Cell[];
  current: number;
  ghost: Ghost;
  viewH?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [cw, setCw] = useState(0);

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

  // The run is laid out WHOLE - every cell at its true position - and then slid, so a
  // ghost sits exactly where it will sit when the window reaches it. Laying out only
  // the window would make the cells jump as the current one advanced.
  // Sized from the VIEWPORT, not the column: see `fitWindowCell`. Clamped to the
  // column so a narrow rail never overflows sideways.
  const w = cw > 0 ? Math.min(fitWindowCell(viewH), cw / 1.5) : 0;
  const { boxes, height } = placeSpine(cells.length, w, cw);
  const solids = projectSpine(boxes, cw, height);
  const win = combWindow(cells.length, current);
  const dy = w > 0 ? centreOffset(win.current, w, viewH) : 0;
  const measured = boxes.length === cells.length && height > 0;

  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        height: viewH,
        overflow: "hidden",
        // The veil takes the run out at both ends, so it reads as continuing past the
        // frame. A hard edge reads as the course stopping there.
        ...(ghost === "veil"
          ? {
              WebkitMaskImage:
                "linear-gradient(to bottom, transparent 0%, #000 22%, #000 78%, transparent 100%)",
              maskImage:
                "linear-gradient(to bottom, transparent 0%, #000 22%, #000 78%, transparent 100%)",
            }
          : {}),
      }}
    >
      <div className="gh" style={{ position: "absolute", left: 0, right: 0, top: dy, height }}>
        {measured && solids.length > 0 ? (
          <SpineCombScene
            solids={solids}
            sceneW={cw}
            sceneH={height}
            cellW={w}
            // `dim` is the scene's own recede state, so a ghost that drops its prism
            // asks the shipped component for that rather than inventing a second
            // vocabulary for the same idea.
            cells={cells.map((c, i) => ({
              kind: c.kind,
              dim: ghost === "flat" && !isLit(win, i),
            }))}
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
                  {lit || ghost !== "narrow" ? (
                    <>
                      <span className="gh-m">
                        <span className="gh-title">{c.title}</span>
                        {c.lead ? <span className="gh-lead">{c.lead}</span> : null}
                      </span>
                      <span className="gh-status">
                        <span className="gh-chip">{c.statusText}</span>
                      </span>
                    </>
                  ) : null}
                </div>
              );
            })
          : null}
      </div>
    </div>
  );
}
