// The real Hex-TB-Main part outline, as a vector.
//
// PROVENANCE, and why this is not hand-drawn. These paths are GENERATED from
// the CAD by the bioscale-viz glyph pipeline (`tools/glyph/build-glyphs.mjs`,
// PR #5) out of `Hex-TB-Main.FCStd` via the published STL, at the owner's
// 25-degree edge-angle pick. Copied here as the emitted output rather than
// re-projected, because a second projection of the same solid is a second thing
// that can disagree with the part.
//
//   DO NOT HAND-EDIT THE PATH DATA. If the geometry changes, re-run the
//   generator and copy the result again. An edited path is a drawing of a
//   part that does not exist.
//
// `stroke="currentColor"` is load-bearing for the theming law: the glyph takes
// its colour from the parent's text colour, so it flips with the theme and
// carries no baked hex. That is also why this is an inline component rather
// than an <img>, which could not inherit the colour.
//
// Source viewBoxes are the generator's: 1000x894 top, 1000x899 iso.

export type HexGlyphVariant =
  /** The full top-down projection: body, dovetails and interior edge lines. */
  | "top"
  /** The closed body silhouette alone. The same outline as `top`, with the
   *  interior projection lines dropped, so it reads as a mark rather than a
   *  drawing. */
  | "outline"
  /** The isometric projection. Considerably busier; it carries tessellation
   *  artefacts that are invisible at icon size and legible at hero size. */
  | "iso";

/** The OUTER silhouette: the hex body with a dovetail on each of the six edges.
 *
 *  This is the path the `outline` variant draws, and picking it is not obvious.
 *  The generated set contains two large closed paths, and the wrong one looks
 *  right at a glance: `BODY_INNER` below is the inner wall, whose profile shows
 *  a notch on only the two FLAT edges, so a silhouette drawn from it quietly
 *  claims a two-dovetail part. Verified by rendering, not by reading. */
//  VERBATIM from the generator, including the closing Z. It briefly was not:
//  the emitter used to weld a four-point tail onto this loop after it had
//  already returned to its start, drawing a spur off the bottom-left vertex,
//  and this file truncated it by hand. That was fixed upstream instead
//  (bioscale-viz PR #8, `chain()` now stops a walk at its own start), so the
//  hand-truncation is gone and these are the emitted bytes again.
/** Image units per millimetre, for placing these glyphs at REAL spacing (a
 *  lattice at the 76.20 mm cell pitch) instead of a gap that merely looks
 *  right.
 *
 *  Derived from the DRAWN EXTENT, not the viewBox. The obvious reading is
 *  `1000 / 87.757`, since the viewBox is 1000 wide and the part is 87.757 mm
 *  across, and it is wrong: the generator pads the path inside the box, so the
 *  outer path actually spans x 37..963, which is 926 units. Using 1000 makes
 *  every derived distance 8% too large, which in a lattice means the tiles sit
 *  apart with a visible gap and the dovetails never meet. That is exactly what
 *  the first render showed.
 *
 *  Cross-check: 926 across corners implies 926 x cos(30) = 802 across flats,
 *  and the pitch works out at 804 units, so neighbours land 2 units apart with
 *  their dovetails overlapping. That is an engaged joint, which is the thing
 *  the drawing is supposed to depict. */
const OUTER_PATH_SPAN_X = 926;
const PART_WIDTH_MM = 87.757;
export const GLYPH_UNITS_PER_MM = OUTER_PATH_SPAN_X / PART_WIDTH_MM;

/** Where the hex body's centre sits inside the viewBox, for transforms.
 *  Measured from the same path: x 37..963 and y 35..859 both centre here. */
export const GLYPH_CENTRE = { x: 500, y: 447 } as const;

/** Half the DRAWN extent, for framing a group of translated copies. Not the
 *  same as GLYPH_CENTRE, and conflating the two is how the first lattice got a
 *  viewBox 537 units too wide on each side: the tiles were laid out correctly
 *  and then framed so loosely that they read as scattered. */
export const GLYPH_HALF = { x: OUTER_PATH_SPAN_X / 2, y: 824 / 2 } as const;

/** Which way the part faces, established from the path rather than assumed:
 *  the left extreme is a single point (a VERTEX) and the top extreme is a short
 *  run (a dovetail tip on a flat edge). So vertices lie on the horizontal axis
 *  and the flats face up and down, which fixes where a neighbour must sit. */
export const GLYPH_VERTEX_ON_X = true;

export const BODY_OUTER =
  "M306 859L394 859 378 838 622 838 606 859 694 859 800 675 811 700 884 574 " +
  "857 577 963 393 919 316 909 341 787 130 814 133 769 57 557 57 573 35 " +
  "427 35 443 57 231 57 186 133 213 130 91 341 81 316 37 393 143 577 116 574 " +
  "189 700 200 675Z";

/** The inner wall of the top view. Part of the full projection; NOT a
 *  silhouette (see above). */
export const BODY_INNER =
  "M704 116L879 420 883 431 883 442 879 453 704 756 692 768 681 772 608 772 " +
  "603 771 589 761 583 751 581 734 577 724 570 715 560 709 549 707 451 707 " +
  "440 709 426 719 419 734 417 751 411 761 397 771 386 773 325 773 308 768 " +
  "296 756 121 453 117 442 117 431 121 420 296 116 308 104 319 100 392 100 " +
  "402 104 411 112 417 121 419 138 423 149 435 161 445 165 555 165 565 161 " +
  "574 153 581 138 583 121 586 116 598 104 608 100 681 100 692 104Z";

export const TOP_INTERIOR = [
  "M565 150L565 105 564 125",
  "M565 150L562 155 438 155 435 152 435 104 438 100 562 100 565 105 563 101",
  "M560 773L440 773 435 769 435 720 439 717 561 717 565 720 565 769 560 773 440 773 435 769",
  "M924 434L713 68 290 67 709 67",
  "M76 439L75 434 285 70 290 67 285 70 75 434 75 438 285 801",
  "M78 444L97 475",
  "M97 476L114 506",
  "M132 537L168 599",
  "M169 600L205 662",
  "M925 434L925 438 712 805 288 805",
  "M378 838L406 851 410 848 590 848 594 851 622 838",
  "M143 577L117 560 115 562 105 561 101 564 116 574",
  "M189 700L190 718 195 715 199 707 203 706 207 709 296 865",
  "M200 675L202 706 205 708",
  "M37 393L24 393 118 555 117 560",
  "M81 316L82 299 77 301 24 393 28 399",
  "M91 341L93 310 89 308 83 299",
  "M606 859L590 867 592 870 700 870 694 859",
  "M231 57L224 46 412 46 416 42 416 38 411 32 411 27 414 24 586 24 589 26 589 32 584 38 585 43 557 57",
  "M186 133L172 143 171 138 221 51",
  "M213 130L188 147 183 144 174 145 171 141",
  "M800 675L798 706 810 718 811 700",
  "M884 574L899 564 899 570 815 716 812 718 807 717",
  "M857 577L883 560 885 562 895 561 899 564 896 562",
  "M573 35L589 27 589 32 584 38 584 42 588 46 776 46 829 138 829 142 826 145 814 145 812 153 902 308 907 310 909 341",
  "M919 316L918 299 923 301 976 393 882 555 883 560 882 555 910 505",
  "M963 393L976 393 893 536 976 393 938 326",
  "M787 130L812 147 817 144 813 147 817 144 822 145",
  "M769 57L776 46 800 88",
  "M899 569L815 716",
  "M800 707L797 706 793 709 700 870 764 758",
  "M883 554L906 514",
  "M976 393L955 357",
  "M595 870L646 870",
  "M591 849L410 848 405 852 410 862 408 870 354 870",
  "M193 717L188 718 185 716 101 570 101 564",
  "M188 147L188 153 98 308 92 310",
];

const ISO = [
  "M601 546L600 517 598 511 587 500 585 490 585 486 597 468 718 427 722 428 738 445 739 518 735 514",
  "M242 182L237 184 237 113 240 108 358 69 364 70 379 85 391 126 387 137 268 177 262 176 254 168 259 167",
  "M601 523L584 530 575 541 574 567 576 574",
  "M865 477L866 254",
  "M109 476L109 266 111 260 116 255 127 250 187 230 206 227 225 230 236 235 247 244 269 249 286 246 382 214 396 206 401 198 401 169 393 158 391 151 391 158",
  "M73 470L73 465 489 604 903 466 903 202",
  "M358 69L381 60 353 53 439 24 646 93 642 75 785 123 757 130 964 199 964 256 939 246 939 404 964 394 964 451 757 520 785 527 642 575 646 557 439 626 353 597 381 590 143 511 147 529 61 500 61 362 36 373 36 277 61 288 61 150 147 121 143 139 381 60",
  "M397 163L409 156 468 136 488 133 507 136 849 250 859 255 866 263",
  "M964 199L976 205 976 274 973 274 964 256",
  "M939 246L955 276 958 274 966 276 973 274",
  "M61 150L48 156 48 279 46 281",
  "M964 451L976 465 794 526 792 532 757 520",
  "M964 394L973 391 976 395 976 694 803 752",
  "M36 277L27 275 24 279 24 390 27 390 36 373",
  "M61 362L45 393 42 390 33 393 27 390",
  "M642 575L630 592 629 586 620 584 439 644 336 610 333 604 353 597",
  "M785 527L805 534 802 540 638 594 634 594 631 591",
  "M646 557L627 587",
  "M143 511L162 540 160 540 160 546 158 546 147 529",
  "M61 500L48 514 48 392 45 393",
  "M381 590L346 602 344 596 169 538 165 538 162 541",
  "M439 626L439 873 333 839 439 875 439 873 628 810",
  "M838 674L850 687 841 652 830 633 816 618",
  "M838 354L829 314 818 287 793 249 768 223",
  "M838 354L821 367 862 381 865 384",
  "M520 248L553 259 561 225 580 197 598 184 622 174",
  "M520 248L520 140",
  "M520 248L456 248 423 259 414 225 398 201",
  "M553 259L557 279 516 265 459 265 419 279 423 259 386 223 385 213",
  "M553 259L565 247 574 213 589 189",
  "M138 674L101 711 109 678 119 660 134 643",
  "M456 248L456 141",
  "M110 364L138 354 146 314 158 287 174 261 203 227",
  "M138 354L154 367 113 381 109 385",
  "M24 390L25 460 29 465 39 456 48 452",
  "M48 514L151 548 155 548 158 545",
  "M48 514L48 727",
  "M160 545L160 627 142 638 126 652",
  "M160 541L160 625 168 618 203 610 242 613 283 629 308 645 332 665",
  "M333 604L333 690 354 718 374 755 385 793 386 806 393 799",
  "M629 591L629 663 631 666 659 640 683 624 719 607 763 599 783 600 802 604 805 607 805 534",
  "M558 774L565 782 574 741 592 701 610 676 629 655",
  "M565 782L575 788 644 765 620 791 629 785 629 816 628 812 439 875",
  "M652 646L688 622 726 607 751 604 805 607",
  "M557 279L575 261 565 247",
  "M386 806L376 813 339 800 334 802 333 839",
  "M101 711L112 724 149 737 157 745 160 745 160 739 162 740 143 711 149 737",
  "M154 682L112 724",
  "M386 223L376 236 336 251 333 261 336 266 343 267 345 270",
  "M419 279L376 236",
  "M48 743L157 780 160 777 160 744",
  "M149 312L143 338 381 259 339 249",
  "M339 800L381 790 143 711",
  "M644 765L642 774 785 726 771 723 840 700",
  "M575 261L644 284 632 289",
  "M644 284L642 275 785 322 771 326 836 348",
  "M976 694L976 588 976 694 964 700 804 754",
  "M48 482L36 477 36 572 48 567",
  "M36 477L27 474 24 478 24 590 27 589 36 572",
  "M785 726L805 733 802 739 638 794 631 791",
  "M160 740L160 770 161 766 333 824",
  "M162 740L169 737 344 795 346 798",
  "M629 790L629 823 631 826 642 824 805 768 805 733",
  "M24 589L24 620 27 625",
  "M631 826L805 768",
  "M546 839L536 844 516 849",
];

export function HexBodyGlyph({
  variant = "top",
  className,
  style,
  strokeWidth,
  title = "Hex Cluster base tile, dovetailed on all six edges",
}: {
  variant?: HexGlyphVariant;
  className?: string;
  /** Sizing only. Colour must come from the parent's text colour, never here. */
  style?: React.CSSProperties;
  /** Override the stroke, in viewBox units. The default is the generator's 10
   *  on a 1000-wide box, which is 1% of the width: correct at hero size and
   *  invisible at icon size, where 1% of 15px is a sixth of a pixel. An icon
   *  needs roughly 70. */
  strokeWidth?: number;
  /** Accessible name. Pass null-ish only when a caption already names it. */
  title?: string;
}) {
  const iso = variant === "iso";
  const paths =
    variant === "outline"
      ? [BODY_OUTER]
      : iso
        ? ISO
        : [BODY_OUTER, BODY_INNER, ...TOP_INTERIOR];

  return (
    <svg
      viewBox={iso ? "0 0 1000 899" : "0 0 1000 894"}
      className={className}
      style={style}
      role="img"
      aria-label={title}
    >
      <g
        fill="none"
        stroke="currentColor"
        // The generator's stroke is 10 on a 1000-unit box (1%). Kept, so the
        // glyph reads at the same weight the configurator's icons do.
        strokeWidth={strokeWidth ?? (variant === "outline" ? 12 : 10)}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {paths.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
    </svg>
  );
}
