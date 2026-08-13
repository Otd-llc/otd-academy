"use client";

// The comb, using the PRODUCT'S comb rather than a drawing of it.
//
// Round 2 shipped a hand-rolled `<polygon>` wearing the right colours and I
// described it as the product's hex language. It was not. The honeycomb already
// exists - `.gh-node`, `.gh-hex`, `.comb-num`, `.gh-m`, `.gh-title`,
// `.gh-chip` in globals.css, with `.done` / `.current` / `.blocked` / `.pending`
// state classes, plus the `HexPrism` svg that gives each cell its thin 3D face.
// A redrawing is the failure the design law names outright: the moment either
// side changes, the video is advertising a comb the product no longer has.
//
// So every cell below is the real markup with the real class names, and the
// styling is whatever globals.css currently says it is. What this file adds is
// only LAYOUT (a tessellated row at video scale, since the hub measures its own
// container) and the WALK (which cell is lit, as a function of scrub time).
//
// `.gh-node` is `position: absolute` and `container-type: inline-size`, so each
// cell needs an explicit box - that is the hub's contract too, its layout engine
// just computes the boxes from a measured width.
//
// ASCII only.

import type { Stage } from "@prisma/client";
import { HexPrism } from "@/components/guide/GuideHoneycomb";
import { STAGE_LABELS } from "@/lib/stages";
import { stageArt, stageArtGhost } from "@/lib/guide-stage-art";
import { ts, hw } from "./units";

export type CellKind = "done" | "current" | "blocked" | "pending";

/** Pointy-top regular hex: height = width * 1.1547. Same ratio the hub uses. */
export const RATIO = 1.1547;

export function CombCell({
  stage,
  num,
  kind,
  w,
  showArt,
  chip,
}: {
  stage: Stage;
  num: string;
  kind: CellKind;
  /** Cell width as a share of the frame SHORT edge (`cqmin`).
   *
   *  Short edge, not width. A hex carries a Saira numeral across its whole face,
   *  so it is type as much as it is graphic - size it against the long edge and
   *  it shrinks by 1.78x in portrait while the numeral inside it does not. That
   *  mismatch is exactly what the unit fix was for. See `units.ts`. */
  w: number;
  showArt?: boolean;
  chip?: string;
}) {
  const art = kind === "done" || kind === "current" ? stageArt(stage) : null;
  const ghost = stageArtGhost(stage);
  return (
    // A relatively-positioned box the `.gh-node` fills. The node itself is
    // `position: absolute` in globals.css, so it needs a positioned parent -
    // and giving it one lets the COMB be laid out as a flex row instead of by
    // absolute-left arithmetic. That removes the last place two container units
    // could be mixed: every distance in the comb is now cqmin.
    <div style={{ position: "relative", width: `${w}cqmin`, height: `${w * RATIO}cqmin`, flex: "0 0 auto" }}>
    <div
      className={`gh-node ${kind}`}
      style={{ position: "absolute", inset: 0 }}
    >
      <HexPrism className="gh-hex" />
      {/* The ordinal is a watermark spanning the face, sized off the cell width,
          exactly as the hub does it. */}
      <span className="comb-num" aria-hidden style={{ fontSize: `${w * 0.98}cqmin` }}>
        {num}
      </span>
      {showArt && art ? (
        <span
          aria-hidden
          className="gh-art"
          style={{ left: "14%", right: "14%", top: "9%", height: "36%", backgroundImage: `url(${art})` }}
        />
      ) : null}
      {showArt && !art && ghost ? (
        <span aria-hidden className="gh-art gh-art-soon" style={{ left: "14%", right: "14%", top: "9%", height: "36%" }}>
          <span
            className="gh-art-soon-fill"
            style={{ WebkitMaskImage: `url(${ghost})`, maskImage: `url(${ghost})` }}
          />
        </span>
      ) : null}
      <span className="gh-m">
        <span className="gh-title">{STAGE_LABELS[stage]}</span>
      </span>
      {chip ? (
        <span className="gh-status">
          <span className="gh-chip">{chip}</span>
        </span>
      ) : null}
    </div>
    </div>
  );
}

/**
 * Boxes for a tessellating row of `n` cells.
 *
 * Pointy-top hexes tessellate at 3/4 of their width horizontally, with every
 * other cell dropped half a height. Getting that spacing wrong is what makes a
 * comb read as "hexagons in a line" rather than a honeycomb.
 */
export function rowBoxes(n: number, w: number, cx = 50, cy = 50) {
  const stepX = w * 0.75;
  const total = stepX * (n - 1) + w;
  const left0 = cx - total / 2;
  return Array.from({ length: n }, (_, i) => ({
    left: left0 + i * stepX,
    // cy is a cqh centre; the half-row offset is in cqw, converted by the
    // caller's aspect. Kept in cqw here so the tessellation stays correct.
    top: cy,
    w,
    odd: i % 2 === 1,
  }));
}
