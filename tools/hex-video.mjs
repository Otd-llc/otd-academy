// A short silent loop of the configurator, for the /hex hero.
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
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const APP = "http://localhost:5180/hex";
const RAW =
  "C:/Users/raven/AppData/Local/Temp/claude/c--zzz-project-foundry/6b77be38-fe0b-4908-93a5-9783a0347c55/scratchpad/hexvid";
const OUT = "public/hex";
rmSync(RAW, { recursive: true, force: true });
mkdirSync(RAW, { recursive: true });
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

const browser = await chromium.launch();
const contextStart = Date.now();
const ctx = await browser.newContext({
  viewport: { width: W, height: H },
  recordVideo: { dir: RAW, size: { width: W, height: H } },
});
const page = await ctx.newPage();
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
await page.addStyleTag({
  content: `
    #header, #toolbar, #inspector, #idle-prompt, #ghost-tip, #hint,
    #crosshair, #action-sheet, #export-modal, .long-press-indicator,
    #loading { display: none !important; }
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

const trimMs = Date.now() - contextStart;

const actualMs = await page.evaluate(async (seconds) => {
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

  // One full revolution across the clip, so the last frame meets the first.
  const RATE = (2 * Math.PI) / seconds; // rad/s
  const t0 = performance.now();
  let done = false;
  let last = t0;

  // The camera and the render budget are driven from one rAF loop. Without the
  // bump the app stops drawing the moment nothing is lerping, which is what made
  // the first take a slideshow.
  // The turn is ACCUMULATED and clamped to exactly one revolution, rather than
  // left to a fixed rate for a fixed duration. Timers slip under a page that is
  // rendering every frame and cloning meshes, so the real runtime overran the
  // planned twelve seconds every time -- and an overrun at a fixed rate means
  // more than 360 degrees, which is precisely what stops the last frame meeting
  // the first. Clamping makes the loop close whatever the clock does.
  let turned = 0;
  (function spin(now) {
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    const step = Math.min(RATE * dt, 2 * Math.PI - turned);
    if (step > 0) {
      controls.rotate(step, 0, false);
      turned += step;
    }
    bumpRender(10);
    if (!done) requestAnimationFrame(spin);
  })(t0);

  // BEATS FIRE ON ROTATION ANGLE, NOT ON THE CLOCK.
  //
  // Every wall-clock version of this drifted. setTimeout is throttled hard on a
  // page rendering every frame at 1280x800 while Playwright screencasts it, so a
  // ten-second plan took sixteen and the beats slid out from under the camera.
  // Keying them to accumulated azimuth makes the two impossible to separate:
  // whatever the frame rate does, the lid opens at the same point in the turn,
  // and the clip always ends where it started.
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
  const limitGhosts = () => {
    for (const g of ghosts) {
      g.root.visible = neighbours.some(
        ([q, r]) => g.slot.q === q && g.slot.r === r,
      );
    }
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

  await new Promise((resolve) => {
    const poll = setInterval(() => {
      const f = turned / (2 * Math.PI);
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
      if (f >= 1) {
        clearInterval(poll);
        resolve(null);
      }
    }, 50);
  });
  // LET THE CAMERA ARRIVE, not just the commanded turn.
  //
  // The turn is clamped to exactly one revolution, so the COMMAND closes. The
  // camera does not: camera-controls smooth-damps toward what it was told, so
  // when the last radian is issued the visible camera is still catching up, and
  // the final frame sits a fraction of a degree short of the first. That shows
  // up as the tray's rim outlined in a first-vs-last difference -- a uniform
  // silhouette shift, which is what a small camera offset looks like and what a
  // scene-state mismatch does not.
  //
  // A flat 400ms was not enough for a 0.18s smoothTime plus the drag constant.
  // Poll the angle instead: three reads with no measurable change is arrived.
  await (async () => {
    let still = 0;
    let prev = controls.azimuthAngle;
    for (let i = 0; i < 120 && still < 3; i++) {
      await sleep(30);
      const now = controls.azimuthAngle;
      still = Math.abs(now - prev) < 1e-5 ? still + 1 : 0;
      prev = now;
    }
  })();
  await sleep(200); // and the final removal's own settle
  done = true;
  // Caps and neighbours must ALL be gone by here, or the closing frame does not
  // match the opening one and the loop visibly jumps.
  if (cells.size !== 1)
    console.warn("loop does not close: cells =", cells.size);
  // The rim of the tray was not lining up between the first and last frames,
  // and the camera clamp rules the camera out -- so report the SCENE against
  // the state the clip opened in, per axis, rather than trusting "every beat is
  // undone by a later one".
  const closing = snapshot();
  const drift = closing.lift.map((v, i) =>
    Number((v - opening.lift[i]).toFixed(6)),
  );
  if (
    closing.cells !== opening.cells ||
    closing.caps !== opening.caps ||
    drift.some((d) => d !== 0)
  ) {
    console.warn(
      "loop does not close:",
      JSON.stringify({ opening, closing, liftDrift: drift }),
    );
  }
  // The REAL elapsed time, returned so the trim is exact. Neither guess worked:
  // measuring from context creation assumed recording starts there (it does not,
  // and the beats landed 4.4s late), and trimming a fixed 12s off the end cut the
  // opening off whenever the beats overran their budget. The page is the only
  // thing that knows how long it actually took.
  return performance.now() - t0;
}, SECONDS);

await ctx.close(); // flushes the video
await browser.close();

const raw = join(
  RAW,
  readdirSync(RAW).find((f) => f.endsWith(".webm")),
);
const trim = (trimMs / 1000).toFixed(2);

// Two encodes: MP4/H.264 is the safe default and the only thing some older
// Safari builds will autoplay; WebM is smaller where it is supported.
// `faststart` puts the index at the front so playback can begin early.
execFileSync("ffmpeg", [
  "-y",
  "-loglevel",
  "error",
  "-sseof",
  `-${(actualMs / 1000).toFixed(2)}`,
  "-i",
  raw,
  "-an",
  // Retimed to a fixed length. The capture rate is whatever the machine managed;
  // the hero wants a predictable loop, and a pure speed change keeps every frame
  // real rather than interpolating new ones.
  "-vf",
  `setpts=${(SECONDS / (actualMs / 1000)).toFixed(4)}*PTS,fps=30`,
  "-c:v",
  "libx264",
  "-preset",
  "slow",
  "-crf",
  "31",
  "-pix_fmt",
  "yuv420p",
  // LOOPING IS A SEEK BACK TO ZERO, and how cheap that is depends on the
  // encode. Measured, the CONTENT closes: the final frame best-matches head
  // frame 0 out of the first forty, mean |diff| 1.19/255, with the next
  // candidate no better. So a visible hitch at the loop point is the decoder
  // rewinding, not the choreography failing to return.
  //
  // A keyframe every second gives it a near one to rewind to instead of
  // decoding forward from a single IDR at the start, and make_zero drops the
  // edit-list offset that otherwise makes the first frame arrive late.
  "-g",
  "30",
  "-avoid_negative_ts",
  "make_zero",
  // START AT ZERO. Without these the muxer writes a start_time of 0.066s -- two
  // frames at 30fps, the B-frame reorder delay carried as a container offset.
  // A player rewinding to 0 then waits for it, which is the hitch; measured on
  // the shipped clip before this line existed. `-avoid_negative_ts make_zero`
  // alone did NOT clear it.
  "-muxdelay",
  "0",
  "-muxpreload",
  "0",
  "-movflags",
  "+faststart",
  `${OUT}/configurator${suffix}.mp4`,
]);
execFileSync("ffmpeg", [
  "-y",
  "-loglevel",
  "error",
  "-sseof",
  `-${(actualMs / 1000).toFixed(2)}`,
  "-i",
  raw,
  "-an",
  "-vf",
  `setpts=${(SECONDS / (actualMs / 1000)).toFixed(4)}*PTS,fps=30`,
  "-c:v",
  "libvpx-vp9",
  "-crf",
  "36",
  "-b:v",
  "0",
  "-row-mt",
  "1",
  `${OUT}/configurator${suffix}.webm`,
]);
execFileSync("ffmpeg", [
  "-y",
  "-loglevel",
  "error",
  "-ss",
  "5",
  "-i",
  `${OUT}/configurator${suffix}.mp4`,
  "-frames:v",
  "1",
  `${OUT}/configurator${suffix}-poster.jpg`,
]);

console.log(`trimmed ${trim}s of boot`);
for (const f of [
  `configurator${suffix}.mp4`,
  `configurator${suffix}.webm`,
  `configurator${suffix}-poster.jpg`,
]) {
  const { size } = await import("node:fs").then((m) =>
    m.statSync(`${OUT}/${f}`),
  );
  console.log(`${f}  ${(size / 1024).toFixed(0)} KB`);
}
