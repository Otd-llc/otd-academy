// SANDBOX - EARN beat arrangements. DEV ONLY.
//
// A PLAIN MODULE: a server component importing this from a "use client" file
// would get client references instead of values.
//
// WHAT THE CURRENT FRAME DOES WRONG, measured off it rather than felt:
//
//   THE RHYTHM IS INVERTED. Word ink ends at 35.8, the ask starts at 74, and the
//   link starts at 90.7. So there is a 38.2 point void in the middle of the
//   column and then two elements 6.1 apart at the bottom. The eye reads a hole
//   followed by a clump, which is the opposite of a stack.
//
//   THE URL IS THE ONLY CENTRED ELEMENT. Its left edge sits 25.5 points right of
//   everything above it. A centred line under a left-aligned stack reads as a
//   mistake rather than a choice.
//
//   THE MARK SHARES AN EDGE WITH NOTHING. Air on all four sides and no alignment
//   to the word above or the box below, so it looks parked rather than placed.
//
//   THE BOTTOM RIGHT IS EMPTY. The card's rotated box ends at 79.9 and nothing
//   uses the band underneath it.
//
// THE NUMBERS BELOW ARE COMPUTED, NOT EYEBALLED. Measured constants, all as
// percentages of frame HEIGHT:
//
//   EARN ink height  14.3 at scale 1.2 | 15.5 at 1.3 | 15.9 at 1.34
//   EARN ink top     `top` + 0.4
//   ask box height   10.6, and its top IS `top` (a border box, not a glyph run)
//   link ink height  2.1, ink top `top` + 0.7
//   card at w46/top18 spans 13.9 to 79.9 vertically, centre 46.9
//     (18 is the unrotated top; the -6 degree lean grows the box 4.3 either way)
//   card at w48/top16 spans 11.7 to 80.6
//
// POSITIONS ARE EXPLICIT PERCENTAGES, not grid cells. The cue grid is the house
// system and the winner converts back into it, but a five-cell grid cannot say
// "move the block down six points and even out the gaps", which is the question.
//
// ASCII only.

export type Box = { left: number; top: number; w?: number };

export type Arrangement = {
  id: string;
  label: string;
  note: string;
  /** left/top are percentages of WIDTH and HEIGHT. */
  earn: Box & { scale: number };
  /** `size` is a percentage of the SHORT AXIS, matching TEXT_SCALE and the
   *  flash round. Read as a width it comes out 1.78x too big on 16:9. */
  wm: (Box & { size: number; opacity: number }) | null;
  cta: Box;
  url: Box & { align: "left" | "centre" | "right" };
  /** `bleed` says the crop off the right edge is the point, so the safe-area
   *  check does not report it as an accident. Type is never exempt. */
  cert: { w: number; left: number; top: number; lean: number; bleed?: true };
};

const CERT = { w: 46, left: 46, top: 18, lean: -6 };

export const ARRANGEMENTS: Arrangement[] = [
  {
    id: "current",
    label: "As shipped",
    note: "The reference. A 38 point void mid-column, two elements clumped at the bottom, and the link centred under a left-aligned stack",
    // Reproduces the cue grid: c-tl and c-ml are rows 2 and 3 of 8/1fr/1fr/1fr/8,
    // so each band is 28 tall and the mark sits centred in the middle one.
    earn: { left: 7, top: 21, scale: 1.2 },
    wm: { left: 8, top: 32, size: 36, opacity: 0.11 },
    cta: { left: 7, top: 74 },
    url: { left: 0, top: 90, align: "centre" },
    cert: CERT,
  },
  {
    id: "even",
    label: "Even column",
    note: "Four elements spread across the full column at a constant 9.6 gap. The ask lands its bottom edge on the card's, which was not aimed at and is worth keeping",
    // 10 to 91 is 81 points to fill. 15.5 word + 24 mark + 10.6 ask + 2.1 link
    // leaves 28.8 for three gaps, so 9.6 each.
    earn: { left: 7, top: 9.6, scale: 1.3 }, // ink 10.0 to 25.5
    wm: { left: 7, top: 35.1, size: 24, opacity: 0.12 }, // 35.1 to 59.1
    cta: { left: 7, top: 69.3 }, // 69.3 to 79.9, and the card ends at 79.9
    url: { left: 7, top: 88.2, align: "left" }, // ink 88.9 to 91.0
    cert: CERT,
  },
  {
    id: "grouped",
    label: "Grouped, link as footer",
    note: "Word, mark and ask as one tight block at a 5 gap, optically centred against the card, with the link demoted to the bottom line where an address belongs",
    // Block height 15.5 + 5 + 20 + 5 + 10.6 = 56.1, centred on the card's 46.9.
    earn: { left: 7, top: 18.5, scale: 1.3 }, // ink 18.9 to 34.4
    wm: { left: 7, top: 39.4, size: 20, opacity: 0.13 }, // 39.4 to 59.4
    cta: { left: 7, top: 64.4 }, // 64.4 to 75.0
    url: { left: 7, top: 89.1, align: "left" }, // ink 89.8 to 91.9
    cert: CERT,
  },
  {
    id: "footer-row",
    label: "Footer row",
    note: "The bottom band used across the whole width: link bottom left, ask bottom right under the card. The empty corner stops being empty and the two halves share a line",
    earn: { left: 7, top: 12, scale: 1.3 }, // ink 12.4 to 27.9
    wm: { left: 7, top: 33, size: 24, opacity: 0.12 }, // 33 to 57
    cta: { left: 55, top: 80 }, // 80 to 90.6, in the band under the card
    // Centred on the ask, not hung from the same top. A 10.6 box and a 2.1 line
    // sharing a top edge do not read as a row; sharing a centre does. Ask
    // centre 85.3, so the link's ink runs 84.25 to 86.35.
    url: { left: 7, top: 83.55, align: "left" },
    cert: CERT,
  },
  {
    id: "bleed",
    label: "Mark bleeding",
    note: "The mark large and running off the left edge, texture rather than logo. It forces the ask out from under it and into the corner beneath the card, which is the trade being tested",
    // A big left-edge mark and a left-column ask cannot coexist: at this size
    // the mark covers over half the box, and the rule carried over from the
    // flash round is that it never touches the ask. So the ask moves.
    earn: { left: 7, top: 9.6, scale: 1.3 }, // ink 10.0 to 25.5
    wm: { left: -10, top: 18, size: 62, opacity: 0.06 }, // 18 to 80
    cta: { left: 55, top: 80 }, // 80 to 90.6
    url: { left: 7, top: 83.55, align: "left" }, // ink 84.25 to 86.35, centred on the ask
    cert: CERT,
  },
  {
    id: "cert-bleed",
    label: "Card off the edge",
    note: "Same even column, but the card grows to 52 and crops past the right edge. A confident crop reads as a frame from a longer film rather than a poster",
    // w52 at top 14.3 spans 9.5 to 84.5 and runs to 107.8 across, so 7.8 of it
    // is off-frame. Centre 47, near enough the 46.9 the column is built around.
    earn: { left: 7, top: 9.6, scale: 1.3 },
    wm: { left: 7, top: 35.1, size: 24, opacity: 0.12 },
    cta: { left: 7, top: 69.3 },
    url: { left: 7, top: 88.2, align: "left" },
    cert: { w: 52, left: 52, top: 14.3, lean: -6, bleed: true },
  },
  {
    id: "baseline",
    label: "Two columns agreeing",
    note: "Word top locked to the card top and ask bottom locked to the card bottom, so the halves of the frame start and end together. The mark fills what is left, which is how it earns its size instead of choosing it",
    // Card w48/top16 spans 11.7 to 80.6. Word ink top 11.8, ask bottom 80.6.
    earn: { left: 7, top: 11.3, scale: 1.34 }, // ink 11.8 to 27.7
    wm: { left: 7, top: 33, size: 31, opacity: 0.11 }, // 33 to 64
    cta: { left: 7, top: 70 }, // 70 to 80.6
    url: { left: 7, top: 88.2, align: "left" }, // ink 88.9 to 91.0
    cert: { w: 48, left: 46, top: 16, lean: -6 },
  },
  {
    id: "no-mark",
    label: "No mark",
    note: "Type alone at a constant 10 gap, hung from the bottom line. Worth seeing before deciding the mark earns its place, and it shows how much of the column the mark was carrying",
    earn: { left: 7, top: 42.0, scale: 1.34 }, // ink 42.4 to 58.3
    wm: null,
    cta: { left: 7, top: 68.3 }, // 68.3 to 78.9
    url: { left: 7, top: 88.2, align: "left" }, // ink 88.9 to 91.0
    cert: CERT,
  },
];

export const byId = (id: string) => ARRANGEMENTS.find((a) => a.id === id) ?? ARRANGEMENTS[0];

// 08 WITH THE MARK ABOVE THE WORD.
//
// The column is bottom-anchored and unchanged from 08: ask 68.3 to 78.9, link
// ink 88.9 to 91.0, word ink 42.5 to 58.4, at a constant 10 gap. So the mark has
// a FIXED FLOOR at 42.5 and a ceiling at the top safe line, and its size is the
// only free variable - which means size and gap are the same decision:
//
//   mark hung at top 9, so gap to the word = 42.5 - (9 + size)
//
// Opacity comes down as it grows, following the flash round's own curve
// (24 at .13, 36 at .11, 50 at .09, 72 at .07): a bigger mark puts more ink on
// the frame at the same alpha, so holding alpha constant would make the large
// ones shout.
//
// This is the INVERSE of "even": there the word owns the top and the mark sits
// mid-column, here the mark owns the top and the word drops to the middle.
const EIGHT = {
  earn: { left: 7, top: 42.0, scale: 1.34 }, // ink 42.5 to 58.4
  cta: { left: 7, top: 68.3 }, // 68.3 to 78.9
  url: { left: 7, top: 88.2, align: "left" as const }, // ink 88.9 to 91.0
  cert: CERT,
};

export const EIGHT_MARKS: Arrangement[] = [
  {
    ...EIGHT,
    id: "e8-none",
    label: "08 as it was",
    note: "The reference. Type alone, and the whole top third of the column is empty",
    wm: null,
  },
  {
    ...EIGHT,
    id: "e8-16",
    label: "Mark 16",
    note: "Small and hung off the top line. It marks the corner, but a 17.5 gap leaves it stranded from the word",
    wm: { left: 7, top: 9, size: 16, opacity: 0.15 }, // 9 to 25, gap 17.5
  },
  {
    ...EIGHT,
    id: "e8-22",
    label: "Mark 22",
    note: "Gap 11.5, near enough the column's own 10 that the mark reads as a fourth member of the stack rather than a decoration",
    wm: { left: 7, top: 9, size: 22, opacity: 0.13 }, // 9 to 31, gap 11.5
  },
  {
    ...EIGHT,
    id: "e8-26",
    label: "Mark 26",
    note: "Gap 7.5, so it groups toward the word without touching it. The largest that still leaves visible air",
    wm: { left: 7, top: 9, size: 26, opacity: 0.12 }, // 9 to 35, gap 7.5
  },
  {
    ...EIGHT,
    id: "e8-30",
    label: "Crest",
    note: "Gap 3.5. Close enough to read as one lockup, mark and word together, rather than two stacked items",
    wm: { left: 7, top: 9, size: 30, opacity: 0.11 }, // 9 to 39, gap 3.5
  },
];
