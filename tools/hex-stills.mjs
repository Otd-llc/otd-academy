// Configurator art for the /hex landing page, in two kinds.
//
//   ui/     what the tool LOOKS LIKE -- chrome, buttons, the real thing.
//   clean/  the cluster alone on transparency, for a hero or a figure.
//
// Driven against the LOCAL dev server rather than production because the dev
// build exposes the app's own modules, so a cluster can be built by calling
// placeCell and the camera framed by calling fitToBox. Deterministic: re-run it
// and the framing is identical, which is what stops the page's art drifting
// away from the product it advertises.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const APP = "http://localhost:5180/hex";
const OUT = "public/hex"; // run from the repo root: node tools/hex-stills.mjs
mkdirSync(`${OUT}/ui`, { recursive: true });
mkdirSync(`${OUT}/clean`, { recursive: true });

const SHOTS = [
  {
    name: "trio",
    cells: [
      [0, 0],
      [1, 0],
      [0, 1],
    ],
  },
  {
    name: "flower",
    cells: [
      [0, 0],
      [1, 0],
      [1, -1],
      [0, -1],
      [-1, 0],
      [-1, 1],
      [0, 1],
    ],
  },
  {
    name: "strip",
    cells: [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
    ],
  },
];

/** Build the cluster and frame it. Returns once the scene has settled.
 *
 *  Framing is done by hand rather than with `controls.fitToBox`, which was the
 *  first attempt and came out wrong twice over: its padding is in WORLD units,
 *  and this scene is in metres, so the 0.35 that looked like a sensible margin
 *  was nearly twice the width of the cluster and shoved the camera into the next
 *  county. It also re-aimed the camera, flattening the default three-quarter
 *  view to an edge-on one.
 *
 *  So: keep the app's own azimuth and elevation exactly as shipped -- that view
 *  is a deliberate choice and it reads well -- and only change the DISTANCE, to
 *  the one that makes the cluster's bounding sphere fill `fill` of the frame. */
async function build(page, cells, fill) {
  await page.evaluate(
    async ({ cells, fill }) => {
      // NOT `import("three")`: a bare specifier does not resolve at runtime, and
      // Vite only rewrites those in files it serves, not in an injected script.
      // Nothing here needs THREE anyway -- camera-controls can do the fit.
      const { placeCell } = await import("/src/hex/cells.ts");
      const { controls, cellsContainer } = await import("/src/hex/scene.ts");
      for (const [q, r] of cells) placeCell(q, r);
      // A frame, so the freshly-cloned meshes have world matrices before their
      // bounds are read. Measuring first silently yields an empty box.
      await new Promise((r) => requestAnimationFrame(() => r(null)));

      // fitToSphere, not fitToBox: it re-centres and re-distances while LEAVING
      // THE CAMERA'S AIM ALONE, which is the whole difference. fitToBox aimed
      // down an axis and flattened the shipped three-quarter view to edge-on.
      await controls.fitToSphere(cellsContainer, false);
      // fitToSphere fits the sphere exactly; back off so the cluster occupies
      // `fill` of the frame instead of touching the edges.
      controls.dollyTo(controls.distance / fill, false);
    },
    { cells, fill },
  );
  await page.waitForTimeout(2500); // damping + the shadow pass
}

const browser = await chromium.launch();

// ---- what the tool looks like -------------------------------------------
for (const theme of ["dark", "light"]) {
  for (const shot of SHOTS) {
    const ctx = await browser.newContext({
      viewport: { width: 1600, height: 1000 },
      deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();
    // Before boot: the app reads the theme in a no-flash inline script, so
    // setting it later would capture a repaint.
    await page.addInitScript((t) => {
      try {
        localStorage.setItem("otd-theme", t);
      } catch {
        /* private mode */
      }
    }, theme);
    await page.goto(APP, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(9000);
    // The idle prompt is a timed nudge for a real visitor and pure noise in a
    // still. Everything else stays: this shot exists to show the interface.
    await page.addStyleTag({
      content: "#idle-prompt, #ghost-tip, #hint { display: none !important; }",
    });
    await build(page, shot.cells, 0.62);
    const file = `${OUT}/ui/${shot.name}-${theme}.png`;
    await page.screenshot({ path: file });
    console.log(file);
    await ctx.close();
  }
}

// ---- the cluster alone, on transparency ---------------------------------
// ONE file per shape, not one per theme: a transparent PNG sits on whatever
// the page is, so it cannot be wrong in either theme.
for (const shot of SHOTS) {
  const ctx = await browser.newContext({
    viewport: { width: 1600, height: 1200 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  // `bg=transparent` makes the RENDERER clear to alpha 0. That is necessary and
  // not sufficient: the document still paints its own background behind the
  // canvas, and `omitBackground` only suppresses the browser's default white.
  // Both have to go or the result is a black rectangle with a cluster on it.
  await page.goto(`${APP}?bg=transparent`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(9000);
  await page.addStyleTag({
    content: `
      html, body { background: transparent !important; }
      #header, #toolbar, #inspector, #idle-prompt, #ghost-tip, #hint,
      #crosshair, #action-sheet, .long-press-indicator { display: none !important; }
    `,
  });
  await build(page, shot.cells, 0.88);
  const file = `${OUT}/clean/${shot.name}.png`;
  await page.screenshot({ path: file, omitBackground: true });
  console.log(file);
  await ctx.close();
}

await browser.close();
