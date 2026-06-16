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

const disc = scallop(50, C - 12, C - 30);
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <defs>
    <!-- muted, believable gold (not neon) -->
    <radialGradient id="base" cx="42%" cy="36%" r="74%">
      <stop offset="0%"  stop-color="#e3c87e"/>
      <stop offset="42%" stop-color="#c2a04c"/>
      <stop offset="78%" stop-color="#977630"/>
      <stop offset="100%" stop-color="#6a4f1d"/>
    </radialGradient>
    <radialGradient id="dome" cx="50%" cy="43%" r="63%">
      <stop offset="0%"  stop-color="#000" stop-opacity="0"/>
      <stop offset="66%" stop-color="#000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#2c1f08" stop-opacity="0.5"/>
    </radialGradient>
    <radialGradient id="hi" cx="35%" cy="25%" r="44%">
      <stop offset="0%"  stop-color="#fff5d6" stop-opacity="0.45"/>
      <stop offset="78%" stop-color="#fff5d6" stop-opacity="0"/>
    </radialGradient>

    <!-- Real foil = uneven reflections. Drive a specular pass with fractal-noise
         so the gold catches light in irregular glints + grain (kills the clean-
         gradient "clipart" tell). -->
    <filter id="foil" x="0%" y="0%" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.016 0.052" numOctaves="4" seed="13" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.9 0 0 0 0" result="bump"/>
      <feSpecularLighting in="bump" surfaceScale="2.4" specularConstant="0.5" specularExponent="5.5" lighting-color="#fff3cf" result="g">
        <feDistantLight azimuth="220" elevation="62"/>
      </feSpecularLighting>
      <feComposite in="g" in2="SourceAlpha" operator="in" result="gc"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.10 0 0 0 0" result="grain"/>
      <feComposite in="grain" in2="SourceAlpha" operator="in" result="grainc"/>
      <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="grainc"/><feMergeNode in="gc"/></feMerge>
    </filter>

    <!-- Struck relief: soft specular highlight (top-left) + dark diffuse (bottom-
         right), gently blurred for a rolled embossed edge. -->
    <filter id="emboss" x="-25%" y="-25%" width="150%" height="150%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="2.4" result="b"/>
      <feSpecularLighting in="b" surfaceScale="4.6" specularConstant="0.9" specularExponent="13" lighting-color="#fff4dd" result="hl">
        <feDistantLight azimuth="222" elevation="46"/>
      </feSpecularLighting>
      <feComposite in="hl" in2="SourceAlpha" operator="in" result="hlc"/>
      <feDiffuseLighting in="b" surfaceScale="4.6" diffuseConstant="0.82" lighting-color="#4c3712" result="sh">
        <feDistantLight azimuth="42" elevation="40"/>
      </feDiffuseLighting>
      <feComposite in="sh" in2="SourceAlpha" operator="in" result="shc"/>
      <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="shc"/><feMergeNode in="hlc"/></feMerge>
    </filter>

    <filter id="drop" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="5" stdDeviation="7" flood-color="#1f1503" flood-opacity="0.38"/>
    </filter>
  </defs>

  <!-- field: muted gold, foil glints/grain, domed edges, soft highlight -->
  <g filter="url(#drop)"><path d="${disc}" fill="url(#base)" filter="url(#foil)"/></g>
  <path d="${disc}" fill="none" stroke="#4a3410" stroke-width="1.6" stroke-opacity="0.5"/>
  <path d="${disc}" fill="url(#dome)"/>
  <path d="${disc}" fill="url(#hi)"/>

  <!-- struck design: rings, beads, bee -->
  <g fill="#bf9a44" stroke="none" filter="url(#emboss)">
    <circle cx="${C}" cy="${C}" r="263" fill="none" stroke="#bf9a44" stroke-width="6"/>
    <circle cx="${C}" cy="${C}" r="206" fill="none" stroke="#bf9a44" stroke-width="6"/>
    ${beads(38, 234, 6.4)}
    ${beeGroup(270)}
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
