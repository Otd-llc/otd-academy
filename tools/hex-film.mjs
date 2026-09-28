// The Hex Cluster v2 film engine: one choreography, driven frame by frame on a
// virtual clock, shared by every generator that films the configurator.
//
//   tools/hex-video.mjs        the /hex loop + its posters (both themes)
//   tools/hex-promo-cuts.mjs   the aspect-ratio cuts, the apex band, the README
//   tools/hex-stills.mjs       the /hex hero stills, the OG cutout, clean/ + ui/
//
// v1 IS GONE FROM ALL OF THEM. The earlier generators drove v1's app modules
// (`/src/hex/cells.ts`, `placeCell`) and filmed a v1 parts tray opening. None of that exists in v2 and none of it may appear in a frame. This
// file drives the v2 configurator through its own dev hook (`window.__v2`) and
// its own modules, so what the film shows is what the configurator builds.
//
// ---------------------------------------------------------------------------
// WHERE IT RUNS
// ---------------------------------------------------------------------------
// The v2 configurator's DEV server, not its built `dist`. The hook the film
// stages builds with (`window.__v2.restore`, `explodeCell`, ...) is gated on
// `import.meta.env.DEV` and is dead code in a build, and the plate layout below
// imports the configurator's own packer and part tables by URL, which only the
// dev server serves. So:
//
//   git -C <bioscale-viz> archive HEAD | tar -x -C <scratch>/v2src
//   (junction <scratch>/v2src/node_modules to the checkout's node_modules)
//   node node_modules/vite/bin/vite.js --port 5231 --strictPort
//
// against an ARCHIVED COPY of a commit, never the live checkout, so a film is
// pinned to one configurator commit and another session's in-flight edits
// cannot land in it halfway through a take. Point `HEX_V2_APP` at it; 5231 is
// only the default. (5180 is the configurator's usual dev port and 5199 is
// used by its own gates, so neither is assumed free.)
//
// ---------------------------------------------------------------------------
// THE CHOREOGRAPHY: column -> PVC -> explode -> plates, as a closed loop
// ---------------------------------------------------------------------------
// 120 BPM, 4/4: a bar is 2.000 s and five bars is the 10.000 s loop. Every
// landing is on a downbeat, because the bed (tools/hex-bed.py) strikes there:
// sparse, stated, SNAP at 4.0, DROP at 6.0, release at 8.0. Landings are drawn
// LEAD seconds early (three frames) -- a hit landing exactly on the beat is
// measurably correct and reads late.
//
//   0.0  the stacked column, framed close. The pipe is not there yet.
//   2.0  PVC: the pipe slides through the row's bores and lands; the camera has
//        pulled back to show the run it belongs to.
//   4.0  SNAP: the column's top cover lifts and snaps home.
//   6.0  DROP: the whole build explodes along its seams.
//   8.0  PLATES: every printed part has flown out of the exploded build and is
//        lying on a print bed, in its print orientation, where the
//        configurator's own packer puts it. The pipe is BOUGHT, not printed, so
//        it is not on a plate: it shrinks away as the parts leave.
//   9.9  every part has flown home to its assembled pose -- which is the
//        opening frame, so the loop closes by construction, not by a cut.
//
// ---------------------------------------------------------------------------
// WHAT IS REAL AND WHAT IS STAGED
// ---------------------------------------------------------------------------
// REAL: the build (restored through the app's own share-state path), every
// part's mesh and material (clones of the app's own scene nodes), the explode
// (the app's own seams and easing), the plate layout (`packPlates` over
// `packRows(buildV2SheetBOM(), supplyRows(bom))`, the same rows the Download
// button counts), the bed (the app's `DEFAULT_BED`), and each part's print pose
// (`part-facts.json`, applied exactly as the part modal's BED view applies it).
// STAGED: the flights between those states, the pipe's slide and the cover's
// snap. Those are film, and they are pure functions of scene time.
//
// ---------------------------------------------------------------------------
// SCRUB, NEVER PLAY
// ---------------------------------------------------------------------------
// `performance.now` is replaced with a clock this script advances by exactly
// one frame per captured frame, so a frame that takes three seconds to draw on
// a slow GPU still lands at the right scene time. Everything the film itself
// moves is a pure function of `t`. The ONE thing that is not is the app's
// explode easing, which integrates `dt` -- deterministic here because frames
// are always stepped in order from zero on the virtual clock.
import { mkdirSync, rmSync, statSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

export const HEX_V2_APP =
  process.env.HEX_V2_APP ?? "http://localhost:5231/hex.html";

/** The grid. Single source: the bed, the picture and every cut read these. */
export const FPS = 30;
export const BAR = 2.0;
export const SECONDS = 10; // five bars
/** How early a visual landing is drawn ahead of its downbeat (3 frames). */
export const LEAD = 0.1;

/**
 * The event table. LANDING times, on downbeats; the picture subtracts LEAD.
 * `tools/hex-bed.py` scores the same bars (SNAP riser at 4.0, DROP at 6.0).
 */
export const EVENTS = Object.freeze({
  pipe: 2.0, // PVC lands
  snap: 4.0, // cover snaps home
  drop: 6.0, // explode
  plates: 8.0, // parts on the beds
  home: 10.0, // reassembled == frame 0
});

/**
 * THE SHOWCASE BUILD, as a v2 share state (the shape `snapshot()` writes).
 *
 * A stacked column of three storeys with its two stacking collars and a top
 * cover, standing in a row of four cells that a PVC run passes through. Every
 * family the choreography needs is here and nothing else is: no v1 part
 * of any kind. The row is left UNCOVERED so the pipe reads.
 */
export const SHOWCASE_BUILD = Object.freeze({
  pieces: [
    { q: -1, r: 0, level: 0, variant: "full" },
    { q: 0, r: 0, level: 0, variant: "full" },
    { q: 1, r: 0, level: 0, variant: "full" },
    { q: 2, r: 0, level: 0, variant: "full" },
    { q: 0, r: 0, level: 1, variant: "full" },
    { q: 0, r: 0, level: 2, variant: "full" },
  ],
  snaps: [
    { q: 0, r: 0, level: 0, variant: "full" },
    { q: 0, r: 0, level: 1, variant: "full" },
  ],
  spikes: [],
  covers: ["0,0,2;full;top"],
  caps: [],
  inserts: [],
  handles: [],
  connectors: [],
  runs: ["r1#0#-1,0,0#3#-1,0,0,0|0,0,0,0|1,0,0,0|2,0,0,0#"],
  risers: [],
});

/** The three still builds for `public/hex/{clean,ui}/` (names kept from v1's
 *  files so every consumer of those paths keeps working, contents now v2). */
const P = (q, r, level = 0) => ({ q, r, level, variant: "full" });
const EMPTY = {
  pieces: [], snaps: [], spikes: [], covers: [], caps: [], inserts: [],
  handles: [], connectors: [], runs: [], risers: [],
};
export const STILL_BUILDS = Object.freeze({
  trio: {
    ...EMPTY,
    pieces: [P(0, 0), P(1, 0), P(0, 1), P(0, 0, 1)],
    snaps: [P(0, 0)],
    covers: ["0,0,1;full;top", "1,0,0;full;top", "0,1,0;full;top"],
  },
  flower: {
    ...EMPTY,
    pieces: [P(0, 0), P(1, 0), P(1, -1), P(0, -1), P(-1, 0), P(-1, 1), P(0, 1)],
    covers: ["1,0,0;full;top", "1,-1,0;full;top", "0,-1,0;full;top",
      "-1,0,0;full;top", "-1,1,0;full;top", "0,1,0;full;top"],
  },
  strip: SHOWCASE_BUILD,
});

export const GPU_ARGS = [
  "--use-angle=gl",
  "--enable-gpu",
  "--ignore-gpu-blocklist",
];

/**
 * Boot the configurator for filming: clock replaced, theme pinned, chrome
 * hidden, hook ready. Returns `{ ctx, page, hidden }`.
 *
 * CHROME IS HIDDEN BY RULE, AND LOGGED. Every direct child of <body> that is
 * not the canvas goes, whatever its id -- a named list goes stale the day the
 * app grows a widget -- and the ids that were hidden are returned so a run
 * prints what it removed. A capture surface that silently removes things
 * cannot be trusted about what it kept.
 */
export async function bootFilm(browser, { w, h, theme = "dark", transparent = false, keepChrome = false, scale = 1 }) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    deviceScaleFactor: scale,
    colorScheme: theme,
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log(`[page] ${String(e).slice(0, 300)}`));
  page.on("console", (m) => {
    const t = m.text();
    if (t.startsWith("[film]")) console.log(t);
    else if (m.type() === "error") console.log(`[page error] ${t.slice(0, 300)}`);
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
  }, theme);
  // The film never wants the app's own entrance: no reduced-motion override
  // here, because the explode must animate.
  await page.goto(HEX_V2_APP, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.__v2), null, { timeout: 180000 });
  await page.waitForTimeout(2500);
  let hidden = [];
  if (!keepChrome) {
    hidden = await page.evaluate((transparent) => {
      const gone = [...document.body.children]
        .filter((e) => e.tagName !== "CANVAS" && e.tagName !== "SCRIPT")
        .map((e) => `${e.tagName.toLowerCase()}#${e.id || "?"}(${getComputedStyle(e).position})`);
      const s = document.createElement("style");
      s.textContent =
        "body > *:not(canvas):not(script):not(#hexcue) { display: none !important; }" +
        (transparent ? " html, body { background: transparent !important; }" : "");
      document.head.appendChild(s);
      return gone;
    }, transparent);
  }
  return { ctx, page, hidden };
}

/**
 * Stage the film in the page: restore the build, measure the three framings,
 * lay out the plates, and install `window.__film`.
 *
 * `fill` is the SHARE of the frame's binding half-extent the subject's
 * bounding sphere may take, per framing. It is a share, not a scale: the same
 * number composes the same picture at 177 px and at 1080.
 */
export async function stageFilm(page, opts = {}) {
  const res = await page.evaluate(pageStage, {
    build: opts.build ?? SHOWCASE_BUILD,
    events: EVENTS,
    lead: LEAD,
    seconds: SECONDS,
    fill: { column: 0.78, build: 0.84, plates: 0.8, ...(opts.fill ?? {}) },
    polar: { column: 1.08, build: 1.02, plates: 0.72, ...(opts.polar ?? {}) },
    azimuth0: opts.azimuth0 ?? -0.55,
    // A STILL is one instant, so it is fitted and centred on that instant
    // alone rather than on the worst azimuth of a whole lap.
    stillAt: opts.stillAt ?? null,
    lift: opts.lift ?? 0,
    visible: opts.visible ?? { w: 1, h: 1 },
    // Where the subject's centre sits across the frame, as NDC (-1 left edge,
    // +1 right). Non-zero only for a surface whose visible window is not
    // centred on the frame (the apex band shows the left 62% of it).
    shiftX: opts.shiftX ?? 0,
    bedTheme: opts.theme ?? "dark",
  });
  return res;
}

/** Step the page to scene time `t` (frames MUST be stepped in order). */
export async function filmFrame(page, t, dtMs = 1000 / FPS) {
  await page.evaluate((t) => window.__film.step(t), t);
  await page.evaluate((ms) => window.__clock.advance(ms), dtMs);
  // Two animation frames: the app's loop runs `stepAnimations` + render in
  // one, and the second is the one the screenshot reads.
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  // Re-assert the film's own state on the far side of the app's frame, then
  // let it paint once more: the app may rebuild nodes during its frame.
  await page.evaluate((t) => window.__film.pin(t), t);
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
}

/** Projected extent of everything the film shows, as SHARES of the frame. */
export async function filmExtent(page) {
  return page.evaluate(() => window.__film.extent());
}

/** Encode a PNG sequence 1:1 at FPS. Returns bytes. */
export function encodeMp4(framesDir, out, { crf = 30, scale = null } = {}) {
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error",
    "-framerate", String(FPS),
    "-i", `${framesDir}/f%04d.png`,
    "-an",
    ...(scale ? ["-vf", `scale=${scale}:flags=lanczos`] : []),
    "-c:v", "libx264", "-preset", "slow", "-crf", String(crf),
    "-pix_fmt", "yuv420p",
    // A keyframe a second, so a rewind lands near one.
    "-g", "30",
    // Start at zero, or the muxer writes a 0.066 s start_time and every lap
    // waits for it.
    "-muxdelay", "0", "-muxpreload", "0",
    "-movflags", "+faststart",
    out,
  ]);
  return statSync(out).size;
}

/** Duration + frame count of an encoded file, read back from the file. */
export function probeMp4(file) {
  const out = execFileSync(
    "ffprobe",
    ["-v", "error", "-count_frames", "-select_streams", "v:0",
      "-show_entries", "stream=nb_read_frames,width,height:format=duration",
      "-of", "default=nw=1", file],
    { encoding: "utf8" },
  );
  const get = (k) => Number(out.match(new RegExp(`${k}=([\\d.]+)`))?.[1]);
  return {
    frames: get("nb_read_frames"),
    duration: get("duration"),
    w: get("width"),
    h: get("height"),
  };
}

/** Pull frames out of an ENCODED file at the given times, for looking at. */
export function extractFrames(file, times, outPrefix) {
  const paths = [];
  for (const t of times) {
    const p = `${outPrefix}-${t.toFixed(2)}s.png`;
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(t), "-i", file,
      "-frames:v", "1", p]);
    paths.push(p);
  }
  return paths;
}

export function freshDir(dir) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function frameCount(dir) {
  return readdirSync(dir).filter((f) => /^f\d{4}\.png$/.test(f)).length;
}

/**
 * Capture a whole take. Returns the worst extent seen across the shot (every
 * `sampleEvery`-th frame), which is the only extent that matters.
 */
export async function captureTake(page, dir, { total = SECONDS * FPS, sampleEvery = 3, onFrame = null } = {}) {
  await page.evaluate(() => window.__clock.start());
  let worst = null;
  for (let i = 0; i < total; i++) {
    const t = i / FPS;
    await filmFrame(page, t);
    if (onFrame) await onFrame(t, i);
    if (i % sampleEvery === 0) {
      const e = await filmExtent(page);
      if (e && (!worst || e.margin < worst.margin)) worst = { ...e, t };
    }
    await page.screenshot({ path: `${dir}/f${String(i).padStart(4, "0")}.png` });
    if (i % 60 === 0) console.log(`[film] frame ${i}/${total}`);
  }
  return worst;
}

// ===========================================================================
// IN-PAGE. Everything below runs inside the configurator's page, via
// page.evaluate. It may only close over its argument.
// ===========================================================================
async function pageStage(A) {
  // THREE from the SAME module instance the app uses. A bare `import("three")`
  // does not resolve in an injected script, and importing Vite's prebundled
  // copy by a guessed URL risks a second instance. The app's own scene module
  // names the exact URL it imported, so read it from there.
  const sceneSrc = await (await fetch("/src/hex/scene.ts")).text();
  const threeUrl = sceneSrc.match(/import \* as THREE from\s+["']([^"']*\/three\.js(?:\?[^"']*)?)["']/)?.[1];
  if (!threeUrl) throw new Error("could not find the app's three import");
  const THREE = await import(threeUrl);
  const { scene, camera, controls, cellsContainer, ghostGroup, renderer } = await import("/src/hex/scene.ts");
  const { buildV2SheetBOM } = await import("/src/hex/v2/export-bom.ts");
  const { supplyRows } = await import("/src/hex/v2/export-supply.ts");
  const { packRows } = await import("/src/hex/export/pack-plan.ts");
  const { packLines, partSlug } = await import("/src/hex/export/parts-pack.ts");
  const { HEX_PART_BOX } = await import("/src/hex/hex-release.generated.ts");
  const { packPlates } = await import("/src/hex/plate-pack.ts");
  const { DEFAULT_BED } = await import("/src/hex/print-bed.ts");
  const { toSceneUnits } = await import("/src/hex/v2/lattice.ts");
  const facts = (await import("/src/hex/part-facts.json")).default;
  const v2 = window.__v2;

  /**
   * The box of what is actually DRAWN. `Box3.setFromObject` counts every mesh
   * under a node, and the app parents invisible pick proxies (material
   * `visible: false`) to its parts: counted, they pushed the fitted framing off
   * centre and left a still's build in the top two thirds of its frame.
   */
  const isDrawn = (m) => {
    for (let p = m; p; p = p.parent) if (!p.visible) return false;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    return mats.some((x) => x && x.visible !== false && x.colorWrite !== false && !(x.transparent && x.opacity === 0));
  };
  const drawnBox = (obj) => {
    const box = new THREE.Box3();
    obj.updateWorldMatrix(true, true);
    obj.traverse((m) => {
      if (!m.isMesh || !m.geometry || !isDrawn(m)) return;
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      box.union(m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld));
    });
    return box;
  };
  /**
   * The drawn geometry as WORLD POINTS, for projecting. A box is not enough:
   * the run's pipe is built in world coordinates along a diagonal, so even its
   * LOCAL box is a loose rectangle, and one of its corners projected a
   * phantom 20% below the build. Small meshes give up their vertices; big
   * ones (a base is thousands) their local box's eight corners, which for an
   * axis-aligned part is tight.
   */
  const localPts = new WeakMap();
  const pointsOfGeometry = (g) => {
    let pts = localPts.get(g);
    if (pts) return pts;
    const pos = g.attributes.position;
    pts = [];
    if (pos && pos.count <= 4000) {
      for (let i = 0; i < pos.count; i++) pts.push(new THREE.Vector3().fromBufferAttribute(pos, i));
    } else {
      if (!g.boundingBox) g.computeBoundingBox();
      const b = g.boundingBox;
      for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) pts.push(new THREE.Vector3(x, y, z));
    }
    localPts.set(g, pts);
    return pts;
  };
  const cloudOf = (obj, out = []) => {
    obj.updateWorldMatrix(true, true);
    obj.traverse((m) => {
      if (!m.isMesh || !m.geometry || !isDrawn(m)) return;
      for (const p of pointsOfGeometry(m.geometry)) out.push(p.clone().applyMatrix4(m.matrixWorld));
    });
    return out;
  };
  const cornersOf = (b, out = []) => {
    for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) out.push(new THREE.Vector3(x, y, z));
    return out;
  };
  const log = (...a) => console.log("[film]", ...a);

  const settle = (ms) => new Promise((r) => setTimeout(r, ms));
  v2.collapseAll();
  v2.restore(A.build);
  await settle(2500);
  v2.restoreExplode([]);
  await settle(300);

  const clamp01 = (x) => Math.min(1, Math.max(0, x));
  const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
  const easeInOut = (x) => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const easeIn = (x) => { x = clamp01(x); return x * x * x; };
  const easeOut = (x) => { x = clamp01(x); return 1 - Math.pow(1 - x, 3); };
  const E = A.events;
  const L = A.lead;
  const mm = toSceneUnits(1);

  // ---- the parts: every node the BOM walk counts as one part ----------------
  // The same walk `collectV2Anchors` makes: the first node down each branch
  // that carries a `modelPath` IS a part instance.
  const anchorsNow = () => {
    const out = [];
    const visit = (n) => {
      if (n.userData.modelPath) { out.push(n); return; }
      for (const c of n.children) visit(c);
    };
    for (const c of cellsContainer.children) visit(c);
    return out;
  };
  const pipesNow = () => cellsContainer.children.filter((c) => c.userData.runPipe);
  const snapshotOf = (n) => {
    n.updateWorldMatrix(true, false);
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    n.matrixWorld.decompose(p, q, s);
    return { p, q, s };
  };

  const assembled = anchorsNow().map((n) => ({
    path: n.userData.modelPath,
    slug: partSlug(`${n.userData.modelPath.split("/").pop().replace(/\.gltf$/, "")}.FCStd`),
    home: snapshotOf(n),
    source: n,
  }));
  // Deterministic order: by height, then x, then z. Everything downstream
  // (plate assignment, flight stagger) keys off this order.
  const key = (a) => [a.home.p.y, a.home.p.x, a.home.p.z];
  assembled.sort((a, b) => {
    const ka = key(a), kb = key(b);
    for (let i = 0; i < 3; i++) if (Math.abs(ka[i] - kb[i]) > 1e-6) return ka[i] - kb[i];
    return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
  });

  // ---- the plates: the configurator's own packer, over its own rows ---------
  const rows = packRows(buildV2SheetBOM(), supplyRows(v2.bom()));
  const lines = packLines(rows);
  const bed = { ...DEFAULT_BED };
  const plates = packPlates(lines.map((l) => ({ ...l, box: HEX_PART_BOX[l.slug] })), bed);
  const cols = Math.ceil(Math.sqrt(plates.length));
  const plateRows = Math.ceil(plates.length / cols);
  const bedW = bed.x * mm, bedD = bed.y * mm;
  const gap = 40 * mm;

  // The build's footprint centre and floor, assembled.
  const buildBox = new THREE.Box3();
  for (const a of assembled) buildBox.union(drawnBox(a.source));
  for (const p of pipesNow()) buildBox.union(drawnBox(p));
  const floorY = buildBox.min.y;
  const centre = buildBox.getCenter(new THREE.Vector3());
  const gridW = cols * bedW + (cols - 1) * gap;
  const gridD = plateRows * bedD + (plateRows - 1) * gap;
  const bedThick = 3 * mm;
  const film = new THREE.Group();
  film.name = "film";
  scene.add(film);
  const bedsGroup = new THREE.Group();
  film.add(bedsGroup);
  const bedMat = new THREE.MeshStandardMaterial({
    color: A.bedTheme === "light" ? 0xd6d0c2 : 0x1d2431,
    roughness: 0.85,
    metalness: 0.0,
    transparent: true,
  });
  const edgeMat = new THREE.LineBasicMaterial({
    color: 0xc8963e,
    transparent: true,
    opacity: A.bedTheme === "light" ? 0.7 : 0.55,
  });
  const plateOrigin = [];
  plates.forEach((_, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    const x0 = centre.x - gridW / 2 + c * (bedW + gap);
    const z0 = centre.z - gridD / 2 + r * (bedD + gap);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(bedW, bedThick, bedD), bedMat);
    // Relative to the grid centre, so the beds can grow OUT of it.
    slab.position.set(x0 + bedW / 2 - centre.x, -bedThick / 2, z0 + bedD / 2 - centre.z);
    slab.receiveShadow = true;
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(bedW, bedThick, bedD)),
      edgeMat,
    );
    edges.position.copy(slab.position);
    bedsGroup.add(slab, edges);
    plateOrigin.push({ x0, z0 });
  });
  bedsGroup.position.set(centre.x, floorY, centre.z);

  // Print pose, exactly as part-modal.ts's BED view builds it: the manifest is
  // Z-up, three is Y-up, so X stays X, manifest Y turns about -Z, Z about Y.
  const poseQ = (slug) => {
    const o = new THREE.Object3D();
    for (const step of facts.parts?.[slug]?.pose ?? facts[slug]?.pose ?? []) {
      const rad = (step.degrees * Math.PI) / 180;
      if (step.axis === "X") o.rotateX(rad);
      else if (step.axis === "Y") o.rotateZ(-rad);
      else o.rotateY(rad);
    }
    return o.quaternion.clone();
  };

  // Assign placements to part instances, slug by slug, in order.
  const bySlug = new Map();
  for (const a of assembled) {
    if (!bySlug.has(a.slug)) bySlug.set(a.slug, []);
    bySlug.get(a.slug).push(a);
  }
  const placed = [];
  const unmatched = [];
  plates.forEach((plate, pi) => {
    for (const pl of plate) {
      const pool = bySlug.get(pl.slug);
      const a = pool?.find((x) => !x.plate);
      if (!a) { unmatched.push(pl.slug); continue; }
      a.plate = { index: pi, x: pl.x, y: pl.y, box: pl.box };
      placed.push(a);
    }
  });
  const leftover = assembled.filter((a) => !a.plate).map((a) => a.slug);

  // Build a flying clone per part and its plate pose.
  const flyers = [];
  for (const a of assembled) {
    const clone = a.source.clone(true);
    clone.matrixAutoUpdate = true;
    film.add(clone);
    let plate = null;
    if (a.plate) {
      const q = poseQ(a.slug);
      clone.position.set(0, 0, 0);
      clone.quaternion.copy(q);
      clone.scale.copy(a.home.s);
      clone.updateMatrixWorld(true);
      const b = drawnBox(clone);
      const o = plateOrigin[a.plate.index];
      const p = new THREE.Vector3(
        o.x0 + a.plate.x * mm - b.min.x,
        floorY - b.min.y,
        o.z0 + a.plate.y * mm - b.min.z,
      );
      plate = { p, q, s: a.home.s.clone(), size: b.getSize(new THREE.Vector3()) };
    }
    clone.visible = false;
    flyers.push({ a, clone, plate, from: null });
  }
  // Stagger: plate by plate, so plate one fills first.
  const order = [...flyers].sort((f, g) =>
    (f.plate?.index ?? 99) - (g.plate?.index ?? 99));
  order.forEach((f, i) => (f.rank = i / Math.max(1, order.length - 1)));

  // ---- the pipe: BOUGHT, so it slides in and shrinks away -------------------
  // A clone with its own geometry (the app's run mesh owns its geometry and
  // may dispose it on a rebuild), rebased so the pivot sits on the end the run
  // enters from, and scaled along its long axis.
  const pipeFlyers = [];
  for (const src of pipesNow()) {
    const geo = src.geometry.clone();
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    const size = bb.getSize(new THREE.Vector3());
    const axis = size.x >= size.y && size.x >= size.z ? "x" : size.y >= size.z ? "y" : "z";
    // Which local end is further WEST in the world: that is where it enters.
    src.updateWorldMatrix(true, false);
    const lo = new THREE.Vector3(), hi = new THREE.Vector3();
    lo.copy(bb.getCenter(new THREE.Vector3())); lo[axis] = bb.min[axis];
    hi.copy(lo); hi[axis] = bb.max[axis];
    const wlo = lo.clone().applyMatrix4(src.matrixWorld);
    const whi = hi.clone().applyMatrix4(src.matrixWorld);
    const fromMin = wlo.x <= whi.x;
    const pivot = fromMin ? lo : hi;
    geo.translate(-pivot.x, -pivot.y, -pivot.z);
    const mesh = new THREE.Mesh(geo, src.material);
    mesh.castShadow = src.castShadow;
    mesh.receiveShadow = src.receiveShadow;
    const holder = new THREE.Group();
    holder.matrixAutoUpdate = false;
    holder.matrix.copy(src.matrixWorld).multiply(new THREE.Matrix4().makeTranslation(pivot.x, pivot.y, pivot.z));
    holder.add(mesh);
    film.add(holder);
    pipeFlyers.push({ mesh, holder, axis, sign: fromMin ? 1 : -1 });
  }

  // ---- the cover SNAP: the top cover, lifted and dropped home ---------------
  const topCover = [...flyers]
    .filter((f) => /cover/.test(f.a.slug))
    .sort((f, g) => g.a.home.p.y - f.a.home.p.y)[0] ?? null;

  // ---- the framings: MEASURED, not derived from a bounding sphere ----------
  // A sphere round a long flat row over-covers it badly (the first take framed
  // the build at under a third of the frame) and under-covers a tall stack at
  // some azimuths. So every framing is FITTED: place the camera, project the
  // eight corners of every part's own box at every azimuth that framing is on
  // screen for, and move the camera until the WORST azimuth fills exactly the
  // share asked for. The share is of the VISIBLE window, which is the whole
  // frame except on a surface that crops (the apex band, the academy hero).
  const cloudOfAll = (nodes) => nodes.reduce((acc, n) => cloudOf(n, acc), []);
  const cellsXZ = [...new Set(A.build.pieces.map((p) => `${p.q},${p.r}`))].map((s) => s.split(",").map(Number));
  const assembledBoxes = cloudOfAll([...anchorsNow(), ...pipesNow()]);
  // The SNAP lifts the top cover: its lifted box belongs to the assembled shot.
  if (topCover && A.stillAt == null) {
    for (const p of cloudOf(topCover.a.source, [])) assembledBoxes.push(p.add(new THREE.Vector3(0, 120 * mm, 0)));
  }
  // Explode once, snapped, to measure; then put it back.
  for (const [q, r] of cellsXZ) v2.explodeCell(q, r);
  const explodedKeys = v2.explodedPartKeys();
  v2.restoreExplode(explodedKeys);
  await settle(250);
  const explodedBoxes = cloudOfAll([...anchorsNow(), ...pipesNow()]);
  v2.restoreExplode([]);
  await settle(250);
  const plateBoxes = [];
  bedsGroup.updateMatrixWorld(true);
  for (const c of bedsGroup.children) if (c.isMesh) cornersOf(drawnBox(c), plateBoxes);
  for (const f of flyers) {
    if (!f.plate) continue;
    // The part AT its plate pose, measured, then hidden again.
    f.clone.visible = true;
    f.clone.position.copy(f.plate.p);
    f.clone.quaternion.copy(f.plate.q);
    f.clone.scale.copy(f.plate.s);
    cloudOf(f.clone, plateBoxes);
    f.clone.visible = false;
  }

  const azAt = (t) => A.azimuth0 + (2 * Math.PI * t) / A.seconds;
  const posFor = (target, dist, polar, az) => new THREE.Vector3(
    target.x + dist * Math.sin(polar) * Math.sin(az),
    target.y + dist * Math.cos(polar),
    target.z + dist * Math.sin(polar) * Math.cos(az),
  );
  const probeCam = camera.clone();
  const measure = (boxes, target, dist, polar, az) => {
    probeCam.position.copy(posFor(target, dist, polar, az));
    probeCam.up.set(0, 1, 0);
    probeCam.lookAt(target);
    probeCam.updateMatrixWorld(true);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    const v = new THREE.Vector3();
    for (const p of boxes) {
      v.copy(p).project(probeCam);
      x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
    }
    return { x0, x1, y0, y1 };
  };
  const fit = (boxes, polar, times, share) => {
    const union = new THREE.Box3().setFromPoints(boxes);
    const target = union.getCenter(new THREE.Vector3());
    let dist = union.getSize(new THREE.Vector3()).length() * 1.5;
    const tanV = Math.tan(((camera.fov * Math.PI) / 180) / 2);
    for (let it = 0; it < 12; it++) {
      let worst = 0, cy = 0, cx = 0;
      for (const t of times) {
        const m = measure(boxes, target, dist, polar, azAt(t));
        worst = Math.max(worst, Math.max(-m.x0, m.x1) / A.visible.w, Math.max(-m.y0, m.y1) / A.visible.h);
        cy += (m.y0 + m.y1) / 2 / times.length;
      }
      // Centre vertically on the average of the shot, then set the distance
      // so the worst instant fills exactly `share`.
      target.y += cy * dist * tanV / Math.max(0.3, Math.sin(polar));
      dist *= worst / share;
    }
    target.y -= dist * A.lift;
    return { target, dist, polar };
  };
  const span = (a, b, n = 16) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
  const F = {
    // On screen 0 -> 5.9 and 9.9 -> 10.
    assembled: fit(assembledBoxes, A.polar.column,
      A.stillAt != null ? [A.stillAt] : [...span(0, E.drop - 0.5, 24), E.home - L], A.fill.column),
    // On screen through the drop until the parts leave.
    exploded: fit(explodedBoxes, A.polar.build, span(E.drop - L, E.plates - 1.0, 8), A.fill.build),
    plates: fit(plateBoxes, A.polar.plates, span(E.plates - L, E.home - 1.0, 8), A.fill.plates),
  };

  controls.minDistance = 0;
  controls.maxDistance = Infinity;
  camera.far = Math.max(camera.far, F.plates.dist * 6, F.exploded.dist * 6);
  camera.updateProjectionMatrix();

  // The camera's weight curve over the loop:
  //   assembled (0 -> 5.9)  ->  exploded (pulls back ON the drop)
  //   -> plates (7.0 -> 7.9, with the parts)  ->  assembled (9.0 -> 9.9).
  const camAt = (t) => {
    let a = F.assembled, b = F.assembled, u = 0;
    // The pull-back STARTS before the drop: the explode's first frames are its
    // fastest (an exponential ease), and a camera that waited for it let the
    // column's top leave the frame at 5.9 s.
    if (t < E.drop - 0.5) { /* assembled */ }
    else if (t < E.plates - 1.0) { a = F.assembled; b = F.exploded; u = easeInOut((t - (E.drop - 0.5)) / 1.0); }
    else if (t < E.plates - L) { a = F.exploded; b = F.plates; u = easeInOut((t - (E.plates - 1.0)) / (1.0 - L)); }
    else if (t < E.home - 1.0) { a = b = F.plates; }
    else if (t < E.home - L) { a = F.plates; b = F.assembled; u = easeInOut((t - (E.home - 1.0)) / (1.0 - L)); }
    const target = a.target.clone().lerp(b.target, u);
    const dist = a.dist + (b.dist - a.dist) * u;
    const polar = a.polar + (b.polar - a.polar) * u;
    // One revolution per lap, so the last frame meets the first.
    return { target, dist, polar, az: azAt(t) };
  };
  const placeCamera = (t) => {
    const c = camAt(t);
    const pos = posFor(c.target, c.dist, c.polar, c.az);
    controls.setLookAt(pos.x, pos.y, pos.z, c.target.x, c.target.y, c.target.z, false);
    // A focal offset slides the view sideways without turning it, so the
    // subject sits at `shiftX` of the frame at every azimuth.
    const tanH = Math.tan(((camera.fov * Math.PI) / 180) / 2) * camera.aspect;
    controls.setFocalOffset(-A.shiftX * c.dist * tanH, 0, 0, false);
    controls.update(0);
  };

  // ---- the frame function ----------------------------------------------------
  const FLY_OUT = [E.plates - 1.0, E.plates - L]; // 7.0 -> 7.9
  const FLY_HOME = [E.home - 1.0, E.home - L]; // 9.0 -> 9.9
  const SPAN = 0.55; // each part's own flight, inside the window
  const ARC = 60 * mm;
  let explodedAt = null;
  let exploded = false;
  let captured = false;

  const hideAppExtras = () => {
    ghostGroup.visible = false;
    // Loose marks the app parents to the scene root (the run-start diamond,
    // free-start rings): anything that is not a light, the floor catcher, the
    // cells or the film.
    for (const c of scene.children) {
      if (c === cellsContainer || c === film || c === ghostGroup) continue;
      if (c.isLight || c.name === "shadow-catcher") continue;
      c.visible = false;
    }
    for (const p of pipesNow()) p.visible = false;
  };

  const flightPose = (f, u, from, to) => {
    const p = from.p.clone().lerp(to.p, u);
    p.y += Math.sin(Math.PI * u) * ARC;
    const q = from.q.clone().slerp(to.q, u);
    return { p, q };
  };
  const localU = (f, t, win) => {
    const start = win[0] + f.rank * (win[1] - win[0] - SPAN);
    return easeInOut((t - start) / SPAN);
  };

  const apply = (t) => {
    hideAppExtras();
    // THE SHADOW MAP IS NOT REDRAWN UNLESS ASKED. The app runs it with
    // `autoUpdate` off and flags it only when ITS build moves, so every part the
    // film moves left its shadow where it had been -- measured as a detached
    // hexagon of shadow on the floor beside the reassembled build at 9.96 s.
    renderer.shadowMap.needsUpdate = true;
    // App-side state changes, fired once, in order.
    if (t >= E.drop - L && !exploded) {
      for (const [q, r] of cellsXZ) v2.explodeCell(q, r);
      exploded = true;
    }
    const inFlight = t >= FLY_OUT[0] && t < FLY_HOME[1];
    if (inFlight && !captured) {
      // The exploded pose of every part, read off the app's own scene at the
      // moment the parts leave it.
      const now = anchorsNow();
      for (const f of flyers) {
        let best = null, bd = Infinity;
        for (const n of now) {
          if (n.userData.modelPath !== f.a.path) continue;
          const wp = n.getWorldPosition(new THREE.Vector3());
          const d = Math.hypot(wp.x - f.a.home.p.x, wp.z - f.a.home.p.z) + Math.abs(wp.y - f.a.home.p.y) * 1e-3;
          if (d < bd) { bd = d; best = n; }
        }
        f.from = best ? snapshotOf(best) : f.a.home;
      }
      captured = true;
      // Collapse NOW, snapped, while the build is hidden behind its flyers: it
      // must be at rest and home long before the parts land back on it.
      v2.restoreExplode([]);
    }
    if (t < FLY_OUT[0]) { captured = false; }
    cellsContainer.visible = !inFlight;
    bedsGroup.visible = t >= FLY_OUT[0] && t < FLY_HOME[1];
    // Beds rise into place ahead of the parts, and sink after they leave.
    // The beds GROW out of the build's footprint as the camera rises to them,
    // and shrink back into it on the way home. Laid out at full size they
    // reached out of the exploded framing's frame before the camera had moved
    // (measured: y0 -1.25 at 6.6 s).
    const bedIn = easeOut((t - FLY_OUT[0]) / 0.7);
    // Out in step with the camera's return, or their far corners run off
    // the bottom of the frame as it comes down (measured at 9.5 s).
    const bedOut = 1 - easeInOut((t - (FLY_HOME[0] + 0.1)) / 0.8);
    const bedK = Math.max(1e-3, Math.min(bedIn, bedOut));
    bedsGroup.scale.set(bedK, 1, bedK);
    bedMat.opacity = bedK;
    edgeMat.opacity = (A.bedTheme === "light" ? 0.7 : 0.55) * bedK;

    for (const f of flyers) {
      const c = f.clone;
      if (!inFlight) {
        // The cover SNAP is the only flyer shown while the build is.
        if (f === topCover && t >= E.snap - 0.9 && t < E.snap - L) {
          const u = (t - (E.snap - 0.9)) / (0.9 - L);
          // Up fast, hang, then drop home on the beat.
          const up = easeOut(u / 0.35);
          const down = easeIn((u - 0.55) / 0.45);
          const h = 120 * mm * (up - down);
          c.visible = true;
          c.position.copy(f.a.home.p);
          c.position.y += Math.max(0, h);
          c.quaternion.copy(f.a.home.q);
          c.scale.copy(f.a.home.s);
          hideSource(f);
        } else {
          c.visible = false;
          showSource(f);
        }
        continue;
      }
      const from = f.from ?? f.a.home;
      if (t < FLY_HOME[0]) {
        const u = localU(f, t, FLY_OUT);
        if (f.plate) {
          const pose = flightPose(f, u, from, f.plate);
          c.position.copy(pose.p); c.quaternion.copy(pose.q); c.scale.copy(f.plate.s);
        } else {
          c.position.copy(from.p); c.quaternion.copy(from.q);
          c.scale.copy(from.s).multiplyScalar(1 - easeIn(u));
        }
      } else {
        const u = localU(f, t, FLY_HOME);
        if (f.plate) {
          const pose = flightPose(f, u, f.plate, f.a.home);
          c.position.copy(pose.p); c.quaternion.copy(pose.q); c.scale.copy(f.a.home.s);
        } else {
          c.position.copy(f.a.home.p); c.quaternion.copy(f.a.home.q);
          c.scale.copy(f.a.home.s).multiplyScalar(easeOut(u));
        }
      }
      c.visible = c.scale.x > 1e-4;
    }

    // The pipe: slides in before the PVC downbeat, shrinks as the parts leave.
    for (const pf of pipeFlyers) {
      let k;
      if (t < E.pipe - 0.75) k = 0;
      else if (t < E.pipe - L) k = easeOut((t - (E.pipe - 0.75)) / (0.75 - L));
      else if (t < FLY_OUT[0]) k = 1;
      else k = 1 - easeIn((t - FLY_OUT[0]) / 0.4);
      pf.holder.visible = k > 1e-4;
      pf.mesh.scale.set(1, 1, 1);
      pf.mesh.scale[pf.axis] = Math.max(1e-4, k);
    }

    placeCamera(t);
  };
  const srcHidden = new Set();
  function hideSource(f) {
    for (const n of anchorsNow()) {
      if (n.userData.modelPath === f.a.path) {
        const wp = n.getWorldPosition(new THREE.Vector3());
        if (wp.distanceTo(f.a.home.p) < 1e-4) { n.visible = false; srcHidden.add(n); }
      }
    }
  }
  function showSource(f) {
    for (const n of [...srcHidden]) {
      if (n.userData.modelPath === f.a.path) { n.visible = true; srcHidden.delete(n); }
    }
  }

  /** Projected extent of what is on screen, as shares of the frame. */
  const extent = () => {
    const box = new THREE.Box3();
    const v = new THREE.Vector3();
    for (const p of [...cloudOf(cellsContainer, []), ...cloudOf(film, [])]) box.expandByPoint(v.copy(p).project(camera));
    if (box.isEmpty()) return null;
    // NDC -> shares from the centre, against the VISIBLE window.
    // Measured from where the subject is MEANT to sit, not from the centre.
    const x0 = box.min.x - A.shiftX, x1 = box.max.x - A.shiftX, y0 = box.min.y, y1 = box.max.y;
    const mx = Math.min(A.visible.w - Math.max(-x0, x1), 9);
    const my = Math.min(A.visible.h - Math.max(-y0, y1), 9);
    return {
      x0: +x0.toFixed(3), x1: +x1.toFixed(3), y0: +y0.toFixed(3), y1: +y1.toFixed(3),
      marginX: +(mx / 2).toFixed(3), marginY: +(my / 2).toFixed(3),
      margin: +(Math.min(mx, my) / 2).toFixed(3),
    };
  };

  window.__film = {
    step: (t) => apply(t),
    pin: (t) => apply(t),
    extent,
    camAt: (t) => { const c = camAt(t); return { ...c, target: c.target.toArray() }; },
  };
  // Start clean at t = 0.
  apply(0);
  log(`plates ${plates.length} on ${bed.x}x${bed.y}, parts ${assembled.length}, placed ${placed.length}, ` +
    `not printed ${leftover.join(",") || "-"}, unmatched ${unmatched.join(",") || "-"}, pipes ${pipeFlyers.length}`);
  return {
    plates: plates.map((p) => p.map((q) => q.slug)),
    parts: assembled.length,
    placed: placed.length,
    leftover,
    unmatched,
    pipes: pipeFlyers.length,
    explodedKeys,
    framing: Object.fromEntries(Object.entries(F).map(([k, v]) => [k, { dist: +v.dist.toFixed(3), target: v.target.toArray().map((x) => +x.toFixed(3)) }])),
  };
}
