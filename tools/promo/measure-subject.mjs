// Where does the SUBJECT actually sit, beat by beat?
//
// The band shifts the whole clip sideways and crops hard, so a subject that
// wanders horizontally between beats reads as the shot jumping. The gerber
// stack and the board are placed by the 3D rig, which frames them its own way;
// the certificate is placed by placeEarn at a left-column layout's card
// position. Nobody has ever checked that those two agree.
//
// Measured as the luminance CENTROID of each frame, ignoring the near-black
// field, which is what the eye reads as "where the thing is".
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const req = createRequire("C:/zzz/pf-beta/package.json");
const sharp = req("sharp");
const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });

// The typeless picture, so the measurement is the SUBJECT and not the words.
const SRC = "C:/zzz/_hex-promo/social/l101-beta-band-notype.mp4";

const BEATS = [
  { t: 1.0, what: "gerber stack, flat" },
  { t: 3.0, what: "stack exploded" },
  { t: 4.6, what: "the board" },
  { t: 6.6, what: "the exam plate" },
  { t: 9.0, what: "the certificate" },
];

const centroid = async (file) => {
  const { data, info } = await sharp(file).greyscale().raw().toBuffer({ resolveWithObject: true });
  let sum = 0;
  let wx = 0;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const v = data[y * info.width + x];
      // Deep space is luma 8-14. Anything above 40 is subject.
      if (v < 40) continue;
      sum += v;
      wx += v * x;
    }
  }
  if (!sum) return null;
  return (wx / sum / info.width) * 100;
};

console.log("  beat   what                  subject centre (% of frame width)");
const seen = [];
for (const b of BEATS) {
  const p = `${OUT}/subj-${b.t}.png`;
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", SRC, "-ss", String(b.t), "-frames:v", "1", p]);
  const c = await centroid(p);
  if (c === null) {
    console.log(`  ${String(b.t).padStart(4)}   ${b.what.padEnd(20)} nothing above the black floor`);
    continue;
  }
  seen.push({ ...b, c });
  console.log(`  ${String(b.t).padStart(4)}   ${b.what.padEnd(20)} ${c.toFixed(1)}%`);
}

const cs = seen.map((s) => s.c);
const spread = Math.max(...cs) - Math.min(...cs);
console.log(`\n  spread across the beats: ${spread.toFixed(1)} points of frame width`);
const geom = seen.filter((s) => s.t <= 4.6).map((s) => s.c);
const cert = seen.find((s) => s.t === 9.0);
if (geom.length && cert) {
  const g = geom.reduce((a, b) => a + b, 0) / geom.length;
  console.log(`  gerbers/board average: ${g.toFixed(1)}%`);
  console.log(`  certificate:           ${cert.c.toFixed(1)}%`);
  console.log(`  the certificate is ${(cert.c - g).toFixed(1)} points to the ${cert.c > g ? "RIGHT" : "LEFT"} of the geometry`);
}
