// Build the GHOST alpha maps a locked comb cell masks against.
//
//   pnpm tsx scripts/make-stage-ghosts.ts
//
// A locked cell (build-guide hub or /courses) draws its artifact as a gold ghost
// rather than the artifact itself. It does that by masking a flat gold fill, so
// the mask has to describe the drawing. The source PNGs do not: their alpha
// describes the SHEET, and two separate things go wrong with it.
//
// 1. THE FOUR KICAD RENDERS CARRY A BAKED CONTACT SHADOW. It sits as a clean band
//    at alpha ~0.2 while the board is fully opaque, so masking raw alpha turned the
//    silhouette into a smear offset below the board. Kept area at a 0.5 cut, from
//    scripts/probe-stage-alpha.ts:
//
//      ORDERING 89.7%   REQUIREMENTS 82.4%   ASSEMBLY 68.3%   BRINGUP 67.3%
//
//    The two separate cleanly, so those four are thresholded.
//
// 2. THE FOUR SVG PLOTS MUST NOT BE THRESHOLDED. There the soft alpha is thin ink,
//    not a shadow, and the same cut keeps only:
//
//      BOM_SOURCING 54.1%   SCHEMATIC 49.8%   LAYOUT 21.8%   DRC_GERBER 20.9%
//
//    Cutting LAYOUT or DRC_GERBER would delete four fifths of the artwork.
//
// And for BOTH kinds the structure lives in LUMINANCE, not alpha: BOM_SOURCING and
// SCHEMATIC are white sheets with dark ink (mean luminance of inked pixels 205 and
// 202 of 255), so their alpha is a solid rectangle and a flat fill floods it into a
// featureless slab. So:
//
//   ghost alpha = coverage x ink
//     coverage = source alpha, thresholded for renders only
//     ink      = BASE + GAIN * (1 - luminance), clamped
//
// Finally the result is NORMALISED per tile. Ink density varies a lot between a
// dense little module render and a mostly-white BOM sheet, and without this the
// denser tiles read several stops louder than their neighbours in the same comb.
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import sharp from "sharp";

const STAGE_DIR = "public/guide-stages";
const STAGE_OUT = "public/guide-stages/ghost";
const COMB_IN = "public/board-posters/comb/l1-01-wroom-breakout.png";
const COMB_OUT = "public/board-posters/comb/ghost";

/** Tiles that are `kicad-cli pcb render` output, so their alpha is thresholdable. */
const RENDERS = new Set(["REQUIREMENTS", "ORDERING", "ASSEMBLY", "BRINGUP"]);

const STAGES = [
  "REQUIREMENTS",
  "BOM_SOURCING",
  "SCHEMATIC",
  "LAYOUT",
  "DRC_GERBER",
  "ORDERING",
  "ASSEMBLY",
  "BRINGUP",
];

const CUT = 0.5 * 255;
const BASE = 0.1; // the sheet or board body, so its silhouette still reads
const GAIN = 1.15; // how hard the ink itself comes forward
/** Target mean ghost alpha over covered pixels. What makes the comb even. */
const TARGET_DENSITY = 0.4;

/**
 * The widest a ghost is ever painted, in device pixels.
 *
 * Measured on the real pages, not guessed: the largest box any of these fills
 * is 437 CSS px (the guide hub comb at a laptop viewport and up), and a 2x
 * display samples that at 874. 896 covers it with a little room.
 *
 * A ghost bigger than this is carrying resolution nobody can see. BRINGUP ships
 * at 1782 px and 484 KB to fill 437.
 */
const MAX_PX = 896;

/**
 * Downscale to MAX_PX, but KEEP THE RESULT ONLY IF IT IS SMALLER.
 *
 * Resizing is not free on these. Resampling a crisp sparse alpha map replaces
 * hard edges with a spread of intermediate values, which PNG compresses worse,
 * so a ghost already near display size comes back BIGGER. Measured, source ->
 * 896 px:
 *
 *   BRINGUP       1782 px  484 KB -> 207 KB    kept
 *   comb standin  1782 px  484 KB -> 207 KB    kept
 *   DRC_GERBER    1015 px  328 KB -> 425 KB    discarded
 *   LAYOUT        1015 px  314 KB -> 366 KB    discarded
 *   BOM_SOURCING  1322 px  192 KB -> 237 KB    discarded
 *   SCHEMATIC     1238 px  172 KB -> 219 KB    discarded
 *
 * IS IT SAFE? Yes, and this was measured rather than assumed, because a mask
 * that goes wrong resolves to transparent and the comb silently changes weight.
 * Painting both variants through the comb's own CSS at 437 CSS px on a 2x
 * display, the difference in painted density is at most 0.22%. sharp's own
 * mean-alpha figures for a resized mask look alarming (LAYOUT reads +175%), but
 * that describes sharp's resampler acting on the file - the browser was already
 * downsampling these to the cell on every view, so the screen barely moves.
 *
 * Mitchell rather than lanczos3: at this ratio its ringing is negligible, and
 * lanczos' negative lobes clip at zero on a mostly-empty map, which is one-sided.
 */
async function capSize(out: string, label: string) {
  const before = statSync(out).size;
  const meta = await sharp(out).metadata();
  const w = meta.width ?? 0;
  if (w <= MAX_PX) {
    console.log(`${"".padEnd(14)}   ${label}: ${w}px, already at or under ${MAX_PX} - left alone`);
    return;
  }
  const small = await sharp(out)
    .resize(MAX_PX, MAX_PX, { kernel: "mitchell" })
    .png({ compressionLevel: 9 })
    .toBuffer();
  if (small.length >= before) {
    console.log(
      `${"".padEnd(14)}   ${label}: ${w}px -> ${MAX_PX}px would be ${(small.length / 1024).toFixed(0)} KB vs ${(before / 1024).toFixed(0)} KB - discarded`,
    );
    return;
  }
  writeFileSync(out, small);
  console.log(
    `${"".padEnd(14)}   ${label}: ${w}px -> ${MAX_PX}px, ${(before / 1024).toFixed(0)} KB -> ${(small.length / 1024).toFixed(0)} KB`,
  );
}

async function ghost(src: string, out: string, threshold: boolean, label: string) {
  const { data, info } = await sharp(src)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  const ink = new Float32Array(width * height);
  let covered = 0;
  let sum = 0;

  for (let p = 0; p < width * height; p += 1) {
    const i = p * channels;
    const a = data[i + channels - 1];
    const coverage = threshold ? (a >= CUT ? 1 : 0) : a / 255;
    if (coverage === 0) continue;
    const lum =
      (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
    const v = coverage * Math.min(1, Math.max(0, BASE + GAIN * (1 - lum)));
    ink[p] = v;
    covered += 1;
    sum += v;
  }

  const mean = covered ? sum / covered : 0;
  // Scale toward the target, but never amplify past 2x: a tile that is genuinely
  // sparse should stay sparse rather than have its noise pulled up.
  const gain = mean > 0 ? Math.min(2, TARGET_DENSITY / mean) : 1;

  const buf = Buffer.from(data);
  for (let p = 0; p < width * height; p += 1) {
    buf[p * channels + channels - 1] = Math.round(
      Math.min(1, ink[p] * gain) * 255,
    );
  }

  await sharp(buf, { raw: { width, height, channels } }).png().toFile(out);
  console.log(
    `${label.padEnd(14)} ${threshold ? "render, thresholded" : "plot, alpha kept  "}  density ${mean.toFixed(3)} -> gain ${gain.toFixed(2)}`,
  );
  // AFTER the density normalisation, never before. The gain above is computed
  // from coverage at full resolution; resizing first would compute it from a
  // resampled map and the comb's per-tile weighting would drift.
  await capSize(out, label);
}

async function main() {
  mkdirSync(STAGE_OUT, { recursive: true });
  mkdirSync(COMB_OUT, { recursive: true });

  for (const stage of STAGES) {
    await ghost(
      join(STAGE_DIR, `${stage}.png`),
      join(STAGE_OUT, `${stage}.png`),
      RENDERS.has(stage),
      stage,
    );
  }

  // The /courses stand-in is a kicad render of the same family, so it thresholds.
  await ghost(
    COMB_IN,
    join(COMB_OUT, "l1-01-wroom-breakout.png"),
    true,
    "comb standin",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
