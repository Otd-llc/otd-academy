"use client";

// SANDBOX — one variant of the go-further comb, measured and drawn.
//
// The prisms come from `SpineCombScene`, the component that now ships on the two body
// combs. That is deliberate reuse rather than convenience: it takes `HexSolid`s, which
// already carry their own face and rear points, so it is orientation-agnostic. Every
// variant below therefore gets the same masked silhouette, the same cell-relative
// stroke and the same token colours as the combs above it on the page, and the only
// thing under test here is the LAYOUT and what each cell says.

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { SpineCombScene } from "@/components/guide/SpineCombScene";
import {
  fitRibbonCell,
  placeRibbon,
  projectRibbon,
  ribbonRatio,
  type RibbonShape,
} from "./geometry";

import { accentFor, chipFor, eyebrowFor, type PathCell } from "./fixtures";

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/** The cell silhouette as a clip path, per orientation. */
const HEX_CLIP: Record<RibbonShape, string> = {
  laced: "polygon(0 50%, 25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%)",
  row: "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)",
};

/** What a cell says. The lesson ribbon says a numeral and three letters; today's
 *  go-further hex says an eyebrow, a name and a chip. Everything between is a variant. */
export type CellContent =
  /** the lesson ribbon, literally: big Saira code, mono track label under it. */
  | "code"
  /** the name alone, in Bebas. */
  | "name"
  /** the name over a code watermark, plus the chip. */
  | "name-mark"
  /** today's content: eyebrow, name, chip. */
  | "full";

export interface PathVariant {
  id: string;
  label: string;
  note: string;
  shape: RibbonShape;
  content: CellContent;
  /** stroke the hex in its track accent, as today's comb does. */
  tracked: boolean;
  /** cap the cell so a wide row does not make four enormous hexes. */
  maxCell: number | null;
  castFar: number;
}

function Inner({
  p,
  content,
  cellW,
  signedIn,
}: {
  p: PathCell;
  content: CellContent;
  cellW: number;
  signedIn: boolean;
}) {
  const chip = chipFor(p, signedIn);
  if (content === "code") {
    return (
      <span className="pv-stack">
        <span className="pv-code" style={{ fontSize: Math.round(cellW * 0.34) }}>
          {p.code}
        </span>
        <span className="pv-sub">{eyebrowFor(p)}</span>
      </span>
    );
  }
  if (content === "name") {
    return (
      <span className="pv-stack">
        <span className="pv-name">{p.label}</span>
      </span>
    );
  }
  if (content === "name-mark") {
    return (
      <>
        <span
          className="pv-mark"
          aria-hidden
          style={{ fontSize: Math.round(cellW * 0.46) }}
        >
          {p.code}
        </span>
        <span className="pv-stack">
          <span className="pv-name">{p.label}</span>
          <span className="pv-chip">{chip}</span>
        </span>
      </>
    );
  }
  return (
    <span className="pv-stack">
      <span className="pv-sub">{eyebrowFor(p)}</span>
      <span className="pv-name">{p.label}</span>
      <span className="pv-chip">{chip}</span>
    </span>
  );
}

export function PathStage({
  variant,
  paths,
  width,
  signedIn,
}: {
  variant: PathVariant;
  paths: PathCell[];
  /** the container the comb is given, in px. */
  width: number;
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

  const w =
    cw > 0 ? fitRibbonCell(variant.shape, paths.length, cw, variant.maxCell) : 0;
  const { boxes, height } = placeRibbon(variant.shape, paths.length, w, cw);
  const solids = projectRibbon(boxes, variant.shape, cw, height, variant.castFar);

  return (
    <div style={{ width, maxWidth: "100%" }}>
      <div
        ref={ref}
        className="gh"
        style={{ position: "relative", width: "100%", height }}
      >
        {solids.length > 0 ? (
          <SpineCombScene
            solids={solids}
            sceneW={cw}
            sceneH={height}
            cellW={w}
            // The go-further comb is not a progress ladder: nothing on it is done,
            // current or blocked. `track` in the shipped scene is the same idea; here
            // every cell is "pending" and the accent does the talking.
            cells={paths.map((p) => ({
              kind: "pending" as const,
              accent: variant.tracked ? accentFor(p) : "var(--color-command-gold)",
              flag: p.isPrimary,
            }))}
            track={variant.tracked}
            hot={hot}
          />
        ) : null}
        {paths.map((p, i) => {
          const b = boxes[i];
          if (!b) return null;
          const accent = variant.tracked ? accentFor(p) : "var(--color-command-gold)";
          return (
            <Link
              key={p.key}
              href={`/courses?path=${p.key}`}
              aria-label={`${p.label} — ${chipFor(p, signedIn)}`}
              className={`pv-node${p.isPrimary ? " flag" : ""}`}
              style={
                {
                  position: "absolute",
                  left: b.left,
                  top: b.top,
                  width: b.w,
                  height: b.h,
                  zIndex: 2,
                  "--accent": accent,
                  // the hex's own aspect drives the cqw type below it
                  "--cell-ratio": ribbonRatio(variant.shape),
                  // and its own silhouette clips the watermark
                  "--hex-clip": HEX_CLIP[variant.shape],
                } as CSSProperties
              }
              onMouseEnter={() => setHot(i)}
              onMouseLeave={() => setHot((h) => (h === i ? null : h))}
              onFocus={() => setHot(i)}
              onBlur={() => setHot((h) => (h === i ? null : h))}
            >
              <Inner p={p} content={variant.content} cellW={b.w} signedIn={signedIn} />
            </Link>
          );
        })}
      </div>

      {/* The caption row exists only for the variant that follows the lesson ribbon
          literally: a three-letter code is not a destination name, so the names have
          to live somewhere. Whether that is acceptable IS the question that variant
          asks. */}
      {variant.content === "code" ? (
        <ul className="mt-3 flex flex-wrap justify-center gap-x-6 gap-y-1">
          {paths.map((p) => (
            <li
              key={p.key}
              className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted"
            >
              <span className="text-command-gold">{p.code}</span> · {p.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
