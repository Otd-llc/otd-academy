// The /hex loop: a short silent clip of the v2 configurator, both themes.
//
//   node tools/hex-video.mjs            -> public/hex/configurator.mp4 + -poster.jpg
//   node tools/hex-video.mjs light      -> public/hex/configurator-light.mp4 + -poster.jpg
//   node tools/hex-video.mjs --frames=N    a short look, no encode
//
// The film itself -- the build, the choreography (column -> PVC -> explode ->
// plates), the virtual clock and the across-the-shot framing -- is
// tools/hex-film.mjs, shared with the promo cuts and the stills. Read its
// header first; this file only picks the /hex shape and the byte budget.
//
// v1 IS GONE. This generator used to drive v1's app modules and film a v1
// parts tray; it now drives the v2 configurator's dev server (HEX_V2_APP,
// default http://localhost:5231/hex.html) through its own hook.
//
// BOTH THEMES, because a clip recorded on deep space is a black slab on the
// ivory theme. `ThemedLoop` mounts both and CSS picks one; the POSTER carries
// the reduced-motion case (ThemedLoop shows the poster, never the loop).
//
// BYTE BUDGET: one clip <= 500 KB (launch 8.2). The CRF starts where the v1 clip
// shipped (31, ~459 KB) and steps up until the file fits, so the budget is a
// gate on the output rather than a hope about the encoder.
import { chromium } from "playwright";
import { copyFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import {
  GPU_ARGS,
  SECONDS,
  FPS,
  bootFilm,
  stageFilm,
  captureTake,
  encodeMp4,
  probeMp4,
  encodeProblem,
  freshDir,
} from "./hex-film.mjs";

const OUT = "public/hex"; // run from the repo root
const THEME = process.argv.includes("light") ? "light" : "dark";
const suffix = THEME === "light" ? "-light" : "";
const RAW = `${process.env.HEX_FILM_SCRATCH ?? "C:/Users/raven/AppData/Local/Temp/hex-film"}/hexvid-${THEME}`;
const W = 1280;
const H = 800;
const BUDGET = 500 * 1024;

const capArg = process.argv.find((a) => a.startsWith("--frames="));
const TOTAL = capArg ? Number(capArg.slice(9)) : SECONDS * FPS;

const frames = freshDir(`${RAW}/frames`);
const browser = await chromium.launch({ args: GPU_ARGS });
const { page, hidden } = await bootFilm(browser, { w: W, h: H, theme: THEME });
console.log(`[capture] hid ${hidden.length} overlays: ${hidden.join(" ")}`);
const staged = await stageFilm(page, { theme: THEME });
console.log(`[capture] plates ${staged.plates.length}, parts ${staged.parts}, framing ${JSON.stringify(staged.framing)}`);
const worst = await captureTake(page, frames, { total: TOTAL });
await browser.close();
console.log(`[framing] worst across the shot ${JSON.stringify(worst)}`);

if (capArg) {
  console.log(`stopped after ${TOTAL} frames (--frames), no encode`);
  process.exit(0);
}
if (!worst || worst.margin < 0) {
  console.error(`[GATE FAILED] the subject leaves the frame at ${worst?.t}s`);
  process.exit(1);
}

const mp4 = `${OUT}/configurator${suffix}.mp4`;
let crf = 31;
let bytes = encodeMp4(frames, `${RAW}/take.mp4`, { crf });
while (bytes > BUDGET && crf < 40) {
  crf += 1;
  bytes = encodeMp4(frames, `${RAW}/take.mp4`, { crf });
}
if (bytes > BUDGET) {
  console.error(`[GATE FAILED] ${bytes} bytes at crf ${crf}, budget ${BUDGET}`);
  process.exit(1);
}
copyFileSync(`${RAW}/take.mp4`, mp4);

// Gate after encode, on the FILE: a 9.967 s clip does not loop.
const got = probeMp4(mp4);
if (got.frames !== TOTAL || Math.abs(got.duration - SECONDS) > 0.0005) {
  console.error(`[GATE FAILED] ${mp4}: ${got.frames} frames / ${got.duration}s`);
  process.exit(1);
}
// And the phone-safe encode, off the file, not off the flags we passed.
if (encodeProblem(got)) {
  console.error(`[GATE FAILED] ${mp4}: not High@4.0 avc1 (${encodeProblem(got)})`);
  process.exit(1);
}

// The poster is a real frame of the clip: 5.0 s, the assembled build with its
// pipe, mid-orbit -- the frame that reads as "the product" with no motion.
execFileSync("ffmpeg", [
  "-y", "-loglevel", "error",
  "-i", `${frames}/f${String(Math.floor(TOTAL / 2)).padStart(4, "0")}.png`,
  "-q:v", "4",
  `${OUT}/configurator${suffix}-poster.jpg`,
]);

console.log(`${got.frames} frames, ${got.duration}s, ${got.w}x${got.h}, crf ${crf}`);
for (const f of [mp4, `${OUT}/configurator${suffix}-poster.jpg`]) {
  console.log(`${f}  ${statSync(f).size} bytes`);
}
