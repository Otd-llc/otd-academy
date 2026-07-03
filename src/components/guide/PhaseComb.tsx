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
  const { w, h } = combViewBox(stages.length);
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
                <polygon points={HEX} />
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
