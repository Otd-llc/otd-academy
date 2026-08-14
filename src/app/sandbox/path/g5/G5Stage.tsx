"use client";

// SANDBOX — one G5 treatment, on the laced ribbon.
//
// The geometry is settled (G5 from the previous round: flat-top hexes laced edge to
// edge, one-point prism at the lesson comb's own cast, drawn by the shipped
// `SpineCombScene`). What varies here is only what the cell SAYS and which house
// device it says it with.

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { SpineCombScene } from "@/components/guide/SpineCombScene";
import { fitRibbonCell, placeRibbon, projectRibbon } from "../geometry";
import { accentFor, chipFor, eyebrowFor, type PathCell } from "../fixtures";

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Which way the prism is cast. The DEPTH is no longer bundled in here: it is a live
 * slider on the round, because "not so deep" is a scalar and a scalar is worth
 * dialling rather than guessing at in three frozen steps.
 *
 * The direction still matters on a laced run in a way it did not on the vertical
 * spine. The spine's cells touch only at a seam, so a cast converging on the centre of
 * the run survives the face mask as a solid band. Laced hexes overlap by a quarter of
 * their width, so a centre-converging cast lands under a neighbour and is masked away,
 * leaving a hairline where a slab should be. Dropping the vanishing point below the
 * run sends every cast the same way, clear of the neighbours.
 */
export type PrismMode = "below" | "centre";

const PRISM_VP: Record<PrismMode, [number, number]> = {
  below: [0.5, 1.6],
  centre: [0.5, 0.5],
};

export type Treatment =
  /** /hex SpecRows: mono label, dotted leader, Saira value. */
  | "spec"
  /** /hex P4: a caliper over a big Saira readout. */
  | "caliper"
  /** /hex Frame: four corner ticks bracketing the stack. */
  | "ticks"
  /** the document band: the name between two accent hairlines. */
  | "band"
  /** the count as the signature Saira instrument readout, name as its label. */
  | "readout"
  /** the configurator's floating label: a left accent bar, ranged left. */
  | "bar";

export interface G5Variant {
  id: string;
  label: string;
  note: string;
  source: string;
  treatment: Treatment;
  /** stroke each hex in its track accent, as today's comb does. */
  tracked: boolean;
}

/** The count, split so the numeral can take the Saira face on its own. */
function countOf(p: PathCell, signedIn: boolean): { n: string; unit: string } {
  if (signedIn && p.done > 0) return { n: `${p.done}/${p.total}`, unit: "done" };
  return { n: String(p.total), unit: p.isBench ? "tools" : "courses" };
}

function Inner({
  p,
  treatment,
  signedIn,
}: {
  p: PathCell;
  treatment: Treatment;
  signedIn: boolean;
}) {
  const { n, unit } = countOf(p, signedIn);
  const eyebrow = eyebrowFor(p);

  if (treatment === "spec") {
    return (
      <span className="g5-inner">
        <span className="g5-eyebrow">{eyebrow}</span>
        <span className="g5-name">{p.label}</span>
        <span className="g5-spec">
          <span className="g5-spec-label">{unit}</span>
          <span aria-hidden className="g5-spec-rule" />
          <span className="g5-spec-value">{n}</span>
        </span>
      </span>
    );
  }

  if (treatment === "caliper") {
    return (
      <span className="g5-inner">
        <span aria-hidden className="g5-caliper">
          <span />
          <span />
          <span />
        </span>
        <span className="g5-readout">{n}</span>
        <span className="g5-unit">{unit}</span>
        <span className="g5-name">{p.label}</span>
      </span>
    );
  }

  if (treatment === "ticks") {
    return (
      <span className="g5-inner">
        <span className="g5-ticks">
          <span aria-hidden className="g5-tick left-0 top-0 border-l border-t" />
          <span aria-hidden className="g5-tick right-0 top-0 border-r border-t" />
          <span aria-hidden className="g5-tick bottom-0 left-0 border-b border-l" />
          <span aria-hidden className="g5-tick bottom-0 right-0 border-b border-r" />
          <span className="g5-eyebrow">{eyebrow}</span>
          <span className="g5-name">{p.label}</span>
          <span className="g5-badge">
            {n} {unit}
          </span>
        </span>
      </span>
    );
  }

  if (treatment === "band") {
    return (
      <span className="g5-inner">
        <span className="g5-eyebrow">{eyebrow}</span>
        <span className="g5-band">
          <span className="g5-name">{p.label}</span>
        </span>
        <span className="g5-unit">
          {n} {unit}
        </span>
      </span>
    );
  }

  if (treatment === "readout") {
    return (
      <span className="g5-inner">
        <span className="g5-readout">{n}</span>
        <span className="g5-unit">{unit}</span>
        <span className="g5-name">{p.label}</span>
      </span>
    );
  }

  return (
    <span className="g5-inner">
      <span className="g5-bar">
        <span className="g5-eyebrow">{eyebrow}</span>
        <span className="g5-name" style={{ display: "block" }}>
          {p.label}
        </span>
        <span className="g5-unit" style={{ display: "block", marginTop: "0.4em" }}>
          {n} {unit}
        </span>
      </span>
    </span>
  );
}

export function G5Stage({
  variant,
  paths,
  width,
  signedIn,
  prism,
  depth,
}: {
  variant: G5Variant;
  paths: PathCell[];
  width: number;
  signedIn: boolean;
  prism: PrismMode;
  /** the far-end cast, in cell widths. 0.23 is the lesson comb's own. */
  depth: number;
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

  const w = cw > 0 ? fitRibbonCell("laced", paths.length, cw, null) : 0;
  const { boxes, height } = placeRibbon("laced", paths.length, w, cw);
  // The projection clamps the near/far ratio at 0.999, so a depth of 0 is not a
  // division problem; it just draws a slab a tenth of a percent thick, which is none.
  const solids = projectRibbon(boxes, "laced", cw, height, depth, PRISM_VP[prism]);

  return (
    <div style={{ width, maxWidth: "100%" }}>
      <div ref={ref} className="gh" style={{ position: "relative", width: "100%", height }}>
        {solids.length > 0 ? (
          <SpineCombScene
            solids={solids}
            sceneW={cw}
            sceneH={height}
            cellW={w}
            cells={paths.map((p) => ({
              kind: "pending" as const,
              accent: variant.tracked ? accentFor(p) : "var(--color-command-gold)",
              flag: p.isPrimary,
            }))}
            track
            hot={hot}
          />
        ) : null}
        {paths.map((p, i) => {
          const b = boxes[i];
          if (!b) return null;
          return (
            <Link
              key={p.key}
              href={`/courses?path=${p.key}`}
              aria-label={`${p.label} — ${chipFor(p, signedIn)}`}
              className={`g5-node${p.isPrimary ? " flag" : ""}`}
              style={
                {
                  position: "absolute",
                  left: b.left,
                  top: b.top,
                  width: b.w,
                  height: b.h,
                  zIndex: 2,
                  "--accent": variant.tracked
                    ? accentFor(p)
                    : "var(--color-command-gold)",
                } as CSSProperties
              }
              onMouseEnter={() => setHot(i)}
              onMouseLeave={() => setHot((h) => (h === i ? null : h))}
              onFocus={() => setHot(i)}
              onBlur={() => setHot((h) => (h === i ? null : h))}
            >
              <Inner p={p} treatment={variant.treatment} signedIn={signedIn} />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
