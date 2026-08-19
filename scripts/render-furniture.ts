/**
 * Render the video-furniture pieces to files an NLE can actually use.
 *
 *   pnpm furniture:render                 every piece, every variant
 *   pnpm furniture:render intro           one piece, every variant
 *   pnpm furniture:render lower form-tab  one piece, one variant
 *
 * Output: ProRes 4444 .mov, one per piece/variant, under OUT (default
 * C:/zzz/_video/furniture). Resolve decodes ProRes natively on Windows, it
 * carries an alpha channel, and it is an intermediate rather than a delivery
 * format, so the size is the right trade.
 *
 * TWO CLASSES OF PIECE, and conflating them is the mistake this file exists to
 * prevent:
 *
 *   FULL-FRAME (intro, outro, intro-short, outro-short) are standalone clips.
 *   They sit BEFORE and AFTER footage, not on top of it, and they keep their
 *   deep-space ground. Rendering these to alpha would be wrong.
 *
 *   OVERLAY (lower, chapter, callout, label, pause, beforeafter) sit ON TOP of
 *   the screencast and must carry transparency. These are rendered with
 *   `?alpha=1`, which drops the page's opaque ground, AND with Playwright's
 *   `omitBackground`. BOTH are required: the page really is opaque otherwise,
 *   so omitBackground alone still yields a black rectangle. That trap is
 *   documented in tools/hex-stills.mjs and was flagged in the pipeline handoff.
 *
 * SCRUBBED, NEVER PLAYED. Every frame comes from awaiting `__seek(t)`, the
 * promise contract in src/types/capture-surface.d.ts. A frame may be rendered
 * any number of times and must come out identical.
 *
 * THE OUTPUT IS CHECKED, NOT ASSUMED. After each render this reads the file back
 * and asserts: the frame count is what was asked for, the piece actually drew
 * something (frames are not uniformly blank), and -- for overlays -- that real
 * transparency exists. A "successful" render of a black rectangle is the exact
 * failure this is guarding, and it is invisible until it reaches the timeline.
 *
 * ASCII only.
 */

import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import { PIECES, type PieceKey } from "@/app/sandbox/video-furniture/r2/variants";

const ORIGIN = process.env.FURNITURE_ORIGIN ?? "http://localhost:3010";
const FRAME = `${ORIGIN}/sandbox/video-furniture/r2/frame`;
const OUT = process.env.FURNITURE_OUT ?? "C:/zzz/_video/furniture";

/** Matches the capture spec. Furniture that does not share the capture's rate
 *  and size cannot be laid over it without a resample. */
const FPS = 30;
const WIDE = { width: 1920, height: 1080 };
const TALL = { width: 1080, height: 1920 };

/** The four standalone compositions. Everything else overlays. */
const FULL_FRAME = new Set<PieceKey>(["intro", "outro", "intro-short", "outro-short"]);
/** The 9:16 pieces. A short is a separate composition, not a reflow. */
const VERTICAL = new Set<PieceKey>(["intro-short", "outro-short"]);

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const [onlyPiece, onlyVariant] = args;

const seek = async (page: Page, t: number) => {
  const ok = await page.evaluate(async (tt) => {
    const w = window as unknown as { __seek?: (n: number) => void | Promise<void> };
    if (typeof w.__seek !== "function") return false;
    await w.__seek(tt);
    return true;
  }, t);
  if (!ok) throw new Error(`__seek missing at t=${t} on ${page.url()} -- the page never mounted`);
};

/** Run ffmpeg with PNG frames on stdin. Rejects on a non-zero exit. */
function encoder(out: string, size: { width: number; height: number }, alpha: boolean) {
  const ff = spawn("ffmpeg", [
    "-y", "-hide_banner", "-loglevel", "error",
    "-f", "image2pipe", "-framerate", String(FPS), "-i", "pipe:0",
    "-c:v", "prores_ks", "-profile:v", "4444",
    // yuva444p10le carries the alpha plane. Opaque pieces get a fully opaque
    // one, which costs a little size and keeps ONE code path instead of two.
    "-pix_fmt", alpha ? "yuva444p10le" : "yuv444p10le",
    "-s", `${size.width}x${size.height}`,
    out,
  ], { stdio: ["pipe", "ignore", "pipe"] });
  let err = "";
  ff.stderr.on("data", (d) => (err += d.toString()));
  const done = new Promise<void>((resolve, reject) => {
    ff.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}: ${err.slice(0, 500)}`))));
  });
  return { ff, done };
}

/** Read the finished file back. Reports of intent are not evidence. */
function inspect(file: string, alpha: boolean) {
  const probe = (entries: string) =>
    execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", entries, "-of", "default=nw=1:nk=1", file], {
      encoding: "utf8",
    }).trim();
  const frames = Number(probe("stream=nb_frames"));
  const [w, h] = probe("stream=width,height").split("\n").map(Number);

  // Does the piece DRAW anything? A uniformly flat luma across the whole clip
  // means it rendered nothing -- the failure that otherwise reaches the
  // timeline looking like a valid file.
  const stats = execFileSync("ffmpeg", [
    "-hide_banner", "-nostats", "-loglevel", "error", "-i", file,
    "-vf", "signalstats,metadata=print:file=-", "-f", "null", "-",
  ], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const yavgs = [...stats.matchAll(/YAVG=([\d.]+)/g)].map((m) => Number(m[1]));
  const spread = yavgs.length ? Math.max(...yavgs) - Math.min(...yavgs) : 0;

  // For an overlay, is there REAL transparency? alphaextract turns the alpha
  // plane into luma; a fully opaque file reads YMIN 255 and is a black
  // rectangle waiting to happen.
  // ALPHA IS NOT 8-BIT HERE, and assuming it was cost an hour.
  //
  // ProRes 4444 writes 12-bit alpha, so the plane runs 0..4095, not 0..255. A
  // correctly transparent file reads YMIN 256 -- about 6% of full scale -- and a
  // check hardcoded against 255 calls that "fully opaque" and fails a render
  // that is perfectly fine. The threshold has to come from the file's actual
  // depth, which ffprobe reports as `bits_per_raw_sample`.
  let alphaMin: number | null = null;
  let alphaPct: number | null = null;
  if (alpha) {
    const bits = Number(probe("stream=bits_per_raw_sample")) || 8;
    const maxval = (1 << bits) - 1;
    const a = execFileSync("ffmpeg", [
      "-hide_banner", "-nostats", "-loglevel", "error", "-i", file,
      "-vf", "alphaextract,signalstats,metadata=print:file=-", "-f", "null", "-",
    ], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    const mins = [...a.matchAll(/YMIN=(\d+)/g)].map((m) => Number(m[1]));
    if (!mins.length) throw new Error("alphaextract produced no readings; cannot judge transparency");
    alphaMin = Math.min(...mins);
    alphaPct = (alphaMin / maxval) * 100;
  }
  return { frames, w, h, samples: yavgs.length, spread, alphaMin, alphaPct };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const problems: string[] = [];
  let rendered = 0;

  const keys = (Object.keys(PIECES) as PieceKey[]).filter((k) => !onlyPiece || k === onlyPiece);
  if (keys.length === 0) {
    console.log(`no such piece "${onlyPiece}". known: ${Object.keys(PIECES).join(", ")}`);
    process.exit(2);
  }

  for (const key of keys) {
    const def = PIECES[key];
    const overlay = !FULL_FRAME.has(key);
    const size = VERTICAL.has(key) ? TALL : WIDE;
    const frames = Math.round(def.seconds * FPS);
    const variants = def.variants
      .map((v: { id: string }) => v.id)
      .filter((v: string) => !onlyVariant || v === onlyVariant);

    for (const variant of variants) {
      const file = join(OUT, `${key}--${variant}.mov`);
      const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      const pageErrors: string[] = [];
      page.on("pageerror", (e) => pageErrors.push(String(e)));

      const url = `${FRAME}?piece=${key}&variant=${variant}${overlay ? "&alpha=1" : ""}`;
      await page.goto(url, { waitUntil: "networkidle" });

      // SUPPRESS PAGE CHROME, or it gets baked into the furniture.
      //
      // This surface is dev-only by design (the route `notFound()`s in
      // production), so it always renders with dev chrome attached: the c15t
      // consent banner sits bottom-left, and Next's dev-issue badge sits beside
      // it. Both composited straight into a finished overlay and every numeric
      // check still passed -- frame count, dimensions, alpha floor, luma spread
      // were all correct on a file with a cookie dialog in it. It was caught by
      // LOOKING at a composite, which is the only reason this exists.
      await page.addStyleTag({
        content: `
          [class*="c15t-"], nextjs-portal, [data-nextjs-toast],
          #__next-build-watcher, [data-nextjs-dev-tools-button] { display: none !important; }
        `,
      });
      await page.evaluate(() => document.fonts.ready);

      // Assert it worked, rather than assume the selectors still match. Chrome
      // that moves to a new class name would otherwise silently return.
      const chrome = await page.evaluate(() => {
        const bad: string[] = [];
        for (const el of document.querySelectorAll("body *")) {
          if (el.closest("[data-piece-stage]")) continue;
          const r = el.getBoundingClientRect();
          if (r.width < 20 || r.height < 20) continue;
          const cs = getComputedStyle(el);
          if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) < 0.02) continue;
          bad.push(`${el.tagName.toLowerCase()}${el.className ? "." + String(el.className).split(" ")[0] : ""}`);
        }
        return [...new Set(bad)].slice(0, 4);
      });

      const { ff, done } = encoder(file, size, overlay);
      for (let i = 0; i < frames; i += 1) {
        await seek(page, i / FPS);
        // omitBackground only matters when the page itself is transparent --
        // which is what `?alpha=1` above arranges. Both halves, or neither works.
        const png = await page.screenshot({ omitBackground: overlay });
        if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once("drain", r));
      }
      ff.stdin.end();
      await done;
      await ctx.close();

      const got = inspect(file, overlay);
      const faults: string[] = [];
      if (got.frames !== frames) faults.push(`${got.frames} frames, expected ${frames}`);
      if (got.w !== size.width || got.h !== size.height) faults.push(`${got.w}x${got.h}, expected ${size.width}x${size.height}`);
      if (got.samples === 0) faults.push("no frames could be measured");
      // 99% of full scale, whatever the depth. An overlay whose most
      // transparent pixel is still essentially opaque IS the black rectangle.
      if (overlay && got.alphaPct !== null && got.alphaPct >= 99) {
        faults.push(`NO TRANSPARENCY -- most transparent pixel is ${got.alphaPct.toFixed(1)}% opaque; this is a black rectangle`);
      }
      if (pageErrors.length) faults.push(`page errors: ${pageErrors.slice(0, 2).join(" | ")}`);
      if (chrome.length) faults.push(`page chrome visible in the render: ${chrome.join(", ")}`);

      rendered += 1;
      const tag = overlay ? "overlay" : "full   ";
      if (faults.length) {
        problems.push(`${key}/${variant}: ${faults.join("; ")}`);
        console.log(`  FAIL ${tag} ${key}/${variant}`);
        for (const f of faults) console.log(`         !! ${f}`);
      } else {
        console.log(
          `  ok   ${tag} ${key}/${variant}  ${got.frames}f ${got.w}x${got.h}` +
            (overlay ? `  alpha floor ${got.alphaPct!.toFixed(1)}%` : "") +
            `  luma spread ${got.spread.toFixed(1)}`,
        );
      }
    }
  }

  await browser.close();
  console.log(`\nrendered ${rendered}   problems ${problems.length}   -> ${OUT}`);
  for (const p of problems) console.log(`  !! ${p}`);
  if (rendered === 0) {
    console.log("NOTHING WAS RENDERED. A render over an empty set reports success.");
    process.exit(1);
  }
  process.exit(problems.length === 0 ? 0 : 1);
}

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
void main();
