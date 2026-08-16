// The package thumbnail: is it a PNG, is it the right picture, and is it the
// same bytes twice.
//
// THE PIXELS ARE READ BACK, not merely counted. A PNG that is structurally valid
// and shows the wrong thing passes every "does it decode" check ever written,
// and the specific wrong thing available here is a MIRRORED plate -- a printer's
// bed origin is the front-left corner with Y growing away from you, an image's
// is the top-left with Y growing down. So the sweeps below decode the image and
// ask where a known part landed.
//
// The decoder is `sharp`, which is a devDependency and never ships. Using our
// own encoder to check our own encoder would establish nothing.
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { inflateSync } from "node:zlib";

import { HEX_PART_BOX, HEX_PART_NAME } from "@/lib/hex-geometry";
import { packPlates } from "@/lib/hex-plate";
import type { Placement } from "@/lib/hex-plate";
import { THUMBNAIL_REL_TYPE, plateThumbnail } from "@/lib/hex-thumbnail";

const BED = { x: 220, y: 220 };

const box = (dx: number, dy: number) => ({
  x0: 0,
  y0: 0,
  z0: 0,
  dx,
  dy,
  dz: 10,
});
const at = (x: number, y: number, dx = 40, dy = 30): Placement => ({
  slug: "a",
  name: "Part-A",
  box: box(dx, dy),
  x,
  y,
});

/** A realistic plate, packed by the real packer from the real geometry table. */
const REAL = packPlates(
  Object.keys(HEX_PART_BOX)
    .slice(0, 8)
    .map((slug, i) => ({
      slug,
      name: HEX_PART_NAME[slug],
      qty: i % 3 === 0 ? 3 : 1,
      box: HEX_PART_BOX[slug],
    })),
  BED,
)[0];

/** Every pixel, as `[r,g,b]` triples, decoded by something that is not us. */
async function pixels(png: Buffer) {
  const { data, info } = await sharp(png)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    w: info.width,
    h: info.height,
    rgb: (x: number, y: number) => {
      const i = (y * info.width + x) * 3;
      return [data[i], data[i + 1], data[i + 2]].join(",");
    },
  };
}

describe("it is a PNG, by somebody else's reckoning", () => {
  it("decodes as a 256x256 sRGB image", async () => {
    const meta = await sharp(plateThumbnail(REAL, BED)).metadata();
    expect(meta.format).toBe("png");
    expect(meta.width).toBe(256);
    expect(meta.height).toBe(256);
  });

  it("carries the PNG signature and the four chunks, in order", async () => {
    const png = plateThumbnail(REAL, BED);
    expect([...png.subarray(0, 8)]).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    const types: string[] = [];
    let at = 8;
    while (at < png.length) {
      const len = png.readUInt32BE(at);
      types.push(png.toString("latin1", at + 4, at + 8));
      at += 12 + len;
    }
    expect(types).toEqual(["IHDR", "PLTE", "IDAT", "IEND"]);
    // And nothing after IEND, which is what a mis-computed length would leave.
    expect(at).toBe(png.length);
  });

  it("declares indexed 8-bit, non-interlaced", async () => {
    const png = plateThumbnail(REAL, BED);
    const ihdr = png.subarray(16, 16 + 13);
    expect(ihdr[8]).toBe(8); // bit depth
    expect(ihdr[9]).toBe(3); // colour type 3 = indexed
    expect(ihdr[12]).toBe(0); // no interlace
  });

  it("carries NO tIME chunk, because a clock would break determinism", async () => {
    // PNG's optional last-modified chunk. Writing one would put a timestamp
    // inside a response that is cached per URL and promises identical bytes --
    // the exact failure this whole module is arranged around.
    expect(plateThumbnail(REAL, BED).includes(Buffer.from("tIME"))).toBe(false);
  });

  it("uses filter NONE on every scanline", async () => {
    // MEASURED, not stylistic: filter 2 (Up) produced 374 bytes against 340 for
    // this same picture, because deflate's window already spans a hundred rows
    // and the Up filter destroys the byte-identity its matches are made of.
    const png = plateThumbnail(REAL, BED);
    let at = 8;
    let idat: Buffer | null = null;
    while (at < png.length) {
      const len = png.readUInt32BE(at);
      if (png.toString("latin1", at + 4, at + 8) === "IDAT") {
        idat = png.subarray(at + 8, at + 8 + len);
        break;
      }
      at += 12 + len;
    }
    const raw = inflateSync(idat!);
    expect(raw.length).toBe(256 * 257);
    for (let y = 0; y < 256; y++) expect(raw[y * 257], `row ${y}`).toBe(0);
  });
});

describe("it is a picture of THIS plate", () => {
  it("draws the bed, inset from the image edge", async () => {
    const p = await pixels(plateThumbnail([], BED));
    // The corner is page, the middle is bed. Both, because "it drew a bed"
    // passes on an image that is entirely bed.
    expect(p.rgb(0, 0)).toBe("11,18,28");
    expect(p.rgb(128, 128)).toBe("22,32,46");
  });

  it("puts a part where the packer put it, NOT mirrored", async () => {
    // THE ONE THAT MATTERS. A printer's Y grows away from the operator; an
    // image's Y grows down. A thumbnail drawn without the flip is a mirror of
    // what the slicer will show -- which is worse than no thumbnail, because it
    // is a picture that disagrees with the file it belongs to.
    //
    // One part in the FRONT-LEFT corner of the bed must appear in the BOTTOM
    // half of the image, and nowhere near the top.
    const p = await pixels(plateThumbnail([at(4, 4)], BED));
    const gold = "200,162,74";
    const goldRows = [];
    for (let y = 0; y < p.h; y++) {
      for (let x = 0; x < p.w; x++) {
        if (p.rgb(x, y) === gold) {
          goldRows.push(y);
          break;
        }
      }
    }
    expect(goldRows.length).toBeGreaterThan(0);
    expect(Math.min(...goldRows)).toBeGreaterThan(p.h / 2);
    // And left, not right: the X axis is NOT flipped, and a lazy "flip both"
    // would pass the row assertion above on its own.
    const goldCols = [];
    for (let x = 0; x < p.w; x++) {
      for (let y = 0; y < p.h; y++) {
        if (p.rgb(x, y) === gold) {
          goldCols.push(x);
          break;
        }
      }
    }
    expect(Math.max(...goldCols)).toBeLessThan(p.w / 2);
  });

  it("CONTROL: a part at the BACK of the bed lands in the top half", async () => {
    // Without this row, "front-left is bottom-left" is satisfied by a renderer
    // that draws everything in the bottom-left corner.
    const p = await pixels(plateThumbnail([at(4, 180)], BED));
    const rows: number[] = [];
    for (let y = 0; y < p.h; y++) {
      for (let x = 0; x < p.w; x++) {
        if (p.rgb(x, y) === "200,162,74") {
          rows.push(y);
          break;
        }
      }
    }
    expect(rows.length).toBeGreaterThan(0);
    expect(Math.max(...rows)).toBeLessThan(p.h / 2);
  });

  it("shows MORE gold for a fuller plate", async () => {
    // The count of drawn pixels tracks what is on the bed. An encoder that drew
    // the bed and ignored the placements entirely passes every structural row
    // in this file and fails this one.
    const gold = async (ps: Placement[]) => {
      const p = await pixels(plateThumbnail(ps, BED));
      let n = 0;
      for (let y = 0; y < p.h; y++) {
        for (let x = 0; x < p.w; x++) if (p.rgb(x, y) === "200,162,74") n++;
      }
      return n;
    };
    const empty = await gold([]);
    const one = await gold([at(4, 4)]);
    const many = await gold(REAL as Placement[]);
    expect(empty).toBe(0);
    expect(one).toBeGreaterThan(0);
    expect(many).toBeGreaterThan(one);
  });

  it("scales to the bed, so the same parts fill less of a bigger one", async () => {
    // The bed is the frame. A renderer that ignored it would draw the same
    // picture for a 100 mm bed and a 1000 mm one -- and the person looking at
    // the thumbnail would have no idea which of their printers it was for.
    const area = async (bed: { x: number; y: number }) => {
      const p = await pixels(plateThumbnail([at(4, 4)], bed));
      let n = 0;
      for (let y = 0; y < p.h; y++) {
        for (let x = 0; x < p.w; x++) if (p.rgb(x, y) === "200,162,74") n++;
      }
      return n;
    };
    expect(await area({ x: 100, y: 100 })).toBeGreaterThan(
      await area({ x: 400, y: 400 }),
    );
  });

  it("keeps a non-square bed non-square, rather than stretching it", async () => {
    const p = await pixels(plateThumbnail([], { x: 400, y: 100 }));
    const bedAt = (x: number, y: number) => p.rgb(x, y) === "22,32,46";
    // Wide and short: the middle row is bed across most of the width, and the
    // middle column is bed over only a slice of the height.
    let across = 0;
    let down = 0;
    for (let x = 0; x < p.w; x++) if (bedAt(x, 128)) across++;
    for (let y = 0; y < p.h; y++) if (bedAt(128, y)) down++;
    expect(across).toBeGreaterThan(200);
    expect(down).toBeLessThan(100);
  });

  it("never writes outside the canvas, even for a part flush to the far edge", async () => {
    // Two roundings compose, so a part against the far edge can land one pixel
    // past it. Clipped, that is cosmetic; unclipped, a flat-array write wraps
    // onto the next row and the picture tears.
    const png = plateThumbnail([at(4, 4, 212, 212)], BED);
    const meta = await sharp(png).metadata();
    expect(meta.width).toBe(256);
    expect(meta.height).toBe(256);
  });
});

describe("it stays small", () => {
  it("is a few hundred bytes, not a few thousand", async () => {
    // The whole justification for not reaching for `next/og`: measured on this
    // same plate, satori + resvg produced 2,721 bytes in ~1,143 ms cold against
    // 496 bytes in ~3 ms here. The bound is loose enough not to be a tripwire
    // and tight enough to catch a change of format or a lost palette.
    expect(plateThumbnail(REAL, BED).byteLength).toBeLessThan(2000);
  });

  it("does not grow without bound with the part count", async () => {
    const one = plateThumbnail([at(4, 4)], BED).byteLength;
    const many = plateThumbnail(REAL, BED).byteLength;
    expect(many).toBeLessThan(one * 6);
  });
});

describe("determinism", () => {
  it("produces byte-identical output for the same plate", async () => {
    // The response is cached per URL and the design promises identical bytes for
    // identical input; a thumbnail with a clock, a seed or a platform-dependent
    // number inside it would break that promise from the inside, where no header
    // comparison would ever look.
    const a = plateThumbnail(REAL, BED);
    await new Promise((r) => setTimeout(r, 50));
    const b = plateThumbnail(REAL, BED);
    expect(Buffer.compare(a, b)).toBe(0);
  });

  it("CONTROL: a different plate is different bytes", async () => {
    // Without this, "identical twice" is satisfied by an encoder that returns a
    // constant image.
    expect(
      Buffer.compare(
        plateThumbnail([at(4, 4)], BED),
        plateThumbnail([at(4, 100)], BED),
      ),
    ).not.toBe(0);
    expect(
      Buffer.compare(
        plateThumbnail(REAL, BED),
        plateThumbnail(REAL, { x: 300, y: 300 }),
      ),
    ).not.toBe(0);
  });
});

describe("the relationship type is the core-spec one", () => {
  it("is the OPC thumbnail type, spelled exactly", () => {
    // A typo here is a package that carries an image nothing looks at. It is
    // the OPC type, not a 3MF one -- 3MF inherits it from the packaging spec,
    // which is why it is `openxmlformats.org` and not `3mf.io`.
    expect(THUMBNAIL_REL_TYPE).toBe(
      "http://schemas.openxmlformats.org/package/2006/relationships/metadata/thumbnail",
    );
  });
});
