// How much of a comb/stage tile's alpha is SHADOW rather than artwork?
//
//   pnpm tsx scripts/probe-stage-alpha.ts public/guide-stages/LAYOUT.png
//
// This is the measurement scripts/make-stage-ghosts.ts is built on. Run it before
// assuming a tile can be thresholded: a kicad render has a clean alpha band for its
// baked shadow and separates, an svg plot does not and a cut destroys it.
//
// Prints the alpha histogram and the kept area at candidate thresholds, which is
// the number that decides whether a threshold can separate shadow from artwork.
import sharp from "sharp";

const file = process.argv[2];
const img = sharp(file).ensureAlpha();
const meta = await img.metadata();
const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });

const ch = info.channels;
const buckets = new Array(11).fill(0);
let nonZero = 0;
for (let i = ch - 1; i < data.length; i += ch) {
  const a = data[i];
  if (a > 0) nonZero += 1;
  buckets[Math.min(10, Math.floor((a / 255) * 10))] += 1;
}
const total = info.width * info.height;

console.log(`${file}  ${meta.width}x${meta.height}  channels ${ch}`);
console.log(`any alpha at all: ${((nonZero / total) * 100).toFixed(1)}% of the canvas`);
console.log("alpha histogram (share of canvas):");
for (let b = 0; b < 11; b += 1) {
  const pct = (buckets[b] / total) * 100;
  if (pct < 0.01) continue;
  const lo = (b / 10).toFixed(1);
  const bar = "#".repeat(Math.max(1, Math.round(pct)));
  console.log(`  a>=${lo}  ${pct.toFixed(2).padStart(6)}%  ${bar}`);
}

console.log("area kept at each threshold, as a share of the full alpha area:");
for (const t of [0.05, 0.2, 0.35, 0.5, 0.65, 0.8, 0.9]) {
  let kept = 0;
  for (let i = ch - 1; i < data.length; i += ch) if (data[i] / 255 >= t) kept += 1;
  console.log(
    `  >= ${t.toFixed(2)}   ${((kept / nonZero) * 100).toFixed(1).padStart(5)}% of alpha area   (${((kept / total) * 100).toFixed(2)}% of canvas)`,
  );
}
