// Draw the platform furniture over the real frame, before and after.
//
// A number saying "BUILD ends at 61.9% and the rail starts at 83.3%" is correct
// and unconvincing. This paints the rail and the caption block onto the actual
// render at the actual beat, so the clearance is something you look at.
//
// The zones are the worst case across TikTok, Reels and Shorts, which is what
// the placement rule was given. They are approximations of a moving target;
// the point is the margin, not the pixel.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";

const req = createRequire("C:/zzz/pf-beta/package.json");
const { chromium } = req("playwright");
const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });

// Percent of the 1080x1920 frame.
const ZONES = [
  { id: "rail", label: "action rail 180px", l: 83.3, t: 25, r: 100, b: 88, fill: "rgba(239,83,80,.28)" },
  { id: "caption", label: "caption + channel 500px", l: 0, t: 74, r: 100, b: 100, fill: "rgba(74,143,255,.26)" },
  { id: "top", label: "top chrome 220px", l: 0, t: 0, r: 100, b: 11.5, fill: "rgba(200,150,62,.22)" },
];

const browser = await chromium.launch({ args: ["--use-angle=gl", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await (
  await browser.newContext({ viewport: { width: 1200, height: 2000 }, deviceScaleFactor: 1, colorScheme: "dark" })
).newPage();

await page.goto("http://localhost:3200/sandbox/capture/cut?format=vertical", {
  waitUntil: "networkidle",
  timeout: 300_000,
});
try { await page.getByRole("button", { name: /reject all/i }).click({ timeout: 4000 }); } catch {}
await page.addStyleTag({
  content: `nextjs-portal{display:none!important}.app-shell-header,header,footer{display:none!important}
    html,body{margin:0;padding:0;background:#08090d}`,
});
await page.waitForFunction(() => window.__cutReady === true, undefined, { timeout: 300_000 });
await page.evaluate(() => document.fonts.ready);

await page.evaluate((zones) => {
  const stage = document.querySelector("[data-cut-stage]");
  const wrap = document.createElement("div");
  wrap.id = "chrome-zones";
  wrap.style.cssText = "position:absolute;inset:0;z-index:900;pointer-events:none";
  for (const z of zones) {
    const d = document.createElement("div");
    d.style.cssText =
      `position:absolute;left:${z.l}%;top:${z.t}%;width:${z.r - z.l}%;height:${z.b - z.t}%;` +
      `background:${z.fill};outline:2px dashed rgba(255,255,255,.55);outline-offset:-2px`;
    const cap = document.createElement("span");
    cap.textContent = z.label;
    cap.style.cssText =
      "position:absolute;left:6px;top:6px;font:600 15px ui-monospace,monospace;color:#fff;" +
      "text-shadow:0 1px 4px #000;letter-spacing:.06em";
    d.appendChild(cap);
    wrap.appendChild(d);
  }
  stage.appendChild(wrap);
}, ZONES);

// 4.6 = the BUILD beat, the one that was covered.
for (const [name, t] of [["build", 4.6], ["earn", 8.8]]) {
  await page.evaluate((tt) => window.__cutSet(tt), t);
  await page.waitForTimeout(400);
  await page.locator("[data-cut-stage]").screenshot({ path: `${OUT}/chrome-${name}.png` });
  console.log(`  shot ${name} at t=${t}`);
}

// And the numbers behind it.
const clear = await page.evaluate(() => {
  const F = document.querySelector("[data-cut-stage]").getBoundingClientRect();
  const out = [];
  for (const el of document.querySelectorAll("#cuelayer .cue")) {
    const r = el.getBoundingClientRect();
    if (r.width < 1) continue;
    const cls = [...el.classList].filter((c) => c.startsWith("c-") || c.startsWith("s-")).join(" ");
    out.push({
      cls,
      right: +(((r.right - F.left) / F.width) * 100).toFixed(1),
      bottom: +(((r.bottom - F.top) / F.height) * 100).toFixed(1),
    });
  }
  return out;
});
console.log("\n  cue extents against rail 83.3% and caption 74%:");
for (const c of clear) {
  console.log(
    `    ${c.cls.padEnd(16)} right ${String(c.right).padStart(5)}%  bottom ${String(c.bottom).padStart(5)}%` +
      `  ${c.right > 83.3 ? "UNDER RAIL" : c.bottom > 74 ? "UNDER CAPTION" : "clear"}`,
  );
}
await browser.close();
