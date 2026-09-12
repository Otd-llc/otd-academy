// A top-down plan of the plate, as a PNG small enough to ride inside the file.
//
// WHY A THUMBNAIL AT ALL. 3MF carries a PACKAGE THUMBNAIL through the OPC
// relationship type
// `http://schemas.openxmlformats.org/package/2006/relationships/metadata/thumbnail`,
// with the image at `/Metadata/thumbnail.png`. That is CORE SPEC, not a vendor
// extension -- which is the whole reason it is worth doing where printer and
// process settings are not. Explorer, Finder, a model browser and most slicers'
// open dialogs all read it, so a file called `MY-CLUSTER-15-parts.3mf` can show
// what is on it before anyone opens a slicer.
//
// WHY A HAND-ROLLED ENCODER, and not `next/og` (which this repo already uses for
// every opengraph card, and which resolves to the bundled
// `next/dist/compiled/@vercel/og`).
//
// MEASURED, NOT ASSUMED. Both were built and timed on the same 14-placement
// plate on a 220 mm bed, in this repo, on Node v24.5.0 -- see
// `docs/plans/2026-08-15-hex-download-identity.md`:
//
//                              bytes    cold      warm     runtime weight
//   next/og (satori+resvg)     2,721    1142.8ms  11.87ms  resvg.wasm 1,378,357 B
//                                                          + yoga.wasm 71,736 B
//   this module                  496       3.2ms   1.05ms  none
//
// 5.5x smaller, 357x faster on a cold call, and 1.45 MB of wasm NOT instantiated
// in a serverless function. Both are deterministic, so that was not what decided
// it -- but determinism is a materially easier property to KEEP over two hundred
// lines of our own arithmetic than over a rasteriser we would be trusting to
// stay bit-stable across versions, for a response that promises identical bytes.
//
// This is a diagram of axis-aligned rectangles. The one axis a general-purpose
// vector rasteriser would win on -- anti-aliased curves -- does not arise.
//
// DETERMINISM IS A REQUIREMENT, inherited from the response. The pack is cached
// `public, max-age=86400` keyed on the URL and the design promises identical
// bytes for identical input, so a thumbnail carrying a timestamp, a random seed
// or a platform-dependent number would break the promise from inside the file.
// Three things are therefore true of everything below:
//
//   - NO CLOCK AND NO RANDOMNESS. PNG's optional `tIME` chunk is not written.
//   - ONLY `+ - * /`, `Math.round`, `Math.floor`, `Math.ceil`, `Math.min`,
//     `Math.max`, and a numeric `Array.prototype.sort`. The five `Math`
//     functions are exactly specified by ECMA-262 (`ceil` in the same clause as
//     `floor`, as its mirror) and the arithmetic by IEEE 754, so they give the
//     same answer on every host. NO transcendental (`sin`, `pow`, `exp`): those
//     are explicitly NOT required to be correctly rounded and are the one place
//     a "floating-point path that varies by platform" actually lives. `sort`
//     with a subtractive comparator is a total order on the finite doubles this
//     file produces, and V8's sort is stable, so ties do not move either.
//   - THE DEFLATE OPTIONS ARE PINNED, not defaulted, so an upstream change to a
//     default cannot silently change our bytes.
//
// WHY SILHOUETTES AND NOT RECTANGLES. Until 2026-08-16 every part was drawn as
// its bounding box, so a hex tile, a carrier tray and a dovetail cap were three
// rectangles differing only in aspect ratio: the picture said HOW MANY parts and
// roughly where, and nothing about WHICH. The outlines come from
// `hex-outlines.ts` and are true top-down shadows, so a hexagon is a hexagon,
// a tray's dovetail tabs stand out where a tile's notches cut in, and a cap's
// fastener holes are holes.
import { constants, crc32, deflateSync } from "node:zlib";

import type { Bed } from "@/lib/hex-pack";
import {
  HEX_OUTLINE_SCALE,
  HEX_PART_FAMILY,
  HEX_PART_OUTLINE,
} from "@/lib/hex-outlines";
import { HEX_PART_FAMILIES } from "@/lib/hex-parts";
import type { Placement } from "@/lib/hex-plate";

/** Where the image lives inside the 3MF package, and the relationship that
 *  points at it. Both are exported because `hex-3mf.ts` has to write the entry,
 *  the `[Content_Types].xml` default and the `.rels` line, and a second spelling
 *  of the path in any one of those three is a package that carries an orphan
 *  image and shows no thumbnail -- valid, silent, and useless. */
export const THUMBNAIL_PATH = "Metadata/thumbnail.png";
export const THUMBNAIL_REL_TYPE =
  "http://schemas.openxmlformats.org/package/2006/relationships/metadata/thumbnail";

/** Square, and small on purpose. This is a thumbnail, not an illustration: at
 *  256 px a 220 mm bed is 1.1 px/mm, which is enough to see the arrangement and
 *  count the parts and not enough to invite anyone to read dimensions off it.
 *  Square because the frame has to hold a 1000 x 100 bed and a 100 x 1000 one
 *  without either being clipped, and because every shell that renders one of
 *  these renders it into a square tile. */
const SIZE = 256;

/** Breathing room around the bed, in pixels. Also what stops a 1 px bed border
 *  landing on the image edge, where several shells crop it. */
const MARGIN = 6;

/** Ten colours: the frame, one per part family, and one for a part with no
 *  family.
 *
 *  ONE HUE, SIX VALUES, AND THAT IS THE WHOLE DESIGN.
 *
 *  GOLD ONLY, because the OTD vocabulary has exactly one accent. Blue is for
 *  data and links and is always secondary; red means a critical state. Six
 *  arbitrary hues would read as somebody else's product, and a red part on a
 *  plate would be a warning about nothing.
 *
 *  VALUE, NOT HUE, because of the size. A spike is 25 x 6.7 mm, which on the
 *  default 220 mm bed is 28 x 7 px. Hue discrimination collapses on shapes that
 *  small -- small-field tritanopia is a property of normal vision, not a defect
 *  -- while a lightness step survives down to a couple of pixels. So the six
 *  families are six rungs of one gold ladder, evenly spaced at 8 points of CIE
 *  L* from 49.3 to 89.3, with the third rung landing exactly on the house
 *  command gold (#c8963e, L* 65.3). The darkest still clears the bed at 3.6:1
 *  and the lightest reaches 12.5:1.
 *
 *  DARK TO LIGHT IN `HEX_PART_FAMILIES` ORDER, which is assembly order and --
 *  because a part fitted later is a part fitted on the outside -- descending
 *  part size. The second reading is the one that matters here: the smallest
 *  parts get the lightest gold, i.e. the most contrast against the bed, which is
 *  exactly where contrast is scarcest. Ordering the ramp the other way would
 *  hide the spikes.
 *
 *  IT CANNOT FLIP WITH A THEME, so it does not try. This is a raster sealed
 *  inside a file, and it will be looked at in a light file browser and a dark
 *  one. Every contrast that matters is INTERNAL -- the picture paints its own
 *  deep-space field edge to edge and nothing of the host shows through -- so the
 *  only thing the host changes is how the tile separates from its surroundings.
 *  Against light chrome the field is a near-black card at ~18:1. Against dark
 *  chrome (Explorer's #202020, Finder's #1e1e1e) the field is DARKER than the
 *  chrome, but only just, so the thing that reads as an object there is not the
 *  page: it is the bed rectangle, which is why the 6 px margin and the lighter
 *  bed edge stay. One treatment, no compromise in either direction, and no
 *  reliance on a background we do not paint.
 *
 *  The image is flat colour, so an indexed PNG (colour type 3) stores one byte
 *  per pixel and deflate turns each run of identical bytes into almost nothing.
 *  A truecolour PNG of the same picture is three times the raw size.
 *
 *  Ordered so index 0 is the page: `Uint8Array` starts zeroed, so the background
 *  fill is free and is not a step anybody can forget. */
const PALETTE: readonly (readonly [number, number, number])[] = [
  [0x0b, 0x12, 0x1c], // 0 -- outside the bed
  [0x16, 0x20, 0x2e], // 1 -- the bed
  [0x33, 0x41, 0x5a], // 2 -- the bed edge
  [0x97, 0x6e, 0x2c], // 3 -- base       L* 49.3
  [0xaf, 0x82, 0x35], // 4 -- insert     L* 57.3
  [0xc8, 0x96, 0x3e], // 5 -- pcb        L* 65.3  (command gold)
  [0xdd, 0xac, 0x57], // 6 -- cap        L* 73.3
  [0xec, 0xc5, 0x80], // 7 -- spike      L* 81.3
  [0xf3, 0xde, 0xb6], // 8 -- accessory  L* 89.3
  [0x7d, 0x86, 0x98], // 9 -- no family
];

const PAGE = 0;
const BED = 1;
const BED_EDGE = 2;
/** The first family rung. Family `i` of `HEX_PART_FAMILIES` is `INK + i`. */
const INK = 3;
/** A part whose slug is in no table. Unreachable from the pack route, where
 *  every placement came out of `HEX_PART_BOX` -- but a `Placement` is a plain
 *  object anyone can build, and the honest answer to "which family is this" is
 *  not to guess a gold. A desaturated slate is the one value in the picture that
 *  is visibly outside the ladder, so an unclassified part looks unclassified
 *  rather than looking like a `pcb`. */
const NO_FAMILY = INK + HEX_PART_FAMILIES.length;

/** Where each family sits on the ladder, resolved once at module load rather
 *  than per part per plate. */
const FAMILY_INK: Record<string, number> = Object.fromEntries(
  HEX_PART_FAMILIES.map((family, i) => [family, INK + i]),
);

/** Smallest part, in pixels on each axis, that gets a keyline drawn inside its
 *  own outline.
 *
 *  The keyline costs a pixel all the way round, so below this it is not a
 *  refinement -- it is most of the part. Five is the first size at which a
 *  keylined part still has a 3 px core of its own family gold, which is the
 *  thing the keyline exists to protect. */
const KEYLINE_MIN_PX = 5;

/** An 8-bit indexed canvas. Deliberately the simplest thing that can draw this:
 *  no state, no transform stack, and every write clipped, so nothing below has
 *  to reason about whether a coordinate landed off the image. */
class Canvas {
  readonly px: Uint8Array;

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.px = new Uint8Array(w * h);
  }

  /** Clipped, so a caller may pass a rectangle that hangs off the edge.
   *
   *  That is not defensive habit: `hex-plate.ts` guarantees a placement fits the
   *  bed, but the SCALED rectangle is the product of two roundings, and a part
   *  flush against the far edge can round one pixel past it. Clipping keeps that
   *  a cosmetic pixel rather than an out-of-bounds write that would silently
   *  wrap onto the next row of a flat array. */
  fill(x: number, y: number, w: number, h: number, colour: number): void {
    const x0 = Math.max(0, x);
    const y0 = Math.max(0, y);
    const x1 = Math.min(this.w, x + w);
    const y1 = Math.min(this.h, y + h);
    for (let row = y0; row < y1; row++) {
      this.px.fill(colour, row * this.w + x0, row * this.w + x1);
    }
  }

  /** A one-pixel rule around a rectangle, drawn as four fills. */
  stroke(x: number, y: number, w: number, h: number, colour: number): void {
    if (w <= 0 || h <= 0) return;
    this.fill(x, y, w, 1, colour);
    this.fill(x, y + h - 1, w, 1, colour);
    this.fill(x, y, 1, h, colour);
    this.fill(x + w - 1, y, 1, h, colour);
  }
}

/**
 * Which pixels of each row a part's outline covers, in image coordinates.
 *
 * A SCANLINE FILL, EVEN-ODD. The rings are closed loops in per-mille of the
 * part's own footprint; this maps them into the rectangle the footprint landed
 * in, then for each pixel row takes every crossing with every edge, sorts them,
 * and keeps the odd-numbered intervals. Even-odd rather than nonzero because it
 * needs no consistent winding: `hex-outlines.ts` traces holes and boundaries by
 * the same walk and does not promise which way round either comes out, and a
 * ring inside a ring is a hole under even-odd however it is wound.
 *
 * THE Y FLIP LIVES HERE, once. An outline's `y` is measured from the part's
 * MINIMUM corner and grows away from the operator, exactly as `PartBox` does; an
 * image's grows down. `y + h - v * h / SCALE` is that turn, and it is the only
 * place in this file that knows about it.
 *
 * Returns one entry per row of the footprint, each a flat list of half-open
 * `[from, to)` column pairs. Spans rather than a bitmap because the keyline pass
 * needs to ask "is this column covered on the row above", and a handful of
 * intervals answers that without allocating a second image per part.
 */
function outlineSpans(
  rings: readonly (readonly number[])[],
  x: number,
  y: number,
  w: number,
  h: number,
): number[][] {
  // The rings in image space, computed once rather than per row.
  const rx: number[][] = [];
  const ry: number[][] = [];
  for (const ring of rings) {
    const a: number[] = [];
    const b: number[] = [];
    for (let i = 0; i < ring.length; i += 2) {
      a.push(x + (ring[i] * w) / HEX_OUTLINE_SCALE);
      b.push(y + h - (ring[i + 1] * h) / HEX_OUTLINE_SCALE);
    }
    rx.push(a);
    ry.push(b);
  }

  const rows: number[][] = [];
  for (let r = 0; r < h; r++) {
    // The pixel CENTRE, so a shape decides a pixel by covering its middle. Any
    // other convention makes a part one pixel bigger than its footprint on the
    // side the rounding happened to favour.
    const yc = y + r + 0.5;
    const xs: number[] = [];
    for (let k = 0; k < rx.length; k++) {
      const a = rx[k];
      const b = ry[k];
      const n = a.length;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const y0 = b[j];
        const y1 = b[i];
        // Half-open in y, so a vertex shared by two edges is counted once and
        // the crossing count stays even.
        if ((y0 <= yc && y1 > yc) || (y1 <= yc && y0 > yc)) {
          xs.push(a[j] + ((yc - y0) * (a[i] - a[j])) / (y1 - y0));
        }
      }
    }
    if (xs.length < 2) {
      rows.push([]);
      continue;
    }
    xs.sort((p, q) => p - q);
    const spans: number[] = [];
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const from = Math.ceil(xs[i] - 0.5);
      const to = Math.ceil(xs[i + 1] - 0.5);
      if (to > from) spans.push(from, to);
    }
    rows.push(spans);
  }
  return rows;
}

/** Is column `c` inside the part on row `r`? Rows off either end are outside,
 *  which is what makes the top and bottom of a part get a keyline. */
function covered(rows: number[][], r: number, c: number): boolean {
  if (r < 0 || r >= rows.length) return false;
  const spans = rows[r];
  for (let i = 0; i < spans.length; i += 2) {
    if (c >= spans[i] && c < spans[i + 1]) return true;
  }
  return false;
}

/** One PNG chunk: length, type, payload, CRC-32 of type+payload.
 *
 *  `zlib.crc32` is the same polynomial PNG specifies (ISO 3309 / ITU-T V.42),
 *  and it is stdlib, so there is no table to transcribe and get subtly wrong. */
function chunk(type: string, data: Uint8Array): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "latin1");
  const body = Buffer.concat([head.subarray(4), data]);
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([head, data, tail]);
}

/**
 * Encode an indexed canvas as a PNG.
 *
 * NO `tIME` CHUNK, and that is the determinism requirement showing up as an
 * omission. PNG defines an optional last-modified chunk; writing one would put a
 * clock inside a response that is cached per URL and promises identical bytes.
 *
 * FILTER 0 (NONE) ON EVERY ROW, and that is measured rather than assumed. The
 * obvious choice for a picture of horizontal bands is filter 2 (Up), which
 * subtracts the row above and turns each band into a run of zeros. It is WORSE
 * here: 374 bytes against 340 for the same image. Deflate's window is 32 KB and
 * a row is 257 bytes, so a hundred-odd rows are visible to the match finder at
 * once and it already encodes "this row is the same as the last one" as a single
 * long back-reference -- while the Up filter destroys the byte-for-byte identity
 * those matches are made of. The simpler code is also the smaller output.
 */
function encodePng(canvas: Canvas): Buffer {
  const { w, h, px } = canvas;

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth: one byte per pixel
  ihdr[9] = 3; // colour type 3: indexed
  ihdr[10] = 0; // compression: deflate, the only value PNG defines
  ihdr[11] = 0; // filter method: the only value PNG defines
  ihdr[12] = 0; // interlace: none

  const plte = Buffer.alloc(PALETTE.length * 3);
  PALETTE.forEach(([r, g, b], i) => {
    plte[i * 3] = r;
    plte[i * 3 + 1] = g;
    plte[i * 3 + 2] = b;
  });

  // One filter byte per row, then the row.
  const raw = Buffer.alloc(h * (w + 1));
  for (let y = 0; y < h; y++) {
    const at = y * (w + 1);
    raw[at] = 0; // filter: None -- see the note above
    raw.set(px.subarray(y * w, (y + 1) * w), at + 1);
  }

  const idat = deflateSync(raw, {
    // PINNED, every one of them. These are zlib's current defaults for
    // `deflateSync` except the level, and stating them is what stops a future
    // change to a default from changing the bytes of a response we promise are
    // a pure function of the URL.
    level: 9,
    memLevel: 8,
    windowBits: 15,
    strategy: constants.Z_DEFAULT_STRATEGY,
  });

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("PLTE", plte),
    chunk("IDAT", idat),
    chunk("IEND", new Uint8Array(0)),
  ]);
}

/**
 * Draw one plate: the bed, and every part's footprint where the packer put it.
 *
 * THE Y AXIS IS FLIPPED. A printer's bed origin is the FRONT-LEFT corner and Y
 * grows away from you; an image's origin is TOP-left and Y grows down. Drawing
 * without the flip produces a picture that is a mirror of what the slicer will
 * show, which is worse than no picture: it is a picture that disagrees with the
 * thing it is a thumbnail of.
 *
 * `x`/`y` on a `Placement` are the MINIMUM corner, and `box.dx`/`dy` the size --
 * which is exactly what a footprint is, so nothing here has to know anything
 * about meshes.
 */
export function plateThumbnail(
  placements: readonly Placement[],
  bed: Bed,
): Buffer {
  const canvas = new Canvas(SIZE, SIZE);
  canvas.fill(0, 0, SIZE, SIZE, PAGE);

  // ONE scale for both axes, so the picture is not stretched: a 300 x 150 bed
  // has to look like a wide bed. Division and `Math.min` only.
  const room = SIZE - 2 * MARGIN;
  const scale = Math.min(room / bed.x, room / bed.y);
  const bw = Math.max(1, Math.round(bed.x * scale));
  const bh = Math.max(1, Math.round(bed.y * scale));
  const ox = Math.round((SIZE - bw) / 2);
  const oy = Math.round((SIZE - bh) / 2);

  canvas.fill(ox, oy, bw, bh, BED);
  canvas.stroke(ox, oy, bw, bh, BED_EDGE);

  for (const p of placements) {
    const w = Math.max(1, Math.round(p.box.dx * scale));
    const h = Math.max(1, Math.round(p.box.dy * scale));
    const x = ox + Math.round(p.x * scale);
    // The flip: the part's FAR edge in bed space is its TOP edge in image space.
    const y = oy + bh - Math.round(p.y * scale) - h;
    const ink = FAMILY_INK[HEX_PART_FAMILY[p.slug]] ?? NO_FAMILY;
    const rings = HEX_PART_OUTLINE[p.slug];

    // NO OUTLINE, OR AN OUTLINE TOO SMALL TO LAND ON A PIXEL, FALLS BACK TO THE
    // FOOTPRINT. The first case is a placement whose slug is not ours; the
    // second is real geometry on a very large bed -- at 1000 mm a spike is
    // 6 x 2 px, and a shape can be thin enough to miss every pixel centre it
    // passes. Drawing the box is the honest answer to both: it is where the part
    // is, drawn as coarsely as the frame allows, rather than a part silently
    // missing from a picture of the plate.
    let rows: number[][] | null = null;
    if (rings) {
      rows = outlineSpans(rings, x, y, w, h);
      let any = false;
      for (const spans of rows) if (spans.length) any = true;
      if (!any) rows = null;
    }

    if (!rows) {
      canvas.fill(x, y, w, h, ink);
      if (w >= KEYLINE_MIN_PX && h >= KEYLINE_MIN_PX) {
        canvas.stroke(x, y, w, h, PAGE);
      }
      continue;
    }

    for (let r = 0; r < h; r++) {
      const spans = rows[r];
      for (let i = 0; i < spans.length; i += 2) {
        canvas.fill(spans[i], y + r, spans[i + 1] - spans[i], 1, ink);
      }
    }

    // THE KEYLINE IS DARK, and that is a decision rather than a leftover. A pale
    // rule -- what this drew until 2026-08-16 -- adds the same high value to
    // every part's perimeter, and at 256 px a small part is nearly all
    // perimeter, so the one channel carrying family identity would be washed out
    // exactly where it is scarcest. Drawing it in the page colour instead does
    // the two jobs a rule is actually for: it separates parts that round into
    // each other on a large bed, and it gives every silhouette a crisp edge, at
    // no cost to the value that names the part.
    if (w < KEYLINE_MIN_PX || h < KEYLINE_MIN_PX) continue;
    for (let r = 0; r < h; r++) {
      const spans = rows[r];
      for (let i = 0; i < spans.length; i += 2) {
        const from = spans[i];
        const to = spans[i + 1];
        for (let c = from; c < to; c++) {
          if (
            c === from ||
            c === to - 1 ||
            !covered(rows, r - 1, c) ||
            !covered(rows, r + 1, c)
          ) {
            canvas.fill(c, y + r, 1, 1, PAGE);
          }
        }
      }
    }
  }

  return encodePng(canvas);
}
