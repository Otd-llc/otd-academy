// Promotional cuts of the configurator loop, at the aspect ratios the /hex hero
// clip cannot serve.
//
// SIBLING OF tools/hex-video.mjs, NOT A REPLACEMENT FOR IT. That file generates
// the two clips the /hex page ships and is pinned to that page's framing; it is
// deliberately left alone. Everything it learned the hard way is carried over
// here verbatim -- the virtual clock, the sealed ghost group, the rest poll, the
// beats-on-rotation-angle -- because none of those traps are aspect-specific and
// re-deriving them is how the judder comes back. Read hex-video.mjs for WHY each
// of those exists; this file only explains what is different.
//
// WHAT IS DIFFERENT
//
//   1. The viewport is a PRESET, and framing is per-preset. `fitToSphere` fits
//      the bounding sphere to whichever screen dimension is tighter, so the
//      dolly multiplier tuned against 16:10 does not transfer. A portrait
//      viewport fits to WIDTH and leaves the subject small with dead space above
//      and below; a 16:9 one fits to HEIGHT. Hence `dolly` and `lift` per preset,
//      measured with `--probe` rather than assumed.
//   2. Output lands OUTSIDE every repo, in `c:/zzz/_hex-promo`. These cuts are
//      destined for four different destinations (apex, the org profile README,
//      the personal README, social) and none of them is this repo. Nothing here
//      should add weight to the academy deploy.
//   3. An animated WebP is emitted alongside the mp4 for the README preset.
//      GitHub README markdown will not autoplay a repo-hosted mp4 -- it renders
//      as a dead link -- so a README needs an animated image or nothing.
//
// USAGE
//   node tools/hex-promo-cuts.mjs --probe                  every preset, one frame
//   node tools/hex-promo-cuts.mjs --preset=vertical        one cut, dark
//   node tools/hex-promo-cuts.mjs --preset=readme --light  one cut, ivory
//   node tools/hex-promo-cuts.mjs --preset=square --frames=60   short look, no encode
import { chromium } from "playwright";
import { mkdirSync, rmSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";

const APP = "http://localhost:5180/hex";
const RAW =
  "C:/Users/raven/AppData/Local/Temp/claude/c--zzz-project-foundry/72976a86-a815-4dda-92f1-e921b785f9be/scratchpad/hexcuts";
const OUT = "C:/zzz/_hex-promo";

const SECONDS = 10;

// `dolly` multiplies the fitted distance: BIGGER pulls the camera back. `lift`
// raises the subject in frame as a fraction of that distance, POSITIVE up.
// Both start from the 16:10 hero's proven 1.06 / 0.06 and are corrected per
// aspect from the probe frames.
// EVERY `dolly` HERE IS LARGER THAN `fitToSphere` SUGGESTS, and that is the
// whole point. The fit is computed against the cluster's bounding SPHERE, which
// under-covers its actual silhouette: the cluster is a wedge of three tiles with
// a stack of parts floating over one of them, so at some azimuths the corners
// reach well outside the sphere's screen projection. Measured over a full
// revolution at the hero's own numbers, all five presets ran off an edge --
// landscape off the top (the floating stack), portrait and square off the sides
// (the neighbour tiles). The values below are the measured fix, targeting about
// a tenth of the frame as margin at the worst azimuth.
//
// Landscape pays for this in empty sides: the binding constraint at 16:9 is the
// HEIGHT of the exploded stack, so clearing it leaves the cluster spanning a
// little over half the width. That is the choreography's shape, not a framing
// error -- the alternative is a shorter explode, which is the thing the clip is
// there to show.
const PRESETS = {
  // 16:9 -- apex hero, YouTube.
  wide: { w: 1920, h: 1080, dolly: 1.22, lift: 0.03 },
  // ---- aspect <= 1: fitToSphere fits to WIDTH, and lift is measured in a
  // distance that is now much larger, so BOTH hero numbers have to change.
  //
  // LIFT GOES TO ZERO on all three. The 0.06 that reads as a gentle nudge at
  // 16:10 travels far more pixels here, because the offset is a fraction of a
  // camera distance that grew when the fit switched to the narrow axis. On the
  // square probe it pushed the floating lid clean off the top edge; an earlier
  // 0.16 on vertical put the subject's centre at 27% of frame height with two
  // thirds of the frame empty below it. Centred is also simply the right
  // composition on these surfaces: the platform's own title and caption
  // furniture claims the top and bottom, so the geometry belongs in the middle.
  //
  // DOLLY GOES OUT for margin. At 1.0 the neighbour tiles already touch both
  // side edges, and the widest beat of the choreography is wider still.
  vertical: { w: 1080, h: 1920, dolly: 1.24, lift: 0 },
  // 1:1 -- X and LinkedIn feed.
  square: { w: 1080, h: 1080, dolly: 1.24, lift: 0 },
  // 4:5 -- LinkedIn and Instagram feed.
  portrait: { w: 1080, h: 1350, dolly: 1.24, lift: 0 },
  // 16:10 at README width. Captured small on purpose: this one becomes an
  // animated WebP, where every pixel is bytes in someone's README render.
  readme: { w: 960, h: 600, dolly: 1.24, lift: 0.03 },
};

// The animated-WebP recipe, README preset only. 15fps and 720px are a size
// decision, not a quality one: 300 frames of 960px lossy WebP is several MB,
// which is a slow README. Halving the rate and scaling down holds it near 1 MB
// and the loop is slow enough that 15fps does not read as choppy.
//
// READMES BAKE THE DARK FIELD IN, deliberately, and two rejected alternatives
// are why. A dark cut plus an ivory cut switched by `<picture>` on
// `prefers-color-scheme` LOOKS correct and is not: that media query reports the
// OS preference while GitHub has its own theme picker, so a viewer on
// GitHub-dark with a light OS gets the ivory image on a dark page. GitHub's
// `#gh-dark-mode-only` fragments do follow its own theme but are deprecated and
// GitHub-only, so a README rendered on npm or a blog loses them.
//
// A transparent capture fixes both and costs too much: measured on the same 300
// frames, alpha came out at 2023 KB against 587 KB opaque, and quality is nearly
// irrelevant to that (q55 saved only 107 KB) because per-frame alpha defeats the
// inter-frame compression. Dropping to 12fps/640 still left 1337 KB. Roughly
// double the bytes on every README view was not worth it.
const WEBP = { fps: 15, width: 720, quality: 72 };

const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`));
const flag = (name) => process.argv.includes(`--${name}`);

const PROBE = flag("probe");
const THEME = flag("light") ? "light" : "dark";
const suffix = THEME === "light" ? "-light" : "";

const presetArg = arg("preset")?.split("=")[1];
if (!PROBE && !arg("check") && !presetArg) {
  console.error(
    `--preset= is required (or --probe, or --check=<frame dir>). ` +
      `One of: ${Object.keys(PRESETS).join(", ")}`,
  );
  process.exit(1);
}
if (presetArg && !PRESETS[presetArg]) {
  console.error(
    `unknown preset "${presetArg}". One of: ${Object.keys(PRESETS).join(", ")}`,
  );
  process.exit(1);
}

const capArg = arg("frames");
const TOTAL = capArg ? Number(capArg.split("=")[1]) : SECONDS * 30;

mkdirSync(OUT, { recursive: true });

/** Boot the app at a given viewport with the clock replaced and the theme
 *  pinned, then hide every scrap of chrome. Returns a page ready to be driven.
 *
 *  The chrome rule is the belt-and-braces one from hex-video.mjs and it matters
 *  more here, not less: a named id list goes stale, and these cuts are shot from
 *  a configurator under active development. Hiding every direct child of <body>
 *  that is not the canvas is what survives the next widget. */
async function boot(browser, { w, h }) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  page.on("console", (m) => {
    const t = m.text();
    if (t.startsWith("[capture]")) console.log(t);
  });

  await page.addInitScript(() => {
    const real = performance.now.bind(performance);
    let virtual = 0;
    let driving = false;
    window.__clock = {
      start() {
        virtual = real();
        driving = true;
      },
      advance(ms) {
        virtual += ms;
      },
    };
    performance.now = () => (driving ? virtual : real());
  });
  await page.addInitScript((t) => {
    try {
      localStorage.setItem("otd-theme", t);
    } catch {
      /* private mode */
    }
  }, THEME);

  await page.goto(APP, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(11000); // three.js, models, first paint

  await page.addStyleTag({
    content: `
      body > *:not(canvas):not(script) { display: none !important; }
      #header, #toolbar, #inspector, #idle-prompt, #ghost-tip, #hint,
      #crosshair, #action-sheet, #export-modal, .long-press-indicator,
      #hex-palette, #hex-compass, #loading { display: none !important; }
    `,
  });
  return { ctx, page };
}

/** Place the opening cluster and frame the camera against the WIDEST moment.
 *
 *  Leaves the scene AT that widest moment when `stayWide` is set, which is what
 *  `--probe` screenshots: the framing decision is about the frame that has the
 *  most in it, so that is the frame worth looking at before paying for 300 of
 *  them.
 *
 *  "WIDEST" HAS TO MEAN WHAT THE CUT WILL ACTUALLY SHOW. The first version of
 *  this probe returned as soon as the camera was fitted, which rendered the
 *  app's full ring of SIX ghost wires and none of the caps -- so it
 *  simultaneously overstated the extent (a ring of wireframe the cut never
 *  contains, sprawling past both edges) and understated it (the caps stand
 *  proud of the perimeter and are the thing most likely to clip). Two errors in
 *  opposite directions is worse than either alone, because the frame looked
 *  plausible and was wrong about the only question being asked. So the probe
 *  now dresses the scene exactly as the choreography's widest beat leaves it:
 *  exploded, two neighbours, three caps, two ghosts.
 *
 *  Framing runs BEFORE the recording window for the reason hex-video.mjs found
 *  the hard way: the neighbours are placed to size the shot and then taken away
 *  again, and doing that inside the window put a phantom beat in the clip. */
async function frame(page, { dolly, lift }, stayWide) {
  return page.evaluate(
    async ({ dolly, lift, stayWide }) => {
      const { placeCell, removeCell, cells, slotHasAnyCell } =
        await import("/src/hex/cells.ts");
      const { ghosts, rebuildGhosts } = await import("/src/hex/ghosts.ts");
      const { controls, cellsContainer } = await import("/src/hex/scene.ts");

      const tray = placeCell(0, 0, "hex-tb-carrier-parts-tray");
      const neighbours = [
        [1, 0],
        [-1, 1],
      ];
      const inNeighbours = (q, r) =>
        neighbours.some(([nq, nr]) => nq === q && nr === r);

      for (const [q, r] of neighbours) placeCell(q, r, "hex-tb-carrier-solid");
      tray.exploded = true;
      rebuildGhosts();
      await new Promise((r) => requestAnimationFrame(() => r(null)));

      await controls.fitToSphere(cellsContainer, false);
      controls.dollyTo(controls.distance * dolly, false);
      controls.setFocalOffset(0, controls.distance * lift, 0, false);

      if (stayWide) {
        const { slotsForCell, defaultKindForSlot, setCapAt, isCapAvailable } =
          await import("/src/hex/caps.ts");
        const { HEX_NEIGHBORS } = await import("/src/hex/types.ts");
        // Settle before capping. A cap's gltf is fetched on demand and the
        // choreography does not ask for one until a third of the way into the
        // clip; a probe that caps the instant it boots is the one context where
        // that lead time does not exist, so it waits for the explode lerp and
        // gets the fetch window for free.
        await new Promise((r) => setTimeout(r, 2500));

        // Same free-edge predicate the choreography uses. Capping a mated edge
        // would drive geometry into the neighbouring tile and inflate the
        // measured extent with something the cut never renders.
        const taken = [];
        for (let i = 0; i < 3; i++) {
          const spec = slotsForCell(tray, {
            hasNeighborOnEdge: (edgeIdx) => {
              const n = HEX_NEIGHBORS[edgeIdx];
              return !!n && slotHasAnyCell(tray.q + n.dq, tray.r + n.dr);
            },
          }).find((s) => !taken.some((t) => t.slotId === s.slotId));
          if (!spec) break;
          const corner = {
            shape: spec.shape,
            variant: "corner",
            gender: spec.gender,
          };
          setCapAt(
            tray,
            spec,
            i === 0 && isCapAvailable(corner)
              ? corner
              : defaultKindForSlot(spec),
          );
          taken.push(spec);
        }
        rebuildGhosts();
        // DETACHED FROM THE RENDERED GROUP, not hidden via the exported array.
        // Both shortcuts fail here for reasons hex-video.mjs already paid for:
        // the app runs its own visibility pass and turns `visible = false` back
        // on, and the exported `ghosts` array is not what the renderer holds
        // (measured: two attached in the array while six drew). During a capture
        // a per-frame limiter papers over both; a probe screenshots once, 2.5s
        // later, so it has to remove them for good.
        let node = tray.scene.baseTopExplode;
        while (node.parent) node = node.parent;
        const group = node.children.find((c) => c.name === "ghosts");
        if (group) {
          for (const root of [...group.children]) {
            const slot = root?.userData?.ghost?.slot;
            if (slot && inNeighbours(slot.q, slot.r)) root.visible = true;
            else group.remove(root);
          }
        }
        // A beat for the caps just requested to arrive and draw.
        await new Promise((r) => setTimeout(r, 1500));
        // REPORTED, NOT EYEBALLED, and this is not a formality: reading the
        // probe frames I concluded the caps were not placing at all, because I
        // could not find one in the picture. The count says three, every
        // preset. A cap on a far edge is small and can sit behind the exploded
        // lid, so "I cannot see one" and "there is not one" are different
        // observations and only one of them is cheap to get right.
        return { caps: tray.caps.size };
      }

      tray.exploded = false;
      for (const key of [...cells.keys()])
        if (cells.get(key) !== tray) removeCell(key);
      rebuildGhosts();
      for (const g of ghosts) g.root.visible = inNeighbours(g.slot.q, g.slot.r);
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    },
    { dolly, lift, stayWide },
  );
}

/** Poll for the explode groups to stop moving, rather than waiting a number.
 *  A first frame caught mid-collapse cannot match a last frame at rest, and
 *  that mismatch IS the loop popping.
 *
 *  It also keeps the page drawing while it waits. The app skips rendering when
 *  it sees no active work, and a poll that reads a stalled scene twice would
 *  call that rest, so the budget is topped up each time round.
 *
 *  THAT DID NOT FIX THE RESIDUAL, and the note that used to sit here claiming
 *  it would was written before the run that disproved it. Every cut still opens
 *  with the insert and board groups a fraction proud of home -- 1.2e-4 to 4.0e-4
 *  scene units, ~0.1 to 0.4 mm on a 76 mm tile -- while the closing frame is
 *  flush. The bump changed the number not at all across six presets, so
 *  whatever leaves it there, a starved render loop is not it. Cause still
 *  unknown; what IS known is that it does not reach the picture, and the seam
 *  check at the bottom of this file is what establishes that rather than
 *  assuming it. */
async function waitForRest(page) {
  await page.waitForFunction(
    async () => {
      const { cells } = await import("/src/hex/cells.ts");
      const { bumpRender } = await import("/src/hex/main.ts");
      bumpRender(4);
      const tray = [...cells.values()][0];
      if (!tray) return false;
      const now = [
        tray.scene.baseTopExplode.position.y,
        tray.scene.insertExplode.position.y,
        tray.scene.boardExplode.position.y,
      ];
      const prev = window.__restProbe ?? null;
      window.__restProbe = now;
      if (!prev) return false;
      return (
        now.every((v, i) => Math.abs(v - prev[i]) < 1e-6) &&
        now.every((v) => Math.abs(v) < 1e-4)
      );
    },
    null,
    { timeout: 15000, polling: 120 },
  );
}

/** Snap the explode groups to exactly home before recording starts.
 *
 *  THE REST POLL IS NOT ENOUGH ON ITS OWN. Every run here leaves a residual
 *  after the poll passes: on the shipped presets it is around 1e-4 scene units,
 *  small enough that the seam check clears it, and it was recorded for a while
 *  as an unexplained curiosity rather than a defect.
 *
 *  A transparent-background variant tried during the README work (since dropped
 *  on size) left 5.9e-3, forty times larger, which is about 5.9 mm on a 76 mm
 *  tile: frame 0 opened with the tray visibly proud while frame 299 sat flush,
 *  and the seam check failed outright at 0.859 against a quietest ordinary step
 *  of 0.733. Same latent bug, one run away from shipping.
 *
 *  Whatever lets the value grow between the poll passing and the snapshot being
 *  taken, the opening state is not a measurement: it is a known quantity. The
 *  tray is collapsed, so home is zero. Setting it is stable rather than a fight
 *  with the app, because `exploded = false` means the lerp's own target is zero
 *  too; this only removes the dependency on it having arrived. */
async function forceCollapsed(page) {
  return page.evaluate(async () => {
    const { cells } = await import("/src/hex/cells.ts");
    const tray = [...cells.values()][0];
    const groups = [
      tray.scene.baseTopExplode,
      tray.scene.insertExplode,
      tray.scene.boardExplode,
    ];
    for (const g of groups) g.position.y = 0;
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    return groups.map((g) => Number(g.position.y.toFixed(6)));
  });
}

/** Install the per-frame stepper. Byte-for-byte the choreography hex-video.mjs
 *  ships, because the cuts are the SAME loop at other aspect ratios -- a cut
 *  that told a different story would stop being a cut. */
async function installStepper(page, total) {
  await page.evaluate(async (total) => {
    const { placeCell, removeCell, cells, slotHasAnyCell } =
      await import("/src/hex/cells.ts");
    const { slotsForCell, defaultKindForSlot, setCapAt, isCapAvailable } =
      await import("/src/hex/caps.ts");
    const { HEX_NEIGHBORS } = await import("/src/hex/types.ts");
    const { ghosts, rebuildGhosts } = await import("/src/hex/ghosts.ts");
    const { controls } = await import("/src/hex/scene.ts");
    const { bumpRender } = await import("/src/hex/main.ts");

    const tray = [...cells.values()][0];
    const neighbours = [
      [1, 0],
      [-1, 1],
    ];
    const caps = [];
    const added = [];
    const fired = new Set();

    const snapshot = () => ({
      cells: cells.size,
      caps: [...cells.values()].reduce((n, c) => n + c.caps.size, 0),
      lift: [
        tray.scene.baseTopExplode.position.y,
        tray.scene.insertExplode.position.y,
        tray.scene.boardExplode.position.y,
      ].map((v) => Number(v.toFixed(6))),
    });
    const opening = snapshot();

    // Only edges with no neighbour. A cap on a mated edge is geometry driven
    // into the tile next door, and it has to be computed at the moment the cap
    // goes on -- computed up front it is answering about an empty board.
    const freeCapSlots = () =>
      slotsForCell(tray, {
        hasNeighborOnEdge: (edgeIdx) => {
          const n = HEX_NEIGHBORS[edgeIdx];
          return !!n && slotHasAnyCell(tray.q + n.dq, tray.r + n.dr);
        },
      });

    const kindFor = (spec, i) => {
      if (i === 0) {
        const corner = {
          shape: spec.shape,
          variant: "corner",
          gender: spec.gender,
        };
        if (isCapAvailable(corner)) return corner;
      }
      return defaultKindForSlot(spec);
    };

    const addCap = (i) => {
      const spec = freeCapSlots().find(
        (s) => !caps.some((c) => c.slotId === s.slotId),
      );
      if (!spec) return;
      setCapAt(tray, spec, kindFor(spec, i));
      caps.push(spec);
    };

    const ghostGroupNode = () => {
      let n = tray.scene.baseTopExplode;
      while (n.parent) n = n.parent;
      return n.children.find((c) => c.name === "ghosts") ?? null;
    };
    const wantedRoot = (o) => {
      const slot = o?.userData?.ghost?.slot;
      return (
        !!slot && neighbours.some(([q, r]) => slot.q === q && slot.r === r)
      );
    };
    const limitGhosts = () => {
      const group = ghostGroupNode();
      if (!group) return;
      for (const root of [...group.children]) {
        if (wantedRoot(root)) root.visible = true;
        else group.remove(root);
      }
    };
    // Refuse the extras at the door. Sweeping the group every frame is a race
    // against the app's own rebuild and it loses intermittently.
    const sealGhostGroup = () => {
      const group = ghostGroupNode();
      if (!group || group.userData.__sealed) return;
      group.userData.__sealed = true;
      const add = group.add.bind(group);
      group.add = (...objs) => {
        const keep = objs.filter(wantedRoot);
        return keep.length ? add(...keep) : group;
      };
    };

    const topology = (fn) => () => {
      fn();
      rebuildGhosts();
      limitGhosts();
    };

    const beats = [
      [0.04, () => void (tray.exploded = true)],
      [
        0.22,
        topology(() =>
          added.push(
            placeCell(
              neighbours[0][0],
              neighbours[0][1],
              "hex-tb-carrier-solid",
            ),
          ),
        ),
      ],
      [
        0.3,
        topology(() =>
          added.push(
            placeCell(
              neighbours[1][0],
              neighbours[1][1],
              "hex-tb-carrier-solid",
            ),
          ),
        ),
      ],
      [0.37, topology(() => addCap(0))],
      [0.43, topology(() => addCap(1))],
      [0.49, topology(() => addCap(2))],
      [0.6, () => void (tray.exploded = false)],
      [0.7, topology(() => caps[0] && setCapAt(tray, caps[0], null))],
      [0.75, topology(() => caps[1] && setCapAt(tray, caps[1], null))],
      [0.8, topology(() => caps[2] && setCapAt(tray, caps[2], null))],
      [
        0.86,
        topology(() => {
          for (const [k, v] of cells) if (v === added[0]) removeCell(k);
        }),
      ],
      [
        0.92,
        topology(() => {
          for (const [k, v] of cells) if (v === added[1]) removeCell(k);
        }),
      ],
    ];

    // Absolute angle per frame. `controls.rotate` accumulates and damps, so the
    // last frame lands short of the first and the loop does not close.
    const az0 = controls.azimuthAngle;
    const polar0 = controls.polarAngle;

    window.__step = (i) => {
      const f = i / total;
      for (const [mark, fn] of beats) {
        if (f >= mark && !fired.has(mark)) {
          fired.add(mark);
          try {
            fn();
          } catch {
            /* a beat must never strand the recording */
          }
        }
      }
      limitGhosts();
      controls.rotateTo(az0 + 2 * Math.PI * f, polar0, false);
      bumpRender(4);
    };
    window.__limit = () => {
      sealGhostGroup();
      limitGhosts();
    };
    window.__probe = () => {
      const group = ghostGroupNode();
      return {
        rendered: group ? group.children.filter((c) => c.visible).length : -1,
      };
    };
    window.__closure = () => {
      const closing = snapshot();
      return {
        opening,
        closing,
        liftDrift: closing.lift.map((v, k) =>
          Number((v - opening.lift[k]).toFixed(6)),
        ),
      };
    };
    void ghosts;
  }, total);
}

/** Mean absolute difference between two frames, 0-255. */
function frameDiff(a, b) {
  const out = execFileSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      a,
      "-i",
      b,
      "-filter_complex",
      "blend=all_mode=difference,format=gray,signalstats," +
        "metadata=print:key=lavfi.signalstats.YAVG:file=-",
      "-f",
      "null",
      "-",
    ],
    { encoding: "utf8" },
  );
  const m = out.match(/YAVG=([0-9.]+)/);
  return m ? Number(m[1]) : NaN;
}

/** DOES THE LOOP ACTUALLY CLOSE, measured on the pictures.
 *
 *  This replaces a gate on the scene graph, which asked whether the closing
 *  state equalled the opening state to the last bit of a float. It always
 *  answered no, on every preset, because of a sub-millimetre lerp residual --
 *  and "no" was wrong in the only sense anyone cares about.
 *
 *  The question a loop poses is whether the jump from the last frame back to
 *  the first is visible, and that has a direct measurement: compare it against
 *  the jumps between ordinary adjacent frames. The seam is one frame's worth of
 *  rotation like any other, so it should not stand out. Measured across all six
 *  presets it does not merely blend in, it comes in BELOW the quietest ordinary
 *  step every time -- the loop point is the calmest moment in the clip, because
 *  it sits in the collapsed passage where nothing but the camera is moving. */
function seamCheck(dir, total) {
  const f = (i) => `${dir}/f${String(i).padStart(4, "0")}.png`;
  const seam = frameDiff(f(total - 1), f(0));
  const ordinary = [0.17, 0.4, 0.67, 0.9]
    .map((p) => Math.floor(total * p))
    .map((i) => frameDiff(f(i), f(i + 1)));
  const quietest = Math.min(...ordinary);
  const verdict = seam <= quietest ? "ok" : "SEAM VISIBLE";
  console.log(
    `[seam] ${verdict}  seam=${seam.toFixed(3)}  quietest ordinary step=${quietest.toFixed(3)}` +
      `  (${ordinary.map((v) => v.toFixed(2)).join(", ")})`,
  );
  return seam <= quietest;
}

// `--check=<dir>` runs the seam gate alone against a frame dump that already
// exists, so the gate can be exercised without paying for a 300-frame capture.
const checkArg = arg("check");
if (checkArg) {
  const dir = checkArg.slice("--check=".length);
  process.exit(seamCheck(dir, TOTAL) ? 0 : 1);
}

const browser = await chromium.launch();

/** Project every rendered vertex to NDC at `steps` azimuths around a full turn
 *  and return the extreme corner reached at any of them.
 *
 *  A SINGLE FRAME CANNOT ANSWER THE FRAMING QUESTION, which is what the two
 *  previous versions of this probe got wrong in two different ways. The camera
 *  makes a complete revolution during the clip, and the cluster's silhouette is
 *  not rotationally symmetric -- it is three tiles in a wedge with a stack of
 *  parts floating over one of them. So the extent at the opening azimuth says
 *  nothing about the extent half a turn later, and shipping on the opening
 *  azimuth is exactly how both README cuts went out with the top cap sliced off
 *  at frame 150: the probe frame was clean, the poster half a revolution away
 *  was not.
 *
 *  NDC, not pixels, and no screenshots: |x| or |y| reaching 1 IS the frame edge,
 *  in one number, for either theme, without a decoder or a cropdetect pass that
 *  would need to know what colour the background is.
 *
 *  Plain arithmetic on `.elements` rather than an `import("three")` -- a bare
 *  specifier does not resolve at runtime here, and nothing below needs more of
 *  the library than a 4x4 multiply. */
async function extentOverTurn(page, steps = 24) {
  return page.evaluate(async (steps) => {
    const { controls, cellsContainer } = await import("/src/hex/scene.ts");
    const { bumpRender } = await import("/src/hex/main.ts");
    const cam = controls.camera;
    const az0 = controls.azimuthAngle;
    const polar0 = controls.polarAngle;

    // Column-major, same convention as THREE's `.elements`.
    const mulMat = (a, b) => {
      const o = new Array(16).fill(0);
      for (let c = 0; c < 4; c++)
        for (let r = 0; r < 4; r++)
          for (let k = 0; k < 4; k++)
            o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
      return o;
    };
    const apply = (m, x, y, z) => {
      const w = m[3] * x + m[7] * y + m[11] * z + m[15];
      return [
        (m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
        (m[1] * x + m[5] * y + m[9] * z + m[13]) / w,
      ];
    };

    // THE CLUSTER, NOT THE SCENE ROOT. Walking up to the root and traversing
    // that returned -Infinity on every preset: the scene also holds the
    // environment -- ground plane, backdrop -- whose corners sit behind the
    // camera, where the perspective divide flips sign and the "extent" becomes
    // meaningless. The cluster is also the only thing the framing is about; the
    // backdrop is supposed to run off the edges.
    const root = cellsContainer;

    const box = {
      minX: Infinity,
      maxX: -Infinity,
      minY: Infinity,
      maxY: -Infinity,
    };
    for (let s = 0; s < steps; s++) {
      controls.rotateTo(az0 + (2 * Math.PI * s) / steps, polar0, false);
      controls.update(1 / 30);
      bumpRender(2);
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      cam.updateMatrixWorld(true);
      const vp = mulMat(
        cam.projectionMatrix.elements,
        cam.matrixWorldInverse.elements,
      );

      root.traverseVisible((o) => {
        // Ghosts are already detached in the probe; anything still drawing and
        // carrying geometry is content the frame has to hold.
        if (!o.isMesh || !o.geometry) return;
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        const bb = o.geometry.boundingBox;
        if (!bb) return;
        const m = o.matrixWorld.elements;
        for (let i = 0; i < 8; i++) {
          const lx = i & 1 ? bb.max.x : bb.min.x;
          const ly = i & 2 ? bb.max.y : bb.min.y;
          const lz = i & 4 ? bb.max.z : bb.min.z;
          const w = m[3] * lx + m[7] * ly + m[11] * lz + m[15];
          const wx = (m[0] * lx + m[4] * ly + m[8] * lz + m[12]) / w;
          const wy = (m[1] * lx + m[5] * ly + m[9] * lz + m[13]) / w;
          const wz = (m[2] * lx + m[6] * ly + m[10] * lz + m[14]) / w;
          const [nx, ny] = apply(vp, wx, wy, wz);
          if (nx < box.minX) box.minX = nx;
          if (nx > box.maxX) box.maxX = nx;
          if (ny < box.minY) box.minY = ny;
          if (ny > box.maxY) box.maxY = ny;
        }
      });
    }
    controls.rotateTo(az0, polar0, false);
    controls.update(1 / 30);
    return box;
  }, steps);
}

// ---- probe: measure every preset over a full revolution -----------------
if (PROBE) {
  const dir = `${OUT}/_probe`;
  mkdirSync(dir, { recursive: true });
  let clipped = 0;
  for (const [name, preset] of Object.entries(PRESETS)) {
    const { ctx, page } = await boot(browser, preset);
    const { caps } = await frame(page, preset, true);
    const box = await extentOverTurn(page);
    // Worst approach to any edge over the whole turn. Negative means the
    // geometry left the frame at some azimuth.
    const marginX = 1 - Math.max(Math.abs(box.minX), Math.abs(box.maxX));
    const marginY = 1 - Math.max(Math.abs(box.minY), Math.abs(box.maxY));
    const bad = marginX < 0 || marginY < 0;
    if (bad) clipped++;
    // The still is kept as a sanity check on what the numbers describe, but it
    // is no longer the thing being judged.
    await page.screenshot({ path: `${dir}/${name}-${THEME}.png` });
    console.log(
      `${name.padEnd(9)} ${preset.w}x${preset.h}  dolly=${preset.dolly} lift=${preset.lift}` +
        `  caps=${caps}  marginX=${marginX.toFixed(3)} marginY=${marginY.toFixed(3)}` +
        `${bad ? "  <-- CLIPS" : ""}`,
    );
    await ctx.close();
  }
  await browser.close();
  process.exit(clipped ? 1 : 0);
}

// ---- a cut ---------------------------------------------------------------
const preset = PRESETS[presetArg];
const FRAMES = `${RAW}/${presetArg}-${THEME}`;
rmSync(FRAMES, { recursive: true, force: true });
mkdirSync(FRAMES, { recursive: true });

const { ctx, page } = await boot(browser, preset);
await frame(page, preset, false);
await waitForRest(page);
const home = await forceCollapsed(page);
if (home.some((v) => v !== 0)) {
  console.warn(
    `[capture] explode groups did not snap home: ${JSON.stringify(home)}`,
  );
}
await installStepper(page, TOTAL);

await page.evaluate(() => window.__clock.start());
const paint = () =>
  page.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );

for (let i = 0; i < TOTAL; i++) {
  await page.evaluate((n) => window.__step(n), i);
  await page.evaluate((ms) => window.__clock.advance(ms), 1000 / 30);
  await paint();
  await page.evaluate(() => window.__limit());
  await paint();
  if (i === 0) {
    const { rendered } = await page.evaluate(() => window.__probe());
    console.log(`[capture] frame 0 ghost wires: ${rendered}`);
    if (rendered !== 2) {
      console.warn(
        `[capture] EXPECTED 2 ghost wires at frame 0, got ${rendered}`,
      );
    }
  }
  await page.screenshot({
    path: `${FRAMES}/f${String(i).padStart(4, "0")}.png`,
  });
  if (i % 60 === 0) console.log(`[capture] frame ${i}/${TOTAL}`);
}

// TOPOLOGY must match exactly. A tile or a cap left over is a hard defect and
// there is no tolerance at which half a cap is acceptable.
//
// LIFT IS REPORTED, NOT GATED. It was gated, first on exact equality and then
// on a tolerance, and both were the wrong instrument: the residual is a float
// off a damped lerp and it is present on every preset, so a gate on it fires
// every single run. A check that always fires is worse than no check, because
// it teaches whoever sees it to scroll past the one time it means something.
const closure = await page.evaluate(() => window.__closure());

await ctx.close();
await browser.close();

// NEITHER CHECK MEANS ANYTHING ON A CAPPED RUN. `--frames` stops part-way
// through the choreography, so the tiles the reverse beats would have removed
// are still standing and the topology check is guaranteed to fire; the seam
// check is worse, because it samples an ordinary pair at 0.9 of the total and
// reads frame N+1, which does not exist, so ffmpeg failed with "No such file"
// and took the whole run down at the finish line. A check that always fires on
// a legitimate mode is noise, and a check that crashes it is a defect.
if (capArg) {
  console.log(
    `stopped after ${TOTAL} frames (--frames), no encode, no closure or seam check`,
  );
  process.exit(0);
}

// TOPOLOGY must match exactly. A tile or a cap left over is a hard defect and
// there is no tolerance at which half a cap is acceptable.
if (
  closure.closing.cells !== closure.opening.cells ||
  closure.closing.caps !== closure.opening.caps
) {
  console.warn("LOOP DOES NOT CLOSE (topology):", JSON.stringify(closure));
}
console.log(`[closure] lift residual ${JSON.stringify(closure.liftDrift)}`);
seamCheck(FRAMES, TOTAL);

const base = `${OUT}/hex-${presetArg}${suffix}`;
const emitted = [];

// Encoded 1:1 at 30fps. No setpts, no trim: the capture produced exactly
// SECONDS * 30 frames of SCENE time, so it is already the right length and
// every frame is a real render at even spacing.
execFileSync("ffmpeg", [
  "-y",
  "-loglevel",
  "error",
  "-framerate",
  "30",
  "-i",
  `${FRAMES}/f%04d.png`,
  "-an",
  "-c:v",
  "libx264",
  "-preset",
  "slow",
  "-crf",
  "31",
  "-pix_fmt",
  "yuv420p",
  "-g",
  "30",
  // Start at zero, or the muxer writes a 0.066s start_time -- the B-frame
  // reorder delay carried as a container offset -- and every lap waits for it.
  "-muxdelay",
  "0",
  "-muxpreload",
  "0",
  "-movflags",
  "+faststart",
  `${base}.mp4`,
]);
emitted.push(`${base}.mp4`);

// A real frame from the middle, not a re-render.
execFileSync("ffmpeg", [
  "-y",
  "-loglevel",
  "error",
  "-i",
  `${FRAMES}/f${String(Math.floor(TOTAL / 2)).padStart(4, "0")}.png`,
  "-q:v",
  "4",
  `${base}-poster.jpg`,
]);
emitted.push(`${base}-poster.jpg`);

// The README cut also ships as an animated WebP: GitHub README markdown cannot
// autoplay a repo-hosted mp4, so an mp4 alone would render as a dead link.
if (presetArg === "readme") {
  execFileSync("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-framerate",
    "30",
    "-i",
    `${FRAMES}/f%04d.png`,
    "-vf",
    `fps=${WEBP.fps},scale=${WEBP.width}:-1:flags=lanczos`,
    "-c:v",
    "libwebp_anim",
    "-lossless",
    "0",
    "-q:v",
    String(WEBP.quality),
    "-loop",
    "0",
    `${base}.webp`,
  ]);
  emitted.push(`${base}.webp`);
}

console.log(
  `${presetArg} ${preset.w}x${preset.h} ${THEME}: ${TOTAL} frames of scene time, 1:1 at 30fps`,
);
for (const f of emitted) {
  console.log(`${f}  ${(statSync(f).size / 1024).toFixed(0)} KB`);
}
