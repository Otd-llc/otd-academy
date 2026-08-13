// Render the Logbook cut to mp4, in every shape we deliver into.
//
// SIBLING OF tools/hex-promo-cuts.mjs and it inherits that file's hard-won
// parts rather than re-deriving them: capture at 1:1 with no resample, encode
// straight from the PNG sequence with no setpts or trim, and zero muxdelay so
// the container does not carry a B-frame reorder offset that every lap then
// waits out. Read that file for why each of those exists.
//
// WHAT IS DIFFERENT HERE
//
//   1. NO WALL CLOCK AT ALL. The Hex cuts advance a virtual clock by 1/30 s a
//      frame. This film is already a pure function of scene time - the whole
//      "scrub, never play" contract - so the renderer just SETS the time and
//      the frame is whatever that time means. There is nothing to advance and
//      nothing to drift.
//
//   2. IT WAITS FOR `[data-settled]`. LogbookLive clears that attribute at the
//      top of every pin cycle and sets it after the rAF pass, so it means
//      "every animation under this stage is pinned to this scene time". This
//      is not belt-and-braces: hashing 120 frozen frames twice on an unchanged
//      tree produced 24 differences before the pin was fixed, all inside that
//      window. Screenshot early and the film rolls dice.
//
//   3. THE VIEWPORT IS THE DELIVERY SIZE, so `w` reaches the fit maths as the
//      real pixel width and the screenshot is the frame. No scale step.
//
//   4. AUDIO IS MUXED, not generated. The bed is already mastered; re-encoding
//      it here would be a second lossy pass on top of the one the platform
//      will do. It is copied in as AAC once, at the end.
//
// USAGE
//   node tools/logbook-render.mjs --probe            one frame per shape
//   node tools/logbook-render.mjs --fmt=9x16
//   node tools/logbook-render.mjs                    all four
//   node tools/logbook-render.mjs --fmt=16x9 --frames=30    short look, no encode
//
// ASCII only.

import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, existsSync, statSync, readdirSync } from "node:fs";

const APP = process.env.LOGBOOK_APP ?? "http://localhost:3010";
const OUT = "C:/zzz/_hex-promo/logbook";
const RAW = "C:/zzz/_hex-promo/logbook/_frames";
const BED = "C:/zzz/_hex-promo/kits/logbook-comp-k-open-master.wav";

const SECONDS = 10;
const FPS = 30;

// Delivery sizes. Kept in step with src/app/sandbox/logbook-cut/formats/formats.ts
// by the gate below rather than by hoping - a renderer that disagrees with the
// preview is a renderer that ships a film nobody approved.
// `quiz` is the share of the SAFE WIDTH the quiz must fill, with the tolerance
// this gate allows. See the gate itself for why it exists.
const SHAPES = [
  { id: "16x9", w: 1920, h: 1080, safe: {}, quiz: 0.55 },
  { id: "1x1", w: 1080, h: 1080, safe: {}, quiz: 0.62 },
  { id: "4x5", w: 1080, h: 1350, safe: { bottom: 0.08 }, quiz: 0.62 },
  { id: "9x16", w: 1080, h: 1920, safe: { top: 0.08, right: 0.13, bottom: 0.2 }, quiz: 0.85 },
];
const QUIZ_TOL = 0.06;

const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.split("=")[1] : d;
};
const PROBE = process.argv.includes("--probe");
const ONLY = arg("fmt", null);
const FRAMES = Number(arg("frames", SECONDS * FPS));

if (!existsSync(BED)) {
  console.error(`No mastered bed at ${BED}\n  python tools/hex-master.py --prefix logbook-comp --kit k-open`);
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

for (const shape of SHAPES) {
  if (ONLY && shape.id !== ONLY) continue;
  const dir = `${RAW}/${shape.id}`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  const page = await browser.newPage({
    viewport: { width: shape.w, height: shape.h },
    deviceScaleFactor: 1,
  });
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e.message)));
  page.on("console", (m) => {
    if (m.type() === "error") errs.push(m.text());
  });

  await page.goto(`${APP}/sandbox/logbook-cut/frame?fmt=${shape.id}`, {
    waitUntil: "networkidle",
  });
  await page.waitForFunction(() => typeof window.__seek === "function");
  // The stage measures the viewport on mount, so give it its first paint before
  // asking for a frame.
  await page.waitForSelector("[data-logbook-stage]");

  // ANYTHING FIXED THAT IS NOT THE FILM GETS BURNED INTO EVERY FRAME. The
  // probe came back with the cookie consent banner and a floating badge in
  // shot - both `position: fixed`, both from the root layout, neither anything
  // to do with this route. Hidden by computed position rather than by a
  // selector, because the next one will be some other vendor's widget, and
  // LOGGED rather than dropped silently: a capture surface that quietly removes
  // things is one you cannot trust about what it kept.
  const hidden = await page.evaluate(() => {
    const stage = document.querySelector("[data-logbook-stage]");
    const out = [];
    // The Next dev indicator lives inside a `nextjs-portal` custom element with
    // its own shadow root, so the computed-position sweep below walks straight
    // past it - the host is static and the badge is fixed inside the shadow
    // tree. Named explicitly because there is no generic way to reach it.
    for (const el of document.querySelectorAll("nextjs-portal")) {
      el.style.setProperty("display", "none", "important");
      out.push("nextjs-portal");
    }
    for (const el of document.body.querySelectorAll("*")) {
      if (!(el instanceof HTMLElement)) continue;
      if (stage && (stage.contains(el) || el.contains(stage))) continue;
      const cs = getComputedStyle(el);
      if (cs.position !== "fixed") continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      el.style.setProperty("display", "none", "important");
      out.push(`${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}`);
    }
    return out;
  });
  if (hidden.length) console.log(`[${shape.id}] hid ${hidden.length} fixed overlay(s): ${hidden.join(", ")}`);

  // THE PALETTE IS PART OF THE DELIVERABLE. Cheap to assert, and the probe
  // shipped a cream frame before FrameStage pinned it.
  const theme = await page.evaluate(() => ({
    attr: document.documentElement.dataset.theme ?? "(none)",
    bg: getComputedStyle(document.querySelector("[data-logbook-stage]")).backgroundColor,
  }));
  if (theme.attr !== "dark") throw new Error(`${shape.id}: theme is ${theme.attr}, expected dark`);

  // THE COMPOSITION MUST SURVIVE THE JUMP TO DELIVERY SIZE, and this gate
  // exists because it did not.
  //
  // The quiz's size cap was written as an absolute scale multiplier. In the
  // preview grid - panels about a fifth of delivery size - it produced exactly
  // the composition that got approved. At 1080 the fit wanted a scale of 3.05
  // and the same cap slammed it to 0.52, so the quiz encoded at 16% of the
  // frame instead of 85%. Four finished mp4s, all wrong, and nothing in the
  // preview could have shown it.
  //
  // So the renderer measures the real composition at the real size and refuses
  // to encode if it has moved. Any tuning written in absolute pixels or scale
  // is resolution dependent; this is the thing that catches the next one.
  await page.evaluate(() => window.__seek(1.0));
  await page.waitForSelector("[data-logbook-stage][data-settled]");
  const share = await page.evaluate((sf) => {
    const st = document.querySelector("[data-logbook-stage]");
    const sr = st.getBoundingClientRect();
    const safeW = sr.width * (1 - (sf.left ?? 0) - (sf.right ?? 0));
    const inner = st.querySelector("[data-quiz-bare] > div");
    return inner ? inner.getBoundingClientRect().width / safeW : null;
  }, shape.safe);
  if (share === null) throw new Error(`${shape.id}: no quiz box to measure`);
  const off = Math.abs(share - shape.quiz);
  console.log(
    `[${shape.id}] quiz fills ${(share * 100).toFixed(0)}% of safe width (expected ${(shape.quiz * 100).toFixed(0)}%)`,
  );
  if (off > QUIZ_TOL) {
    throw new Error(
      `${shape.id}: quiz fills ${(share * 100).toFixed(0)}% of the safe width, expected ` +
        `${(shape.quiz * 100).toFixed(0)}% +/- ${(QUIZ_TOL * 100).toFixed(0)}. The composition ` +
        `approved in the preview is not the composition at delivery size - check for a tuning ` +
        `written in absolute pixels or absolute scale.`,
    );
  }

  // THE VIEWPORT MUST BE THE FRAME. If the page has a scrollbar or the stage
  // measured something else, every frame is subtly the wrong composition and it
  // is invisible until someone overlays a safe area on the output.
  const got = await page.evaluate(() => {
    const r = document.querySelector("[data-logbook-stage]").getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  });
  if (got.w !== shape.w || got.h !== shape.h) {
    throw new Error(
      `${shape.id}: stage is ${got.w}x${got.h}, viewport is ${shape.w}x${shape.h}`,
    );
  }

  const total = PROBE ? 1 : FRAMES;
  const seek = async (i) => {
    const t = (i / FPS) % SECONDS;
    await page.evaluate((v) => window.__seek(v), t);
    // The contract. Cleared on every pin cycle, set after the rAF pass.
    await page.waitForSelector("[data-logbook-stage][data-settled]", { timeout: 5000 });
  };

  const t0 = Date.now();
  for (let i = 0; i < total; i += 1) {
    await seek(PROBE ? Math.round(3.9 * FPS) : i);
    await page.screenshot({
      path: `${dir}/f${String(i).padStart(4, "0")}.png`,
      // The stage fills the viewport, so the default clip IS the frame.
    });
    if (!PROBE && i % 60 === 0) {
      console.log(`[${shape.id}] frame ${i}/${total}`);
    }
  }
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[${shape.id}] captured ${total} frames in ${secs}s`);
  if (errs.length) console.warn(`[${shape.id}] console errors:\n  ${errs.slice(0, 5).join("\n  ")}`);
  await page.close();

  if (PROBE || total < SECONDS * FPS) {
    console.log(`[${shape.id}] probe/short run - frames in ${dir}, no encode`);
    continue;
  }

  const shot = readdirSync(dir).filter((f) => f.endsWith(".png")).length;
  if (shot !== SECONDS * FPS) {
    throw new Error(`${shape.id}: ${shot} frames on disk, expected ${SECONDS * FPS}`);
  }

  const mp4 = `${OUT}/logbook-${shape.id}.mp4`;
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error",
    "-framerate", String(FPS),
    "-i", `${dir}/f%04d.png`,
    "-i", BED,
    "-c:v", "libx264",
    "-preset", "slow",
    "-crf", "20",
    "-pix_fmt", "yuv420p",
    "-g", String(FPS),
    // AAC at 192k. The bed is already mastered and already had its one lossy
    // round trip measured (2.2 ms of tail at the loop seam, a -44 dBFS step);
    // this is the second and the platform's will be the third.
    "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
    "-shortest",
    "-muxdelay", "0", "-muxpreload", "0",
    "-movflags", "+faststart",
    mp4,
  ]);

  // MEASURED, NOT ASSUMED. A film that is 9.967s or 10.033s does not loop.
  const probe = JSON.parse(
    execFileSync("ffprobe", [
      "-v", "error", "-show_entries",
      "format=duration:stream=codec_type,width,height,nb_frames,r_frame_rate",
      "-of", "json", mp4,
    ]).toString(),
  );
  const v = probe.streams.find((s) => s.codec_type === "video");
  const a = probe.streams.find((s) => s.codec_type === "audio");
  const dur = Number(probe.format.duration);
  const kb = Math.round(statSync(mp4).size / 1024);
  console.log(
    `${mp4}\n  ${v.width}x${v.height}  ${v.nb_frames} frames @ ${v.r_frame_rate}  ` +
      `${dur.toFixed(3)}s  ${kb} KB  audio ${a ? a.codec_type : "MISSING"}`,
  );
  if (Math.abs(dur - SECONDS) > 0.05) {
    console.warn(`  WARNING: ${dur.toFixed(3)}s is not ${SECONDS}s - this will not loop cleanly`);
  }
  if (Number(v.nb_frames) !== SECONDS * FPS) {
    console.warn(`  WARNING: ${v.nb_frames} frames, expected ${SECONDS * FPS}`);
  }
  if (!a) console.warn("  WARNING: no audio stream");
}

await browser.close();
