// The LEARN plate, captured at each format's own viewport. LOCAL ONLY.
//
// WHY NOT CROP THE WIDE ONE. The exam plate's content occupies 22 to 78 percent
// of a 2560px frame, so a centre crop to 9:16 keeps 810px of it and slices every
// question in half. Scaling it to fit instead makes 30px body text render at
// 13px in a 1080-wide frame. The page is responsive, so the honest answer is to
// let it reflow at the target viewport and photograph that.
//
// The session is the SYNTHETIC persona minted by scripts/_promo-session.ts. The
// local database is a restore of production, so the neighbouring rows are real
// people; that script refuses to run against anything but localhost and this one
// never touches a real account.
//
//   node capture-plates.mjs <out-dir> <session-token> <exam-key.json> <format> [format ...]
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";

const req = createRequire("C:/zzz/pf-beta/package.json");
const { chromium } = req("playwright");

const OUT = process.argv[2];
const TOKEN = process.argv[3];
const KEY = JSON.parse(readFileSync(process.argv[4], "utf8").replace(/^\uFEFF/, ""));
const FORMATS = process.argv.slice(5);

// The CSS viewport each format is photographed at, and the scale that takes it
// to the render size. 2x on the narrow ones for the same reason the wide plate
// is 2x: the beat pushes in, and a plate captured at 1:1 goes soft the moment
// it does.
const VIEWPORT = {
  vertical: { w: 540, h: 960, scale: 2 },
  square: { w: 540, h: 540, scale: 2 },
  portrait: { w: 540, h: 675, scale: 2 },
};

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ["--use-angle=gl", "--enable-gpu", "--ignore-gpu-blocklist"] });

for (const format of FORMATS) {
  const v = VIEWPORT[format];
  if (!v) throw new Error(`no viewport for format "${format}"`);

  const ctx = await browser.newContext({
    viewport: { width: v.w, height: v.h },
    deviceScaleFactor: v.scale,
    colorScheme: "dark",
    locale: "en-US",
    timezoneId: "UTC",
  });
  await ctx.addCookies([
    { name: "authjs.session-token", value: TOKEN, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" },
    { name: "theme", value: "dark", domain: "localhost", path: "/" },
  ]);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto("http://localhost:3200/learn/l1-01-wroom-breakout/exam", {
    waitUntil: "networkidle",
    timeout: 240_000,
  });
  try { await page.getByRole("button", { name: /reject all/i }).click({ timeout: 6000 }); } catch {}
  // Header and footer OFF. The wide plate has neither, and on a 960px-tall
  // viewport the footer is a third of the frame: the page simply runs out of
  // content below the last question, so scrolling it into view drags the site
  // furniture in with it. Hidden BEFORE the scroll is computed, or the scroll
  // is measured against a document that is about to change height.
  await page.addStyleTag({
    content: `nextjs-portal{display:none!important}
      .app-shell-header,header,footer{display:none!important}
      *{scroll-behavior:auto!important}
      *,*::before,*::after{animation-play-state:paused!important}`,
  });
  await page.evaluate(() => document.fonts.ready);

  // THE OPTIONS ARE BUTTONS, NOT RADIOS. The honeycomb ExamForm renders
  // `div.qzh-opts[data-qid] > button.qzh-opt[role=radio][aria-checked]`. The
  // older plate script drove `input[type=radio]`, which now matches nothing, so
  // it would have answered zero questions and photographed a blank exam without
  // failing. Assert the shape rather than trusting it.
  const shape = await page.evaluate(() => ({
    groups: document.querySelectorAll("div.qzh-opts[data-qid]").length,
    opts: document.querySelectorAll("button.qzh-opt").length,
    url: location.pathname,
  }));
  if (!shape.groups || !shape.opts) {
    throw new Error(
      `${format}: found ${shape.groups} question groups and ${shape.opts} options at ${shape.url}. ` +
        `Either the session cookie did not take or ExamForm's markup changed.`,
    );
  }

  const prep = await page.evaluate((key) => {
    const groups = [...document.querySelectorAll("div.qzh-opts[data-qid]")];
    const byId = new Map(key.map((k) => [k.id, k.correctIndex]));
    const last = groups[groups.length - 1];
    let answered = 0;
    for (const g of groups) {
      if (g === last) continue;
      const i = byId.get(g.dataset.qid);
      if (i === undefined) continue;
      const opts = [...g.querySelectorAll("button.qzh-opt")];
      opts[i]?.click();
      answered += 1;
    }
    return {
      questions: groups.length,
      answered,
      lastQid: last.dataset.qid,
      lastCorrect: byId.get(last.dataset.qid),
    };
  }, KEY);
  // A key that does not line up with the rendered ids answers nothing and the
  // plate silently becomes a blank form.
  if (prep.answered !== prep.questions - 1) {
    throw new Error(`${format}: answered ${prep.answered} of ${prep.questions - 1} - the key does not match the rendered question ids`);
  }

  // Scroll so the last question and the submit button are both in frame, then
  // pick its right answer, which is the state the wide plate is in.
  const shot = await page.evaluate(([qid, correctIdx]) => {
    const g = document.querySelector(`div.qzh-opts[data-qid="${CSS.escape(qid)}"]`);
    const fieldset = g.closest("fieldset") ?? g;
    // Aim the SUBMIT BUTTON at the lower third rather than the question at the
    // upper third. With the footer gone the document ends just past the button,
    // so scrolling by the question overshoots into blank page on short
    // viewports; scrolling by the last thing on the page cannot.
    const submit = [...document.querySelectorAll("button")].find((b) => /submit exam/i.test(b.textContent || ""));
    const anchor = submit ?? fieldset;
    const want = anchor.getBoundingClientRect().bottom + window.scrollY - window.innerHeight * 0.88;
    document.scrollingElement.scrollTop = Math.max(0, want);
    const target = [...g.querySelectorAll("button.qzh-opt")][correctIdx ?? 0];
    const r = target.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, [prep.lastQid, prep.lastCorrect]);

  await page.mouse.click(shot.x, shot.y);
  await page.waitForTimeout(180);
  const checked = await page.evaluate(() => document.querySelectorAll('button.qzh-opt[aria-checked="true"]').length);
  if (checked < 1) throw new Error(`${format}: nothing reads as chosen after clicking`);

  // The frame must be exam, top to bottom. Anything empty below the submit
  // button means the scroll hit the document end and the plate has a dead band
  // that a push-in will only make more obvious.
  const fill = await page.evaluate(() => {
    const submit = [...document.querySelectorAll("button")].find((b) => /submit exam/i.test(b.textContent || ""));
    const r = submit?.getBoundingClientRect();
    return { submitBottom: r ? r.bottom / window.innerHeight : null, scrollMax: document.scrollingElement.scrollTopMax ?? null };
  });
  if (fill.submitBottom !== null && fill.submitBottom < 0.72) {
    throw new Error(
      `${format}: the submit button ends at ${(fill.submitBottom * 100).toFixed(0)}% of the frame, ` +
        `so the bottom ${(100 - fill.submitBottom * 100).toFixed(0)}% is empty page`,
    );
  }
  const path = `${OUT}/exam-${format}.png`;
  await page.screenshot({ path });
  await ctx.close();
  console.log(JSON.stringify({ format, viewport: v, ...prep, checked, path, errors: errors.slice(0, 2) }));
}

await browser.close();
console.log("OK");
