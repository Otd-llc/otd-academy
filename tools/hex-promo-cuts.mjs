// Promotional cuts of the Hex Cluster v2 loop, at the aspect ratios the /hex
// page's own clip cannot serve: the four social masters' sources, the apex
// home band, the academy hero band, and the README animated WebP.
//
// v2 ONLY. The choreography, the build, the virtual clock and the framing all
// live in tools/hex-film.mjs, which every generator shares -- read its header
// for WHAT is filmed and WHY each trap exists. This file only knows about
// SHAPES: the viewport, how much of it a surface actually shows, where the
// platform's furniture sits, and the kinetic type.
//
// The v1 cuts this replaces filmed a v1 parts tray opening under a revolving
// camera (`--choreo=hero|orbit`, `--ground-mark`). Those flags are gone with the
// parts they filmed; there is one choreography now.
//
// WHAT A PRESET IS
//
//   Framing is a SHARE of the frame, never a camera distance. `fill` is the
//   share of the visible half-extent the subject may reach at its WORST
//   instant (tools/hex-film.mjs fits every framing across every azimuth it is
//   on screen for), and `visible` is the share of each axis the surface
//   actually shows. A cut for a surface shown through `object-fit: cover`
//   declares the crop, and the subject is fitted inside what survives it.
//   Resolution-independent by construction: the same numbers compose the same
//   picture at 177 px and at 1080.
//
// Output lands OUTSIDE every repo, in `c:/zzz/_hex-promo`: these cuts are
// destined for the apex site, the org profile README, the personal README and
// social, and none of them is this repo.
//
// USAGE (the configurator dev server must be up; see tools/hex-film.mjs)
//   node tools/hex-promo-cuts.mjs --probe                  every preset, framing only
//   node tools/hex-promo-cuts.mjs --preset=vertical        one cut, dark
//   node tools/hex-promo-cuts.mjs --preset=readme --light  one cut, ivory
//   node tools/hex-promo-cuts.mjs --preset=square --frames=60   short look, no encode
//   node tools/hex-promo-cuts.mjs --preset=wide --text     cut with the type burned in
//   node tools/hex-promo-cuts.mjs --check=<frame dir>      the seam gate alone
//
// `--text` burns the APPROVED cue sheet in (PRINT 2.0, SNAP 4.0, GROW 6.0, FREE
// + the download 8.0), copied verbatim below from the preview that was signed
// off. The words were approved against the v1 picture; against v2 they land
// on: PRINT -> the pipe arriving, SNAP -> the cover snapping home, GROW -> the
// explode, FREE -> the parts on their plates. The owner should look at that
// pairing before any text cut is posted.
import { chromium } from "playwright";
import { mkdirSync, renameSync, rmSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import {
  GPU_ARGS,
  SECONDS,
  FPS,
  bootFilm,
  stageFilm,
  filmFrame,
  filmExtent,
  probeMp4,
} from "./hex-film.mjs";

const RAW =
  process.env.HEX_FILM_SCRATCH ??
  "C:/Users/raven/AppData/Local/Temp/hex-film/cuts";
const OUT = "C:/zzz/_hex-promo";

const PRESETS = {
  // 16:9 -- YouTube, X/LinkedIn landscape.
  wide: { w: 1920, h: 1080 },
  // 9:16 -- Shorts, Reels, TikTok. CHROME IS NOT A CROP: the platform draws its
  // furniture over a frame shown whole. Measured on the academy cut: the action
  // rail from 83.3% across, the caption block from 74% down, the header the
  // top 11.5%, plus 3% breathing room on the furniture sides. The subject is
  // fitted inside what is left, and the type is gated against it.
  vertical: {
    w: 1080, h: 1920,
    chrome: { top: 11.5, right: 19.7, bottom: 26, left: 5.6 },
  },
  // 1:1 -- X and LinkedIn feed.
  square: { w: 1080, h: 1080 },
  // 4:5 -- LinkedIn and Instagram feed.
  portrait: { w: 1080, h: 1350 },
  // FOR A CROPPED BAND: the academy /hex hero showed its clip through
  // `object-fit: cover` and kept 74% of the height at a 1440 viewport.
  band: {
    w: 1920, h: 1080, cropped: true,
    budget: 500 * 1024,
    visible: { w: 1, h: 0.74 },
    textSafe: 24,
    textDl: { cell: "c-bl", align: "" },
  },
  // THE APEX HOME BAND (`cluster-loop.mp4`). `.hx-band video` is 124% wide,
  // 46vh tall (min 320 px), `object-fit: cover`, pushed right by 19% of its
  // own width, with the copy over a scrim on the left. At 1440x900 the page
  // shows the source's rows 317-763 (41% of its height) and columns 0-1183
  // (the LEFT 62% -- the right of the clip runs off the viewport), and the
  // copy covers columns up to ~333. So the free window is NDC x -0.65..+0.23,
  // y +-0.41: centred at -0.21, and the subject is shifted there rather than
  // shrunk to fit a centred window whose right edge is at +0.23.
  apex: {
    w: 1920, h: 1080, cropped: true,
    visible: { w: 0.42, h: 0.37 },
    shiftX: -0.21,
    crf: 30,
    budget: 500 * 1024,
  },
  // 16:10 at README width. Captured small on purpose: it becomes an animated
  // WebP, where every pixel is bytes in someone's README render.
  readme: { w: 960, h: 600 },
};

// The animated-WebP recipe, README preset only. Frame rate and width are a size
// decision: 300 frames of 960px lossy WebP is several MB. READMEs bake the dark
// field in -- a `<picture>` switched on `prefers-color-scheme` follows the OS,
// not GitHub's own theme picker, and a transparent capture cost ~3.4x the bytes.
// v2: 12 fps at 640 px. The v2 loop's plates beat puts nine beds of edges in
// every frame, and at v1's 15 fps / 720 px the README WebP measured 1009 KB at
// q72 and still 808 KB at q48 -- quality alone cannot buy it back. 12 fps /
// 640 px / q64 measured 644 KB; the budget loop below takes it the rest of the
// way.
const WEBP = { fps: 12, width: 640, quality: 64 };

const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`));
const flag = (name) => process.argv.includes(`--${name}`);

const PROBE = flag("probe");
const THEME = flag("light") ? "light" : "dark";
const TEXT = flag("text");
const suffix = `${TEXT ? "-text" : ""}${THEME === "light" ? "-light" : ""}`;

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
const TOTAL = capArg ? Number(capArg.split("=")[1]) : SECONDS * FPS;

mkdirSync(OUT, { recursive: true });

/** The visible window a preset's subject is fitted inside, as shares. A
 *  vertical cut's furniture shrinks it asymmetrically; the fit is symmetric,
 *  so it takes the tighter side of each axis. */
function visibleOf(p) {
  if (p.visible) return p.visible;
  if (p.chrome) {
    const c = p.chrome;
    return {
      w: 1 - (2 * Math.max(c.left, c.right)) / 100,
      h: 1 - (2 * Math.max(c.top, c.bottom)) / 100,
    };
  }
  return { w: 1, h: 1 };
}

async function stage(page, p) {
  return stageFilm(page, {
    theme: THEME,
    visible: visibleOf(p),
    shiftX: p.shiftX ?? 0,
    // RESERVE THE TYPE'S BAND OUT OF THE PLATES SHOT. FREE and the download
    // share 8.0, the download centred in the bottom band -- exactly where the
    // plates grid sat at the default fill, so the arrow drew across a bed
    // (measured on the first wide --text cut at 8.3 s). With type on, the
    // plates are fitted smaller so the band is theirs.
    fill: TEXT ? { plates: 0.6, ...(p.fill ?? {}) } : p.fill,
  });
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
 *  The question a loop poses is whether the jump from the last frame back to
 *  the first is visible, and that has a direct measurement: compare it with
 *  the steps AROUND it. The seam is one frame's worth of motion like any other,
 *  so it should not stand out from the three steps before it and the three
 *  after.
 *
 *  THE NEIGHBOURS, NOT THE QUIETEST STEP IN THE CLIP. The v1 gate compared the
 *  seam with the quietest of four steps sampled across the clip, which was
 *  right for v1: its seam sat in a collapsed passage where only the camera
 *  moved. The v2 seam is mid-orbit at full framing, so it is exactly as busy as
 *  its neighbours, and measured on the wide cut it read 1.143 against
 *  neighbours of 1.152 / 1.156 / 1.129 / 1.127 -- continuous -- while the
 *  "quietest step in the clip" (1.052) was a frame where the subject happened
 *  to be smaller. A gate that fails a continuous seam teaches its reader to
 *  scroll past it. The old number is still printed, for comparison. */
function seamCheck(dir, total) {
  const f = (i) => `${dir}/f${String(((i % total) + total) % total).padStart(4, "0")}.png`;
  const seam = frameDiff(f(total - 1), f(0));
  const around = [-4, -3, -2, 0, 1, 2]
    .map((k) => total + k)
    .map((i) => frameDiff(f(i), f(i + 1)));
  const sorted = [...around].sort((a, b) => a - b);
  const median = (sorted[2] + sorted[3]) / 2;
  const ok = seam <= median * 1.15;
  const ordinary = [0.17, 0.4, 0.67, 0.9]
    .map((p) => Math.floor(total * p))
    .map((i) => frameDiff(f(i), f(i + 1)));
  console.log(
    `[seam] ${ok ? "ok" : "SEAM VISIBLE"}  seam=${seam.toFixed(3)}  neighbours ` +
      `${around.map((v) => v.toFixed(3)).join(", ")} (median ${median.toFixed(3)}, limit x1.15)` +
      `  [clip-wide steps ${ordinary.map((v) => v.toFixed(2)).join(", ")}]`,
  );
  return ok;
}

// `--check=<dir>` runs the seam gate alone against a frame dump that already
// exists, so the gate can be exercised without paying for a 300-frame capture.
const checkArg = arg("check");
if (checkArg) {
  const dir = checkArg.slice("--check=".length);
  process.exit(seamCheck(dir, TOTAL) ? 0 : 1);
}

// ---- the kinetic text, burned in ------------------------------------------
//
// THE APPROVED SPEC LIVES IN `C:/zzz/_hex-promo/final-preview.html` AND THE CSS
// BELOW IS COPIED FROM IT, not rewritten from the same intent. The preview is
// what was judged: five cues on strikes in the bed, PRINT 2.0, SNAP 4.0 with a
// 0.3 s lead so the halves MEET on the beat, GROW 6.0 growing through the drop,
// FREE and the actuated download sharing 8.0. Reconstructing the rules would
// silently ship something adjacent to what was signed off.
//
// COMPOSITED BY THE BROWSER, NOT IN POST. The layer is injected into the page
// the scene is already rendering in, so one screenshot carries picture and type
// together. Rendering a transparent overlay separately and compositing with
// ffmpeg would double the render and add a second copy of the cue sheet to keep
// in sync.
//
// EVERY ANIMATION IS SCRUBBED, NEVER PLAYED, and that is the load-bearing part.
// The capture replaces `performance.now` with a clock it advances by hand, and
// a frame can take any amount of wall time to draw. An animation left running
// would land wherever REAL time reached, which is precisely the judder the
// virtual clock exists to remove. So each animation is paused and its
// `currentTime` pinned to the frame's scene time. `Animation.currentTime` is
// measured from the start of the delay, so the per-character stagger and the
// download's 0.1 s offset come out right without special handling.
//
// Opacity is computed rather than transitioned for the same reason: a CSS
// transition has no seek.
//
// TWO DELIBERATE DEPARTURES FROM THE PREVIEW, both about the loop seam, which
// the preview never had to survive because a <video> in a page just jumps:
//
//   1. The animations bind to `.held` rather than `.on`. In the preview,
//      removing `.on` at the end of a window drops the animation and the
//      element snaps back to its static style mid-fade -- PRINT's characters
//      vanish outright (their base rule is `opacity:0`) and the download arrow
//      POPS BACK to full opacity, because its last keyframe faded it out and
//      that fill is what just went away. Binding to `.held`, which already
//      outlasts the window for GROW's sustained scale, lets every cue fade out
//      from the state it ended on.
//   2. Cue time WRAPS. The last window ends at 9.9 and its 0.28 s fade runs to
//      10.18, past the end of a 10 s clip. Truncating it puts a hard step at
//      the seam. Evaluating each cue at both `t` and `t + SECONDS` instead
//      means frame 0 shows the tail the previous lap was still fading, so the
//      seam is continuous by construction -- the same trick the audio bed uses
//      when it renders two laps and keeps the second.
//
// SIZES ARE RATIOS OF THE SHORT AXIS, taken from the preview's computed pixels.
// The preview sized type with `clamp(26px,7.4vw,52px)` against a 460 px stage,
// where `vw` is the BROWSER's width and not the stage's, so on any real desktop
// every clamp pinned to its maximum: 52 px of type over 460 px of picture. The
// ratios below are those measured pairs.
//
// THE SHORT AXIS, NOT THE WIDTH, and the first render is why. Scaling by width
// is right for the three portrait-or-square formats -- their width IS the short
// axis -- and wrong for 16:9, where it multiplies everything by 1.78: the words
// came out at 217 px instead of 122, and the download icon at 359 px instead of
// 202, which put the arrow straight through the front tile of the cluster. The
// short axis is what actually constrains a caption laid over a centred subject,
// and it also keeps the whole set at one absolute type size, which matters when
// four cuts of the same clip are seen next to each other.
const TEXT_SCALE = {
  word: 52 / 460,
  big: 66 / 460,
  icon: 86 / 460,
  url: 11 / 460,
  gap: 9.6 / 460,
};
const FONT_DIR = "C:/zzz/_hex-promo/fonts";
// Google's own CSS endpoint, fetched ONCE and cached outside the repo. A render
// must not depend on the network, and a webfont served over http from the
// remote CSS would also be a different file on a different day.
const FONT_SRC = {
  bebas: "family=Bebas+Neue",
  mono: "family=Space+Mono:wght@400",
};

async function displayFonts() {
  const out = {};
  for (const [name, q] of Object.entries(FONT_SRC)) {
    const cached = `${FONT_DIR}/${name}.woff2`;
    if (!existsSync(cached)) {
      const ua =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
      // The User-Agent decides the format Google serves. Without a modern one
      // it hands back TTF, which is four times the bytes for the same glyphs.
      const css = await (
        await fetch(`https://fonts.googleapis.com/css2?${q}&display=swap`, {
          headers: { "User-Agent": ua },
        })
      ).text();
      const blocks = css.split("@font-face");
      const latin =
        blocks.find((b) => /U\+0000-00FF/.test(b)) ?? blocks[blocks.length - 1];
      const url = latin.match(/url\((https:[^)]+\.woff2)\)/)?.[1];
      if (!url) throw new Error(`no woff2 for ${name} in Google's CSS`);
      mkdirSync(FONT_DIR, { recursive: true });
      writeFileSync(
        cached,
        Buffer.from(
          await (
            await fetch(url, { headers: { "User-Agent": ua } })
          ).arrayBuffer(),
        ),
      );
      console.log(`[text] cached ${name}.woff2`);
    }
    out[name] = readFileSync(cached).toString("base64");
  }
  return out;
}

async function installCues(page, preset, seconds) {
  const fonts = await displayFonts();
  const px = (k) => Math.round(Math.min(preset.w, preset.h) * TEXT_SCALE[k]);
  const ready = await page.evaluate(
    async ({ fonts, size, seconds, safe, dl, chrome }) => {
      const D = "<span class='tdot'>.</span>";
      // The four grid margins. With no `chrome` this is exactly what the grid
      // was before - 7% sides, `safe` top and bottom - so every preset except
      // the vertical one renders unchanged, and that is checkable rather than
      // asserted.
      const ins = {
        top: chrome?.top ?? safe,
        right: chrome?.right ?? 7,
        bottom: chrome?.bottom ?? safe,
        left: chrome?.left ?? 7,
      };
      const style = document.createElement("style");
      // Everything is scoped under #hexcue. The app has its own stylesheet and
      // bare class names like `.half` are not ours to claim; the id also wins
      // specificity outright, so nothing the page ships can reach in.
      style.textContent = `
@font-face{font-family:'Bebas Neue';font-style:normal;font-weight:400;font-display:block;
  src:url(data:font/woff2;base64,${fonts.bebas}) format('woff2')}
@font-face{font-family:'Space Mono';font-style:normal;font-weight:400;font-display:block;
  src:url(data:font/woff2;base64,${fonts.mono}) format('woff2')}
#hexcue{position:fixed;inset:0;z-index:2147483000;pointer-events:none;display:grid;
  grid-template-columns:${ins.left}% 1fr 1fr 1fr ${ins.right}%;
    grid-template-rows:${ins.top}% 1fr 1fr 1fr ${ins.bottom}%;
  --command-gold:#c8963e;--gold-light:#e8b865;--title:#f1ece0;--muted:#aaa}
#hexcue .cue{opacity:0;align-self:center;min-width:0}
#hexcue .c-tl{grid-area:2/2/3/4} #hexcue .c-tr{grid-area:2/3/3/5}
#hexcue .c-bl{grid-area:4/2/5/4} #hexcue .c-br{grid-area:4/3/5/5}
#hexcue .c-band{grid-area:4/2/5/5;align-self:end}
#hexcue .right{text-align:right} #hexcue .centre{text-align:center}
#hexcue .k-grow{display:inline-block} #hexcue .k-mask{display:block}
#hexcue .an-mask .k-mask{overflow:hidden}
#hexcue .k-word{font-family:'Bebas Neue',sans-serif;font-weight:400;line-height:.84;
  letter-spacing:-.01em;color:var(--title);-webkit-text-stroke:.04em currentColor;
  paint-order:stroke fill;text-shadow:0 2px 26px rgba(0,0,0,.8);font-size:${size.word}px}
#hexcue .big .k-word{font-size:${size.big}px}
#hexcue .k-word .accent{color:var(--command-gold)}
#hexcue .tdot{-webkit-text-fill-color:transparent;-webkit-text-stroke-width:.05em;text-shadow:none}
#hexcue .k-word .tdot{-webkit-text-stroke-color:var(--command-gold)}
#hexcue .k-word .accent .tdot{-webkit-text-stroke-color:var(--title)}
#hexcue .p2 .ch{opacity:0;display:inline-block}
#hexcue .cue.held.p2 .ch{animation:hxKeyStrike .13s cubic-bezier(.3,1.5,.5,1) both}
@keyframes hxKeyStrike{from{opacity:0;transform:translateY(-28%) scaleY(1.25)}to{opacity:1;transform:none}}
#hexcue .s1 .half{position:absolute;inset:0;display:block}
#hexcue .s1 .half.l{clip-path:inset(0 50% 0 0)} #hexcue .s1 .half.r{clip-path:inset(0 0 0 50%)}
#hexcue .s1 .k-word{position:relative}
#hexcue .cue.held.s1 .half.l{animation:hxSnapL .3s cubic-bezier(.85,0,.15,1) both}
#hexcue .cue.held.s1 .half.r{animation:hxSnapR .3s cubic-bezier(.85,0,.15,1) both}
@keyframes hxSnapL{from{transform:translateX(-42%);opacity:0}to{transform:none;opacity:1}}
@keyframes hxSnapR{from{transform:translateX(42%);opacity:0}to{transform:none;opacity:1}}
#hexcue .cue.held.an-mask .k-word{animation:hxMaskUp .5s cubic-bezier(.16,.84,.28,1) both}
@keyframes hxMaskUp{from{transform:translateY(105%)}to{transform:translateY(0)}}
#hexcue .cue[data-hold="1"].held .k-grow{animation:hxGrowHold var(--hold,1.9s) linear both}
@keyframes hxGrowHold{from{transform:scale(1)}to{transform:scale(var(--growTo,1.34))}}
#hexcue .cue.held.f1 .k-word{animation:hxRelease .66s cubic-bezier(.16,1.1,.3,1) both}
@keyframes hxRelease{from{letter-spacing:-.32em;transform:scale(.72);opacity:0;filter:blur(7px)}
  60%{letter-spacing:.02em;opacity:1;filter:blur(0)}to{letter-spacing:-.01em;transform:scale(1)}}
#hexcue .dl{display:flex;flex-direction:column;align-items:center;gap:${size.gap}px}
/* The icon column follows its cue's alignment. Left-aligning the cue alone does
   nothing, because the flex column centres its own children regardless. */
#hexcue .cue:not(.centre) .dl{align-items:flex-start}
#hexcue .dl svg{width:${size.icon}px;height:auto;overflow:visible}
#hexcue .dl .stem,#hexcue .dl .head,#hexcue .dl .tray{fill:none;stroke-width:3.4;
  stroke-linecap:square;stroke-linejoin:miter;vector-effect:non-scaling-stroke}
#hexcue .dl .stem,#hexcue .dl .head{stroke:var(--title)}
#hexcue .dl .tray{stroke:var(--command-gold);transform-origin:center bottom}
#hexcue .cue.held .dl .arrow{animation:hxDlDrop 1.05s cubic-bezier(.5,0,.6,1) .1s 2 both}
@keyframes hxDlDrop{0%{transform:translateY(-34%);opacity:0}26%{opacity:1}
  46%{transform:translateY(0);opacity:1}58%{transform:translateY(0);opacity:1}
  72%{transform:translateY(6%);opacity:0}100%{transform:translateY(6%);opacity:0}}
#hexcue .cue.held .dl .tray{animation:hxDlHit 1.05s ease-out .1s 2 both}
@keyframes hxDlHit{0%,44%{stroke:var(--command-gold);transform:scaleY(1)}
  50%{stroke:var(--gold-light);transform:scaleY(.72)}
  62%{stroke:var(--command-gold);transform:scaleY(1)}
  100%{stroke:var(--command-gold);transform:scaleY(1)}}
#hexcue .dl-url{font-family:'Space Mono',monospace;font-size:${size.url}px;letter-spacing:.18em;
  text-transform:uppercase;color:var(--muted)}
#hexcue .cue.held .dl-url{animation:hxFadeUp .5s ease-out .5s both}
@keyframes hxFadeUp{from{opacity:0;transform:translateY(30%)}to{opacity:1;transform:none}}`;
      document.head.appendChild(style);

      const DL_SVG = `<svg viewBox="0 0 60 54" aria-hidden="true">
        <g class="arrow"><path class="stem" d="M30 4 V30"/><path class="head" d="M18 20 L30 32 L42 20"/></g>
        <path class="tray" d="M10 40 V48 H50 V40"/></svg>`;
      const CUES = [
        { t: 2.0, d: 1.9, cell: "c-tl", anim: "p2", word: "PRINT" + D },
        {
          t: 4.0,
          d: 1.9,
          lead: 0.3,
          cell: "c-br",
          anim: "s1",
          word: "SNAP" + D,
          align: "right",
        },
        {
          t: 6.0,
          d: 1.9,
          cell: "c-tr",
          anim: "an-mask",
          word: "GROW" + D,
          align: "right",
          hold: 1.34,
        },
        {
          t: 8.0,
          d: 1.9,
          cell: "c-tl",
          anim: "f1",
          word: "<span class='accent'>FREE" + D + "</span>",
          big: 1,
        },
        {
          t: 8.0,
          d: 1.9,
          cell: dl.cell,
          anim: "dl",
          align: dl.align,
          html: `<div class="dl">${DL_SVG}<div class="dl-url">academy.onethousanddrones.com/hex</div></div>`,
        },
      ];

      const layer = document.createElement("div");
      layer.id = "hexcue";
      const els = CUES.map((c) => {
        const d = document.createElement("div");
        d.className = `cue ${c.cell} ${c.anim} ${c.align ?? ""} ${c.big ? "big" : ""}`;
        if (c.html) {
          d.innerHTML = c.html;
        } else {
          d.innerHTML = `<div class="k-grow"><div class="k-mask"><div class="k-word">${c.word}</div></div></div>`;
          if (c.hold) {
            d.dataset.hold = "1";
            d.style.setProperty("--hold", `${c.d}s`);
            d.style.setProperty("--growTo", String(c.hold));
            d.querySelector(".k-grow").style.transformOrigin =
              c.align === "right" ? "right center" : "left center";
          }
          const w = d.querySelector(".k-word");
          if (c.anim === "p2") {
            // Split TEXT NODES ONLY, so the accent span and the hollow period
            // survive the per-character wrapping.
            const walk = (n) => {
              if (n.nodeType === 3) {
                const f = document.createDocumentFragment();
                for (const ch of n.textContent) {
                  const s = document.createElement("span");
                  s.className = "ch";
                  s.textContent = ch;
                  f.appendChild(s);
                }
                n.replaceWith(f);
              } else [...n.childNodes].forEach(walk);
            };
            walk(w);
            const cs = [...w.querySelectorAll(".ch")];
            const per = (c.d * 0.42) / Math.max(1, cs.length);
            cs.forEach((ch, i) => (ch.style.animationDelay = `${i * per}s`));
          }
          if (c.anim === "s1") {
            const inner = w.innerHTML;
            w.innerHTML =
              `<span class="half l">${inner}</span><span class="half r">${inner}</span>` +
              `<span style="visibility:hidden">${inner}</span>`;
          }
        }
        layer.appendChild(d);
        return d;
      });
      document.body.appendChild(layer);

      // A cue that outlasts the clip cannot fade out inside its own window, so
      // it would carry type onto the last frame and step at the seam. Caught
      // here rather than discovered in a seam number 300 frames later.
      const over = CUES.filter((c) => c.t - (c.lead ?? 0) + c.d > seconds);
      if (over.length) {
        throw new Error(
          `cue sheet runs past the ${seconds}s clip: ` +
            over.map((c) => `${c.word ?? "icon"}@${c.t}+${c.d}`).join(", "),
        );
      }

      // TYPE MUST CLEAR THE PLATFORM'S FURNITURE, asserted here on real DOM
      // rects rather than checked afterwards on pixels. The shipped vertical
      // master had SNAP and GROW under the action rail and FREE under the
      // caption block, and nothing in the pipeline noticed, because nothing in
      // the pipeline knew where the furniture is.
      //
      // MEASURED IN THE DOM ON PURPOSE. Differencing a text render against a
      // clean one seems like the obvious check and is not usable: both are
      // encoded separately, so adding type changes the encoder's bit allocation
      // across the WHOLE frame and the difference lights up hardware edges far
      // from any glyph. It reported the type reaching 87% when the type stopped
      // at 80%. A rect cannot be wrong that way.
      //
      // Scale transforms are included via getBoundingClientRect, which reports
      // the post-transform box, so GROW's hold is measured at its grown size.
      if (chrome) {
        const vw = window.innerWidth, vh = window.innerHeight;
        const held = [];
        els.forEach((d, i) => {
          d.classList.add("held");
          const r = d.getBoundingClientRect();
          const inner = d.firstElementChild?.getBoundingClientRect() ?? r;
          const box = {
            x1: Math.max(r.right, inner.right) / vw,
            y1: Math.max(r.bottom, inner.bottom) / vh,
            y0: Math.min(r.top, inner.top) / vh,
          };
          const what = CUES[i].word?.replace(/<[^>]*>/g, "") ?? "download";
          if (box.x1 > (100 - chrome.right) / 100 + 0.002)
            held.push(`${what} reaches ${(box.x1 * 100).toFixed(1)}% across`);
          if (box.y1 > (100 - chrome.bottom) / 100 + 0.002)
            held.push(`${what} reaches ${(box.y1 * 100).toFixed(1)}% down`);
          if (box.y0 < chrome.top / 100 - 0.002)
            held.push(`${what} starts at ${(box.y0 * 100).toFixed(1)}% down`);
          d.classList.remove("held");
        });
        if (held.length) {
          throw new Error(
            "type runs into the platform chrome: " + held.join("; ") +
            ` (allowed: ${chrome.left}% to ${100 - chrome.right}% across, ` +
            `${chrome.top}% to ${100 - chrome.bottom}% down)`,
          );
        }
      }

      const FADE = 0.28;
      // CSS `ease-out` is cubic-bezier(0,0,.58,1). Newton on x, which converges
      // in a handful of steps over [0,1] and costs nothing five times a frame.
      const easeOut = (x) => {
        const cx = 3 * 0,
          bx = 3 * (0.58 - 0) - cx,
          ax = 1 - cx - bx;
        const cy = 3 * 0,
          by = 3 * (1 - 0) - cy,
          ay = 1 - cy - by;
        let t = x;
        for (let i = 0; i < 8; i++) {
          const fx = ((ax * t + bx) * t + cx) * t - x;
          const dx = (3 * ax * t + 2 * bx) * t + cx;
          if (Math.abs(dx) < 1e-9) break;
          t -= fx / dx;
        }
        return ((ay * t + by) * t + cy) * t;
      };

      /** Put every cue at exactly scene time `t`. One call per captured frame. */
      window.__cueFrame = (t) => {
        CUES.forEach((c, i) => {
          const el = els[i];
          const start = c.t - (c.lead ?? 0);
          const local = t - start;
          // THE FADE LIVES INSIDE THE WINDOW, so every cue is fully gone by its
          // own `end` and the clip's last frame carries no type at all.
          //
          // It used to fade out AFTER the window and wrap the tail round to the
          // top of the next lap, which made the seam continuous but put FREE and
          // the download URL on frame 0 at ~87% -- the loop's first frame, and
          // the still a feed shows before play. Every alternative that keeps a
          // post-window fade AND a clean frame 0 is worse: truncating it leaves a
          // step at the seam, and compressing it into the 0.067 s left after 9.9
          // is a two-frame blink while the picture around it flows.
          //
          // The cost is 0.28 s of the 1.9 s hold, and it lands somewhere useful:
          // PRINT now dims as SNAP arrives instead of both sitting at full
          // opacity, and the download dissolves just after its second hit lands
          // rather than snapping off.
          const held = local >= 0 && local < c.d;
          // ONE CLASS, not two. `.held` existed to outlast `.on` so an animation
          // would not drop its fill mid-fade; with the fade inside the window
          // there is nothing left to outlast.
          el.classList.toggle("held", held);
          if (!held) {
            el.style.opacity = "0";
            return;
          }
          el.style.opacity = String(
            Math.min(
              easeOut(Math.min(1, local / FADE)),
              easeOut(Math.min(1, (c.d - local) / FADE)),
            ),
          );
          // SCRUB, DO NOT PLAY. `pause()` is what makes this deterministic: a
          // running animation would advance during the screenshot's own paint.
          for (const a of el.getAnimations({ subtree: true })) {
            a.pause();
            try {
              a.currentTime = local * 1000;
            } catch {
              /* a finished animation can refuse a seek; its fill already holds */
            }
          }
        });
      };

      // Both faces must be RASTERISED before the first frame, not merely
      // requested. `font-display:block` keeps the invisible-text period open
      // rather than flashing a fallback, so a race here would burn blank words
      // into the opening seconds and nothing would report it.
      await document.fonts.load(`${size.big}px 'Bebas Neue'`);
      await document.fonts.load(`${size.url}px 'Space Mono'`);
      await document.fonts.ready;
      // THE LAYER MUST BE ON SCREEN, and that is checked rather than assumed:
      // the capture's chrome-hiding rule swallowed it on the first run and the
      // result was a clean render with no type and no error anywhere.
      const box = layer.getBoundingClientRect();
      return {
        cues: CUES.length,
        // `document.fonts.check()` ALONE IS NOT A GATE. It returns TRUE when no
        // `@font-face` matches the family at all -- verified in Playwright: on a
        // page with `document.fonts.size === 0`, `check('1em "Bebas Neue"')` is
        // true. It answers "is anything blocking this render?", not "did my font
        // load". So it goes green in exactly the case it exists to catch: the
        // data URI malformed, the family misspelled, the face never registered.
        //
        // The real test is that the face EXISTS in the registry and is loaded.
        // `check()` is kept as the third condition because it still catches a
        // face that is registered but unresolved.
        bebas: [...document.fonts].some(
          (f) => f.family === "Bebas Neue" && f.status === "loaded",
        ),
        mono: [...document.fonts].some(
          (f) => f.family === "Space Mono" && f.status === "loaded",
        ),
        registered: document.fonts.size,
        resolves:
          document.fonts.check(`${size.big}px 'Bebas Neue'`) &&
          document.fonts.check(`${size.url}px 'Space Mono'`),
        shown:
          getComputedStyle(layer).display !== "none" &&
          box.width > 0 &&
          box.height > 0,
      };
    },
    {
      fonts,
      seconds,
      // Vertical safe margin. The horizontal one stays 7% on every preset
      // because `object-fit: cover` on a wider-than-tall slice crops HEIGHT.
      safe: preset.textSafe ?? 7,
      // Per-side insets for platform furniture. Only the vertical cut sets
      // these; everywhere else it is undefined and the grid falls back to what
      // it always was.
      chrome: preset.chrome ?? null,
      dl: preset.textDl ?? { cell: "c-band", align: "centre" },
      size: {
        word: px("word"),
        big: px("big"),
        icon: px("icon"),
        url: px("url"),
        gap: px("gap"),
      },
    },
  );
  if (
    !ready.bebas ||
    !ready.mono ||
    !ready.shown ||
    !ready.resolves ||
    ready.registered < 2
  ) {
    throw new Error(
      `[text] cue layer not ready: ${JSON.stringify(ready)} -- ` +
        "the burn would ship with no type, or in a fallback face",
    );
  }
  console.log(
    `[text] ${ready.cues} cues, word ${px("word")}px, big ${px("big")}px, fonts ok`,
  );
}


// ---- --probe: framing only, every preset, across the whole shot -------------
const browser = await chromium.launch({ args: GPU_ARGS });

if (PROBE) {
  let bad = 0;
  for (const [name, p] of Object.entries(PRESETS)) {
    const { ctx, page } = await bootFilm(browser, { w: p.w, h: p.h, theme: THEME });
    await stage(page, p);
    await page.evaluate(() => window.__clock.start());
    let worst = null;
    for (let i = 0; i < TOTAL; i++) {
      await filmFrame(page, i / FPS);
      if (i % 3) continue;
      const e = await filmExtent(page);
      if (e && (!worst || e.margin < worst.margin)) worst = { ...e, t: i / FPS };
    }
    const clips = !worst || worst.margin < 0;
    if (clips) bad++;
    console.log(
      `${name.padEnd(9)} ${p.w}x${p.h}  worst margin ${worst?.margin} at ${worst?.t?.toFixed(2)}s ` +
        `(${JSON.stringify(worst)})${clips ? "  <-- CLIPS" : ""}`,
    );
    await ctx.close();
  }
  await browser.close();
  process.exit(bad ? 1 : 0);
}

// ---- a cut -------------------------------------------------------------------
const preset = PRESETS[presetArg];
const FRAMES = `${RAW}/${presetArg}${TEXT ? "-text" : ""}-${THEME}`;
rmSync(FRAMES, { recursive: true, force: true });
mkdirSync(FRAMES, { recursive: true });

const { ctx, page, hidden } = await bootFilm(browser, { w: preset.w, h: preset.h, theme: THEME });
console.log(`[capture] hid ${hidden.length} overlays: ${hidden.join(" ")}`);
const staged = await stage(page, preset);
console.log(`[capture] ${JSON.stringify(staged.framing)}`);
// LAST, once nothing is still measuring the picture, and before a frame.
if (TEXT) await installCues(page, preset, SECONDS);

await page.evaluate(() => window.__clock.start());
let worst = null;
for (let i = 0; i < TOTAL; i++) {
  const t = i / FPS;
  await filmFrame(page, t);
  if (TEXT) await page.evaluate((t) => window.__cueFrame(t), t);
  if (i % 3 === 0) {
    const e = await filmExtent(page);
    if (e && (!worst || e.margin < worst.margin)) worst = { ...e, t };
  }
  await page.screenshot({ path: `${FRAMES}/f${String(i).padStart(4, "0")}.png` });
  if (i % 60 === 0) console.log(`[capture] frame ${i}/${TOTAL}`);
}
await ctx.close();
await browser.close();

if (capArg) {
  console.log(`stopped after ${TOTAL} frames (--frames), no encode, no gates`);
  process.exit(0);
}

// THE GATES STOP THE RUN. A gate that records a number and lets the artefact
// through is a log line with ambitions. `--force` still encodes (a broken cut
// is what you want to look at when working out why) but exits non-zero.
const failures = [];
console.log(`[framing] worst margin across the shot ${JSON.stringify(worst)}`);
if (!worst || worst.margin < 0) {
  failures.push(`the subject leaves the visible window at ${worst?.t?.toFixed(2)}s`);
}
if (!seamCheck(FRAMES, TOTAL)) {
  failures.push("loop seam is louder than the quietest ordinary step");
}
if (failures.length) {
  for (const f of failures) console.error(`[GATE FAILED] ${f}`);
  if (!flag("force")) {
    const kept = `${FRAMES}-failed-${Date.now()}`;
    try {
      renameSync(FRAMES, kept);
    } catch {
      /* diagnostic only */
    }
    console.error(`\nNOT encoding. Frames kept at ${kept}; --force to encode anyway.`);
    process.exit(1);
  }
  console.error("\n--force: encoding a cut that failed its gates.");
  process.exitCode = 1;
}

const base = `${OUT}/hex-${presetArg}${suffix}`;
const emitted = [];
if (failures.length) {
  writeFileSync(
    `${base}.GATE-FAILED.txt`,
    `${new Date().toISOString()}\nforced past ${failures.length} failed gate(s):\n` +
      failures.map((f) => `  - ${f}\n`).join(""),
  );
}

// THE BYTE BUDGET IS A GATE ON THE OUTPUT, for the cuts a PAGE ships: one clip
// <= 500 KB (launch 8.2). The CRF starts at the preset's and steps up until the
// file fits.
//
// SOCIAL CUTS HAVE NO BUDGET, deliberately. The v2 loop has more edges than
// v1's (the plates beat is nine beds of them), and forcing the 1080p wide cut
// with type under 500 KB took CRF 37, which measurably smeared the part edges
// and the type on the encoded frame. Every platform re-encodes an upload, so
// what a social master's bytes buy is the quality going INTO that re-encode.
// They stay at CRF 31, where the v1 cuts were made, and the size is printed.
const BUDGET = preset.budget ?? Infinity;
const encode = (crf) =>
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error",
    "-framerate", String(FPS),
    "-i", `${FRAMES}/f%04d.png`,
    "-an",
    "-c:v", "libx264", "-preset", "slow", "-crf", String(crf),
    "-pix_fmt", "yuv420p",
    "-g", "30",
    "-muxdelay", "0", "-muxpreload", "0",
    "-movflags", "+faststart",
    `${base}.mp4`,
  ]);
let crf = preset.crf ?? 31;
encode(crf);
while (statSync(`${base}.mp4`).size > BUDGET && crf < 40) encode(++crf);
if (statSync(`${base}.mp4`).size > BUDGET) {
  console.error(`[GATE FAILED] ${statSync(`${base}.mp4`).size} bytes at crf ${crf}, budget ${BUDGET}`);
  process.exitCode = 1;
}
console.log(`[encode] crf ${crf}`);
emitted.push(`${base}.mp4`);

// GATE AFTER ENCODE, on the file: a clip that is 9.967 s does not loop.
const got = probeMp4(`${base}.mp4`);
if (got.frames !== TOTAL || Math.abs(got.duration - TOTAL / FPS) > 0.0005) {
  console.error(`[GATE FAILED] encoded ${got.frames} frames / ${got.duration}s, wanted ${TOTAL} / ${TOTAL / FPS}s`);
  process.exitCode = 1;
}

// The poster: the frame at 5.0 s, the assembled build with its pipe, mid-orbit.
// A real frame of the clip, not a re-render.
execFileSync("ffmpeg", [
  "-y", "-loglevel", "error",
  "-i", `${FRAMES}/f${String(Math.floor(TOTAL / 2)).padStart(4, "0")}.png`,
  "-q:v", "4",
  `${base}-poster.jpg`,
]);
emitted.push(`${base}-poster.jpg`);

// The README WebP has a budget too: the v1 ones sat at 550-600 KB. Quality
// steps down from WEBP.quality until it fits.
const WEBP_BUDGET = 620 * 1024;
if (presetArg === "readme") {
  const webpAt = (q) =>
    execFileSync("ffmpeg", [
      "-y", "-loglevel", "error",
      "-framerate", String(FPS),
      "-i", `${FRAMES}/f%04d.png`,
      "-vf", `fps=${WEBP.fps},scale=${WEBP.width}:-1:flags=lanczos`,
      "-c:v", "libwebp_anim", "-lossless", "0", "-q:v", String(q),
      "-loop", "0",
      `${base}.webp`,
    ]);
  let q = WEBP.quality;
  webpAt(q);
  while (statSync(`${base}.webp`).size > WEBP_BUDGET && q > 40) webpAt((q -= 8));
  console.log(`[webp] q ${q}`);
  if (statSync(`${base}.webp`).size > WEBP_BUDGET) {
    console.error(`[GATE FAILED] ${base}.webp is ${statSync(`${base}.webp`).size} bytes, budget ${WEBP_BUDGET}`);
    process.exitCode = 1;
  }
  emitted.push(`${base}.webp`);
}

console.log(`${presetArg} ${preset.w}x${preset.h} ${THEME}: ${got.frames} frames, ${got.duration}s`);
for (const f of emitted) console.log(`${f}  ${statSync(f).size} bytes`);
