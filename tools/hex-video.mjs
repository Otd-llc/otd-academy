// A short silent loop of the configurator, for the /hex hero.
//
// DRIVEN FRAME BY FRAME ON A VIRTUAL CLOCK, not screencast in real time.
//
// The screencast version recorded whatever the machine managed and then asked
// ffmpeg to retime it to ten seconds. Measured, headless WebGL runs this scene
// at about 0.7 fps, so the choreography took 423 SECONDS and was compressed to
// 10 -- a 38x speed-up. ffmpeg kept roughly one captured frame in thirty-five
// and stretched the rest, which is three complaints in one number: the explode
// played 38x too fast whatever it was authored at, the kept frames were unevenly
// spaced so the motion juddered, and the exact loop frame was unlikely to
// survive the selection.
//
// So the page's clock is replaced with one this script advances. Each captured
// frame is exactly 1/30 of a SCENE second regardless of how long it took to
// render, the camera is placed absolutely rather than damped toward a target,
// and the frames are encoded at 30fps with no retime at all. Wall-clock speed
// stops being able to affect the result.
//
// WHY THE FIRST TAKE RAN AT ABOUT HALF A FRAME PER SECOND. The app has an
// idle-frame skip: `tick()` runs rAF continuously, but `renderer.render()` only
// fires while there is "active work" -- a lerp in flight, controls damping, or
// recent input -- and a `renderBudget` that decays to zero otherwise. Between
// scripted changes there was no active work, so the GPU went idle and the
// screencast captured the same frame over and over. It was never a capture-rate
// problem; the page genuinely was not drawing.
//
// `bumpRender` is exported for exactly this, so the recording keeps the budget
// topped up for its whole duration and every frame is a real one.
//
// The choreography is a closed loop: it starts and ends on a collapsed carrier
// parts tray, and the camera completes exactly one revolution, so the last frame
// meets the first.
import { chromium } from "playwright";
import { mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const APP = "http://localhost:5180/hex";
const RAW =
  "C:/Users/raven/AppData/Local/Temp/claude/c--zzz-project-foundry/6b77be38-fe0b-4908-93a5-9783a0347c55/scratchpad/hexvid";
const OUT = "public/hex";
const FRAMES = `${RAW}/frames`;
rmSync(RAW, { recursive: true, force: true });
mkdirSync(FRAMES, { recursive: true });
mkdirSync(OUT, { recursive: true });

const W = 1280;
const H = 800;
const SECONDS = 10;

/** How far to lift the cluster in frame, as a fraction of the camera distance.
 *  Owner note: "too much empty space at the top and the bottom of the video
 *  distracts from the text. So, just move the scene up a smidge." */
const FRAME_LIFT = 0.06;

// BOTH themes, for the same reason the stills are shot twice: a clip recorded on
// deep space is a black slab on the ivory theme.
const THEME = process.argv[2] === "light" ? "light" : "dark";
const suffix = THEME === "light" ? "-light" : "";

// LAUNCHED ON THE REAL GPU, and this is worth 25x.
//
// Headless Chromium silently falls back to SwiftShader, its software
// rasteriser, and this scene renders a 2048x2048 shadow map every frame. Timed
// over 20 frames at 1920x1080: 8508 ms/frame on SwiftShader against 342 ms on
// the machine's Intel UHD through ANGLE's GL backend. That is the difference
// between 43 minutes and 2 minutes for one 300-frame preset.
//
// It looked like a capture-rate problem and was a renderer problem. Check
// WEBGL_debug_renderer_info if a run is ever slow again: if the string says
// SwiftShader, these flags are not taking.
const GPU_ARGS = ["--use-angle=gl", "--enable-gpu", "--ignore-gpu-blocklist"];

const browser = await chromium.launch({ args: GPU_ARGS });
const ctx = await browser.newContext({ viewport: { width: W, height: H } });
const page = await ctx.newPage();
page.on("console", (m) => {
  const t = m.text();
  if (t.startsWith("[capture]") || t.startsWith("loop does not close")) {
    console.log(t);
  }
});

// THE CLOCK, installed before any app code runs.
//
// Everything the app animates -- the explode lerp, camera damping, the render
// budget -- reads performance.now(). Handing it a clock this script advances by
// exactly one frame's worth per captured frame makes scene time independent of
// how long a frame actually takes to draw.
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
// Pin the theme BEFORE boot: the app resolves it in a no-flash inline script,
// and Playwright's default colorScheme is light.
await page.addInitScript((t) => {
  try {
    localStorage.setItem("otd-theme", t);
  } catch {
    /* private mode */
  }
}, THEME);
await page.goto(APP, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(11000); // three.js, models, first paint

// ALL app chrome goes. This clip is about the geometry: the brand lockup and the
// edit/export controls are the page's job, not the loop's, and at hero size they
// read as clutter someone has to look past.
//
// A NAMED LIST GOES STALE. #hex-palette and #hex-compass are here because the
// list did not have them and the clip shipped with the placement menu and the
// north arrow sitting in frame -- the palette was rebuilt under a new id and the
// compass did not exist when this was written. Anything the app adds to the DOM
// in future is in the same position, so the belt-and-braces rule below hides
// every direct child of <body> that is not the canvas, and the named ids stay
// only for the ones nested deeper.
await page.addStyleTag({
  content: `
    body > *:not(canvas):not(script) { display: none !important; }
    #header, #toolbar, #inspector, #idle-prompt, #ghost-tip, #hint,
    #crosshair, #action-sheet, #export-modal, .long-press-indicator,
    #hex-palette, #hex-compass, #loading { display: none !important; }
  `,
});

// SETUP happens in its own evaluate, BEFORE the trim is measured. The first take
// measured the trim first, so the framing pass -- which places the neighbours to
// size the shot and then takes them away again -- was inside the recorded window
// and appeared as a phantom beat at four seconds.
await page.evaluate(async (FRAME_LIFT) => {
  const { placeCell, removeCell, cells } = await import("/src/hex/cells.ts");
  const { ghosts, rebuildGhosts } = await import("/src/hex/ghosts.ts");
  const { controls, cellsContainer } = await import("/src/hex/scene.ts");

  // The ghost wireframes STAY. They are the app's own "you can add one here"
  // affordance, and in the loop they do the explaining that a caption would
  // otherwise have to: the empty slots are visibly slots, so the tiles that
  // arrive later read as snapping into a system rather than floating in.
  //
  // BUT THEY MUST BE REBUILT AFTER EVERY TOPOLOGY CHANGE. `placeCell` and
  // `removeCell` do not touch the ghosts -- cells.ts says so in as many words
  // ("Caller (inspector) is expected to call rebuildGhosts() after"), because
  // in the real app it is the picking layer that owns that. Driving the scene
  // straight from a script skips it, so a ghost stayed on every slot that had
  // just been filled and z-fought the tile now occupying it.

  // Open on the carrier parts tray -- the part that best shows what the system
  // is for, and the one with something inside it to reveal.
  const tray = placeCell(0, 0, "hex-tb-carrier-parts-tray");

  // Frame for the WIDEST moment (exploded, with neighbours) so the camera never
  // has to move to keep up. A hero loop that re-frames itself reads as a bug.
  for (const [q, r] of [
    [1, 0],
    [-1, 1],
  ])
    placeCell(q, r, "hex-tb-carrier-solid");
  tray.exploded = true;
  rebuildGhosts();
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  await controls.fitToSphere(cellsContainer, false);
  // MULTIPLY to move in. The first take divided by 0.60, which pushed the camera
  // two thirds further out and shrank the subject to a thumbnail.
  controls.dollyTo(controls.distance * 1.06, false);

  // LIFT THE SUBJECT IN FRAME. fitToSphere centres the cluster, which left dead
  // space above it and put the bottom of the clip right against the copy below
  // the hero. A focal offset shifts the view without rotating it, so the
  // framing changes and the orbit does not.
  //
  // In world units along the camera's local axes, so it is expressed as a
  // fraction of the fitted distance and survives any change to the dolly above.
  // POSITIVE Y raises the subject in the image. Measured, not assumed: the
  // first take used the negative and pushed the cluster to the bottom of the
  // frame, which is the opposite of what was asked for.
  controls.setFocalOffset(0, controls.distance * FRAME_LIFT, 0, false);

  // Back to the opening state.
  tray.exploded = false;
  for (const key of [...cells.keys()])
    if (cells.get(key) !== tray) removeCell(key);
  rebuildGhosts();
  // Same two-ghost limit as the choreography, or the clip OPENS on all six and
  // four of them vanish on the first beat.
  for (const g of ghosts) {
    g.root.visible = [
      [1, 0],
      [-1, 1],
    ].some(([q, r]) => g.slot.q === q && g.slot.r === r);
  }
  await new Promise((r) => requestAnimationFrame(() => r(null)));
}, FRAME_LIFT);
// WAIT FOR REST, NOT FOR A NUMBER.
//
// This was a flat 1200ms, which was enough while the explode lerp settled in
// about half a second. It is slower now, so a fixed wait started the recording
// mid-collapse -- and a first frame caught mid-animation cannot match a last
// frame at rest, which is the loop popping.
//
// Poll the actual thing: the tray's three explode groups are at rest when none
// of them has moved between two reads.
await page.waitForFunction(
  async () => {
    const { cells } = await import("/src/hex/cells.ts");
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

// `--frames=N` caps the run for a quick look at the opening without paying for
// the whole clip; the encode is skipped when it is set.
const capArg = process.argv.find((a) => a.startsWith("--frames="));
const TOTAL = capArg ? Number(capArg.slice(9)) : SECONDS * 30;

// SETUP: hand the page a stepper it can be driven with, rather than letting it
// run the clip on its own clock.
await page.evaluate(async (total) => {
  const { placeCell, removeCell, cells, slotHasAnyCell } =
    await import("/src/hex/cells.ts");
  const { slotsForCell, defaultKindForSlot, setCapAt, isCapAvailable } =
    await import("/src/hex/caps.ts");
  const { HEX_NEIGHBORS } = await import("/src/hex/types.ts");
  const { ghosts, rebuildGhosts } = await import("/src/hex/ghosts.ts");
  const { controls } = await import("/src/hex/scene.ts");
  const { bumpRender } = await import("/src/hex/main.ts");

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const tray = [...cells.values()][0];
  const neighbours = [
    [1, 0],
    [-1, 1],
  ];

  // THE CAMERA IS DRIVEN FROM OUTSIDE NOW, one absolute angle per captured
  // frame, so the rAF spin that used to accumulate a turn against wall-clock dt
  // is gone with the clock it depended on. What it worked around -- timers
  // slipping under a page rendering at 1280x800 while being screencast -- can no
  // longer happen: nothing here reads real time.
  // BEATS FIRE ON ROTATION ANGLE, NOT ON THE CLOCK.
  //
  // Every wall-clock version of this drifted. setTimeout is throttled hard on a
  // page rendering every frame at 1280x800 while Playwright screencasts it, so a
  // ten-second plan took sixteen and the beats slid out from under the camera.
  // The stepper passes the fraction directly, so a beat and the camera angle
  // are read from the same number and cannot drift apart.
  const caps = [];
  const added = [];
  const fired = new Set();

  /** What the frame actually shows, reduced to the things a loop has to match.
   *  The clip is a closed loop by construction -- the camera is clamped to one
   *  revolution and every beat is undone by a later one -- but "by
   *  construction" is a claim, and a rim that does not quite line up is what it
   *  looks like when the claim is wrong. */
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

  /** Cap slots on edges that are actually FREE.
   *
   *  This is where the clipping came from. `slotsForCell(cell)` with no options
   *  returns every edge slot, including the ones a neighbouring tile is already
   *  mated to -- and caps.ts says why that is wrong in as many words: "the two
   *  bases mate directly via their own dovetail features, and a cap there would
   *  block the conduit between them". A cap placed on such an edge is not merely
   *  redundant, it is geometry pushed inside the tile next door.
   *
   *  Two mistakes compounded. The slots were taken with no `hasNeighborOnEdge`
   *  predicate, AND they were computed once up front, before the neighbours
   *  existed -- so even a correct predicate would have been answering about an
   *  empty board. Computed here, at the moment the first cap goes on, with the
   *  occupancy of the board as it stands. HEX_NEIGHBORS[0] is {+1,0} and [4] is
   *  {-1,+1}: precisely the two slots the choreography fills, and precisely the
   *  two that were being capped. */
  const freeCapSlots = () =>
    slotsForCell(tray, {
      hasNeighborOnEdge: (edgeIdx) => {
        const n = HEX_NEIGHBORS[edgeIdx];
        return !!n && slotHasAnyCell(tray.q + n.dq, tray.r + n.dr);
      },
    });

  // At least one CORNER cap, not three of whatever the slot defaults to. The
  // corner is the piece that shows the system turning a corner rather than just
  // running in a line, so a loop without one undersells what the caps are for.
  // `variantsFor` offers corner on both shapes; it is guarded by
  // `isCapAvailable` because a variant can exist in the type union while its
  // gltf is still FCStd-only, and setting one of those places nothing at all.
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

  /** Cap the next still-free edge, remembering the spec so the removal beats
   *  take off exactly what went on. Silently does nothing when there is no free
   *  edge left -- better a missing cap than one driven into a neighbour. */
  const addCap = (i) => {
    const spec = freeCapSlots().find(
      (s) => !caps.some((c) => c.slotId === s.slotId),
    );
    if (!spec) return;
    setCapAt(tray, spec, kindFor(spec, i));
    caps.push(spec);
  };

  // Anything that changes the cluster's topology REBUILDS THE GHOSTS. A ghost
  // left on a slot that has just been filled sits inside the tile that filled
  // it, and the two z-fight for the rest of the clip. `placeCell`/`removeCell`
  // do not do this for you: in the app it is the picking layer's job, and a
  // script driving the scene directly has to take that job on.
  //
  // Then all but TWO are hidden. Six rings of wireframe is what the app should
  // show someone holding a mouse -- every slot they could click -- but in a
  // recording it is six rings of high-frequency edges, which roughly doubled
  // the encoded size for detail nobody is going to read at hero scale.
  //
  // The two kept are the slots the choreography is about to fill, which is the
  // pair that actually carries meaning: a marked empty slot, then a tile
  // snapping into precisely that slot. The other four were decoration.
  // REMOVED, not hidden. Setting `visible = false` does not survive: the app
  // runs its own visibility pass over every ghost -- it decides which candidate
  // a slot shows -- and that pass turns them all back on, so the clip opened on
  // all six wires the limit exists to prevent. Detaching the extras puts them
  // beyond anything that could re-show them.
  // Driven off the SCENE GROUP, not the exported `ghosts` array.
  //
  // Measured: at frame 0 the rendered group held six objects and NONE of them
  // were entries in the array this script imported -- `mine: 0` -- so limiting
  // the array detached six things the renderer never had and left the six it
  // did. Every earlier attempt to fix the opening frame was aimed at objects
  // that were not on screen, which is why the count logged 2 while the picture
  // showed 6. Each ghost root carries its own `userData.ghost`, so the slot can
  // be read off whatever is actually in the group, whoever created it.
  const ghostGroupNode = () => {
    let n = tray.scene.baseTopExplode;
    while (n.parent) n = n.parent;
    return n.children.find((c) => c.name === "ghosts") ?? null;
  };

  const wantedRoot = (o) => {
    const slot = o?.userData?.ghost?.slot;
    return !!slot && neighbours.some(([q, r]) => slot.q === q && slot.r === r);
  };

  const limitGhosts = () => {
    const group = ghostGroupNode();
    if (!group) return;
    for (const root of [...group.children]) {
      if (wantedRoot(root)) root.visible = true;
      else group.remove(root);
    }
  };

  /** Filter the group's `add` ONCE, instead of sweeping it every frame.
   *
   *  Sweeping is a race and it was being lost: the app rebuilds its ghosts
   *  during the animation frames between the step and the shutter, so a limit
   *  applied before the paint is undone by the time the frame is read, and a
   *  limit applied after it only wins if no rebuild happens to follow. Both
   *  were tried; both produced a six-wire opening frame intermittently.
   *
   *  Refusing the object at the door is not timing-dependent: whatever rebuilds,
   *  and whenever, only the two slots this clip is framed around get in. */
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
          placeCell(neighbours[0][0], neighbours[0][1], "hex-tb-carrier-solid"),
        ),
      ),
    ],
    [
      0.3,
      topology(() =>
        added.push(
          placeCell(neighbours[1][0], neighbours[1][1], "hex-tb-carrier-solid"),
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

  // The camera is PLACED, not nudged. `controls.rotate` accumulates and then
  // damps toward the result, so the visible angle trails the commanded one and
  // the last frame lands a fraction short of the first. An absolute angle per
  // frame closes the revolution exactly: frame `total` would be the opening
  // angle again, which is why it is never rendered.
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
    // EVERY FRAME, because a one-off limit does not hold. rebuildGhosts()
    // recreates all six whenever the topology changes, and the app calls it on
    // its own as well -- so detaching the extras once at setup left the clip
    // opening on six wires anyway. Re-applying per frame is the only version
    // that survives whatever the app decides to rebuild, and it costs nothing:
    // it is a visibility flag on at most a handful of objects.
    limitGhosts();
    if (i < 2) {
      console.log(
        `[capture] ghosts total=${ghosts.length} attached=${ghosts.filter((g) => g.root.parent).length} visible=${ghosts.filter((g) => g.root.parent && g.root.visible).length}`,
      );
    }
    controls.rotateTo(az0 + 2 * Math.PI * f, polar0, false);
    bumpRender(4);
  };

  // Applied AFTER the paint, immediately before the shutter. Limiting at step
  // time does not hold: the app rebuilds its ghosts during the two animation
  // frames between the step and the screenshot, so the group is back to six by
  // the time it is captured. This is the last write before the frame is read.
  window.__limit = () => {
    sealGhostGroup();
    limitGhosts();
  };

  // Scene-graph truth, read AFTER the app has painted rather than at step time.
  // The step-time count and the rendered image disagreed, and only a probe on
  // the far side of the paint can say which one the renderer actually saw.
  // Counts what the RENDERER sees, which is the only count that ever mattered.
  // The exported `ghosts` array disagreed with the group on frame 0 -- it
  // reported two attached while six drew -- so nothing derived from it is
  // evidence about the picture.
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
}, TOTAL);

// DRIVE IT. One captured frame is exactly one scene frame: fire the beats due
// at this fraction, advance the clock by 1/30 of a second, let the app render,
// and take the shot. However long that takes in real time is irrelevant.
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
  // Re-apply the ghost limit on the far side of the paint, then let the app
  // draw once more so the removal is in the framebuffer the shutter reads.
  await page.evaluate(() => window.__limit());
  await paint();
  // Frame 0 is the frame the loop returns to, so it is the one worth asserting:
  // it must open on the two wires, not the app's full ring of six.
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

const closure = await page.evaluate(() => window.__closure());
if (
  closure.closing.cells !== closure.opening.cells ||
  closure.closing.caps !== closure.opening.caps ||
  closure.liftDrift.some((d) => d !== 0)
) {
  console.warn("loop does not close:", JSON.stringify(closure));
}

await ctx.close();
await browser.close();

if (capArg) {
  console.log(`stopped after ${TOTAL} frames (--frames), no encode`);
  process.exit(0);
}

// ENCODE THE FRAMES AS THEY ARE. No setpts, no trim, no boot to cut off: the
// capture produced exactly SECONDS * 30 frames of scene time, so the clip is
// already the right length and every frame is a real render at an even spacing.
//
// The retime this replaces is what made the loop judder -- it kept about one
// captured frame in thirty-five out of a source whose real frame times varied
// with whatever the machine was doing.
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
  // A keyframe a second, so rewinding to zero lands on a near one rather than
  // decoding forward from a single IDR.
  "-g",
  "30",
  // START AT ZERO. Without these the muxer writes a start_time of 0.066s -- two
  // frames at 30fps, the B-frame reorder delay carried as a container offset --
  // and a player rewinding waits for it every lap.
  "-muxdelay",
  "0",
  "-muxpreload",
  "0",
  "-movflags",
  "+faststart",
  `${OUT}/configurator${suffix}.mp4`,
]);

// The poster is a real frame from the middle of the clip, not a re-render.
execFileSync("ffmpeg", [
  "-y",
  "-loglevel",
  "error",
  "-i",
  `${FRAMES}/f${String(Math.floor((SECONDS * 30) / 2)).padStart(4, "0")}.png`,
  "-q:v",
  "4",
  `${OUT}/configurator${suffix}-poster.jpg`,
]);

console.log(`${SECONDS * 30} frames of scene time, encoded 1:1 at 30fps`);
for (const f of [
  `configurator${suffix}.mp4`,
  `configurator${suffix}-poster.jpg`,
]) {
  const { size } = await import("node:fs").then((m) =>
    m.statSync(`${OUT}/${f}`),
  );
  console.log(`${f}  ${(size / 1024).toFixed(0)} KB`);
}
