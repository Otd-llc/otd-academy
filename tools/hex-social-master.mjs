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
// THE BED IS A FILE NOW, NOT A GENERATOR CALL. This used to invoke
// tools/hex-drums.py to synthesise a bed at exactly the master's length. That
// bed was rejected -- synthesis was the wrong material, and what replaced it is
// an arrangement of CC0 samples finished through tools/hex-master.py: EBU R128
// at -14 LUFS, -1 dBTP, convolved through a real room. None of that can be
// re-derived from a duration, so the master reads the finished wav.
//
// It is ONE LAP long and loop-safe by construction (hex-master.py renders two
// laps through the reverb and keeps the second, so the tail arriving at the loop
// point is the one that just left it). `-stream_loop` therefore tiles it to any
// whole number of laps without a click, the same argument as the video concat.
//
//   node tools/hex-social-master.mjs --preset=vertical --laps=3 --text
//   node tools/hex-social-master.mjs --preset=square --laps=1 --silent
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync, statSync } from "node:fs";

const DIR = "C:/zzz/_hex-promo";
const TMP = `${DIR}/_master-tmp`;
const SECONDS_PER_LAP = 10;
const BED = `${DIR}/kits/hex-bed-rd-revtaiko-master.wav`;

const arg = (n, d) =>
  process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=")[1] ?? d;
const flag = (n) => process.argv.includes(`--${n}`);

const preset = arg("preset");
const laps = Number(arg("laps", "1"));
const silent = flag("silent");
// `--text` takes the cut with the kinetic type burned in. Kept as a separate
// source rather than a switch inside one file, because the two are different
// deliverables: the type version is for a feed, where a viewer scrolls past
// with the sound off and the words are the only copy; the clean one is for a
// page that already has a headline.
const text = flag("text");
const bed = arg("bed", BED);
if (!preset) {
  console.error("--preset= is required (vertical | square | portrait | wide)");
  process.exit(1);
}

const src = `${DIR}/hex-${preset}-orbit${text ? "-text" : ""}.mp4`;
statSync(src); // fail loudly if the cut has not been rendered
const seconds = laps * SECONDS_PER_LAP;
const out = `${DIR}/social/hex-${preset}-${seconds}s${text ? "-text" : ""}${silent ? "-silent" : ""}.mp4`;
mkdirSync(`${DIR}/social`, { recursive: true });
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

// The concat DEMUXER, not the filter: stream copy, so the laps are bit-identical
// to the source and no generation loss accumulates across a 3x master.
const list = `${TMP}/list.txt`;
writeFileSync(
  list,
  Array.from({ length: laps }, () => `file '${src}'`).join("\n"),
);
const looped = `${TMP}/looped.mp4`;
execFileSync("ffmpeg", [
  "-y",
  "-loglevel",
  "error",
  "-f",
  "concat",
  "-safe",
  "0",
  "-i",
  list,
  "-c",
  "copy",
  looped,
]);

if (silent) {
  execFileSync("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-i",
    looped,
    "-c",
    "copy",
    out,
  ]);
} else {
  statSync(bed); // fail loudly rather than muxing a master with no audio
  execFileSync("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-i",
    looped,
    // One lap of bed per lap of picture. `-stream_loop n` plays the input n+1
    // times, and `-shortest` trims the remainder against the video, so an
    // off-by-one here lengthens nothing.
    "-stream_loop",
    String(laps - 1),
    "-i",
    bed,
    // Video untouched; only the bed is encoded. AAC-LC at 48 kHz is what
    // YouTube's spec names. 192k because that is what the already-distributed
    // masters carry, and a set of cuts of the same clip should not differ in
    // audio quality by which day they were made.
    "-map",
    "0:v",
    "-map",
    "1:a",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-ar",
    "48000",
    "-ac",
    "2",
    "-shortest",
    // Start at zero, or the muxer writes a start_time offset and every lap
    // waits for it -- the same trap the picture encode already avoids.
    "-muxdelay",
    "0",
    "-muxpreload",
    "0",
    "-movflags",
    "+faststart",
    out,
  ]);
}

const probe = execFileSync(
  "ffprobe",
  [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-show_entries",
    "stream=codec_type,codec_name,width,height,sample_rate",
    "-of",
    "default=nw=1",
    out,
  ],
  { encoding: "utf8" },
)
  .trim()
  .replace(/\r?\n/g, "  ");
console.log(`${out}  ${(statSync(out).size / 1024).toFixed(0)} KB`);
console.log(`  ${probe}`);
rmSync(TMP, { recursive: true, force: true });
