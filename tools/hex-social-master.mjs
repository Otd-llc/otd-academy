// Platform masters: the silent loop, repeated to a useful runtime, with the
// percussion bed muxed in.
//
// WHY LAPS RATHER THAN A LONGER RENDER. The cuts are verified exact loops, so
// concatenating N of them is seamless BY CONSTRUCTION and costs one stream copy
// instead of an N-times-longer capture. A 30 s Shorts master is three laps of
// the same 10 s choreography, joined with no re-encode of the video at all.
//
// WHY AUDIO AT ALL. The captures are written with `-an`, so they carry no audio
// STREAM, not merely a silent one. X and LinkedIn accept that; YouTube's spec
// asks for AAC-LC at 48 kHz, and a Short with no audio track is the one case
// where the absence might be rejected rather than ignored. This attaches a real
// track, so the question stops mattering.
//
// The bed is generated at exactly the master's length by tools/hex-drums.py,
// which refuses any duration that is not a whole number of bars at 120 BPM. A
// bed that does not divide the runtime clicks on every lap even though the
// picture does not.
//
//   node tools/hex-social-master.mjs --preset=vertical --laps=3
//   node tools/hex-social-master.mjs --preset=square --laps=1 --silent
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync, statSync } from "node:fs";

const DIR = "C:/zzz/_hex-promo";
const TMP = `${DIR}/_master-tmp`;
const SECONDS_PER_LAP = 10;

const arg = (n, d) =>
  process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=")[1] ?? d;
const flag = (n) => process.argv.includes(`--${n}`);

const preset = arg("preset");
const laps = Number(arg("laps", "1"));
const silent = flag("silent");
if (!preset) {
  console.error("--preset= is required (vertical | square | portrait | wide)");
  process.exit(1);
}

const src = `${DIR}/hex-${preset}-orbit.mp4`;
statSync(src); // fail loudly if the cut has not been rendered
const seconds = laps * SECONDS_PER_LAP;
const out = `${DIR}/social/hex-${preset}-${seconds}s${silent ? "-silent" : ""}.mp4`;
mkdirSync(`${DIR}/social`, { recursive: true });
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

// The concat DEMUXER, not the filter: stream copy, so the laps are bit-identical
// to the source and no generation loss accumulates across a 3x master.
const list = `${TMP}/list.txt`;
writeFileSync(list, Array.from({ length: laps }, () => `file '${src}'`).join("\n"));
const looped = `${TMP}/looped.mp4`;
execFileSync("ffmpeg", [
  "-y", "-loglevel", "error",
  "-f", "concat", "-safe", "0", "-i", list,
  "-c", "copy",
  looped,
]);

if (silent) {
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", looped, "-c", "copy", out]);
} else {
  const wav = `${TMP}/bed.wav`;
  execFileSync("python", [
    "tools/hex-drums.py",
    "--seconds", String(seconds),
    "--out", wav,
  ]);
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error",
    "-i", looped,
    "-i", wav,
    // Video untouched; only the bed is encoded. AAC-LC at 48 kHz is what
    // YouTube's spec names.
    "-c:v", "copy",
    "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2",
    "-shortest",
    "-movflags", "+faststart",
    out,
  ]);
}

const probe = execFileSync(
  "ffprobe",
  ["-v", "error", "-show_entries", "format=duration",
   "-show_entries", "stream=codec_type,codec_name,width,height,sample_rate",
   "-of", "default=nw=1", out],
  { encoding: "utf8" },
).trim().replace(/\r?\n/g, "  ");
console.log(`${out}  ${(statSync(out).size / 1024).toFixed(0)} KB`);
console.log(`  ${probe}`);
rmSync(TMP, { recursive: true, force: true });
