// Where the EARN beat's four things go, in any aspect. DEV ONLY.
//
// A PLAIN MODULE, imported by both the cut's cue layer and the card render, so
// the type and the certificate cannot disagree about the frame they share.
//
// WHY THIS IS DERIVED RATHER THAN FIVE SETS OF LITERALS. The other three beats
// sit over geometry that recentres itself for whatever aspect it is given, so a
// grid corner places them and nothing has to move. The EARN beat is different:
// its type has to relate to the CERTIFICATE, and the certificate is a fixed
// aspect object inside a frame whose aspect changes. Hand-tuning five layouts
// means five chances to drift, and every later correction has to be applied
// five times. One rule plus measured constants means a correction is one edit.
//
// THE LOCKED LAYOUT IS A RULE, NOT A SET OF NUMBERS. Layout 08 was picked as
// "no mark, bottom anchored, constant 10 gap". Read back out of the measured
// frame that is exactly:
//
//   link ink bottom 91.0
//   ask bottom      91.0 - 2.1 - 10 = 78.9   (measured 78.9)
//   word ink bottom 78.9 - 10.6 - 10 = 58.3  (measured 58.4)
//   word ink top    58.3 - 15.83     = 42.47 (measured 42.5)
//
// so the same rule regenerates it, and applies to a frame of any shape.
//
// ASCII only.

export type Format = "wide" | "vertical" | "square" | "portrait" | "band";

/** Every constant below is a fraction of the SHORT axis, because that is what
 *  TEXT_SCALE is a fraction of. Measured off the rendered wide frame, not
 *  computed from font metadata: the numbers that matter are the ones the
 *  browser actually paints. */
const K = {
  /** Bebas cap ink as a fraction of its font size. Back-solved from the
   *  rendered wide frame: ink 42.5 to 58.4 of 1080 at a 248.55px font. */
  capRatio: 0.6908,
  /** Font box top to cap top, same source: element 42.0, ink 42.5. */
  capTopOff: 0.0217,
  /** TEXT_SCALE.big, repeated here so this module needs no import cycle. */
  bigScale: 79 / 460,
  /** TEXT_SCALE.url. */
  urlScale: 11 / 460,
  /** The ask's border box, in multiples of its own font size. Measured
   *  68.3 to 78.9 at a 40px font. */
  askBox: 2.8625,
  /** The ask's font, in multiples of the link's. */
  askFont: 1.55,
  /** Mono ink height and top offset, as fractions of the link's font size.
   *  Measured element 88.2, ink 88.9 to 91.0 at a 25.83px font. */
  linkInk: 0.878,
  linkTopOff: 0.293,
} as const;

const AR = 1436 / 1016;
const LEAN = -6;
const RAD = (Math.abs(LEAN) * Math.PI) / 180;
const SIN = Math.sin(RAD);
const COS = Math.cos(RAD);

type Spec = {
  w: number;
  h: number;
  safe: number;
  /** Multiplier on TEXT_SCALE.big. */
  wordScale: number;
  /** The certificate's width, percent of frame width. */
  cardW: number;
  /**
   * "column" keeps the wide composition: the card holds the right, the type
   * runs down a left column, bottom anchored at a constant gap.
   * "stack" is for aspects at or near square and taller, where there IS no
   * left column: the word sits above the card and the ask and link below it.
   */
  mode: "column" | "stack";
  /** Column mode only: the card's own position, percent. */
  card?: { left: number; top: number };
};

export const SPECS: Record<Format, Spec> = {
  // The locked frame. Card and gap exactly as picked.
  wide: { w: 1920, h: 1080, safe: 8, wordScale: 1.34, cardW: 46, mode: "column", card: { left: 46, top: 18 } },
  // SAME PICTURE AS WIDE, only the type margin changes. Band is not a 1920x640
  // render: it is the 16:9 cut shown through object-fit:cover on a roughly
  // 2.4:1 slice, so re-rendering it at 640 tall would letterbox the subject
  // rather than crop it, which is the opposite of what the surface does. safe
  // 24 is what clears the worse of the two crops that use it.
  band: { w: 1920, h: 1080, safe: 24, wordScale: 1.34, cardW: 46, mode: "column", card: { left: 46, top: 18 } },
  // ---- aspect at or below 1. The left column does not exist here, and the
  // word no longer has to hold one side on its own, so it drops back to the
  // base size. At 1.34 it spanned the full width on all three and left nothing
  // for the card.
  vertical: { w: 1080, h: 1920, safe: 8, wordScale: 1, cardW: 78, mode: "stack" },
  square: { w: 1080, h: 1080, safe: 8, wordScale: 1, cardW: 52, mode: "stack" },
  portrait: { w: 1080, h: 1350, safe: 8, wordScale: 1, cardW: 72, mode: "stack" },
};

/** Percent of frame WIDTH and HEIGHT. `top`/`left` are the ELEMENT's, not the
 *  ink's, because that is what CSS takes. */
export type Placed = {
  word: { left: number; top: number };
  ask: { left: number; top: number };
  link: { left: number; top: number };
  card: { left: number; top: number; w: number; lean: number };
  /** Reported so a render can be checked against what was intended. */
  ink: { wordTop: number; wordBottom: number; askTop: number; askBottom: number; linkTop: number; linkBottom: number };
  gap: number;
};

export function placeEarn(format: Format): Placed {
  const s = SPECS[format];
  const { w: W, h: H } = s;
  const short = Math.min(W, H);
  const pctH = (px: number) => (px / H) * 100;

  const fontBig = short * K.bigScale * s.wordScale;
  const fontLink = short * K.urlScale;
  const fontAsk = Math.round(fontLink * K.askFont);

  const wordInk = pctH(fontBig * K.capRatio);
  const wordTopOff = pctH(fontBig * K.capTopOff);
  const askH = pctH(fontAsk * K.askBox);
  const linkInk = pctH(fontLink * K.linkInk);
  const linkTopOff = pctH(fontLink * K.linkTopOff);

  // The card's AXIS-ALIGNED box after the lean. The element is placed by its
  // unrotated top-left, but everything is composed against what the lean
  // actually occupies, so the two have to be converted between.
  const cardWpx = (s.cardW / 100) * W;
  const cardHpx = cardWpx / AR;
  const aabbH = pctH(cardWpx * SIN + cardHpx * COS);
  const elemFromAabb = (aabbTop: number) => aabbTop + (aabbH - pctH(cardHpx)) / 2;

  const top = s.safe;
  const bottom = 100 - s.safe;

  if (s.mode === "column") {
    // Bottom anchored at a constant gap, which IS the locked rule.
    const gap = 10;
    // 91 when safe is 8, which is the locked frame: the link rides just inside
    // the line rather than sitting on it.
    const linkInkBottom = bottom - 1;
    const linkInkTop = linkInkBottom - linkInk;
    const askBottom = linkInkTop - gap;
    const askTop = askBottom - askH;
    const wordInkBottom = askTop - gap;
    const wordInkTop = wordInkBottom - wordInk;
    const c = s.card ?? { left: 46, top: 18 };
    return {
      word: { left: 7, top: wordInkTop - wordTopOff },
      ask: { left: 7, top: askTop },
      link: { left: 7, top: linkInkTop - linkTopOff },
      card: { left: c.left, top: c.top, w: s.cardW, lean: LEAN },
      ink: {
        wordTop: wordInkTop,
        wordBottom: wordInkBottom,
        askTop,
        askBottom,
        linkTop: linkInkTop,
        linkBottom: linkInkBottom,
      },
      gap,
    };
  }

  // STACK. Four things share one column, so the gap is what is left over rather
  // than a number chosen in advance. Solving for it is the only way the same
  // rule can serve 1:1, 4:5 and 9:16, whose leftovers differ by a factor of two.
  const total = wordInk + aabbH + askH + linkInk;
  const gap = (bottom - top - total) / 3;
  const wordInkTop = top;
  const wordInkBottom = wordInkTop + wordInk;
  const cardAabbTop = wordInkBottom + gap;
  const askTop = cardAabbTop + aabbH + gap;
  const askBottom = askTop + askH;
  const linkInkTop = askBottom + gap;

  return {
    word: { left: 7, top: wordInkTop - wordTopOff },
    ask: { left: 7, top: askTop },
    link: { left: 7, top: linkInkTop - linkTopOff },
    card: { left: (100 - s.cardW) / 2, top: elemFromAabb(cardAabbTop), w: s.cardW, lean: LEAN },
    ink: {
      wordTop: wordInkTop,
      wordBottom: wordInkBottom,
      askTop,
      askBottom,
      linkTop: linkInkTop,
      linkBottom: linkInkTop + linkInk,
    },
    gap,
  };
}

export function formatFor(w: number, h: number, band = false): Format {
  if (band) return "band";
  if (w === 1080 && h === 1920) return "vertical";
  if (w === 1080 && h === 1080) return "square";
  if (w === 1080 && h === 1350) return "portrait";
  return "wide";
}
