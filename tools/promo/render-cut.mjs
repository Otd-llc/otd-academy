// Render the full 10 s cut for one format and mux the bed under it. LOCAL ONLY.
//
//   node render-cut.mjs <out-dir> <format>
//
// SCRUBBED, NEVER PLAYED. Every frame comes from awaiting __cutSet(t), which
// seeks the segment videos and pins every cue animation's currentTime to scene
// time. A frame may take any amount of wall clock and the picture cannot drift,
// which is the only reason this is reproducible.
//
// THE BED IS NOT RE-ENCODED PAST AAC. It is already mastered: convolved, glued,
// true-peak limited, and loudness-capped at whatever linear gain could reach.
// A second normalisation here would undo exactly the thing that was protected.
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { execFileSync, spawnSync } from "node:child_process";

const req = createRequire("C:/zzz/pf-beta/package.json");
const { chromium } = req("playwright");

const OUT = process.argv[2];
const FORMAT = process.argv[3];
/**
 * `--no-type`: the picture with the cue layer suppressed.
 *
 * A site band overlays its OWN copy on the clip - the apex hex band does
 * exactly that - so a cut with words burnt into it puts two type systems in one
 * frame. The shipped hex band uses its typeless variant for this reason.
 *
 * Costs nothing to support because the cue layer is a separate DOM layer over
 * the picture, so this hides it rather than re-rendering anything differently.
 */
const NO_TYPE = process.argv.includes("--no-type");
const SUFFIX = NO_TYPE ? "-notype" : "";
const FPS = 30;
const SECONDS = 10;
const FRAMES = FPS * SECONDS;

// THE LOCKED SCORE: half-time groove, saw-stab bass, stutter drop, rev-long as
// the LEARN accent. Named in full rather than by a kit alias so the file the
// film ships with is legible from the command that made it.
const BED = "C:/zzz/_hex-promo/kits/jingle-half-time_saw-stab_stutter_rev-long-master.wav";
const BED_RAW = BED.replace("-master.wav", ".wav");
if (!existsSync(BED)) throw new Error(`no such bed: ${BED}`);

const dir = `${OUT}/cut-${FORMAT}${SUFFIX}`;
rmSync(`${dir}/frames`, { recursive: true, force: true });
mkdirSync(`${dir}/frames`, { recursive: true });

// ── the arc survived mastering ──────────────────────────────────────────────
//
// loudnorm with linear=true silently compresses when it cannot reach the target
// by gain alone, and the thing it flattens first is the crest -- which on a
// five-bar jingle IS the arc from the opening bar to the EARN landing. Measure
// it rather than assume the master was built with --preserve-arc.
const crest = (f) => {
  // STDERR, not stdout. astats writes its report to stderr at -v info, and
  // reading stdout returned an empty string: every crest came back null, both
  // sides of the comparison were falsy, and the gate passed having measured
  // nothing. A check that cannot fail is worse than no check.
  const r = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-nostats", "-i", f, "-af", "astats=metadata=1:reset=0", "-f", "null", "-"],
    { encoding: "utf8" },
  );
  const text = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  const m = [...text.matchAll(/Crest factor:\s*([\d.]+)/g)].map((x) => Number(x[1]));
  const finite = m.filter(Number.isFinite);
  return finite.length ? Math.max(...finite) : null;
};
if (!existsSync(BED_RAW)) throw new Error(`no unmastered bed to compare against: ${BED_RAW}`);
const arc = { before: crest(BED_RAW), after: crest(BED) };
if (arc.before === null || arc.after === null) {
  throw new Error(`could not read a crest factor (before ${arc.before}, after ${arc.after}) - the arc gate measured nothing`);
}
if (arc.after < arc.before * 0.85) {
  throw new Error(
    `the master flattened the arc: crest ${arc.before.toFixed(2)} -> ${arc.after.toFixed(2)}. ` +
      `Re-master with --preserve-arc.`,
  );
}

const browser = await chromium.launch({
  args: [
    "--use-angle=gl", "--enable-gpu", "--ignore-gpu-blocklist",
    "--autoplay-policy=no-user-gesture-required",
  ],
});
const ctx = await browser.newContext({
  viewport: { width: 1920, height: 1920 },
  deviceScaleFactor: 1,
  colorScheme: "dark",
  locale: "en-US",
  timezoneId: "UTC",
  // REDUCED MOTION IS A SEEKABILITY CONTROL HERE, not an accessibility courtesy.
  //
  // The film's contract is that every animated value is a pure function of `t`, so a
  // frame at t=1.4 is the same picture every time it is asked for. Product CSS the
  // film composes does not honour that on its own: the honeycomb's current cell runs
  // `animation: gh-pulse 1.8s infinite` on the WALL CLOCK, and `.gh-art` and the
  // prism strokes carry 0.28s and 0.15s transitions that fire whenever a cell's kind
  // changes. Two grabs of the same nominal frame differ - the same class of failure
  // already measured once as 24 of 120 frozen frames not matching on a re-hash.
  //
  // globals.css already switches all three off under `prefers-reduced-motion`. The
  // escape hatch existed and this pipeline simply never pulled it, while
  // `scripts/export-diagrams.ts` has been pulling it for the diagram exporter all
  // along. Pausing animations after the fact only reaches the trees we know to walk;
  // this reaches any product CSS the film ever composes.
  reducedMotion: "reduce",
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(`http://localhost:3200/sandbox/capture/cut?format=${FORMAT}`, {
  waitUntil: "networkidle",
  timeout: 300_000,
});
try { await page.getByRole("button", { name: /reject all/i }).click({ timeout: 5000 }); } catch {}
await page.addStyleTag({
  content: `nextjs-portal{display:none!important}
    .app-shell-header,header,footer{display:none!important}
    body{margin:0;background:#08090d}
    ${NO_TYPE ? "#cuelayer{display:none!important}" : ""}`,
});
await page.waitForFunction(() => window.__cutReady === true, undefined, { timeout: 300_000 });
await page.evaluate(() => document.fonts.ready);

const meta = await page.evaluate(() => window.__cutMeta);
const placed = await page.evaluate(() => window.__cutPlaced);
const stage = page.locator("[data-cut-stage]");
const box = await stage.boundingBox();

for (let i = 0; i < FRAMES; i += 1) {
  const t = (i / FPS) % SECONDS;
  await page.evaluate((tt) => window.__cutSet(tt), t);
  await stage.screenshot({ path: `${dir}/frames/f${String(i).padStart(4, "0")}.png` });
}
await browser.close();
if (errors.length) console.warn("page errors:", errors.slice(0, 3));

const mp4 = `${OUT}/cuts/l101-beta-${FORMAT}${SUFFIX}.mp4`;
mkdirSync(`${OUT}/cuts`, { recursive: true });
execFileSync("ffmpeg", [
  "-y", "-loglevel", "error",
  "-framerate", String(FPS), "-i", `${dir}/frames/f%04d.png`,
  "-i", BED,
  // yuv420p and even dimensions, or half the world cannot decode it.
  "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p",
  "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
  "-shortest", "-movflags", "+faststart",
  mp4,
]);

// A silent, short or mis-sized file is the failure that looks like success, so
// read the muxed result back rather than trusting the encoder's exit code.
const probe = JSON.parse(
  execFileSync("ffprobe", [
    "-v", "error",
    "-show_entries", "stream=codec_type,codec_name,width,height,nb_frames,channels",
    "-show_entries", "format=duration,size", "-of", "json", mp4,
  ]).toString(),
);
const v = probe.streams.find((s) => s.codec_type === "video");
const a = probe.streams.find((s) => s.codec_type === "audio");

const fail = [];
if (!v) fail.push("no video stream");
if (!a) fail.push("no audio stream - the bed did not mux");
if (v && Number(v.nb_frames) !== FRAMES) fail.push(`${v.nb_frames} frames, expected ${FRAMES}`);
if (v && (Number(v.width) !== Math.round(box.width) || Number(v.height) !== Math.round(box.height))) {
  fail.push(`encoded ${v.width}x${v.height} but the stage was ${Math.round(box.width)}x${Math.round(box.height)}`);
}
if (v && (Number(v.width) % 2 || Number(v.height) % 2)) fail.push(`odd dimensions ${v.width}x${v.height}`);
if (Math.abs(Number(probe.format.duration) - SECONDS) > 0.12) {
  fail.push(`duration ${probe.format.duration}s, expected ${SECONDS}`);
}
if (errors.length) fail.push(`page error: ${errors[0]}`);

console.log(JSON.stringify({
  format: FORMAT, mp4, frames: FRAMES,
  size: `${v?.width}x${v?.height}`,
  duration: probe.format.duration,
  bytes: probe.format.size,
  audio: a ? `${a.codec_name} ${a.channels}ch` : null,
  arc, meta,
  gap: placed?.gap,
}, null, 1));

if (fail.length) { console.error("FAIL:\n - " + fail.join("\n - ")); process.exit(1); }
console.log(`OK ${mp4}`);
