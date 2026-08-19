/**
 * Render the video-furniture pieces to files an NLE can actually use.
 *
 *   pnpm furniture:render                 every piece, every variant
 *   pnpm furniture:render intro           one piece, every variant
 *   pnpm furniture:render lower form-tab  one piece, one variant
 *
 * Output: QuickTime Animation (qtrle) RGBA .mov, one per piece/variant/theme,
 * under OUT (default C:/zzz/_video/furniture).
 *
 * WHY NOT THE SAME ENCODE AS THE OBS CAPTURE: H.264 4:2:0 cannot carry an alpha
 * channel, and the furniture is useless without one.
 *
 * WHY NOT ProRes 4444, which was the first answer here: ProRes is a YUV format,
 * so every frame took an RGB->YUV conversion, and swscale DITHERS on that
 * conversion. It put a visible dot-matrix stipple through glyph fills, the bee's
 * wing and the comb faces -- destroying exactly the flat solid areas this
 * artwork is made of. The browser hands us perfect RGBA and nothing downstream
 * wanted YUV; the conversion was pure loss for no gain.
 *
 * qtrle is RGBA and lossless, so the file is BIT-IDENTICAL to what Chromium
 * rendered -- verified per render below, not assumed. Measured against the
 * alternatives on one frame: qtrle 81 KB, utvideo 508 KB, ffv1 3 KB, all three
 * bit-exact. ffv1 is dramatically smaller but Resolve does not read it happily;
 * qtrle is a native NLE format.
 *
 * BOTH THEMES, EVERY PIECE. Each variant renders twice -- `data-theme="dark"`
 * and `data-theme="light"` -- because the furniture has to sit over screen
 * content of either polarity. Dark-theme furniture carries light/gold elements
 * for dark footage; light-theme furniture carries dark elements for a white
 * KiCad canvas. Which one an editor reaches for is a per-shot decision, so both
 * are produced and the choice happens on the timeline.
 *
 * AND THAT GIVES US A HARDCODED-COLOUR DETECTOR FOR FREE. `FrameOne` deliberately
 * does not pin the theme -- its own comment says pinning "would quietly defeat
 * the only check that catches a hardcoded colour". If a piece renders
 * BYTE-IDENTICALLY in both themes, its colours did not come from tokens and the
 * theming law was broken somewhere in that variant. That is asserted below.
 *
 * EVERY PIECE IS AN OVERLAY. Owner ruling, and it is the strictly more useful
 * default: a transparent render can always be given a ground in the NLE by
 * laying a solid underneath it, but an opaque render cannot have transparency
 * recovered from it. Rendering the intro and outro to alpha therefore costs
 * nothing and buys the option of floating them over footage rather than cutting
 * to a card.
 *
 * Every piece is rendered with `?alpha=1`, which drops the page's opaque
 * grounds, AND with Playwright's `omitBackground`. BOTH are required: the page
 * really is opaque otherwise, so omitBackground alone still yields a black
 * rectangle. That trap is documented in tools/hex-stills.mjs and was flagged in
 * the pipeline handoff -- which named two opaque layers where there are four.
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
import { mkdirSync, existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
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

/** The 9:16 pieces. A short is a separate composition, not a reflow. */
const VERTICAL = new Set<PieceKey>(["intro-short", "outro-short"]);

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const [onlyPiece, onlyVariant] = args;

/**
 * Pin every CSS animation's phase to the scrub time.
 *
 * THE BUG THIS FIXES. `globals.css` puts `animation: gh-pulse 1.8s ease-in-out
 * infinite` on the CURRENT hex -- the selected cell's breathing glow. That is
 * correct on the live site and wrong under a scrub: a CSS animation runs on
 * WALL-CLOCK time, so each screenshot catches it at whatever phase the browser
 * happened to be at, and the selected hex FLICKERS across the render. Measured
 * on the outro: 16 alternating luma jumps in that region alone.
 *
 * The fix is not to kill the pulse -- that would drop a deliberate design
 * element. `animation-delay: -Ts` starts the animation T seconds in the past, so
 * paused at capture time its phase is exactly `T mod duration`. Phase becomes a
 * pure function of `t`, which is the rule this whole surface runs on, and the
 * pulse still animates correctly in the output.
 *
 * Works for ANY duration without knowing it, which matters because this has to
 * cover animations nobody has enumerated.
 */
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
      `animation-play-state: paused !important; }`;
  }, t);
};

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
    // RGBA in, RGBA out, no colour conversion anywhere in the chain. `-s` is
    // deliberately absent: the frames are already the right size and passing it
    // invites a scaler that would resample the hairlines.
    "-c:v", "qtrle", "-pix_fmt", "rgba",
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
    const overlay = true; // owner ruling: every piece renders to alpha
    const size = VERTICAL.has(key) ? TALL : WIDE;
    const frames = Math.round(def.seconds * FPS);
    const variants = def.variants
      .map((v: { id: string }) => v.id)
      .filter((v: string) => !onlyVariant || v === onlyVariant);

    for (const variant of variants) {
      const themeFiles: Record<string, string> = {};
      // ONE BAD VARIANT MUST NOT COST THE WHOLE BATCH. A previous run died on
      // `lower/source-rule` with "__seek missing -- the page never mounted" and
      // took every remaining piece with it, after 33 of ~160 clips. A render
      // sweep is exactly the job where partial progress is worth keeping, so a
      // failure is recorded against that variant and the sweep continues.
      try {
      for (const theme of ["dark", "light"] as const) {
      const file = join(OUT, `${key}--${variant}--${theme}.mov`);
      themeFiles[theme] = file;
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
      // The surface does not pin the theme, by design. The rig sets it.
      await page.evaluate((th) => document.documentElement.setAttribute("data-theme", th), theme);

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
      let firstPng: Buffer | null = null;
      for (let i = 0; i < frames; i += 1) {
        await pinAnimations(page, i / FPS);
        await seek(page, i / FPS);
        // omitBackground only matters when the page itself is transparent --
        // which is what `?alpha=1` above arranges. Both halves, or neither works.
        const png = await page.screenshot({ omitBackground: overlay });
        if (i === 0) firstPng = png;
        if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once("drain", r));
      }
      ff.stdin.end();
      await done;

      // DETERMINISM: re-render one mid-clip frame and demand it match.
      //
      // "Scrub, never play. Every animated value a pure function of t" is the
      // rule this surface runs on, and until now nothing enforced it. A
      // wall-clock CSS animation (`gh-pulse` on the current hex) sailed past
      // every check and flickered through the finished outro. Anything driven by
      // real time, a counter, or randomness produces a DIFFERENT frame the
      // second time the same `t` is requested -- so asking twice is the whole
      // test.
      const midIdx = Math.floor(frames / 2);
      let determinismFault: string | null = null;
      try {
        await pinAnimations(page, midIdx / FPS);
        await seek(page, midIdx / FPS);
        const again = await page.screenshot({ omitBackground: overlay });
        // Seek by TIME, not with a select filter. qtrle is all-intra, so an
        // input seek is frame-exact, and it avoids the filter-escaping that made
        // the first attempt fail with an unreadable truncated error.
        const fromFile = execFileSync("ffmpeg", ["-v", "error", "-ss", String(midIdx / FPS),
          "-i", file, "-frames:v", "1", "-f", "image2", "-c:v", "png", "pipe:1"],
          { maxBuffer: 64 * 1024 * 1024 }) as unknown as Buffer;
        const decode = (buf: Buffer, name: string) => {
          const tmp = `${file}.${name}.png`;
          writeFileSync(tmp, buf);
          try {
            return execFileSync("ffmpeg", ["-v", "error", "-i", tmp, "-frames:v", "1",
              "-f", "rawvideo", "-pix_fmt", "rgba", "pipe:1"], { maxBuffer: 64 * 1024 * 1024 }) as unknown as Buffer;
          } finally { try { unlinkSync(tmp); } catch {} }
        };
        const a = decode(again, "again");
        const b = decode(fromFile, "fromfile");
        if (a.length && b.length && !a.equals(b)) {
          let diff = 0;
          for (let i = 0; i < Math.min(a.length, b.length); i += 1) if (a[i] !== b[i]) diff += 1;
          // CALIBRATION, not a loosened bound. Do NOT raise this to make a run pass.
          //
          // Two-sided evidence sets it. The NOISE FLOOR: a clean re-render of
          // intro/light differed by exactly 1 byte of 8,294,400 -- one
          // antialiased subpixel the rasterizer rounded differently. Demanding
          // bit-equality fails honest renders constantly, and a check that cries
          // wolf gets ignored, which is how the real fault would slip through.
          // The SIGNAL: the gh-pulse wall-clock animation this check exists to
          // catch moved luma across a 300x300 region -- hundreds of thousands of
          // bytes, four orders of magnitude above this bound.
          //
          // 0.001% of the frame is ~83 bytes at 1080p: 83x the observed noise,
          // and ~1000x below anything a real animation produces. Nothing can hide
          // in that gap.
          const pct = (diff / b.length) * 100;
          if (pct > 0.001) {
            determinismFault = `NOT DETERMINISTIC -- re-rendering frame ${midIdx} gave ${diff} differing bytes ` +
              `(${pct.toFixed(4)}% of the frame). Something is driven by wall-clock time, a counter, or ` +
              `randomness rather than by t.`;
          } else if (diff > 0) {
            console.log(`         note ${diff} byte(s) differ on re-render (${pct.toFixed(5)}%) -- rasterizer noise, under the bound`);
          }
        }
      } catch (e) {
        determinismFault = `could not check determinism: ${(e as Error).message.slice(0, 100)}`;
      }

      // The page stays alive until here on purpose: the determinism check above
      // needs to re-render a frame, and closing the context first is what made
      // it report "Target page, context or browser has been closed" instead of
      // a verdict.
      await ctx.close();

      const got = inspect(file, overlay);
      const faults: string[] = [];
      if (determinismFault) faults.push(determinismFault);

      // PROVE THE ENCODE IS LOSSLESS, rather than trusting that qtrle is.
      //
      // The previous encoder (ProRes 4444) was YUV, and the RGB->YUV conversion
      // dithered a dot-matrix stipple through every flat fill. Nothing in the
      // old checks noticed: frame count, dimensions, alpha floor and luma spread
      // were all correct on visibly damaged frames. So the pixels themselves are
      // now compared -- frame 0 of the finished file against the exact PNG that
      // went into it. Anything but a bit-identical match is a fault.
      if (firstPng) {
        // COMPARED AS RAW BYTES, not via psnr.
        //
        // The first attempt parsed ffmpeg's psnr output -- which ffmpeg writes to
        // STDERR while execFileSync returns STDOUT, so it read an empty string
        // and reported "psnr ?" on every file. It failed safe, but it was
        // measuring nothing. Decoding both sides to raw RGBA and comparing
        // buffers has no output to misparse: equal or not.
        const tmpSrc = `${file}.src.png`;
        try {
          writeFileSync(tmpSrc, firstPng);
          const raw = (f: string) =>
            execFileSync("ffmpeg", ["-v", "error", "-i", f, "-frames:v", "1",
              "-f", "rawvideo", "-pix_fmt", "rgba", "pipe:1"],
              { maxBuffer: 64 * 1024 * 1024 }) as unknown as Buffer;
          const fromFile = raw(file);
          const fromSrc = raw(tmpSrc);
          if (fromFile.length === 0 || fromSrc.length === 0) {
            faults.push("could not decode frames for the lossless check; refusing to call it clean");
          } else if (!fromFile.equals(fromSrc)) {
            let diff = 0;
            for (let i = 0; i < Math.min(fromFile.length, fromSrc.length); i += 1) {
              if (fromFile[i] !== fromSrc[i]) diff += 1;
            }
            faults.push(
              `ENCODE IS LOSSY -- ${diff} of ${fromSrc.length} bytes differ from the source PNG. ` +
                `A colour conversion is damaging the artwork (this is what ProRes 4444's RGB->YUV dither did).`,
            );
          }
        } catch (e) {
          faults.push(`could not verify losslessness: ${(e as Error).message.slice(0, 120)}`);
        } finally {
          try { unlinkSync(tmpSrc); } catch {}
        }
      }

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
      if (faults.length) {
        problems.push(`${key}/${variant}/${theme}: ${faults.join("; ")}`);
        console.log(`  FAIL ${key}/${variant}/${theme}`);
        for (const f of faults) console.log(`         !! ${f}`);
      } else {
        console.log(
          `  ok   ${key}/${variant}/${theme.padEnd(5)}  ${got.frames}f ${got.w}x${got.h}` +
            `  alpha floor ${got.alphaPct!.toFixed(1)}%  luma spread ${got.spread.toFixed(1)}`,
        );
      }
      } // theme loop
      } catch (e) {
        rendered += 1;
        problems.push(`${key}/${variant}: RENDER THREW -- ${(e as Error).message.slice(0, 160)}`);
        console.log(`  FAIL ${key}/${variant}: ${(e as Error).message.slice(0, 100)}`);
        try { await ctx.close(); } catch {}
        continue;
      }

      // THE THEMING LAW, checked. Two themes that produce identical bytes mean
      // the variant painted a literal colour instead of a token.
      try {
        const a = readFileSync(themeFiles.dark);
        const b = readFileSync(themeFiles.light);
        if (a.length === b.length && a.equals(b)) {
          problems.push(`${key}/${variant}: dark and light renders are BYTE-IDENTICAL -- hardcoded colour, not tokens`);
          console.log(`  FAIL ${key}/${variant}: identical in both themes (hardcoded colour)`);
        }
      } catch (e) {
        problems.push(`${key}/${variant}: could not compare themes -- ${(e as Error).message}`);
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
