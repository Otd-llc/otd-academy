// A short silent loop of the configurator building a cluster, for the /hex hero.
//
// The choreography runs INSIDE the page as one awaited promise rather than as a
// series of Playwright waits, because the recording is real time: any round trip
// between node and the browser lands in the footage as a stutter.
//
// Playwright starts recording when the CONTEXT is created, so the boot and the
// model load are in the file too. The offset from context creation to the first
// frame worth keeping is measured, not guessed, and handed to ffmpeg as the trim.
import { chromium } from "playwright";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const APP = "http://localhost:5180/hex";
const RAW =
  "C:/Users/raven/AppData/Local/Temp/claude/c--zzz-project-foundry/6b77be38-fe0b-4908-93a5-9783a0347c55/scratchpad/hexvid";
const OUT = "public/hex";
rmSync(RAW, { recursive: true, force: true });
mkdirSync(RAW, { recursive: true });
mkdirSync(OUT, { recursive: true });

const W = 1280;
const H = 800;

const browser = await chromium.launch();
const contextStart = Date.now();
const ctx = await browser.newContext({
  viewport: { width: W, height: H },
  recordVideo: { dir: RAW, size: { width: W, height: H } },
});
const page = await ctx.newPage();
// Pin the theme BEFORE boot. Playwright's default colorScheme is light, and the
// app's no-flash script honours prefers-color-scheme, so leaving this out
// silently records the wrong palette -- which is exactly what the first take did.
await page.addInitScript(() => {
  try {
    localStorage.setItem("otd-theme", "dark");
  } catch {
    /* private mode */
  }
});
await page.goto(APP, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(11000); // three.js, models, first paint

// Hide the timed nudges. The toolbar and header STAY: this is a clip about what
// the tool does, and a tool with no interface in shot is just a turntable.
await page.addStyleTag({
  content: "#idle-prompt, #ghost-tip, #hint { display: none !important; }",
});

const trimMs = Date.now() - contextStart;

await page.evaluate(async () => {
  const { placeCell, removeCell, cells } = await import("/src/hex/cells.ts");
  const { controls, cellsContainer } = await import("/src/hex/scene.ts");
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // A ring of six around one, laid down in order so the dovetails visibly meet.
  const CELLS = [
    [0, 0],
    [1, 0],
    [1, -1],
    [0, -1],
    [-1, 0],
    [-1, 1],
    [0, 1],
  ];

  // Frame the FINISHED cluster first, then take it back down, so the camera
  // never jumps mid-clip: a hero loop that re-frames itself reads as a bug.
  //
  // Torn down with removeCell, NOT cellsContainer.clear(). The first take used
  // clear(), which empties the SCENE GRAPH while leaving the `cells` registry
  // populated -- so the re-placement deduped against entries that were still
  // there, added nothing back, and recorded seven ghost previews and no cluster.
  for (const [q, r] of CELLS) placeCell(q, r);
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  await controls.fitToSphere(cellsContainer, false);
  controls.dollyTo(controls.distance / 0.66, false);
  for (const key of [...cells.keys()]) removeCell(key);
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  await sleep(700);

  // Place them one at a time.
  for (const [q, r] of CELLS) {
    placeCell(q, r);
    await sleep(430);
  }

  // Then a slow orbit of the finished cluster. Stepped per frame rather than one
  // eased `rotate`, so the speed is constant instead of ease-in-ease-out.
  const start = performance.now();
  const DURATION = 3600;
  await new Promise((resolve) => {
    function step(now) {
      const t = now - start;
      controls.rotate(0.0075, 0, false);
      if (t < DURATION) requestAnimationFrame(step);
      else resolve(null);
    }
    requestAnimationFrame(step);
  });
  await sleep(500);
});

await ctx.close(); // flushes the video
await browser.close();

const raw = join(
  RAW,
  readdirSync(RAW).find((f) => f.endsWith(".webm")),
);
const trim = (trimMs / 1000).toFixed(2);

// Two encodes, because one format does not cover the field: MP4/H.264 is the
// safe default and the only thing some older Safari builds will autoplay; WebM
// is smaller where it is supported. `faststart` puts the index at the front so
// playback can begin before the file has finished arriving.
execFileSync("ffmpeg", [
  "-y",
  "-loglevel",
  "error",
  "-ss",
  trim,
  "-i",
  raw,
  "-an",
  "-c:v",
  "libx264",
  "-preset",
  "slow",
  "-crf",
  "26",
  "-pix_fmt",
  "yuv420p",
  "-movflags",
  "+faststart",
  `${OUT}/configurator.mp4`,
]);
execFileSync("ffmpeg", [
  "-y",
  "-loglevel",
  "error",
  "-ss",
  trim,
  "-i",
  raw,
  "-an",
  "-c:v",
  "libvpx-vp9",
  "-crf",
  "38",
  "-b:v",
  "0",
  "-row-mt",
  "1",
  `${OUT}/configurator.webm`,
]);
// A poster, so the hero has something to show before the video is decodable.
execFileSync("ffmpeg", [
  "-y",
  "-loglevel",
  "error",
  "-ss",
  "9",
  "-i",
  `${OUT}/configurator.mp4`,
  "-frames:v",
  "1",
  `${OUT}/configurator-poster.jpg`,
]);

console.log(`trimmed ${trim}s of boot`);
for (const f of [
  "configurator.mp4",
  "configurator.webm",
  "configurator-poster.jpg",
]) {
  const { size } = await import("node:fs").then((m) =>
    m.statSync(`${OUT}/${f}`),
  );
  console.log(`${f}  ${(size / 1024).toFixed(0)} KB`);
}
