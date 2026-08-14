"use client";

// PathHoneycomb — the /courses "Go further" destinations: one hex per other build,
// laced edge to edge in a horizontal ribbon that COLLAPSES to a vertical spine when
// the cells would get too small to read.
//
// It used to be a 4-up tessellating grid under the three-point camera S5, with a
// filled card's worth of content in each hex. The body of /courses is now a vertical
// one-point spine, so the foot was speaking a second hex language; this brings it back
// to one. Picked in the sandbox rounds at `/sandbox/path` (lacing) and
// `/sandbox/path/g5` (treatment G5d, "the document band"), 2026-08-13.
//
// The geometry, including the collapse rule and the prism, lives in `lib/comb-ribbon`.
// The prisms are drawn by `SpineCombScene`, the same component the two body combs use:
// it takes `HexSolid`s, which carry their own face and rear points, so it does not
// care that these hexes are flat-top when the ribbon is laced. That reuse is the point
// rather than a convenience: one silhouette, one cell-relative stroke weight, one set
// of tokens across all three combs on the page.
//
// The cell is the /hex release band applied to a hex: a track eyebrow, the
// destination's name held between two accent hairlines, and its course count under it.
// No chip. The old one was a 999px pill, which the corner language bans outright.

import Link from "next/link";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { HexShell } from "@/components/guide/GuideHoneycomb";
import { SpineCombScene } from "@/components/guide/SpineCombScene";
import { CombLock } from "@/components/guide/CombLock";
import { COMB_CLIP, layoutComb, projectComb, POINTY_RATIO } from "@/lib/comb-ribbon";

const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * The hex's stroke and eyebrow colour, as TOKENS.
 *
 * This map used to hold literal hex values (`#66bb6a` and friends). They are the
 * palette's own colours written out longhand, which is what made it look harmless, and
 * it was still a theming bug: a literal cannot be re-pointed by the
 * `:root[data-theme="light"]` token block, so the track accent was the one colour on
 * /courses that would not flip. Everything here resolves through `var(--color-*)`.
 */
const TRACK_ACCENT: Record<string, string> = {
  SENSE: "var(--color-status-green)",
  ACT: "var(--color-command-gold)",
  POWER: "var(--color-alert-red)",
  COMMS: "var(--color-signal-blue)",
};

/** Hoisted out of the render loop because the prism scene needs it too: a `--accent`
 *  that reaches only the label leaves `stroke: var(--accent)` unresolved, and an
 *  unresolved stroke on a deep-space fill is an invisible hex. */
function accentFor(p: PathDest): string {
  if (p.isPrimary) return "var(--color-command-gold)";
  return (p.goalTrack ? TRACK_ACCENT[p.goalTrack] : undefined) ?? "var(--color-gold-dim)";
}

function eyebrowFor(p: PathDest): string {
  if (p.isPrimary) return "★ Flagship";
  return p.goalTrack ?? (p.isBench ? "Bench" : "Path");
}

/** The count, split so the figure can take the Saira face on its own. */
function countOf(p: PathDest, signedIn: boolean): string {
  if (signedIn && p.done > 0) return `${p.done}/${p.total} done`;
  return p.isBench ? `${p.total} tools` : `${p.total} courses`;
}

export interface PathDest {
  key: string;
  label: string;
  total: number;
  done: number;
  goalTrack: string | null;
  isPrimary: boolean;
  isBench: boolean;
}

export function PathHoneycomb({
  paths,
  signedIn,
}: {
  paths: PathDest[];
  signedIn: boolean;
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

  const layout = layoutComb(paths.length, cw);
  const solids = projectComb(layout);
  const measured = layout.boxes.length === paths.length && layout.height > 0;

  if (paths.length === 0) return null;

  return (
    <div
      ref={ref}
      className="gh"
      style={{ position: "relative", height: measured ? layout.height : undefined }}
    >
      {measured && solids.length > 0 ? (
        <SpineCombScene
          solids={solids}
          sceneW={cw}
          sceneH={layout.height}
          cellW={layout.cellW}
          track
          cells={paths.map((p) => ({
            kind: "pending" as const,
            flag: p.isPrimary,
            accent: accentFor(p),
          }))}
          hot={hot}
        />
      ) : null}

      {/* The marker, on the flagship. This comb has no "current" - it is a set of

          onward paths, not a run you are part-way down - so the thing worth

          marking is the one the curriculum points at. */}

      {(() => {

        const fi = paths.findIndex((p) => p.isPrimary);

        const fb = fi >= 0 ? layout.boxes[fi] : null;

        return fb && measured && solids.length > 0 ? (

          <CombLock box={fb} sceneW={cw} sceneH={layout.height} />

        ) : null;

      })()}

      {paths.map((p, i) => {
        const b = layout.boxes[i];
        const count = countOf(p, signedIn);

        // Measured: the cell's content at exactly its box, since a one-point face lies
        // in the picture plane and needs no billboarding. Pre-measure: the stacked
        // fallback, which is not cosmetic — it is what keeps these links in the SSR
        // HTML for crawlers and for a visitor with JS off.
        const wrapStyle: CSSProperties = b
          ? {
              position: "absolute",
              left: b.left,
              top: b.top,
              width: b.w,
              height: b.h,
              zIndex: 2,
              // HIT TEST: a laced run overlaps harder than the spine does, so an
              // unclipped rectangle hands clicks on this hex to the next destination.
              clipPath: COMB_CLIP[layout.axis],
            }
          : {
              position: "relative",
              width: "100%",
              maxWidth: 230,
              margin: "0 auto 10px",
              aspectRatio: `1 / ${POINTY_RATIO}`,
            };

        return (
          <Link
            key={p.key}
            href={`/courses?path=${p.key}`}
            aria-label={`${p.label} — ${count}`}
            className={`phex group${p.isPrimary ? " flag" : ""}`}
            style={{ "--accent": accentFor(p), ...wrapStyle } as CSSProperties}
            onMouseEnter={() => setHot(i)}
            onMouseLeave={() => setHot((h) => (h === i ? null : h))}
            onFocus={() => setHot(i)}
            onBlur={() => setHot((h) => (h === i ? null : h))}
          >
            {b ? null : <HexShell className="gh-hex" />}
            <span className="phex-inner">
              <span className="phex-eyebrow">{eyebrowFor(p)}</span>
              <span className="phex-band">
                <span className="phex-title">{p.label}</span>
              </span>
              <span className="phex-count">{count}</span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
