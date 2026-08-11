// SANDBOX — EARN layouts, reworked for space. DEV ONLY.
//
// A PLAIN MODULE because the stage is a client component and the page is a
// server one, and anything a server component imports from a "use client" file
// arrives as a client reference rather than a value.
//
// WHAT THE SCREENSHOT SHOWED, and none of it was subtle once measured:
//
//   THE CARD WAS CLIPPED. Layout 08 put it at left 54% with width 44%, so its
//   right edge sat at 98% before anything moved. The push-in then grows it 4.5%
//   about its centre and the six degree lean widens its axis-aligned box by
//   roughly another 3%, which together push it past the frame. Every layout
//   here leaves room for BOTH, and the check measures the rendered bounds
//   rather than trusting this arithmetic.
//
//   THE LINK WAS NOT AT THE BOTTOM. It sat in grid row 4, vertically centred,
//   which lands it near 77% with a dead band under it. It is on `c-band` now,
//   which is bottom-aligned.
//
//   THE LOWER LEFT WAS EMPTY. With the word up at 22% and the link at 77%,
//   about a third of the frame did nothing. These trade card size against word
//   size to use it.

export type Layout = {
  id: string;
  label: string;
  note: string;
  /** Card box as fractions of the frame, BEFORE the push-in scales it. */
  cert: { w: number; left: number; top: number };
  /** Multiplier on the cue layer's `big` word size. */
  wordScale: number;
  /** Bottom-aligned band, or the original row-4 cell. */
  urlAlign?: "right" | "centre";
};

export const LAYOUTS: Layout[] = [
  {
    id: "a",
    label: "Shifted left",
    note: "The minimum change: card moved in from the edge, link dropped to the bottom. Same sizes otherwise",
    cert: { w: 44, left: 44, top: 20 },
    wordScale: 1,
  },
  {
    id: "b",
    label: "Bigger card",
    note: "Card grown to half the frame now that it has room on the right",
    cert: { w: 50, left: 40, top: 16 },
    wordScale: 1,
  },
  {
    id: "c",
    label: "Bigger word",
    note: "Card as in A, EARN up by a third. The word carries the empty left instead of floating in it",
    cert: { w: 44, left: 45, top: 20 },
    wordScale: 1.34,
  },
  {
    id: "d",
    label: "Both bigger",
    note: "Card at half the frame and the word up by a third. The fullest reading",
    cert: { w: 49, left: 42, top: 15 },
    wordScale: 1.34,
  },
  {
    id: "e",
    label: "Card dominant",
    note: "Card at 54% and the word held back. The certificate is the subject and the type labels it",
    cert: { w: 54, left: 38, top: 13 },
    wordScale: 0.86,
  },
  {
    id: "f",
    label: "Word dominant",
    note: "Card small and low-right, EARN at half again. The most graphic of them",
    cert: { w: 38, left: 52, top: 26 },
    wordScale: 1.5,
  },
  {
    id: "g",
    label: "Centred band",
    note: "Card left of centre, link centred along the bottom rather than left-aligned",
    cert: { w: 46, left: 46, top: 18 },
    wordScale: 1.2,
    urlAlign: "centre",
  },
];

export const byId = (id: string) => LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[0];
