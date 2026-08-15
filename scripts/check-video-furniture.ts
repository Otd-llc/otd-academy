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
 * THE RULE THIS FILE IS BUILT ON, and the three bugs that bought it.
 *
 *   AN ASSERTION MAY ONLY COUNT ITSELF AFTER A COMPLETED MEASUREMENT, never on
 *   entry to a check.
 *
 * All three were live in this file and all three made a BLIND path look
 * identical to a CLEAN one from the outside:
 *
 *   1. The lower-third band assertion passed when nothing rendered. `readBox`
 *      returned null at every sample, `worst` stayed 0, `0 > BAND_TOP` was
 *      false, and the counter incremented anyway. Under `--mutate` `BAND_TOP`
 *      became 0, so `worst > 0` was ALSO false -- provably blind even under
 *      mutation. It now counts OBSERVATIONS and fails on zero.
 *   2. `page.evaluate(() => window.__seek?.(t))` was optional-chained. With
 *      `__seek` absent -- and the effect cleanup deletes it -- the call was a
 *      no-op, `data-settled` was already present from mount so `waitForSelector`
 *      returned instantly, and EVERY sample measured frame 0 while every
 *      assertion counted itself. `seek` now awaits the contract and throws.
 *   3. `--mutate` exited 0 if ANY assertion fired. The first chapter variant
 *      failed immediately, so everything after it was free to be blind. Every
 *      id must now fire, and the ones that did not are printed.
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

// ---- ASSERTION LEDGER -----------------------------------------------------
// A bare counter cannot tell "ran and passed" from "never ran". So every check
// declares its id UP FRONT, from the same data the loops iterate, and files a
// verdict only once it has actually measured something. Three things then
// become visible that a counter hides: an id that was planned and never filed,
// a group whose data set is empty so nothing was planned at all, and (under
// --mutate) an id that failed to fail.
const planned: string[] = [];
const filed = new Set<string>();
const failedIds = new Set<string>();

/** Declare ids this run intends to check. Call before measuring. */
const plan = (group: string, ids: string[]) => {
  if (ids.length === 0) {
    // A check over an empty set reports success. Catching this per GROUP
    // matters: the global "assertions === 0" guard only fires when EVERY group
    // is empty, which is the one case that never happens in practice.
    problems.push(`plan/${group}: nothing to check -- the variant set is empty`);
  }
  planned.push(...ids);
  return ids;
};

/** File a verdict for an id. Only ever called after a completed measurement. */
const file = (id: string, problem?: string) => {
  filed.add(id);
  if (problem) {
    failedIds.add(id);
    problems.push(problem);
  }
};

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

/**
 * The ONE settle contract: await the promise `__seek` returns.
 *
 * This used to be `__seek?.(t)` followed by `waitForSelector("[data-settled]")`
 * -- two contracts, and the weaker one silently won. Optional chaining turned a
 * missing `__seek` into a no-op instead of an error, and `data-settled` is
 * present at mount, so the wait returned immediately and every sample in the
 * run measured frame 0 while every assertion counted itself.
 *
 * Throwing here is the point. A rig that cannot drive the page must stop, not
 * quietly measure the same frame 800 times.
 */
const seek = async (page: Page, t: number) => {
  const ok = await page.evaluate(async (tt) => {
    const w = window as unknown as { __seek?: (n: number) => Promise<void> };
    if (typeof w.__seek !== "function") return false;
    await w.__seek(tt);
    return true;
  }, t);
  if (!ok) {
    throw new Error(
      `__seek is not installed on ${page.url()} at t=${t}. The page never mounted, or it ` +
        `unmounted mid-run. NOT a pass: no measurement was taken.`,
    );
  }
};

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1 });
  const page = await ctx.newPage();

  // ---- 1. CHAPTER: geometry across the whole scrub -------------------------
  const chapterVariants = PIECES.chapter.variants.map((v: { id: string }) => v.id);
  plan("chapter-geometry", chapterVariants.map((v: string) => `chapter/${v}/geometry`));
  for (const variant of chapterVariants) {
    const id = `chapter/${variant}/geometry`;
    await page.goto(`${FRAME}?piece=chapter&variant=${variant}`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    let box: Box | null = null;
    let seen = 0;
    for (let t = 0; t <= PIECES.chapter.seconds + 1e-9; t += 0.1) {
      await seek(page, t);
      const r = await readBox(page, "[data-chapter]");
      if (!r) continue;
      seen += 1;
      box = box
        ? { x0: Math.min(box.x0, r.x0), x1: Math.max(box.x1, r.x1), y0: Math.min(box.y0, r.y0), y1: Math.max(box.y1, r.y1) }
        : { x0: r.x0, x1: r.x1, y0: r.y0, y1: r.y1 };
    }
    if (!box || seen === 0) {
      file(id, `chapter/${variant}: never rendered across the whole scrub (${seen} observations)`);
      continue;
    }
    const faults: string[] = [];
    if (box.x0 < SAFE - 1e-6 || box.y0 < SAFE - 1e-6 || box.x1 > 1 - SAFE + 1e-6 || box.y1 > 1 - SAFE + 1e-6) {
      faults.push("outside graphics safe");
    }
    for (const [name, w] of Object.entries(WELLS_16X9)) {
      if (overlap(box, w) > 1e-9) faults.push(`overlaps end-screen well ${name}`);
    }
    if (variant === "notch" && (box.x0 < NOTCH_16X9.left - 1e-6 || box.x1 > NOTCH_16X9.right + 1e-6)) {
      faults.push("outside the notch-safe x band");
    }
    // Filed once, after the measurement completed, carrying every fault found.
    file(id, faults.length ? `chapter/${variant}: ${faults.join("; ")} (${seen} observations)` : undefined);
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
  plan(
    "chapter-cut",
    chapterVariants.flatMap((v: string) => STAGE_ORDER.map((s) => `chapter/${v}/${s}/cut`)),
  );
  for (const variant of chapterVariants) {
    for (const stage of STAGE_ORDER) {
      const id = `chapter/${variant}/${stage}/cut`;
      await page.goto(`${FRAME}?piece=chapter&variant=${variant}&stage=${stage}`, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      await seek(page, 0.5);
      const before = await readBox(page, "[data-chapter]");
      await seek(page, 3.0);
      const after = await readBox(page, "[data-chapter]");
      // Both reads must have LANDED before this is a measurement at all. With
      // one of them null the comparison below is vacuously "no cut", which
      // reports the right verdict for the wrong reason and hides a piece that
      // never rendered.
      if (!before || !after) {
        file(id, `chapter/${variant} @ ${stage}: nothing rendered at t=${!before ? "0.5" : "3.0"}; no measurement taken`);
        continue;
      }
      const faults: string[] = [];
      const cut = before.text !== after.text;
      if (MUTATE ? cut : !cut) {
        faults.push(cut ? "cut fired (mutation expected none)" : "no cut across t=2.0");
      }
      // The line must not MOVE when it changes - a right-anchored variable
      // string drags every glyph with it, which is the 16px travel ceiling.
      const shift = Math.abs(before.x0 - after.x0) * VIEW.width;
      if (!MUTATE && shift > 16) {
        faults.push(`line shifts ${shift.toFixed(0)}px at the cut (ceiling 16px)`);
      }
      file(id, faults.length ? `chapter/${variant} @ ${stage}: ${faults.join("; ")}` : undefined);
    }
  }

  // ---- 2b. THE MIXER'S OWN INVARIANTS, headless ----------------------------
  // These need no browser and are the cheapest checks in the file, which is
  // exactly why they are worth having: the rules they enforce are the ones that
  // decay silently.
  // These two used to have NO mutation knob, so `--mutate` could never make
  // them fail. That is indistinguishable from their being blind, and once every
  // id is required to fire it would have been a permanent false alarm. They now
  // invert their expectation like every other check in the file: under
  // --mutate, a HEALTHY repo is the failure.
  plan("meter", ["meter/frame-legal"]);
  {
    const ok = isFrameLegal(BPM);
    file(
      "meter/frame-legal",
      (MUTATE ? ok : !ok) ? `meter: ${BPM} BPM is ${ok ? "" : "not "}frame-legal at 24/30/60` : undefined,
    );
  }

  // The non-accumulation rule, which used to be prose in a plan - the form a
  // convention takes right before it erodes.
  plan("accumulation", ["videotypes/no-accumulation"]);
  {
    const accum = assertNoAccumulation();
    const ok = accum.length === 0;
    file(
      "videotypes/no-accumulation",
      (MUTATE ? ok : !ok) ? `videotypes: ${ok ? "no accumulation found" : accum.join("; ")}` : undefined,
    );
  }

  // Every seeded direction must be dialable: durations on the legal grid for
  // the tempo. At 120 BPM that is whole beats and triplets - a beat is 15
  // frames at 30 fps and cannot be halved.
  const gridIds: string[] = [];
  for (const spec of Object.values(TYPES)) {
    for (const d of spec.directions) {
      d.entry.forEach((e, i) => gridIds.push(`videotypes/${spec.id}/${d.id}/${i}`));
    }
  }
  plan("videotypes-grid", gridIds);
  for (const spec of Object.values(TYPES)) {
    for (const d of spec.directions) {
      d.entry.forEach((e, i) => {
        const id = `videotypes/${spec.id}/${d.id}/${i}`;
        const ok = onGrid(e.durationBeats) && onGrid(e.offsetBeats);
        file(
          id,
          (MUTATE ? ok : !ok)
            ? `videotypes/${spec.id}/${d.id}: ${e.kind} -> ${e.target} is ${ok ? "ON" : "off"} the frame grid ` +
              `(dur ${e.durationBeats}, offset ${e.offsetBeats} beats; finest legal step is ${finestStep()})`
            : undefined,
        );
      });
    }
  }

  // ---- 2c. THE LOOP SEAM ---------------------------------------------------
  // A vertical short LOOPS - Shorts counts every replay as a view, Instagram
  // counts replays inside watch time - so the outro's job is not to end but to
  // cut back to the first frame invisibly. That is a measurable property, and
  // measuring it is the only way "it loops nicely" stops being a feeling.
  //
  // Compared as PIXELS, at 9:16, because that is the delivery the loop is for.
  const outroShortVariants = PIECES["outro-short"].variants.map((v: { id: string }) => v.id);
  plan("loop-seam", outroShortVariants.map((v: string) => `outro-short/${v}/loop-seam`));
  for (const variant of outroShortVariants) {
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

    // Two screenshots of identical size are required before the compare means
    // anything; an empty buffer would compare equal to another empty buffer.
    if (first.length === 0 || last.length === 0) {
      file(`outro-short/${variant}/loop-seam`, `outro-short/${variant}: a screenshot came back empty; no comparison made`);
      continue;
    }
    const same = Buffer.compare(first, last) === 0;
    file(
      `outro-short/${variant}/loop-seam`,
      (MUTATE ? same : !same)
        ? `outro-short/${variant}: the last frame does ${same ? "" : "not "}match the intro's first, so the loop ` +
          `${same ? "is seamless (mutation expected a cut)" : "shows a cut. Everything must retire before the seam."}`
        : undefined,
    );
  }

  // ---- 3. LOWER THIRDS: out of the caption band ----------------------------
  // THE BUG THIS CARRIES A SCAR FROM. `worst` started at 0 and only moved when
  // a box was read. With nothing rendering, `worst` stayed 0, `0 > BAND_TOP`
  // was false, and the check passed having measured nothing -- while still
  // counting itself. Under `--mutate`, BAND_TOP becomes 0 and `worst > 0` is
  // ALSO false, so it was blind in both directions: the one failure a mutation
  // run is supposed to be incapable of missing.
  //
  // The fix is not a better threshold. It is counting OBSERVATIONS, so that
  // "nothing rendered" and "everything was in bounds" stop producing the same
  // verdict.
  for (const piece of ["lower"] as const) {
    plan(
      "lower-band",
      PIECES[piece].variants.map((v: { id: string }) => `${piece}/${v.id}/caption-band`),
    );
    for (const v of PIECES[piece].variants) {
      const id = `${piece}/${v.id}/caption-band`;
      await page.goto(`${FRAME}?piece=${piece}&variant=${v.id}`, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      let worst = 0;
      let seen = 0;
      for (let t = 0; t <= PIECES[piece].seconds + 1e-9; t += 0.1) {
        await seek(page, t);
        const r = await readBox(page, "[data-lower-third]");
        if (!r) continue;
        seen += 1;
        worst = Math.max(worst, r.y1);
      }
      if (seen === 0) {
        file(id, `${piece}/${v.id}: never rendered across the whole scrub; the band assertion measured nothing`);
        continue;
      }
      // NO `MUTATE ?` INVERSION HERE, deliberately. There are two mutation
      // styles in this file and mixing them cancels them out. A check with a
      // THRESHOLD knob mutates by moving the threshold: `BAND_TOP` becomes 0,
      // the band covers the frame, and every variant that renders anything
      // must fire. A check with no knob (the cut, the grid) has to invert its
      // expectation instead. Inverting this one on top of the moved threshold
      // made all 24 go silent under `--mutate` -- caught by requiring every id
      // to fire, which is the whole reason that requirement exists.
      const over = worst > BAND_TOP;
      file(
        id,
        over
          ? `${piece}/${v.id}: enters the caption band ` +
            `(worst y ${worst.toFixed(4)} vs ${BAND_TOP}, ${seen} observations)`
          : undefined,
      );
    }
  }

  await browser.close();

  // ---- THE LEDGER ----------------------------------------------------------
  const neverFiled = planned.filter((id) => !filed.has(id));
  for (const id of neverFiled) {
    problems.push(`${id}: PLANNED BUT NEVER FILED A VERDICT -- the check did not run`);
  }

  console.log(`\nplanned: ${planned.length}   filed: ${filed.size}   problems: ${problems.length}`);
  for (const p of problems) console.log(`  !! ${p}`);

  if (planned.length === 0) {
    console.log("\nNOTHING WAS CHECKED. A check over an empty set reports success.");
    process.exit(1);
  }

  if (MUTATE) {
    // "Any assertion fired" was the old bar, and it was met by the FIRST chapter
    // variant -- after which every other check in the file was free to be blind
    // and the run still exited 0. Every id must now fail under mutation, and
    // the ones that did not are named.
    const silent = planned.filter((id) => !failedIds.has(id));
    if (silent.length === 0) {
      console.log(`\nMutation run: all ${planned.length} assertions fired. Every check is live.`);
      process.exit(0);
    }
    console.log(`\nMutation run: ${silent.length} of ${planned.length} assertions DID NOT FIRE - these are blind:`);
    for (const id of silent) console.log(`  ?? ${id}`);
    process.exit(1);
  }

  console.log(problems.length === 0 ? "\nAll furniture geometry and cut behaviour holds." : "");
  process.exit(problems.length === 0 ? 0 : 1);
}

void main();
