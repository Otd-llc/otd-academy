// Bakes public/otd-wm-brandmark.png — the corner watermark used on the LAST page of
// the library and external-doc PDFs.
//
//   pnpm exec tsx scripts/gen-watermark-png.ts
//
// Why a PNG at all: react-pdf's View-render path paints an <Image> but not an <Svg>,
// so the last-page watermark cannot use the same inline SVG the body pages do.
//
// Why this script is COMMITTED: the previous generator was `scripts/_gen-wm.ts`, and
// the leading underscore put it under the gitignore rule for scratch scripts. The PNG
// it produced was committed but the recipe was not, so the asset could not be
// regenerated when the gradient direction changed. It is checked in now.
//
// The gradient runs STRONG at the top-left and fades toward the bottom-right, matching
// the academy and apex footers, whose masks are opaque at the top-left end.

import { writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { BRANDMARK_PATH, BRANDMARK_VIEWBOX } from "../src/lib/pdf/certificate-content";

const GOLD = "#c8963e";
// Matches the on-page SVG in library-pdf.tsx: same axis, same stops, same direction.
const STOP_NEAR = 0.16; // top-left
const STOP_FAR = 0.05; // bottom-right

// The committed asset is 1380 × 1323, which is the mark's 418:400 ratio; keep it so
// the PDFs' fixed WM_W/WM_H layout boxes are unaffected.
const WIDTH = 1380;
const HEIGHT = Math.round(WIDTH * (400 / 418));

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="${BRANDMARK_VIEWBOX}">
  <defs>
    <linearGradient id="wm" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${GOLD}" stop-opacity="${STOP_NEAR}"/>
      <stop offset="1" stop-color="${GOLD}" stop-opacity="${STOP_FAR}"/>
    </linearGradient>
  </defs>
  <path d="${BRANDMARK_PATH}" fill="url(#wm)"/>
</svg>`;

async function main() {
  const out = path.join(process.cwd(), "public", "otd-wm-brandmark.png");
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  writeFileSync(out, png);
  const meta = await sharp(png).metadata();
  console.log(`wrote ${out} — ${meta.width}x${meta.height}, ${png.length} bytes`);
  console.log(`gradient: ${STOP_NEAR} at top-left → ${STOP_FAR} at bottom-right`);
}

main();
