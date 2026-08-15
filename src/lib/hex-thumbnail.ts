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
//   - ONLY `+ - * /`, `Math.round`, `Math.floor`, `Math.min`, `Math.max`. Those
//     are exactly specified by IEEE754 and by ECMA-262, so they give the same
//     answer on every host. NO transcendental (`sin`, `pow`, `exp`): those are
//     explicitly NOT required to be correctly rounded and are the one place a
//     "floating-point path that varies by platform" actually lives.
//   - THE DEFLATE OPTIONS ARE PINNED, not defaulted, so an upstream change to a
//     default cannot silently change our bytes.
import { constants, crc32, deflateSync } from "node:zlib";

import type { Bed } from "@/lib/hex-pack";
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

/** Five colours, in the house palette, and five is the whole design.
 *
 *  The image is flat rectangles, so an indexed PNG (colour type 3) stores one
 *  byte per pixel and deflate turns each run of identical bytes into almost
 *  nothing. A truecolour PNG of the same picture is three times the raw size for
 *  a picture that has five colours in it.
 *
 *  Ordered so index 0 is the page: `Uint8Array` starts zeroed, so the background
 *  fill is free and is not a step anybody can forget. */
const PALETTE: readonly (readonly [number, number, number])[] = [
  [0x0b, 0x12, 0x1c], // 0 -- outside the bed
  [0x16, 0x20, 0x2e], // 1 -- the bed
  [0x33, 0x41, 0x5a], // 2 -- the bed edge
  [0xc8, 0xa2, 0x4a], // 3 -- a part's footprint
  [0xf0, 0xd8, 0x9b], // 4 -- that footprint's edge
];

const PAGE = 0;
const BED = 1;
const BED_EDGE = 2;
const PART = 3;
const PART_EDGE = 4;

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
    canvas.fill(x, y, w, h, PART);
    canvas.stroke(x, y, w, h, PART_EDGE);
  }

  return encodePng(canvas);
}
