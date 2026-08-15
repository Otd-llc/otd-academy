// Check the EARN beat in every format against what the placement rule SAID it
// would do, not against numbers retyped into this file.
//
// The rule publishes its intended ink bounds on window.__cutPlaced; this reads
// the rendered ink back and diffs the two. That makes the check catch the case
// the arithmetic is right and the CSS is wrong, which is the failure a check
// written from the same numbers as the code cannot see.
//
//   node measure-cut.mjs <out-dir> [format ...]
import { mkdirSync } from "node:fs";

// Playwright and sharp are devDependencies of THIS repo, so they import normally.
// These six files used to reach them through
// `createRequire("C:/zzz/pf-beta/package.json")` -- a sibling repo that is not in
// this tree and not on most machines. Two of the six are GATES
// (measure-cut, chrome-overlay), so the hack did not merely break a renderer:
// it broke the checkers while leaving the renderer working, which is the worst
// possible way for a dependency to be missing.
import { chromium } from "playwright";
const OUT = process.argv[2];
const FORMATS = process.argv.slice(3);
const LIST = FORMATS.length ? FORMATS : ["wide", "band", "vertical", "square", "portrait"];
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ["--use-angle=gl", "--enable-gpu", "--ignore-gpu-blocklist"],
});

const rows = [];
for (const format of LIST) {
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1920 },
    deviceScaleFactor: 1,
    colorScheme: "dark",
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  // A missing per-format picture is the failure that looks like a dark frame.
  const missing = [];
  page.on("response", (r) => {
    if (r.url().includes("/_capture/cut/") && !r.ok()) missing.push(`${r.url().split("/").pop()} ${r.status()}`);
  });

  await page.goto(`http://localhost:3200/sandbox/capture/cut?format=${format}`, {
    waitUntil: "networkidle",
    timeout: 240_000,
  });
  try { await page.getByRole("button", { name: /reject all/i }).click({ timeout: 4000 }); } catch {}
  await page.addStyleTag({
    content: `nextjs-portal{display:none!important}.app-shell-header,footer{display:none!important}
      html,body{margin:0;padding:0;background:#08090d}`,
  });
  // undefined in the ARG slot. waitForFunction is (fn, arg, options): passing
  // the options object second makes it the argument and silently leaves the
  // default 30s timeout in place, which a cold Next route compile blows past.
  console.log(`- ${format}: loading`);
  try {
    await page.waitForFunction(() => window.__cutReady === true, undefined, { timeout: 90_000 });
  } catch {
    // Say WHAT did not arrive. "timed out" on its own sends you looking at the
    // wrong thing; a stalled video and a thrown effect look identical from here.
    const state = await page.evaluate(() => ({
      ready: window.__cutReady ?? null,
      stage: !!document.querySelector("[data-cut-stage]"),
      videos: [...document.querySelectorAll("[data-cut-stage] video")].map((v) => ({
        src: v.src.split("/").pop(),
        readyState: v.readyState,
        error: v.error ? v.error.code : null,
      })),
    }));
    console.error(`${format}: never became ready`, JSON.stringify(state, null, 1), errors.slice(0, 2), missing);
    process.exit(1);
  }
  await page.evaluate(() => document.fonts.ready);
  // 8.8, NOT 9.0. EARN's release ends at 8.66 and the ask settles at 8.59, so
  // both are at rest -- but 9.0 is a beat the swell HITS, and measuring a box
  // mid-pulse reports it 3.5% larger than the one that has to clear the card.
  // 8.8 sits at 31% of the ask's loop, between the entrance and the first hit.
  await page.evaluate(() => window.__cutSet(8.8));
  await page.waitForTimeout(150);

  const r = await page.evaluate(() => {
    const stage = document.querySelector("[data-cut-stage]");
    const F = stage.getBoundingClientRect();
    const ctx2 = document.createElement("canvas").getContext("2d");

    // Glyph ink, not the font box: Bebas's ascent and descent make the range
    // rect 1.3x the font size, which on a rhythm check is the whole answer.
    const ink = (el, border) => {
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      if (border) {
        return {
          l: ((rect.left - F.left) / F.width) * 100,
          t: ((rect.top - F.top) / F.height) * 100,
          r: ((rect.right - F.left) / F.width) * 100,
          b: ((rect.bottom - F.top) / F.height) * 100,
        };
      }
      const range = document.createRange();
      range.selectNodeContents(el);
      const rects = [...range.getClientRects()].filter((x) => x.width > 0 && x.height > 0);
      if (!rects.length) return null;
      const probe = document.createElement("span");
      probe.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline";
      el.appendChild(probe);
      const baseline = probe.getBoundingClientRect().top;
      probe.remove();
      const cs = getComputedStyle(el);
      ctx2.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      let s = el.textContent || "";
      if (cs.textTransform === "uppercase") s = s.toUpperCase();
      const m = ctx2.measureText(s.trim());
      if (!Number.isFinite(m.actualBoundingBoxAscent) || !Number.isFinite(m.actualBoundingBoxDescent)) return null;
      return {
        l: ((Math.min(...rects.map((x) => x.left)) - F.left) / F.width) * 100,
        t: ((baseline - m.actualBoundingBoxAscent - F.top) / F.height) * 100,
        r: ((Math.max(...rects.map((x) => x.right)) - F.left) / F.width) * 100,
        b: ((baseline + m.actualBoundingBoxDescent - F.top) / F.height) * 100,
      };
    };

    const round = (b) => (b ? { l: +b.l.toFixed(1), t: +b.t.toFixed(1), r: +b.r.toFixed(1), b: +b.b.toFixed(1) } : null);
    return {
      placed: window.__cutPlaced,
      gutters: (() => {
        const cs = getComputedStyle(document.getElementById("cuelayer"));
        return { cols: cs.gridTemplateColumns, rows: cs.gridTemplateRows };
      })(),
      // Every cue, not just the EARN slots: BUILD lives in c-br, which is
      // exactly where the platform action rail is.
      cues: [...document.querySelectorAll("#cuelayer .cue")].map((el) => {
        const F = document.querySelector("[data-cut-stage]").getBoundingClientRect();
        const r = el.getBoundingClientRect();
        return {
          cls: [...el.classList].filter((c) => c.startsWith("c-") || c.startsWith("s-")).join(" "),
          l: +(((r.left - F.left) / F.width) * 100).toFixed(1),
          t: +(((r.top - F.top) / F.height) * 100).toFixed(1),
          r: +(((r.right - F.left) / F.width) * 100).toFixed(1),
          b: +(((r.bottom - F.top) / F.height) * 100).toFixed(1),
        };
      }),
      size: { w: F.width, h: F.height },
      word: round(ink(document.querySelector(".s-word .k-word"), false)),
      ask: round(ink(document.querySelector(".s-ask .cta-box"), true)),
      link: round(ink(document.querySelector(".s-link .mark-url"), false)),
      // Nothing must be left on a grid cell: a slot cue that kept its cell
      // would look placed and be placed by the wrong thing.
      strays: [...document.querySelectorAll(".cue.slot")].filter((e) =>
        [...e.classList].some((c) => c.startsWith("c-")),
      ).length,
    };
  });

  await page.locator("[data-cut-stage]").screenshot({ path: `${OUT}/earn-${format}.png` });
  await ctx.close();
  rows.push({ format, ...r, errors, missing });
}
await browser.close();

const fail = [];
for (const r of rows) {
  const want = r.placed?.ink;
  const p = r.placed;
  console.log(
    `\n${r.format.padEnd(9)} ${p?.w}x${p?.h}  safe ${p?.safe}  gap ${p?.gap?.toFixed(2)}` +
      (r.missing.length ? `  MISSING PICTURE: ${r.missing.join(", ")}` : ""),
  );
  const line = (name, got, wantT, wantB) => {
    if (!got) { fail.push(`${r.format}: ${name} did not render`); console.log(`  ${name.padEnd(5)} MISSING`); return; }
    const dt = got.t - wantT;
    const db = got.b - wantB;
    console.log(
      `  ${name.padEnd(5)} ink ${String(got.t.toFixed(1)).padStart(5)} to ${String(got.b.toFixed(1)).padEnd(5)}` +
        `  wanted ${wantT.toFixed(1)} to ${wantB.toFixed(1)}  drift ${dt >= 0 ? "+" : ""}${dt.toFixed(2)} / ${db >= 0 ? "+" : ""}${db.toFixed(2)}` +
        `  x ${got.l.toFixed(1)} to ${got.r.toFixed(1)}`,
    );
    // 0.6 of a percent. Tight enough to catch a wrong constant, loose enough to
    // survive sub-pixel rounding at five different frame sizes.
    if (Math.abs(dt) > 0.6 || Math.abs(db) > 0.6) {
      fail.push(`${r.format}: ${name} is ${dt.toFixed(2)}/${db.toFixed(2)} off what the rule intended`);
    }
  };
  if (!want) { fail.push(`${r.format}: the stage published no placement`); continue; }
  line("word", r.word, want.wordTop, want.wordBottom);
  line("ask", r.ask, want.askTop, want.askBottom);
  line("link", r.link, want.linkTop, want.linkBottom);

  // THE CHROME BOX, not the safe rows. A platform paints its action rail and
  // its caption over the frame, so clearing our own margin proves nothing.
  const CH = {
    vertical: { top: 11.5, right: 16.7, bottom: 26, left: 5.6 },
  }[r.format];
  const box = CH
    ? { t: Math.max(p.safe, CH.top), r: 100 - Math.max(7, CH.right), b: 100 - Math.max(p.safe, CH.bottom), l: Math.max(7, CH.left) }
    : { t: p.safe, r: 96, b: 100 - p.safe, l: 4 };
  for (const [n, b] of Object.entries({ word: r.word, ask: r.ask, link: r.link })) {
    if (!b) continue;
    if (b.t < box.t - 1 || b.b > box.b + 1 || b.l < box.l - 1 || b.r > box.r + 1) {
      fail.push(`${r.format}: ${n} is outside the usable box (${b.l},${b.t} to ${b.r},${b.b} vs ${box.l},${box.t} to ${box.r},${box.b})`);
    }
  }
  // And every OTHER cue, which is where BUILD was found covered.
  if (CH) {
    for (const c of r.cues ?? []) {
      if (c.r > box.r + 1) fail.push(`${r.format}: cue [${c.cls}] reaches ${c.r}%, under the action rail (limit ${box.r}%)`);
      if (c.b > box.b + 1) fail.push(`${r.format}: cue [${c.cls}] reaches ${c.b}%, under the caption (limit ${box.b}%)`);
    }
  }
  if (r.strays) fail.push(`${r.format}: ${r.strays} slot cues still carry a grid cell`);
  // A gap the solver could not honour. The drift checks above compare the render
  // to the rule's own INTENT, so an impossible intent sails through all of them.
  if (typeof p.gap === "number" && p.gap < 2) {
    fail.push(`${r.format}: solved gap is ${p.gap.toFixed(2)}% - the stack does not fit and elements overlap`);
  }
  if (r.errors.length) fail.push(`${r.format}: page error ${r.errors[0]}`);
  if (r.missing.length) fail.push(`${r.format}: picture missing - ${r.missing.join(", ")}`);
}

if (fail.length) { console.error("\nFAIL:\n - " + fail.join("\n - ")); process.exit(1); }
console.log(`\nOK: ${rows.length} formats place their type where the rule said they would`);
