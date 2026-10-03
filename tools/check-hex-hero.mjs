// The /hex hero under reduced motion fetches NO video; otherwise it plays.
//
//   node tools/check-hex-hero.mjs [http://localhost:3000]
//
// Plan 4.3: "Playwright reducedMotion:'reduce' asserts zero .mp4 requests".
// A poster-only hero is a promise to the visitor who asked for it; this is
// the measurement. Exit 1 on any failure.
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://localhost:3000";
const browser = await chromium.launch();
const problems = [];

async function visit(reducedMotion, colorScheme = "dark") {
  const ctx = await browser.newContext({
    reducedMotion,
    colorScheme,
    viewport: { width: 1280, height: 900 },
  });
  const page = await ctx.newPage();
  const mp4 = [];
  page.on("request", (r) => {
    if (/\.mp4(\?|$)/.test(r.url())) mp4.push(r.url());
  });
  await page.goto(`${base}/hex`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const state = await page.evaluate(() => {
    const read = (sel) => {
      const v = document.querySelector(sel);
      if (!v) return null;
      return {
        preload: v.preload,
        paused: v.paused,
        readyState: v.readyState,
        poster: v.poster,
        display: getComputedStyle(v).display,
        autoplayAttr: v.hasAttribute("autoplay"),
      };
    };
    return {
      theme: document.documentElement.dataset.theme ?? "dark",
      dark: read('video[data-loop="dark"]'),
      light: read('video[data-loop="light"]'),
    };
  });
  await ctx.close();
  return { mp4, state };
}

const reduced = await visit("reduce");
console.log(
  "[hero] reduced motion:",
  JSON.stringify(reduced.state),
  "mp4 requests:",
  reduced.mp4.length,
);
if (!reduced.state?.dark) problems.push("reduced: no dark video element");
else {
  if (reduced.mp4.length !== 0)
    problems.push(
      `reduced: ${reduced.mp4.length} mp4 request(s): ${reduced.mp4.join(", ")}`,
    );
  for (const k of ["dark", "light"]) {
    if (!reduced.state[k].paused)
      problems.push(`reduced: ${k} clip is playing`);
    if (reduced.state[k].autoplayAttr)
      problems.push(`reduced: ${k} autoplay attribute present in HTML`);
    if (!reduced.state[k].poster) problems.push(`reduced: ${k} has no poster`);
  }
}

// Both themes: the VISIBLE clip plays, the hidden one is never loaded.
for (const scheme of ["dark", "light"]) {
  const r = await visit("no-preference", scheme);
  console.log(
    `[hero] ${scheme} scheme:`,
    JSON.stringify(r.state),
    "mp4 requests:",
    r.mp4.length,
  );
  if (!r.state?.dark || !r.state?.light) {
    problems.push(`${scheme}: missing a video element`);
    continue;
  }
  const shown = r.state.theme === "light" ? "light" : "dark";
  const hidden = shown === "light" ? "dark" : "light";
  if (r.mp4.length < 1)
    problems.push(`${scheme}: the clip was never requested`);
  if (r.state[shown].display === "none")
    problems.push(
      `${scheme}: the ${shown} clip is hidden under the ${shown} theme`,
    );
  if (r.state[shown].paused)
    problems.push(`${scheme}: the visible ${shown} clip did not start`);
  if (r.state[hidden].display !== "none")
    problems.push(
      `${scheme}: the ${hidden} clip is visible under the ${shown} theme`,
    );
  if (r.state[hidden].readyState !== 0)
    problems.push(
      `${scheme}: the hidden ${hidden} clip was loaded (readyState ${r.state[hidden].readyState})`,
    );
  const wrong = r.mp4.filter((u) =>
    hidden === "light" ? /-light\.mp4/.test(u) : !/-light\.mp4/.test(u),
  );
  if (wrong.length)
    problems.push(`${scheme}: fetched the hidden ${hidden} clip: ${wrong[0]}`);
}

await browser.close();
if (problems.length) {
  for (const p of problems) console.error(`[hero] FAIL ${p}`);
  process.exit(1);
}
console.log(
  "[hero] ok: reduced motion fetched nothing and showed the poster; normal played",
);
