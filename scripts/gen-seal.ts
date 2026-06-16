// Generates the embossed gold-foil seal as a static PNG asset
// (src/lib/pdf/seal.png), embedded by both certificate renderers. A real embossed
// seal needs metallic gradients + raised relief, which satori/react-pdf can't do —
// so we author a full SVG (scalloped edge, gold-foil radial gradient, a beaded
// bezel, and the OTD bee in relief via layered shadow/highlight copies) and
// rasterize it once with sharp. Re-run to regenerate: npx tsx scripts/gen-seal.ts
import sharp from "sharp";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { BRANDMARK_PATH } from "@/lib/pdf/certificate-content";

const S = 720; // source resolution
const C = S / 2;

// Scalloped (serrated) edge — alternating outer/inner radius around the circle.
function scallop(teeth: number, rOut: number, rIn: number): string {
  const pts: string[] = [];
  const steps = teeth * 2;
  for (let k = 0; k <= steps; k++) {
    const ang = (k * Math.PI) / teeth - Math.PI / 2;
    const r = k % 2 === 0 ? rOut : rIn;
    const x = C + r * Math.cos(ang);
    const y = C + r * Math.sin(ang);
    pts.push(`${k === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return pts.join(" ") + " Z";
}

function beads(n: number, r: number, br: number): string {
  let out = "";
  for (let i = 0; i < n; i++) {
    const ang = (i * 2 * Math.PI) / n - Math.PI / 2;
    const x = C + r * Math.cos(ang);
    const y = C + r * Math.sin(ang);
    out += `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${br}" fill="url(#bead)"/>`;
  }
  return out;
}

// Bee transform: map its viewBox (-400 400 418 400) to a `size`-wide mark centred
// at (C+dx, C+dy).
function bee(size: number, dx: number, dy: number, fill: string, opacity = 1): string {
  const s = size / 418;
  return `<g transform="translate(${C + dx} ${C + dy}) scale(${s}) translate(191 -600)" opacity="${opacity}"><path d="${BRANDMARK_PATH}" fill="${fill}"/></g>`;
}

const beeSize = 286;
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <defs>
    <radialGradient id="foil" cx="40%" cy="32%" r="78%">
      <stop offset="0%" stop-color="#fcf3cb"/>
      <stop offset="30%" stop-color="#eccb6e"/>
      <stop offset="62%" stop-color="#c59b39"/>
      <stop offset="85%" stop-color="#9d7622"/>
      <stop offset="100%" stop-color="#785615"/>
    </radialGradient>
    <radialGradient id="sheen" cx="36%" cy="27%" r="52%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.5"/>
      <stop offset="65%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="beeGrad" cx="42%" cy="33%" r="72%">
      <stop offset="0%" stop-color="#f4e09a"/>
      <stop offset="55%" stop-color="#c69c3c"/>
      <stop offset="100%" stop-color="#8c6a1f"/>
    </radialGradient>
    <radialGradient id="bead" cx="38%" cy="32%" r="70%">
      <stop offset="0%" stop-color="#f6e7a8"/>
      <stop offset="60%" stop-color="#c09636"/>
      <stop offset="100%" stop-color="#7d5b18"/>
    </radialGradient>
  </defs>

  <!-- scalloped disc -->
  <path d="${scallop(46, C - 14, C - 36)}" fill="url(#foil)" stroke="#6e4f15" stroke-width="1.4"/>
  <path d="${scallop(46, C - 14, C - 36)}" fill="url(#sheen)"/>

  <!-- embossed border rings (groove shadow + raised highlight) -->
  <circle cx="${C}" cy="${C}" r="262" fill="none" stroke="#6b4d14" stroke-width="3" opacity="0.45"/>
  <circle cx="${C}" cy="${C}" r="259" fill="none" stroke="#f7e7ab" stroke-width="1.4" opacity="0.7"/>
  <circle cx="${C}" cy="${C}" r="210" fill="none" stroke="#6b4d14" stroke-width="3" opacity="0.4"/>
  <circle cx="${C}" cy="${C}" r="207" fill="none" stroke="#f7e7ab" stroke-width="1.4" opacity="0.6"/>

  <!-- beaded bezel -->
  ${beads(40, 235, 5.2)}

  <!-- bee in relief: shadow, main (gradient), highlight -->
  ${bee(beeSize, 3, 4, "#5c4213", 0.5)}
  ${bee(beeSize, 0, 0, "url(#beeGrad)")}
  ${bee(beeSize, -2.5, -3, "#f8ebb6", 0.4)}
</svg>`;

async function main() {
  const out = path.join(process.cwd(), "src/lib/pdf/seal.png");
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  writeFileSync(out, buf);
  console.log("wrote", out, buf.length, "bytes");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
