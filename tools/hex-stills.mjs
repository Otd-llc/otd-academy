// The /hex stills, v2, in four kinds:
//
//   hero/   the /hex hero (HexStill), dark + light. Also what the page shows
//           under reduced motion, since a still has nothing to pause.
//   og      the transparent cutout the /hex share card composes (1200x630 card,
//           src/app/(chrome)/hex/opengraph-image.tsx).
//   ui/     what the tool LOOKS LIKE -- chrome, palette, the real thing.
//   clean/  the build alone on transparency, for a figure on any background.
//
//   node tools/hex-stills.mjs            every kind
//   node tools/hex-stills.mjs hero og    just those
//
// Every still is a frame of the same film the loop is (tools/hex-film.mjs), at
// scene time STILL_T: the assembled showcase build with its pipe in, mid-orbit.
// So the hero, the poster and the share card can never show three different
// builds. The ui/ and clean/ stills keep v1's file names (trio, flower, strip)
// because other surfaces link them; the builds behind the names are v2.
//
// Framing is by SHARE, measured across the shot like the film's: `visible` is
// how much of the frame the surface keeps after `object-fit: cover`. The hero
// is shown at 58vh x full width, which on a 1440x900 desktop keeps ~60% of a
// 16:9 frame's height and on a phone ~50% of its width, so the build is fitted
// inside that window.
import { chromium } from "playwright";
import { mkdirSync, statSync } from "node:fs";
import sharp from "sharp";
import {
  GPU_ARGS,
  STILL_BUILDS,
  SHOWCASE_BUILD,
  bootFilm,
  stageFilm,
  filmFrame,
  filmExtent,
} from "./hex-film.mjs";

const OUT = "public/hex"; // run from the repo root
const SCRATCH = `${process.env.HEX_FILM_SCRATCH ?? "C:/Users/raven/AppData/Local/Temp/hex-film"}/stills`;
mkdirSync(`${OUT}/ui`, { recursive: true });
mkdirSync(`${OUT}/clean`, { recursive: true });
mkdirSync(SCRATCH, { recursive: true });

/** The film's own 5.0 s: assembled, pipe in, cover home, half a turn round. */
const STILL_T = 5.0;

const want = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const doKind = (k) => want.length === 0 || want.includes(k);

const browser = await chromium.launch({ args: GPU_ARGS });

/** Stage `build`, step the clock to STILL_T, screenshot. Returns the extent. */
async function shoot({ w, h, scale = 1, theme = "dark", build = SHOWCASE_BUILD, transparent = false, keepChrome = false, visible, fill, file }) {
  const { ctx, page, hidden } = await bootFilm(browser, { w, h, theme, transparent, keepChrome, scale });
  if (keepChrome) {
    // The idle nudges are timed prompts for a live visitor and noise in a
    // still. Everything else of the interface stays: that is the point.
    await page.addStyleTag({ content: "#ghost-tip, #toast { display: none !important; }" });
  }
  await stageFilm(page, {
    build, theme, visible, fill: { column: fill ?? 0.8 },
    // Half a turn back from the film's own azimuth, so the still has the
    // loop's OPENING three-quarter view with the pipe in.
    azimuth0: -0.55 - Math.PI,
    stillAt: STILL_T,
  });
  await page.evaluate(() => window.__clock.start());
  await filmFrame(page, STILL_T);
  const extent = await filmExtent(page);
  await page.screenshot({ path: file, omitBackground: transparent });
  await ctx.close();
  console.log(`${file}  extent ${JSON.stringify(extent)}${hidden.length ? `  hid ${hidden.length}` : ""}`);
  if (!extent || extent.margin < 0) throw new Error(`${file}: the build leaves the visible window`);
  return extent;
}

async function webp(src, dst, quality, alpha = false) {
  await sharp(src).webp({ quality, alphaQuality: alpha ? 90 : 100, effort: 6 }).toFile(dst);
  console.log(`${dst}  ${statSync(dst).size} bytes`);
}

// ---- hero: 1920x1080, both themes -----------------------------------------
if (doKind("hero")) {
  for (const theme of ["dark", "light"]) {
    const png = `${SCRATCH}/hero-${theme}.png`;
    await shoot({ w: 1920, h: 1080, theme, visible: { w: 0.5, h: 0.6 }, fill: 0.92, file: png });
    await webp(png, `${OUT}/hero-${theme}.webp`, 80);
  }
}

// ---- og: the cutout the share card composes ----------------------------------
// 2x the 520x320 box it is drawn into, transparent, so it sits on the card's
// own wash in either theme of the card.
if (doKind("og")) {
  const png = `${SCRATCH}/og-cutout.png`;
  await shoot({ w: 1040, h: 640, transparent: true, fill: 0.94, file: png });
  await sharp(png).png({ compressionLevel: 9, palette: false }).toFile(`${OUT}/og-cutout.png`);
  console.log(`${OUT}/og-cutout.png  ${statSync(`${OUT}/og-cutout.png`).size} bytes`);
}

// ---- ui: the interface, both themes, 3200x2000 --------------------------------
if (doKind("ui")) {
  for (const theme of ["dark", "light"]) {
    for (const [name, build] of Object.entries(STILL_BUILDS)) {
      const png = `${SCRATCH}/ui-${name}-${theme}.png`;
      // The palette rail and the foot take the left and the bottom; the build
      // is fitted inside what the interface leaves.
      await shoot({ w: 1600, h: 1000, scale: 2, theme, build, keepChrome: true, visible: { w: 0.62, h: 0.62 }, fill: 0.9, file: png });
      await webp(png, `${OUT}/ui/${name}-${theme}.webp`, 72);
    }
  }
}

// ---- clean: the build alone, transparent, 3200x2400 ----------------------------
if (doKind("clean")) {
  for (const [name, build] of Object.entries(STILL_BUILDS)) {
    const png = `${SCRATCH}/clean-${name}.png`;
    await shoot({ w: 1600, h: 1200, scale: 2, build, transparent: true, fill: 0.9, file: png });
    await webp(png, `${OUT}/clean/${name}.webp`, 80, true);
  }
}

await browser.close();
