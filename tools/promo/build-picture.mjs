// Both halves of the cut's PICTURE, for one format. LOCAL ONLY.
//
//   node build-picture.mjs <scratch-dir> <format>
//
// WHY PER FORMAT AT ALL. The cut draws its segments with object-fit:cover, so
// handing a 16:9 render to a 9:16 frame throws away the outer 68% of the width,
// which is where the certificate lives. Each aspect is a fresh render of the
// same rigs, not a crop.
//
// BAND IS NOT IN THE LIST on purpose. It is the 16:9 cut shown through a narrow
// crop, so it uses wide's picture and changes only the type margin. Rendering it
// separately would produce a byte-identical file.
//
// TIMINGS ARE THE SAME IN EVERY FORMAT: exam 5.8, card pre-roll 1.2, card 2.4.
// CutStage's segment offsets are measured from them, so a format that changed
// them would need its joins re-nudged from scratch.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, rmSync, existsSync } from "node:fs";

const req = createRequire("C:/zzz/pf-beta/package.json");
const { chromium } = req("playwright");

const OUT = process.argv[2];
const FORMAT = process.argv[3];

// Mirrors SPECS in src/app/sandbox/capture/cut/earn-place.ts. Asserted against
// what the page actually renders below, so a drift is a failure rather than a
// silently mis-sized clip.
const SIZES = {
  wide: { w: 1920, h: 1080 },
  // Band renders too now. It shares wide's HANDOFF (same rig, same centring)
  // but needs its own FINISH, because its certificate is centred on the
  // geometry at 50% where wide's sits at 69% beside a type column.
  band: { w: 1920, h: 1080 },
  vertical: { w: 1080, h: 1920 },
  square: { w: 1080, h: 1080 },
  portrait: { w: 1080, h: 1350 },
};
const size = SIZES[FORMAT];
if (!size) throw new Error(`no size for format "${FORMAT}"`);
// Band only needs the card half; its handoff IS wide's file.
const FINISH_ONLY = FORMAT === "band";
const { w: W, h: H } = size;
const SUFFIX = FORMAT === "wide" ? "" : `-${FORMAT}`;

const FPS = 30;
const HANDOFF_SECONDS = 8;
const EXAM = 5.8;
const PRE = 1.2;
const CARD = 2.4;
const PUB = "c:/zzz/pf-beta/public/_capture";
// wide keeps the 2560x1440 plate it was always captured from; the narrow ones
// are reflowed captures at their own viewport, because a centre crop of the
// wide one slices every question in half.
// Band is the same 16:9 as wide, so it takes the same 2560x1440 plate. Only the
// narrow formats have reflowed captures of their own.
const PLATE =
  FORMAT === "wide" || FORMAT === "band"
    ? `${PUB}/tight/exam-picked.png`
    : `${OUT}/plates/exam-${FORMAT}.png`;
if (!existsSync(PLATE)) throw new Error(`no plate for ${FORMAT}: ${PLATE}`);

const frames = (f) =>
  Number(
    JSON.parse(
      execFileSync("ffprobe", [
        "-v", "error", "-count_frames", "-select_streams", "v:0",
        "-show_entries", "stream=nb_read_frames", "-of", "json", f,
      ]).toString(),
    ).streams[0].nb_read_frames,
  );

const browser = await chromium.launch({
  args: ["--use-angle=gl", "--enable-gpu", "--ignore-gpu-blocklist"],
});
const hideChrome = `nextjs-portal{display:none!important}
  .app-shell-header,header,footer{display:none!important}
  html,body{margin:0;padding:0;background:#08090d;overflow:hidden}`;

/** Assert the stage is the size this script thinks it is. */
async function checkSize(page, selector) {
  const box = await page.locator(selector).boundingBox();
  if (Math.round(box.width) !== W || Math.round(box.height) !== H) {
    throw new Error(
      `${FORMAT}: ${selector} rendered ${Math.round(box.width)}x${Math.round(box.height)}, expected ${W}x${H}. ` +
        `SIZES here has drifted from SPECS in earn-place.ts.`,
    );
  }
}

// ── the handoff: gerbers collapsing onto the board ──────────────────────────
if (!FINISH_ONLY) {
  const dir = `${OUT}/pic-${FORMAT}/hframes`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  const page = await (await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 1,
    colorScheme: "dark",
    timezoneId: "UTC",
  })).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  // The locked look: hero lens, flat 30 deg/s, a 1000 ms cross-fade.
  await page.goto(
    `http://localhost:3200/sandbox/capture/handoff?w=${W}&h=${H}&angle=hero&profile=constant&fade=0.5`,
    { waitUntil: "networkidle", timeout: 300_000 },
  );
  try { await page.getByRole("button", { name: /reject all/i }).click({ timeout: 5000 }); } catch {}
  await page.addStyleTag({ content: hideChrome });
  await page.waitForFunction(() => window.__handoffReady === true, undefined, { timeout: 300_000 });
  await checkSize(page, "[data-rig='handoff']");

  const stage = page.locator("[data-rig='handoff']");
  const n = FPS * HANDOFF_SECONDS;
  for (let i = 0; i < n; i += 1) {
    await page.evaluate((t) => window.__handoffSet(t), i / FPS);
    await stage.screenshot({ path: `${dir}/f${String(i).padStart(4, "0")}.png` });
  }
  await page.context().close();
  if (errors.length) console.warn(`${FORMAT} handoff page errors:`, errors.slice(0, 2));

  const mp4 = `${PUB}/cut/handoff${SUFFIX}.mp4`;
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error",
    "-framerate", String(FPS), "-i", `${dir}/f%04d.png`,
    "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart", mp4,
  ]);
  const got = frames(mp4);
  if (got !== n) throw new Error(`handoff${SUFFIX} is ${got} frames, expected ${n}`);
  console.log(`handoff${SUFFIX}.mp4  ${got} frames  ${W}x${H}`);
}

// ── the card ────────────────────────────────────────────────────────────────
{
  const dir = `${OUT}/pic-${FORMAT}/earnframes`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  const page = await (await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 1,
    colorScheme: "dark",
  })).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(`http://localhost:3200/sandbox/capture/earn?format=${FORMAT}`, {
    waitUntil: "networkidle",
    timeout: 300_000,
  });
  try { await page.getByRole("button", { name: /reject all/i }).click({ timeout: 5000 }); } catch {}
  await page.addStyleTag({ content: hideChrome });
  await page.waitForFunction(() => window.__spaceReady === true, undefined, { timeout: 300_000 });
  await checkSize(page, "[data-space]");

  const stage = page.locator("[data-space]");
  const n = Math.round((PRE + CARD) * FPS);
  for (let i = 0; i < n; i += 1) {
    // Negative t holds the opening pose, which is the pre-roll the EARN join
    // gets nudged against.
    await page.evaluate((t) => window.__spaceSet(t), i / FPS - PRE);
    await stage.screenshot({ path: `${dir}/f${String(i).padStart(4, "0")}.png` });
  }
  await page.context().close();
  if (errors.length) console.warn(`${FORMAT} card page errors:`, errors.slice(0, 2));

  const cardMp4 = `${OUT}/pic-${FORMAT}/_card.mp4`;
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error",
    "-framerate", String(FPS), "-i", `${dir}/f%04d.png`,
    "-r", String(FPS), "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p",
    cardMp4,
  ]);

  // ── the exam half: a push-in on the plate ─────────────────────────────────
  const examMp4 = `${OUT}/pic-${FORMAT}/_exam.mp4`;
  const N = Math.round(EXAM * FPS);
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error",
    "-framerate", String(FPS), "-loop", "1", "-t", String(EXAM), "-i", PLATE,
    "-vf",
    // fps=FPS IS REQUIRED. zoompan has its own `fps` option defaulting to 25 and
    // stamps the output at that rate whatever -framerate says. Without it this
    // produced a 5.8s half that was really 6.97s, and every offset downstream is
    // measured from where this half ends.
    //
    // scale to 2x THE TARGET, not a fixed 2560x1440: the plate is already the
    // right aspect for its format, and forcing 16:9 here would letterbox the
    // vertical ones before the zoom even starts.
    `scale=${W * 2}:${H * 2}:force_original_aspect_ratio=increase,` +
      `crop=${W * 2}:${H * 2},setsar=1,` +
      `zoompan=z='1+0.07*on/${N}':d=1:fps=${FPS}:` +
      `x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}`,
    "-r", String(FPS), "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p",
    examMp4,
  ]);
  {
    const got = frames(examMp4);
    if (got !== N) throw new Error(`exam half is ${got} frames, expected ${N} (${EXAM}s)`);
  }

  const finish = `${PUB}/cut/finish${SUFFIX}.mp4`;
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error", "-i", examMp4, "-i", cardMp4,
    "-filter_complex", "[0:v][1:v]concat=n=2:v=1:a=0[v]",
    "-map", "[v]", "-r", String(FPS),
    "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart", finish,
  ]);
  const want = Math.round((EXAM + PRE + CARD) * FPS);
  const got = frames(finish);
  if (got !== want) throw new Error(`finish${SUFFIX} is ${got} frames, expected ${want}`);
  console.log(`finish${SUFFIX}.mp4   ${got} frames = exam ${N} + card ${n}  ${W}x${H}`);
}

await browser.close();
console.log(`OK ${FORMAT}`);
