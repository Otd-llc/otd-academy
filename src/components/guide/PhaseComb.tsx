// PhaseComb — the connected zig-zag hex breadcrumb, one component in two
// variants so a lesson reads as one system top and bottom (sandbox pair "P7"):
//
//   variant="header" — orient. Just the comb, centered (the ringed current hex
//       says where you are; the stage name + phase live in the PageHeader right
//       below, so no tag here). No buttons. Replaces the old GuideStepper.
//   variant="footer" — act. The comb + a prev/next control row; the Next button
//       subtly breathes + drifts its arrow so the path forward is unmistakable.
//
// The comb itself is identical in both: flat-top hexes laced edge-to-edge,
// coloured by completion (honey done, gold current + ring, grey ahead), each a
// link to its stage card. No per-hex glow. The gated advance of a learner's OWN
// progress lives in the YOUR TRACK panel.
//
// Pure CSS + a fixed-aspect container with percent-positioned hexes, so the
// ribbon scales with its width. No client JS — a server component.

import Link from "next/link";
import {
  combAbbr,
  combGlyph,
  combNodeState,
  combPositions,
  combViewBox,
  type CombStageStatus,
} from "@/lib/phase-comb";

// Flat-top hex path in the intrinsic 48 × 41.57 cell (matches phase-comb.ts).
const HEX = "12,0 36,0 48,20.785 36,41.57 12,41.57 0,20.785";

// Ortho-3D face treatment (sandbox winner "G6", 2026-07-07): each hex is a thin
// prism with a down-right oblique cast, its cast faces filled with the field
// color (a solid occluding slab), plus a fine inset rim line on the face. The
// cast draws OUTSIDE the 48 × 41.57 viewBox (svg overflow is visible); the comb
// container carries +CAST of layout room so the bottom row's cast isn't cramped.
// Slimmer than the /courses cells (owner note 2026-07-07): the lesson serpentine
// is small and laced tight, so a shallower cast keeps the ribbon reading clean.
const CAST = 3.5;
// corner ring of HEX: c0 TL, c1 TR, c2 R, c3 BR, c4 BL, c5 L
const C: [number, number][] = [
  [12, 0], [36, 0], [48, 20.785], [36, 41.57], [12, 41.57], [0, 20.785],
];
const pts = (list: [number, number][]) =>
  list.map(([x, y]) => `${x},${y}`).join(" ");
// visible cast silhouette run for a down-right offset: BL → BR → R → TR
const RUN: [number, number][] = [C[4]!, C[3]!, C[2]!, C[1]!];
const off = ([x, y]: [number, number]): [number, number] => [x + CAST, y + CAST];
const CAST_SIDES = RUN.slice(0, -1).map((a, i) =>
  pts([a, RUN[i + 1]!, off(RUN[i + 1]!), off(a)]),
);
const CAST_EDGES = RUN.map((p) => pts([p, off(p)])).concat([pts(RUN.map(off))]);
// fine rim: the face outline inset toward the centroid (24, 20.785) by 0.86
const RIM = pts(
  C.map(([x, y]) => [
    Math.round((24 + (x - 24) * 0.86) * 100) / 100,
    Math.round((20.785 + (y - 20.785) * 0.86) * 100) / 100,
  ]),
);

export interface PhaseStep {
  stage: string;
  label: string;
}

export function PhaseComb({
  slug,
  revLabel,
  stages,
  viewingStage,
  variant,
  prev = null,
  next = null,
}: {
  slug: string;
  revLabel: string;
  stages: CombStageStatus[];
  /** The stage whose card is being viewed → ringed "you are here". */
  viewingStage: string;
  variant: "header" | "footer";
  /** footer: previous / next stage cards for the control row (null at the ends). */
  prev?: PhaseStep | null;
  next?: PhaseStep | null;
}) {
  const positions = combPositions(stages.length);
  // pad the layout box by the cast offset so percent positions account for the
  // prism depth hanging off the bottom-right of the ribbon
  const { w: vw, h: vh } = combViewBox(stages.length);
  const w = vw + CAST;
  const h = vh + CAST;
  const href = (s: string) =>
    `/projects/${slug}/${encodeURIComponent(revLabel)}/guide/${s}`;

  const comb = (
    <ol className="pc-comb" aria-label="Build stages">
      {stages.map((s, i) => {
        const base = combNodeState(s.state);
        const isViewing = s.stage === viewingStage;
        const p = positions[i]!;
        const cls = ["pc-node", base, isViewing ? "viewing" : ""]
          .filter(Boolean)
          .join(" ");
        return (
          <li key={s.stage} className="contents">
            <Link
              href={href(s.stage)}
              aria-current={isViewing ? "step" : undefined}
              aria-label={`Stage ${s.ordinal + 1}${isViewing ? " (viewing)" : ""}`}
              className={cls}
              style={{
                left: `${(p.x / w) * 100}%`,
                top: `${(p.y / h) * 100}%`,
              }}
            >
              <svg viewBox="0 0 48 41.57" preserveAspectRatio="none">
                {CAST_SIDES.map((q) => (
                  <polygon key={q} className="pc-side" points={q} />
                ))}
                {CAST_EDGES.map((l) => (
                  <polyline key={l} className="pc-cast" points={l} />
                ))}
                <polygon className="pc-top" points={HEX} />
                <polygon className="pc-rim" points={RIM} />
              </svg>
              <span className="pc-num">{combGlyph(base, s.ordinal)}</span>
              {/* Three-letter stage label on the TOP comb only (the footer stays
                  compact; the stage name lives in its prev/next buttons). */}
              {variant === "header" ? <span className="pc-abbr">{combAbbr(s.stage)}</span> : null}
            </Link>
          </li>
        );
      })}
    </ol>
  );

  const defs = (
    <svg width="0" height="0" aria-hidden className="absolute">
      <defs>
        <linearGradient id="pc-honey" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#eab94d" />
          <stop offset="1" stopColor="#b07f31" />
        </linearGradient>
      </defs>
    </svg>
  );

  if (variant === "header") {
    return (
      <div className="pc-header">
        {defs}
        {comb}
      </div>
    );
  }

  // footer
  return (
    <div className="flex flex-col items-center">
      {defs}
      {comb}
      {prev || next ? (
        <div className="pc-nav">
          {prev ? (
            <Link href={href(prev.stage)} className="pc-btn pc-btn-prev">
              <span aria-hidden>‹</span> {prev.label}
            </Link>
          ) : null}
          {next ? (
            <Link href={href(next.stage)} className="pc-btn pc-btn-next">
              Next: {next.label}{" "}
              <span className="pc-arw" aria-hidden>
                ›
              </span>
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
