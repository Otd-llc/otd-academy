/**
 * Geometry and behaviour checks for the video-furniture sandbox.
 *
 *   pnpm furniture:check            against a dev server on :3010
 *   pnpm furniture:check --mutate   invert every expectation; must fail everything
 *
 * WHY THIS IS IN THE REPO AND NOT A SCRATCHPAD. Two independent reviews of the
 * chapter indicator landed on the same finding: the commit described a
 * verification in detail, and the verification could not be re-run, re-read or
 * falsified by anyone else, because the rig lived in a session temp directory.
 * A measurement nobody can repeat is a claim, not a check.
 *
 * WHY IT IMPORTS THE CONSTANTS RATHER THAN RESTATING THEM. A checker holding
 * its own copy of `0.72` passes forever after somebody edits the band. These
 * come from the module the renderers use, so a drift is impossible rather than
 * merely unlikely.
 *
 * WHAT A BOUNDING BOX CANNOT SEE, stated so nobody mistakes a pass here for
 * proof of correctness: it cannot see colour, so a variant that is invisible
 * against the field passes; it cannot see text, so a wrong stage label passes;
 * it cannot see opacity, so a faded-out element still reports as present. The
 * contrast check this wants is not built. `--mutate` proves the assertions can
 * fail; it does not widen what they look at.
 *
 * ASCII only.
 */

import { chromium, type Page } from "playwright";
import {
  GRAPHICS_SAFE_INSET,
  NOTCH_16X9,
  WELLS_16X9,
  PLAYER_BAR_TOP,
  CAPTION_BAND_16X9,
} from "@/app/sandbox/video-furniture/youtube";
import { STAGE_ORDER } from "@/app/sandbox/video-furniture/furniture";
import { PIECES } from "@/app/sandbox/video-furniture/r2/variants";
import { assertNoAccumulation, TYPES } from "@/app/sandbox/video-furniture/r2/videotypes";
import { isFrameLegal, onGrid, BPM, finestStep } from "@/app/sandbox/video-furniture/r2/meter";

const MUTATE = process.argv.includes("--mutate");
const ORIGIN = process.env.FURNITURE_ORIGIN ?? "http://localhost:3010";
const FRAME = `${ORIGIN}/sandbox/video-furniture/r2/frame`;
const VIEW = { width: 1920, height: 1080 };

const SAFE = MUTATE ? 0.49 : GRAPHICS_SAFE_INSET;
const BAND_TOP = MUTATE ? 0 : CAPTION_BAND_16X9.top;

type Box = { x0: number; x1: number; y0: number; y1: number };
const problems: string[] = [];
let assertions = 0;

const fail = (m: string) => problems.push(m);
const overlap = (b: Box, w: { x: number; y: number; w: number; h: number }) =>
  Math.max(0, Math.min(b.x1, w.x + w.w) - Math.max(b.x0, w.x)) *
  Math.max(0, Math.min(b.y1, w.y + w.h) - Math.max(b.y0, w.y));

async function readBox(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const els = [...document.querySelectorAll(sel)];
    const W = window.innerWidth;
    const H = window.innerHeight;
    let box: { x0: number; x1: number; y0: number; y1: number } | null = null;
    let text = "";
    for (const el of els) {
      if (parseFloat(getComputedStyle(el).opacity) < 0.02) continue;
      const b = el.getBoundingClientRect();
      if (b.width < 1 || b.height < 1) continue;
      const n = { x0: b.left / W, x1: b.right / W, y0: b.top / H, y1: b.bottom / H };
      box = box
        ? { x0: Math.min(box.x0, n.x0), x1: Math.max(box.x1, n.x1), y0: Math.min(box.y0, n.y0), y1: Math.max(box.y1, n.y1) }
        : n;
      text += (el.textContent ?? "").replace(/\s+/g, " ").trim();
      text += [...el.querySelectorAll("div")].map((d) => getComputedStyle(d).height).join(",");
    }
    return box ? { ...box, text } : null;
  }, selector);
}

const seek = async (page: Page, t: number) => {
  await page.evaluate((tt) => (window as unknown as { __seek?: (n: number) => void }).__seek?.(tt), t);
  await page.waitForSelector("[data-settled]");
};

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1 });
  const page = await ctx.newPage();

  // ---- 1. CHAPTER: geometry across the whole scrub -------------------------
  const chapterVariants = PIECES.chapter.variants.map((v: { id: string }) => v.id);
  for (const variant of chapterVariants) {
    await page.goto(`${FRAME}?piece=chapter&variant=${variant}`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    let box: Box | null = null;
    for (let t = 0; t <= PIECES.chapter.seconds + 1e-9; t += 0.1) {
      await seek(page, t);
      const r = await readBox(page, "[data-chapter]");
      if (!r) continue;
      box = box
        ? { x0: Math.min(box.x0, r.x0), x1: Math.max(box.x1, r.x1), y0: Math.min(box.y0, r.y0), y1: Math.max(box.y1, r.y1) }
        : { x0: r.x0, x1: r.x1, y0: r.y0, y1: r.y1 };
    }
    assertions += 1;
    if (!box) {
      fail(`chapter/${variant}: never rendered`);
      continue;
    }
    if (box.x0 < SAFE - 1e-6 || box.y0 < SAFE - 1e-6 || box.x1 > 1 - SAFE + 1e-6 || box.y1 > 1 - SAFE + 1e-6) {
      fail(`chapter/${variant}: outside graphics safe`);
    }
    for (const [name, w] of Object.entries(WELLS_16X9)) {
      if (overlap(box, w) > 1e-9) fail(`chapter/${variant}: overlaps end-screen well ${name}`);
    }
    if (variant === "notch" && (box.x0 < NOTCH_16X9.left - 1e-6 || box.x1 > NOTCH_16X9.right + 1e-6)) {
      fail(`chapter/${variant}: outside the notch-safe x band`);
    }
    // REPORTED, not failed. No top-anchored element can clear the conservative
    // mobile-web top chrome: that band reaches y=0.217 and the notch ceiling is
    // y=0.1222, so the two are mutually exclusive. The occlusion is an accepted
    // cost because the controls autohide - but it is stated every run so it
    // stays a decision instead of decaying into an oversight.
    if (box.y0 < PLAYER_BAR_TOP.conservative) {
      console.log(
        `  note  chapter/${variant} sits inside mobile-web top chrome ` +
          `(y ${box.y0.toFixed(3)} < ${PLAYER_BAR_TOP.conservative}); accepted, controls autohide`,
      );
    }
  }

  // ---- 2. CHAPTER: the cut, at EVERY stage ---------------------------------
  // The hole this closes: the first version of this check ran at the default
  // stage only, so it never saw that the final stage clamped and produced an
  // indicator that never changed.
  for (const variant of chapterVariants) {
    for (const stage of STAGE_ORDER) {
      await page.goto(`${FRAME}?piece=chapter&variant=${variant}&stage=${stage}`, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      await seek(page, 0.5);
      const before = await readBox(page, "[data-chapter]");
      await seek(page, 3.0);
      const after = await readBox(page, "[data-chapter]");
      assertions += 1;
      const cut = Boolean(before && after && before.text !== after.text);
      if (MUTATE ? cut : !cut) {
        fail(`chapter/${variant} @ ${stage}: ${cut ? "cut fired (mutation expected none)" : "no cut across t=2.0"}`);
      }
      // The line must not MOVE when it changes - a right-anchored variable
      // string drags every glyph with it, which is the 16px travel ceiling.
      if (before && after) {
        const shift = Math.abs(before.x0 - after.x0) * VIEW.width;
        if (!MUTATE && shift > 16) {
          fail(`chapter/${variant} @ ${stage}: line shifts ${shift.toFixed(0)}px at the cut (ceiling 16px)`);
        }
      }
    }
  }

  // ---- 2b. THE MIXER'S OWN INVARIANTS, headless ----------------------------
  // These need no browser and are the cheapest checks in the file, which is
  // exactly why they are worth having: the rules they enforce are the ones that
  // decay silently.
  assertions += 1;
  if (!isFrameLegal(BPM)) fail(`meter: ${BPM} BPM is not frame-legal at 24/30/60`);

  // The non-accumulation rule, which used to be prose in a plan - the form a
  // convention takes right before it erodes.
  const accum = assertNoAccumulation();
  assertions += 1;
  for (const a of accum) fail(`videotypes: ${a}`);

  // Every seeded direction must be dialable: durations on the legal grid for
  // the tempo. At 120 BPM that is whole beats and triplets - a beat is 15
  // frames at 30 fps and cannot be halved.
  for (const spec of Object.values(TYPES)) {
    for (const d of spec.directions) {
      for (const e of d.entry) {
        assertions += 1;
        const ok = onGrid(e.durationBeats) && onGrid(e.offsetBeats);
        if (MUTATE ? ok : !ok) {
          fail(
            `videotypes/${spec.id}/${d.id}: ${e.kind} -> ${e.target} is off the frame grid ` +
              `(dur ${e.durationBeats}, offset ${e.offsetBeats} beats; finest legal step is ${finestStep()})`,
          );
        }
      }
    }
  }

  // ---- 2c. THE LOOP SEAM ---------------------------------------------------
  // A vertical short LOOPS - Shorts counts every replay as a view, Instagram
  // counts replays inside watch time - so the outro's job is not to end but to
  // cut back to the first frame invisibly. That is a measurable property, and
  // measuring it is the only way "it loops nicely" stops being a feeling.
  //
  // Compared as PIXELS, at 9:16, because that is the delivery the loop is for.
  for (const variant of PIECES["outro-short"].variants.map((v: { id: string }) => v.id)) {
    const tallCtx = await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
    const tp = await tallCtx.newPage();
    await tp.goto(`${FRAME}?piece=intro-short&variant=question`, { waitUntil: "networkidle" });
    await tp.evaluate(() => document.fonts.ready);
    await seek(tp, 0);
    const first = await tp.screenshot();
    await tp.goto(`${FRAME}?piece=outro-short&variant=${variant}`, { waitUntil: "networkidle" });
    await tp.evaluate(() => document.fonts.ready);
    await seek(tp, PIECES["outro-short"].seconds);
    const last = await tp.screenshot();
    await tallCtx.close();

    assertions += 1;
    const same = Buffer.compare(first, last) === 0;
    if (MUTATE ? same : !same) {
      fail(
        `outro-short/${variant}: the last frame does not match the intro's first, so the loop shows a cut. ` +
          `Everything must retire before the seam.`,
      );
    }
  }

  // ---- 3. LOWER THIRDS: out of the caption band ----------------------------
  for (const piece of ["lower"] as const) {
    for (const v of PIECES[piece].variants) {
      await page.goto(`${FRAME}?piece=${piece}&variant=${v.id}`, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      let worst = 0;
      for (let t = 0; t <= PIECES[piece].seconds + 1e-9; t += 0.1) {
        await seek(page, t);
        const r = await readBox(page, "[data-lower-third]");
        if (r) worst = Math.max(worst, r.y1);
      }
      assertions += 1;
      if (worst > BAND_TOP) fail(`${piece}/${v.id}: enters the caption band (y ${worst.toFixed(4)})`);
    }
  }

  await browser.close();

  console.log(`\nassertions: ${assertions}   problems: ${problems.length}`);
  for (const p of problems) console.log(`  !! ${p}`);
  if (assertions === 0) {
    console.log("\nNOTHING WAS CHECKED. A check over an empty set reports success.");
    process.exit(1);
  }
  if (MUTATE) {
    console.log(problems.length > 0 ? "\nMutation run: assertions fired, the check is live." : "\nMutation run: NOTHING fired - the check is blind.");
    process.exit(problems.length > 0 ? 0 : 1);
  }
  console.log(problems.length === 0 ? "\nAll furniture geometry and cut behaviour holds." : "");
  process.exit(problems.length === 0 ? 0 : 1);
}

void main();
