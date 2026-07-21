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
//
// PROJECTION — one-point (sandbox rounds P1 → P1a, owner pick 2026-07-20). Each
// hex is a thin prism whose depth converges on a single vanishing point at the
// centre of the run, replacing the constant down-right oblique cast this comb used
// to draw. The hex FACES stay parallel to the picture plane, which is why this cut
// won: nothing is foreshortened, so no face, label or tap target shrinks and the
// responsive behaviour is unchanged. The geometry is pure and lives in
// lib/phase-comb.ts; this file only paints it.
//
// PAINT ORDER. Because the casts converge, hexes left of the VP cast right and
// hexes right of it cast LEFT, so no DOM order can be correct — a right-hand hex's
// slab lands on the neighbour whose face should occlude it, and depth cannot break
// the tie because every hex is at the same depth. A prism body always lies behind
// every face, so each hex draws TWO svgs: the slab at z-index 0 and the face at
// z-index 1. `.pc-comb` is the stacking context (isolation: isolate) and `.pc-node`
// deliberately creates none, so those z-indexes sort across ALL hexes at once:
// every slab paints under every face. Keep `.pc-node` free of transform, filter,
// opacity and z-index or that collapses back into the bug.

import Link from "next/link";
import {
  COMB_HEX_CORNERS,
  combAbbr,
  combGlyph,
  combNodeState,
  combPositions,
  combRearFace,
  combViewBox,
  COMB_HEX_W,
  type CombPoint,
  type CombStageStatus,
} from "@/lib/phase-comb";

const pts = (list: CombPoint[]) => list.map((p) => `${p.x},${p.y}`).join(" ");

const FACE: CombPoint[] = COMB_HEX_CORNERS.map(([x, y]) => ({ x, y }));
const HEX = pts(FACE);
// fine rim: the face outline inset toward the centroid (24, 20.785) by 0.86
const RIM = pts(
  FACE.map((p) => ({
    x: Math.round((24 + (p.x - 24) * 0.86) * 100) / 100,
    y: Math.round((20.785 + (p.y - 20.785) * 0.86) * 100) / 100,
  })),
);

/** The prism's six side faces: each near edge swept to its far counterpart. All
 *  six are drawn and the opaque face covers the ones that fall behind it, so the
 *  silhouette stays correct wherever the hex sits relative to the VP. */
function prismSides(i: number, n: number): string[] {
  const rear = combRearFace(i, n);
  return FACE.map((a, k) => {
    const b = FACE[(k + 1) % 6]!;
    return pts([a, b, rear[(k + 1) % 6]!, rear[k]!]);
  });
}

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
  // No cast padding any more: a converging prism points INWARD, so nothing hangs
  // off the ribbon's edge and the layout box is the comb's own box. The container's
  // aspect ratio and cell width are derived from it rather than hardcoded, so a
  // 9-stage comb (with REVISION) is as correct as the 8-stage one.
  const { w, h } = combViewBox(stages.length);
  const href = (s: string) =>
    `/projects/${slug}/${encodeURIComponent(revLabel)}/guide/${s}`;

  const comb = (
    <ol
      className="pc-comb"
      aria-label="Build stages"
      style={
        {
          "--pc-ar": `${w} / ${h}`,
          "--pc-cw": `${(COMB_HEX_W / w) * 100}%`,
        } as React.CSSProperties
      }
    >
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
              {/* slab — z-index 0, so it sorts under EVERY hex's face, not just
                  this one's. See the paint-order note at the top of the file. */}
              <svg className="pc-slab" viewBox="0 0 48 41.57" preserveAspectRatio="none">
                <polygon className="pc-side" points={pts(combRearFace(i, stages.length))} />
                {prismSides(i, stages.length).map((q) => (
                  <polygon key={q} className="pc-side" points={q} />
                ))}
              </svg>
              {/* face — z-index 1 */}
              <svg className="pc-face" viewBox="0 0 48 41.57" preserveAspectRatio="none">
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
