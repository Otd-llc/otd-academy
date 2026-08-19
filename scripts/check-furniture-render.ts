/**
 * Compare the RENDERED VIDEO against the LIVE PAGE, frame by frame.
 *
 *   pnpm exec tsx scripts/check-furniture-render.ts
 *   pnpm exec tsx scripts/check-furniture-render.ts outro
 *
 * WHY THIS EXISTS. The renderer's own checks answer "is the file well-formed" --
 * frame count, dimensions, alpha present, encode lossless, output deterministic.
 * Every one of those passed on clips that were visibly wrong: a dot-matrix
 * stipple through the glyphs, a flickering hex, page chrome baked into the
 * corner. A well-formed file of the wrong picture is still the wrong picture.
 *
 * So this asks the only question those cannot: DOES THE VIDEO MATCH THE PAGE?
 * It screenshots the live surface at a given `t` and compares it, pixel for
 * pixel, against the frame the encoder wrote for that same `t`. Any divergence
 * is the pipeline damaging the artwork somewhere between the browser and the
 * file.
 *
 * WHAT A MATCH DOES AND DOES NOT PROVE. A match means the video is a faithful
 * recording of the page -- the pipeline is honest. It says NOTHING about whether
 * the page itself is designed correctly: a chip that is too small, or a label
 * with no contrast against its ground, will match perfectly and still be wrong.
 * Those are design faults and belong in a design round. Keeping the two apart is
 * the point, because they were being confused.
 *
 * ASCII only.
 */

import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync, unlinkSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";

const ORIGIN = process.env.FURNITURE_ORIGIN ?? "http://localhost:3010";
const FRAME = `${ORIGIN}/sandbox/video-furniture/r2/frame`;
const OUT = process.env.FURNITURE_OUT ?? "C:/zzz/_video/furniture";
const FPS = 30;

/**
 * The bar is PERCEPTUAL, not byte equality, and that correction matters.
 *
 * Comparing raw RGBA bytes counts differences in pixels that are nearly
 * transparent, where the colour underneath is invisible. Measured on a clean
 * clip: 11,925 pixels differ in RGB, median delta 2 -- but weighted by their own
 * alpha, the WORST error a viewer could see is 1.73/255. That is two GPU
 * rasterizations of the same page rounding an antialiased edge differently, not
 * the pipeline damaging anything. A byte-equality bar fails every honest render,
 * and a check that always fails is one nobody reads.
 *
 * So the metric is `|delta| * (alpha/255)` -- the error as composited. 8/255 is
 * about the just-noticeable difference on a flat field, roughly 4.6x the
 * observed noise floor, and orders of magnitude below the real faults this
 * exists to catch: the ProRes dither and the pulse flicker both moved whole
 * regions at full opacity.
 */
const VISIBLE_ERROR_MAX = 8;
/**
 * ...and the statistic is a COUNT, not the maximum.
 *
 * The worst single pixel is the wrong measure for antialiasing. A diagonal hex
 * edge rasterized a fraction of a pixel differently produces a scatter of
 * individual pixels at up to ~40/255 -- invisible. The same 40/255 across a
 * REGION is a real fault. Measured on a clean intro frame: the divergence was a
 * handful of dots along one hex edge.
 *
 * 0.02% of the frame is ~415 px at 1080p. Every fault this has actually caught
 * -- the ProRes dither, the pulse flicker, baked-in page chrome -- covered tens
 * of thousands.
 */
const VISIBLE_BAD_PCT_MAX = 0.02;

/**
 * Alpha gets the same treatment, and demanding exactness here was wrong.
 *
 * Alpha edges are antialiased like everything else, so two rasterizations of the
 * same frame disagree on the boundary pixels. Measured on a clean intro frame:
 * 502 pixels of 2,073,600 (0.024%) differ, median delta 8, max 46 -- an edge
 * landing a fraction of a pixel differently, invisible once composited.
 *
 * What this must still catch is STRUCTURAL: an element missing, doubled, or from
 * the wrong variant. That is tens of thousands of pixels at large deltas, three
 * orders of magnitude above the noise. So the bar is a COUNT of meaningfully
 * different alpha pixels, not the presence of any.
 */
const ALPHA_DELTA_MIN = 24;      // below this is edge rounding
const ALPHA_BAD_PCT_MAX = 0.05;  // ~1,000 px at 1080p; observed noise is ~250

const only = process.argv.slice(2).find((a) => !a.startsWith("--"));

const seek = async (page: Page, t: number) => {
  const ok = await page.evaluate(async (tt) => {
    const w = window as unknown as { __seek?: (n: number) => void | Promise<void> };
    if (typeof w.__seek !== "function") return false;
    await w.__seek(tt);
    return true;
  }, t);
  if (!ok) throw new Error(`__seek missing at t=${t}`);
};

const pinAnimations = async (page: Page, t: number) => {
  await page.evaluate((tt) => {
    const ID = "__scrub_pin";
    let el = document.getElementById(ID);
    if (!el) {
      el = document.createElement("style");
      el.id = ID;
      document.head.appendChild(el);
    }
    el.textContent =
      `*, *::before, *::after { animation-delay: -${tt}s !important; ` +
      `animation-play-state: paused !important; transition: none !important; }`;
  }, t);
};

const rawFrom = (file: string, extraArgs: string[] = []) =>
  execFileSync("ffmpeg", ["-v", "error", ...extraArgs, "-i", file, "-frames:v", "1",
    "-f", "rawvideo", "-pix_fmt", "rgba", "pipe:1"], { maxBuffer: 128 * 1024 * 1024 }) as unknown as Buffer;

async function main() {
  const files = readdirSync(OUT).filter((f) => f.endsWith(".mov")).filter((f) => !only || f.startsWith(`${only}--`));
  if (files.length === 0) {
    console.log(`no clips in ${OUT}${only ? ` for "${only}"` : ""}. Nothing was compared.`);
    process.exit(1);
  }

  const browser = await chromium.launch();
  const problems: string[] = [];
  let compared = 0;

  for (const f of files) {
    // <piece>--<variant>--<theme>.mov
    const m = /^(.+?)--(.+?)--(dark|light)\.mov$/.exec(f);
    if (!m) { problems.push(`${f}: unparseable name`); continue; }
    const [, piece, variant, theme] = m;
    const file = join(OUT, f);
    const vertical = piece.endsWith("-short");
    const size = vertical ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 };

    const nb = Number(execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0",
      "-show_entries", "stream=nb_frames", "-of", "default=nw=1:nk=1", file], { encoding: "utf8" }).trim());

    const ctx = await browser.newContext({
      viewport: size,
      deviceScaleFactor: 1,
      // THE CODEBASE ALREADY SOLVED THE SCRUB PROBLEM -- behind this flag.
      // globals.css disables the current-cell pulse and the `.ghp-face` /
      // `.ghp-side` stroke transitions inside a `prefers-reduced-motion:
      // reduce` block, with a comment recording that a 150ms tween left running
      // when the shutter opens makes the same nominal frame come out different
      // depending on how long the seek took. Not emulating the flag left every
      // one of those guards inactive.
      reducedMotion: "reduce",
    });
    const page = await ctx.newPage();
    await page.goto(`${FRAME}?piece=${piece}&variant=${variant}&alpha=1`, { waitUntil: "networkidle" });
    await page.evaluate((th) => document.documentElement.setAttribute("data-theme", th), theme);
    await page.addStyleTag({
      content: `[class*="c15t-"], nextjs-portal, [data-nextjs-toast],
                #__next-build-watcher, [data-nextjs-dev-tools-button] { display: none !important; }`,
    });
    // Same reason as the renderer: networkidle can precede the React effect
    // that installs `__seek`.
    await page.waitForFunction(() => typeof (window as unknown as { __seek?: unknown }).__seek === "function",
      undefined, { timeout: 15000 });
    await page.evaluate(() => document.fonts.ready);

    // Sample across the clip rather than at one point: an early frame is entry
    // animation, a late frame is exit, and a fault can live in either.
    const idxs = [1, Math.floor(nb * 0.25), Math.floor(nb * 0.5), Math.floor(nb * 0.75), nb - 2]
      .filter((i, k, a) => i > 0 && i < nb && a.indexOf(i) === k);

    const worst: { idx: number; pct: number }[] = [];
    for (const idx of idxs) {
      const t = idx / FPS;
      // `-ss idx/FPS` targets frame idx exactly. VERIFIED against a sequential
      // decode: both `-ss 2.0` and `select=eq(n,60)` return byte-identical
      // copies of frame 60. An earlier "fix" nudged this to the frame midpoint
      // on the theory that a boundary seek was ambiguous -- it is not, and the
      // nudge landed on idx+1, tripling the reported divergence.
      const tSeek = idx / FPS;
      await pinAnimations(page, t);
      await seek(page, t);
      const png = await page.screenshot({ omitBackground: true });
      const tmp = `${file}.cmp.png`;
      let live: Buffer, shot: Buffer;
      try {
        writeFileSync(tmp, png);
        live = rawFrom(tmp);
        shot = rawFrom(file, ["-ss", String(tSeek)]);
      } finally { try { unlinkSync(tmp); } catch {} }

      if (!live.length || !shot.length) { problems.push(`${f} @${idx}: could not decode a side`); continue; }
      compared += 1;
      let maxVisible = 0;
      let visibleBad = 0;
      let alphaMismatch = 0;
      for (let i = 0; i < Math.min(live.length, shot.length); i += 4) {
        if (Math.abs(live[i + 3] - shot[i + 3]) >= ALPHA_DELTA_MIN) alphaMismatch += 1;
        const d = Math.max(
          Math.abs(live[i] - shot[i]),
          Math.abs(live[i + 1] - shot[i + 1]),
          Math.abs(live[i + 2] - shot[i + 2]),
        );
        if (d === 0) continue;
        const visible = d * (live[i + 3] / 255);
        if (visible > VISIBLE_ERROR_MAX) visibleBad += 1;
        if (visible > maxVisible) maxVisible = visible;
      }
      const alphaBadPct = (alphaMismatch / (live.length / 4)) * 100;
      if (alphaBadPct > ALPHA_BAD_PCT_MAX) worst.push({ idx, pct: -alphaMismatch });
      else {
        const badPct = (visibleBad / (live.length / 4)) * 100;
        if (badPct > VISIBLE_BAD_PCT_MAX) worst.push({ idx, pct: maxVisible });
      }
    }
    await ctx.close();

    if (worst.length) {
      const w = worst.map((x) => (x.pct < 0
        ? `f${x.idx} ${-x.pct} alpha mismatches`
        : `f${x.idx} worst visible error ${x.pct.toFixed(1)}/255`)).join(", ");
      problems.push(`${f}: VIDEO DIVERGES FROM PAGE at ${w}`);
      console.log(`  FAIL ${f}\n         !! diverges at ${w}`);
    } else {
      console.log(`  ok   ${f}  ${idxs.length} frames match the live page`);
    }
  }

  await browser.close();
  console.log(`\ncompared ${compared} frames across ${files.length} clips   problems ${problems.length}`);
  for (const p of problems) console.log(`  !! ${p}`);
  if (compared === 0) {
    console.log("NOTHING WAS COMPARED. A check over an empty set reports success.");
    process.exit(1);
  }
  console.log(
    problems.length === 0
      ? "\nThe videos are faithful recordings of the page.\n" +
        "NOTE: this proves the PIPELINE is honest, not that the DESIGN is right.\n" +
        "Anything wrong on the page -- type too small, no contrast against the\n" +
        "ground -- matches perfectly and is still wrong. Those are design faults."
      : "",
  );
  process.exit(problems.length === 0 ? 0 : 1);
}

void main();
