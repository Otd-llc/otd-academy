// Generates the embossed gold-foil seal as a static PNG asset
// (src/lib/pdf/seal.png), embedded by both certificate renderers. Realistic foil
// needs (a) a BANDED metallic gradient — alternating light/dark bands read as a
// curved reflective surface — and (b) true RELIEF that catches light, which is the
// SVG feSpecularLighting/feDiffuseLighting emboss filter (alpha as a bump map).
// resvg/sharp can't render those filters, so we rasterize the SVG in headless
// chromium (Playwright) instead. Re-run: npx tsx scripts/gen-seal.ts
import { chromium } from "playwright";
import sharp from "sharp";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { BRANDMARK_PATH } from "@/lib/pdf/certificate-content";

const S = 760;
const C = S / 2;

function scallop(teeth: number, rOut: number, rIn: number): string {
  const pts: string[] = [];
  const steps = teeth * 2;
  for (let k = 0; k <= steps; k++) {
    const ang = (k * Math.PI) / teeth - Math.PI / 2;
    const r = k % 2 === 0 ? rOut : rIn;
    pts.push(`${k === 0 ? "M" : "L"} ${(C + r * Math.cos(ang)).toFixed(2)} ${(C + r * Math.sin(ang)).toFixed(2)}`);
  }
  return pts.join(" ") + " Z";
}

function beads(n: number, r: number, br: number): string {
  let out = "";
  for (let i = 0; i < n; i++) {
    const ang = (i * 2 * Math.PI) / n - Math.PI / 2;
    out += `<circle cx="${(C + r * Math.cos(ang)).toFixed(2)}" cy="${(C + r * Math.sin(ang)).toFixed(2)}" r="${br}"/>`;
  }
  return out;
}

function beeGroup(size: number): string {
  const s = size / 418;
  return `<g transform="translate(${C} ${C}) scale(${s}) translate(191 -600)"><path d="${BRANDMARK_PATH}"/></g>`;
}

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <defs>
    <linearGradient id="metal" x1="14%" y1="2%" x2="86%" y2="100%">
      <stop offset="0%"  stop-color="#6f4b13"/><stop offset="11%" stop-color="#ca9c3a"/>
      <stop offset="20%" stop-color="#f6e7a2"/><stop offset="28%" stop-color="#fefad6"/>
      <stop offset="37%" stop-color="#d3a743"/><stop offset="48%" stop-color="#94701d"/>
      <stop offset="57%" stop-color="#e2bd5c"/><stop offset="68%" stop-color="#fdf4cb"/>
      <stop offset="78%" stop-color="#ca9a3c"/><stop offset="90%" stop-color="#8a6219"/>
      <stop offset="100%" stop-color="#5e3f10"/>
    </linearGradient>
    <radialGradient id="dome" cx="50%" cy="45%" r="60%">
      <stop offset="0%" stop-color="#000" stop-opacity="0"/>
      <stop offset="70%" stop-color="#1f1404" stop-opacity="0"/>
      <stop offset="100%" stop-color="#241804" stop-opacity="0.5"/>
    </radialGradient>
    <radialGradient id="spec" cx="34%" cy="25%" r="42%">
      <stop offset="0%" stop-color="#fffdf4" stop-opacity="0.6"/>
      <stop offset="70%" stop-color="#fffdf4" stop-opacity="0"/>
    </radialGradient>
    <!-- Emboss: blur the alpha into a bump map, light it with a top-left distant
         light (sharp specular highlight) and an opposite dark diffuse (the shaded
         side). Composited over the gold relief → raised metal. -->
    <filter id="emboss" x="-25%" y="-25%" width="150%" height="150%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="3.4" result="blur"/>
      <feSpecularLighting in="blur" surfaceScale="6.5" specularConstant="1.15" specularExponent="17" lighting-color="#fffaf0" result="hl">
        <feDistantLight azimuth="228" elevation="50"/>
      </feSpecularLighting>
      <feComposite in="hl" in2="SourceAlpha" operator="in" result="hlc"/>
      <feDiffuseLighting in="blur" surfaceScale="6.5" diffuseConstant="0.9" lighting-color="#4a3210" result="sh">
        <feDistantLight azimuth="48" elevation="44"/>
      </feDiffuseLighting>
      <feComposite in="sh" in2="SourceAlpha" operator="in" result="shc"/>
      <feMerge>
        <feMergeNode in="SourceGraphic"/>
        <feMergeNode in="shc"/>
        <feMergeNode in="hlc"/>
      </feMerge>
    </filter>
    <filter id="drop" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#2a1c06" flood-opacity="0.45"/>
    </filter>
  </defs>

  <!-- field: banded metal + domed edges + specular highlight -->
  <g filter="url(#drop)">
    <path d="${scallop(48, C - 12, C - 34)}" fill="url(#metal)" stroke="#4f370d" stroke-width="2"/>
  </g>
  <path d="${scallop(48, C - 12, C - 34)}" fill="url(#dome)"/>
  <path d="${scallop(48, C - 12, C - 34)}" fill="url(#spec)"/>

  <!-- relief (rings, beads, bee) struck into the same gold, lit by the emboss -->
  <g fill="#c49633" stroke="none" filter="url(#emboss)">
    <circle cx="${C}" cy="${C}" r="263" fill="none" stroke="#c49633" stroke-width="5"/>
    <circle cx="${C}" cy="${C}" r="208" fill="none" stroke="#c49633" stroke-width="5"/>
    ${beads(38, 235, 6)}
    ${beeGroup(266)}
  </g>
</svg>`;

async function main() {
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:transparent}</style></head><body>${svg}</body></html>`;
  // Use the already-downloaded chromium build (avoids a fresh browser download
  // when the installed revision differs from playwright's expected one).
  const browser = await chromium.launch({
    executablePath: `${process.env.LOCALAPPDATA}\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe`,
  });
  const page = await browser.newPage({ viewport: { width: S, height: S }, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: "networkidle" });
  // Page-level transparent screenshot of the svg's box (element screenshots don't
  // honour omitBackground with lighting filters → black fill).
  const box = await (await page.$("svg"))!.boundingBox();
  const shot = await page.screenshot({ omitBackground: true, clip: box! });
  await browser.close();
  // Downscale + compress to a sensible asset size (displayed ~150px).
  const buf = await sharp(shot).resize(560).png({ compressionLevel: 9 }).toBuffer();
  const out = path.join(process.cwd(), "src/lib/pdf/seal.png");
  writeFileSync(out, buf);
  console.log("wrote", out, buf.length, "bytes");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
