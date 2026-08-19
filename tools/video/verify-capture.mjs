// Read a screen-capture master back off disk and decide whether it is fit to cut.
//
//   node tools/video/verify-capture.mjs <file.mkv>
//   node tools/video/verify-capture.mjs --selftest      builds known-good and
//                                                        known-bad files and
//                                                        proves each check fires
//
// WHY THIS EXISTS, AND WHY IT MEASURES PIXELS INSTEAD OF READING TAGS.
//
// The three faults that ruin a screencast are all invisible in the place you
// would naturally look:
//
//   * `color_range=pc` is a tag OBS writes out of its own config. If the GPU
//     handed it Limited-range pixels the blacks are crushed already and the tag
//     still says `pc`. So this reads YMIN/YMAX off a known black/white target.
//   * A resample anywhere in the chain (wrong base resolution, Windows display
//     scaling, a stray OBS scale filter) turns 1px lines into grey mush. A
//     schematic IS 1px lines. So this measures a hairline grid at the pixel
//     Nyquist rather than trusting the resolution fields.
//   * OBS silently strips options out of the x264 options box -- `force-cfr` is
//     documented as being dropped this way. x264 writes its full options string
//     into the file, so this reads that string back and diffs it against what
//     was asked for.
//
// THE RULES THIS FILE IS BUILT ON, each of which was paid for once already:
//
//   1. A CHECK MAY ONLY COUNT ITSELF AFTER A COMPLETED MEASUREMENT. Never on
//      entry. A gate that increments when it starts reports a clean run over an
//      empty set. Every check here registers an id and must file a reading; any
//      id that filed nothing FAILS the run rather than being skipped.
//   2. PROVE YOU CAPTURED OUTPUT BEFORE CONCLUDING IT IS CLEAN. Every
//      subprocess is checked for empty stdout. An empty string makes every
//      comparison falsy, which reads as a pass. `run()` throws instead.
//   3. SAY WHAT FAILURE DOES. The verdict is written as a sidecar JSON beside
//      the artifact, so it travels with the bytes rather than with somebody's
//      memory of a terminal that has since scrolled. A non-zero exit means DO
//      NOT CUT THIS FILE; reshoot.
//   4. FLOORS ARE EQUALITY, WITH A CALIBRATION COMMENT. Do NOT loosen a bound
//      to make a run succeed. Each one below says where it came from.
//
// ASCII only.

import { execFileSync } from "node:child_process";
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, basename, join } from "node:path";

// ---------------------------------------------------------------------------
// FLOORS. Sources, not preferences. Do NOT lower these to make a run succeed.
// ---------------------------------------------------------------------------

// 1920x1080, decided on the real rig rather than on a benchmark.
//
// THE BINDING CONSTRAINT IS THE OVERLAY, NOT THE ENCODER. KeyViz composites a
// keystroke overlay every frame -- not optional for this material, since the
// script teaches by key (M, R, X, Y, G, Ctrl+F) -- and at 3840x2160 that made
// movement visibly choppy on the actual machine. That cost lands upstream of
// the encoder, so no amount of encoder headroom fixes it, and no synthetic
// encode benchmark can see it.
//
// For the record, since it was measured and will otherwise be re-litigated:
//   * x264 cannot do 4K here at all -- 0.82x at 4:4:4, 1.07x at 4:2:0.
//   * NVENC CAN -- 1.78x sustained across a full 8 minutes with NO thermal
//     decay, because the encode sits on a fixed-function GPU block rather than
//     the 45W CPU. A real 8-minute OBS take dropped zero frames.
//   * So "4K is impossible" was wrong. It is possible, and still not worth it,
//     for a reason that has nothing to do with the encoder.
// At 1080p, NVENC P7/CQ14 measures 3.74x, leaving room for the overlay, the
// capture and KiCad's own draw.
//
// SHEET AREA IS RECOVERED FROM THE OTHER KNOB. Area in frame is capture pixels
// divided by UI scale, so lower KiCad's UI scale and increase line weight
// instead of raising the raster. The audience is desktop-only (KiCad cannot run
// on a phone), so there is no small-screen legibility floor to protect -- see
// docs/video/_capture-spec.md.
//
// STILL NO RESAMPLE ANYWHERE. Base and output must be equal and the display must
// match, or the hairlines this content is made of get destroyed: measured, a
// 0.75 downscale delivers 1px lines at 61-63% of full contrast. `no_resample`
// measures that in pixels.
const WIDTH = 1920;
const HEIGHT = 1080;

// 30, not 60. `tools/promo/render-cut.mjs:34` is `const FPS = 30` and the
// furniture's beat constants are frame-denominated against it; Matroska's 1ms
// timescale cannot represent 1/60s, so a "CFR" 60fps MKV already carries
// non-uniform PTS deltas (17ms x79, 16ms x40 -- reproduced); and -g 30 at 60fps
// is a 0.5s GOP.
const FPS_NUM = 30;
const FPS_DEN = 1;

// 4:4:4. Measured: a 4:2:0 round trip with ZERO compression scores 37.40 dB
// against 65.72 for 4:4:4, and x264 at -qp 0 in 4:2:0 scores 37.399 -- the
// codec adds nothing, the damage is done by the subsample before any encoder
// runs. Convert to 4:2:0 exactly once, at delivery.
//
// 4:2:0, AND THAT IS A REVERSAL WORTH READING BEFORE CHANGING IT BACK.
//
// The 4:4:4 rule came from a real measurement -- a 4:2:0 round trip scores 37.40
// dB against 65.72 for 4:4:4 -- but that measures the MASTER, and the master is
// not what anybody watches. Three things retired it:
//
//   * YouTube's documented ingest spec is 4:2:0 and every delivered rendition
//     comes back 4:2:0 regardless of what was uploaded. The 4:4:4 never reaches
//     a viewer.
//   * Delivered chroma is set by RENDITION SIZE, not master format. A 4K 4:2:0
//     upload delivers 1920x1080 chroma planes; a 1080p 4:4:4 upload delivers
//     960x540. Resolution beats chroma format by 4x per axis.
//   * H.264 High 4:4:4 Predictive is not loadable in most NLEs -- Premiere
//     silently converts it, Resolve free rejects it. A 4:4:4 master is a master
//     you cannot edit.
//
// What still protects the thin lines is the LIGHT canvas: 4:2:0 keeps luma at
// full resolution, so dark strokes on a light page survive. Research section 2's
// own fairness note said exactly this and it now carries the weight.
//
// BOTH SPELLINGS ACCEPTED: a full-range stream reports `yuvj420p`, a
// limited-range one `yuv420p`. This check answers ONE question -- is the chroma
// subsampled as specified -- and range is measured in PIXELS by
// `color_range_pixels`, the only trustworthy place to ask it.
const PIX_FMT = "yuv420p";
const PIX_FMT_OK = new Set(["yuv420p", "yuvj420p"]);

// Full-range readback off the calibration target's black and white patches.
// 1 and 254 rather than 0 and 255 so a single stray dithered pixel does not
// fail an otherwise correct capture. A Limited-range capture lands at 16/235
// and misses both by a wide margin, so the bound is nowhere near the fault.
const Y_MIN_CEIL = 1;
const Y_MAX_FLOOR = 254;

// The hairline grid is 1px black / 1px white. A 1:1 capture preserves both
// extremes inside the crop. ANY resample pulls them toward mid-grey; a 0.75
// downscale of this pattern lands around 96/160. 32 luma of margin on each
// side, i.e. a fault has to be ~4x smaller than the smallest real one to slip.
const HAIRLINE_MIN_CEIL = 32;
const HAIRLINE_MAX_FLOOR = 223;

// The calibration target is held for 3s at the head of every take. Sampled at
// 1.5s: past any autofocus/compositor settle, well before it leaves screen.
const CALIB_T = 1.5;

// x264 settings that must survive OBS's options box into the file.
//
// NOTE THE TWO SPELLINGS, because they are not the same string and assuming
// they were is a check that can never pass. You TYPE `deblock=-3:-3` into OBS's
// x264 options box (x264's CLI form: alpha:beta). x264 then WRITES
// `deblock=1:-3:-3` into its options string (internal form: enabled:alpha:beta).
// Assert the written form.
//
// Reduced deblocking preserves the 1px strokes a schematic is made of; the
// default filter treats them as coding noise and smooths them.


// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
const SELFTEST = argv.includes("--selftest");
const target = argv.find((a) => !a.startsWith("--"));

/**
 * Run a command and REFUSE to return an empty result. Rule 2.
 *
 * `enc` is latin1 when the output is a BITSTREAM rather than text: utf8 decoding
 * of binary replaces invalid sequences with U+FFFD, which can eat the very ASCII
 * run being searched for.
 */
function run(cmd, args, enc = "utf8") {
  let out;
  try {
    out = execFileSync(cmd, args, { encoding: enc, maxBuffer: 256 * 1024 * 1024 });
  } catch (e) {
    // ffprobe writes to stdout even on some non-zero exits; keep whatever came
    // back so the caller can report WHY rather than just "it failed".
    out = (e.stdout ?? "") + "";
    if (!out.trim()) throw new Error(`${cmd} produced no output: ${String(e.stderr ?? e).slice(0, 400)}`);
  }
  if (!out.trim()) throw new Error(`${cmd} ${args.join(" ")} returned an EMPTY string; refusing to treat that as a reading`);
  return out;
}

function probe(file, args) {
  return run("ffprobe", ["-v", "error", ...args, file]).trim();
}

/**
 * signalstats YMIN/YMAX over one frame, optionally cropped. Reads PIXELS.
 *
 * `-show_entries` is an FFPROBE option and ffmpeg rejects it outright, so the
 * readings come back through `metadata=print:file=-` instead. Found by running
 * this, not by reading it: the first draft used the ffprobe spelling here and
 * every pixel check failed with "Unrecognized option".
 */
function lumaExtremes(file, t, crop) {
  const vf = [crop ? `crop=${crop}` : null, "signalstats", "metadata=print:file=-"]
    .filter(Boolean)
    .join(",");
  const out = run("ffmpeg", [
    "-hide_banner", "-nostats", "-loglevel", "error",
    "-ss", String(t), "-i", file, "-frames:v", "1", "-vf", vf, "-f", "null", "-",
  ]);
  const min = /YMIN=(\d+)/.exec(out);
  const max = /YMAX=(\d+)/.exec(out);
  if (!min || !max) throw new Error(`signalstats produced no YMIN/YMAX at t=${t}; got: ${out.slice(0, 300)}`);
  return { min: Number(min[1]), max: Number(max[1]) };
}

// ---------------------------------------------------------------------------
// The checks. Each one registers an id, then files a reading. Rule 1.
// ---------------------------------------------------------------------------

function verify(file) {
  const readings = [];
  const problems = [];
  const filed = new Set();

  const check = (id, fn) => {
    let r;
    try {
      r = fn();
    } catch (e) {
      // A check that could not measure is a FAILURE, never a skip. This is the
      // whole point of rule 1: the blind path and the clean path must not look
      // the same from the outside.
      problems.push(`${id}: could not measure -- ${e.message}`);
      readings.push({ id, ok: false, error: e.message });
      filed.add(id);
      return;
    }
    filed.add(id);
    readings.push({ id, ok: r.ok, ...r });
    if (!r.ok) problems.push(`${id}: ${r.why}`);
  };

  check("resolution", () => {
    const v = probe(file, ["-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0"]);
    const [w, h] = v.split(",").map(Number);
    return {
      ok: w === WIDTH && h === HEIGHT,
      got: `${w}x${h}`, want: `${WIDTH}x${HEIGHT}`,
      why: `captured ${w}x${h}, spec is ${WIDTH}x${HEIGHT} exactly. Any other size means a resample sits between KiCad and the file.`,
    };
  });

  check("pix_fmt", () => {
    const got = probe(file, ["-select_streams", "v:0", "-show_entries", "stream=pix_fmt", "-of", "csv=p=0"]);
    return {
      ok: PIX_FMT_OK.has(got), got, want: [...PIX_FMT_OK].join(" or "),
      why: `pix_fmt is ${got}, spec is 4:2:0 (${[...PIX_FMT_OK].join(" or ")}). 4:4:4 is NOT an upgrade here: it is unloadable in most NLEs and YouTube discards it. If this reads 4:4:4 the capture cannot be edited.`,
    };
  });

  check("fps", () => {
    const got = probe(file, ["-select_streams", "v:0", "-show_entries", "stream=r_frame_rate", "-of", "csv=p=0"]);
    return {
      ok: got === `${FPS_NUM}/${FPS_DEN}`, got, want: `${FPS_NUM}/${FPS_DEN}`,
      why: `frame rate is ${got}, spec is ${FPS_NUM}/${FPS_DEN}. The furniture's beat constants are frame-denominated against 30.`,
    };
  });

  // Cadence and dropped frames are SEPARATE faults and get separate ids. They
  // share one expensive packet read, so they are computed together and filed
  // apart.
  const cadence = (() => {
    const raw = probe(file, ["-select_streams", "v:0", "-show_entries", "packet=pts_time", "-of", "csv=p=0"]);
    const ts = raw.split("\n").map((s) => parseFloat(s)).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
    if (ts.length < 30) throw new Error(`only ${ts.length} packets read; too few to judge cadence`);
    const nominal = 1000 * (FPS_DEN / FPS_NUM);
    const deltas = ts.slice(1).map((t, i) => (t - ts[i]) * 1000);
    return { ts, nominal, deltas };
  })();

  check("cadence", () => {
    const { nominal, deltas, ts } = cadence;
    // NOT "one distinct delta". At 30fps a frame is 33.333ms and Matroska's
    // timescale is 1ms, so a perfectly constant-rate file necessarily alternates
    // 33/34 -- the container cannot represent the true interval. Demanding a
    // single value fails every correct 30fps MKV. (The first draft of this file
    // did exactly that, and the self-test caught it.) The real fault is a delta
    // that wanders further than the container's own quantization can explain,
    // so the bound is +/- 1ms around nominal.
    const strays = deltas.filter((d) => Math.abs(d - nominal) > 1.0 && d < nominal * 1.5);
    return {
      ok: strays.length === 0,
      got: `${deltas.length} intervals, ${strays.length} outside ${(nominal - 1).toFixed(1)}-${(nominal + 1).toFixed(1)}ms`,
      want: `every interval within 1ms of ${nominal.toFixed(3)}ms`,
      why: `${strays.length} of ${ts.length} frame intervals wander beyond what the container's 1ms timescale can explain. Frame-denominated furniture desynchronises against a variable cadence.`,
    };
  });

  check("no_dropped_frames", () => {
    const { nominal, deltas } = cadence;
    // A dropped frame shows up as a gap of two or more frame intervals. This is
    // the single most common way a screen capture is quietly ruined: OBS keeps
    // recording, the file plays, and the motion stutters where the encoder
    // could not keep up. It is invisible in every metadata field.
    const gaps = deltas.filter((d) => d >= nominal * 1.5);
    const worst = gaps.length ? Math.max(...gaps) : 0;
    return {
      ok: gaps.length === 0,
      got: `${gaps.length} gap(s)${gaps.length ? `, worst ${worst.toFixed(1)}ms (${(worst / nominal).toFixed(1)} frames)` : ""}`,
      want: "no interval >= 1.5 frames",
      why: `${gaps.length} dropped-frame gap(s), worst ${worst.toFixed(1)}ms. The encoder could not keep up with the capture. Lower the preset or the resolution and reshoot.`,
    };
  });

  // THE x264 OPTIONS CHECK IS GONE, deliberately, and this comment is its
  // headstone so nobody re-adds it against an NVENC capture.
  //
  // It read x264's options string out of the H.264 SEI and asserted
  // `deblock=1:-3:-3`, which proved OBS had honoured its options box. NVENC
  // writes no such string -- verified on a real take: `stream_tags=encoder` is
  // empty and the bitstream carries no "x264 - core" blob. Kept as-is it would
  // have failed every capture; "fixed" by loosening it, it would have passed
  // everything forever. A check that cannot fail is worse than no check, so it
  // is removed rather than weakened.
  //
  // Nothing replaces it because nothing honest can: NVENC exposes no read-back
  // of its own settings. The encoder's actual behaviour is covered where it
  // matters anyway -- resolution, subsampling, cadence, dropped frames and
  // pixel-measured range all still assert on the artifact.

  check("color_range_pixels", () => {
    const { min, max } = lumaExtremes(file, CALIB_T);
    return {
      ok: min <= Y_MIN_CEIL && max >= Y_MAX_FLOOR,
      got: `YMIN ${min}, YMAX ${max}`, want: `YMIN <= ${Y_MIN_CEIL}, YMAX >= ${Y_MAX_FLOOR}`,
      why: `the calibration target's black and white patches came back at ${min}/${max}, not full range. Limited-range pixels land near 16/235. The container tag cannot see this.`,
    };
  });

  check("no_resample", () => {
    // Bottom-left cell of the calibration target: the 1px hairline grid.
    const crop = `${Math.floor(WIDTH / 3)}:${Math.floor(HEIGHT / 2)}:0:${Math.floor(HEIGHT / 2)}`;
    const { min, max } = lumaExtremes(file, CALIB_T, crop);
    return {
      ok: min <= HAIRLINE_MIN_CEIL && max >= HAIRLINE_MAX_FLOOR,
      got: `hairline YMIN ${min}, YMAX ${max}`,
      want: `YMIN <= ${HAIRLINE_MIN_CEIL}, YMAX >= ${HAIRLINE_MAX_FLOOR}`,
      why: `the 1px hairline grid came back at ${min}/${max} instead of near 0/255, so something between KiCad and the file is resampling. A schematic is made of 1px lines.`,
    };
  });

  // Rule 1, enforced: every registered check must have filed a reading.
  const expected = [
    "resolution", "pix_fmt", "fps", "cadence", "no_dropped_frames",
    "color_range_pixels", "no_resample",
  ];
  const silent = expected.filter((id) => !filed.has(id));
  if (silent.length) problems.push(`checks that never filed a reading: ${silent.join(", ")}`);

  return { readings, problems, silent };
}

// ---------------------------------------------------------------------------

function report(file, result) {
  const verdict = {
    artifact: basename(file),
    checked_at_utc: new Date().toISOString(),
    spec: { WIDTH, HEIGHT, FPS: `${FPS_NUM}/${FPS_DEN}`, PIX_FMT, Y_MIN_CEIL, Y_MAX_FLOOR },
    ok: result.problems.length === 0,
    readings: result.readings,
    problems: result.problems,
  };
  const side = join(dirname(file), `${basename(file)}.verify.json`);
  writeFileSync(side, JSON.stringify(verdict, null, 2));

  for (const r of result.readings) {
    console.log(`  ${r.ok ? "ok  " : "FAIL"}  ${r.id.padEnd(20)} ${r.got ?? r.error ?? ""}`);
  }
  console.log(`\nverdict written to ${side}`);
  if (verdict.ok) {
    console.log("PASS -- this file is fit to cut.");
    return 0;
  }
  console.log(`\nFAIL (${result.problems.length}). DO NOT CUT THIS FILE. Fix the capture and reshoot:`);
  for (const p of result.problems) console.log(`  !! ${p}`);
  return 1;
}

// ---------------------------------------------------------------------------
// SELF-TEST. A gate nobody has watched fail is a gate nobody knows works. This
// builds a compliant file and then one deliberate fault at a time, and asserts
// the RIGHT check fires -- not merely that something failed.
// ---------------------------------------------------------------------------

function selftest() {
  const dir = join(process.env.TEMP ?? "/tmp", "otd-verify-capture-selftest");
  mkdirSync(dir, { recursive: true });
  const mk = (
    name,
    { w = WIDTH, h = HEIGHT, fps = 30, pix = PIX_FMT, opts = "deblock=-3:-3", range = "full", downscaleFrom = null } = {},
  ) => {
    const out = join(dir, name);
    // `downscaleFrom` draws the target at a LARGER size and resamples it down
    // to the spec resolution -- exactly the 2560x1440 capture path. The file
    // that comes out is 1920x1080 and passes every metadata check, which is the
    // whole reason `no_resample` has to measure pixels.
    if (downscaleFrom) {
      w = downscaleFrom[0];
      h = downscaleFrom[1];
    }
    // A synthetic stand-in for the calibration target: full-black left third
    // with a full-white block, so YMIN/YMAX read 0/255, plus a 1px hairline
    // grid in the bottom-left cell where the real target puts one.
    //
    // Built as a raw RGB buffer in Node rather than as a lavfi filtergraph.
    // Both reasons were found by running it: the graph needed three levels of
    // escaping to express a 1px checker and produced a FLAT BLACK cell instead,
    // silently; and lavfi's colour sources arrive as LIMITED range, so the
    // "compliant" fixture failed the range check and read as a gate bug when it
    // was a fixture bug. Raw pixels have neither problem.
    const cw = Math.floor(w / 3);
    const chh = Math.floor(h / 2);
    const buf = Buffer.alloc(w * h * 3, 128); // mid grey elsewhere
    const set = (x, y, v) => {
      const i = (y * w + x) * 3;
      buf[i] = buf[i + 1] = buf[i + 2] = v;
    };
    for (let y = 0; y < chh; y += 1) {
      for (let x = 0; x < w; x += 1) {
        if (x < cw) set(x, y, 0); // BLACK patch -> YMIN
        else if (x < cw * 2) set(x, y, 255); // WHITE patch -> YMAX
      }
    }
    for (let y = chh; y < h; y += 1) {
      for (let x = 0; x < cw; x += 1) set(x, y, x % 2 === 0 ? 0 : 255); // hairlines
    }
    // ONE frame on disk, looped by ffmpeg, rather than N frames down a pipe.
    // At 2560x1440 a 3s pipe is ~1 GB and the 4K fixture ~2.2 GB, both over
    // execFileSync's buffer cap -- the fixture would fail for a reason that has
    // nothing to do with what is being tested.
    const rawPath = out.replace(/\.mkv$/, ".raw");
    writeFileSync(rawPath, buf);
    execFileSync("ffmpeg", [
      "-y", "-hide_banner", "-loglevel", "error",
      "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", `${w}x${h}`, "-framerate", String(fps),
      "-stream_loop", String(fps * 3 - 1), "-i", rawPath,
      // FULL range in and out, matching the capture spec. Without this the
      // RGB->YUV conversion crushes to 16-235 and the fixture is not compliant.
      "-vf",
      [
        downscaleFrom ? `scale=${WIDTH}:${HEIGHT}:flags=lanczos` : null,
        `scale=in_range=full:out_range=${range === "full" ? "full" : "limited"}`,
        `format=${pix}`,
      ].filter(Boolean).join(","),
      "-color_range", range === "full" ? "pc" : "tv",
      "-c:v", "libx264", "-preset", "ultrafast", "-qp", "0",
      // ffmpeg's -x264-params uses ':' as ITS OWN separator, so x264's native
      // `deblock=-3:-3` has to be escaped here. OBS's options box takes the
      // native form directly -- this escaping is an artefact of synthesizing a
      // test file with ffmpeg, not part of the capture spec.
      "-x264-params", opts.replace(/(?<==-?\d+):(?=-?\d)/g, "\\:"),
      out,
    ], { stdio: ["ignore", "ignore", "pipe"] });
    return out;
  };

  const cases = [
    ["compliant", {}, []],
    ["wrong resolution", { w: 2560, h: 1440 }, ["resolution"]],
    ["4:4:4 (not the spec, and not editable)", { pix: "yuv444p" }, ["pix_fmt"]],
    ["60 fps", { fps: 60 }, ["fps"]],
    
    // The two faults that no metadata field can see. Without these cases the
    // pixel checks would never be observed failing, and an unobserved check is
    // indistinguishable from a blind one -- which is the bug this whole track
    // exists to stop shipping.
    ["limited range", { range: "limited" }, ["color_range_pixels"]],
    ["1440p downscaled to 1080p", { downscaleFrom: [2560, 1440] }, ["no_resample"]],
  ];

  let bad = 0;
  for (const [label, opts, expectFail] of cases) {
    const f = mk(`${label.replace(/[^a-z0-9]+/gi, "-")}.mkv`, opts);
    const r = verify(f);
    const failed = r.readings.filter((x) => !x.ok).map((x) => x.id);
    // Every check must have filed, in every case -- including the broken ones.
    // A fault that makes a check go SILENT is the failure mode rule 1 exists for.
    const silentBad = r.silent.length > 0;
    const hit = expectFail.every((id) => failed.includes(id));
    const clean = expectFail.length === 0 ? failed.length === 0 : true;
    const ok = hit && clean && !silentBad;
    if (!ok) bad += 1;
    console.log(
      `  ${ok ? "ok  " : "FAIL"}  ${label.padEnd(24)} expected [${expectFail.join(",") || "none"}]  got [${failed.join(",") || "none"}]` +
        (silentBad ? `  SILENT: ${r.silent.join(",")}` : ""),
    );
  }
  console.log(bad === 0
    ? "\nSelf-test passed: every check fires on its own fault and stays quiet otherwise."
    : `\nSELF-TEST FAILED (${bad}). The gate does not do what it claims.`);
  return bad === 0 ? 0 : 1;
}

// ---------------------------------------------------------------------------

if (SELFTEST) {
  process.exit(selftest());
}
if (!target) {
  console.error("usage: node tools/video/verify-capture.mjs <file.mkv> | --selftest");
  process.exit(2);
}
if (!existsSync(target)) {
  console.error(`no such file: ${target}`);
  process.exit(2);
}
console.log(`\nverify-capture  ${target}\n`);
process.exit(report(target, verify(target)));
