// Read an MP4's H.264 profile, level and sample-entry tag off the bytes.
//
// ffprobe answers the same question in one line, and the film tools use it,
// but CI has no ffprobe (measured: `spawnSync ffprobe ENOENT` failed the hero
// test on 2026-10-02). Skipping the assertion there would make the phone-safe
// encode a claim CI never checks, so this reads the two boxes that carry the
// answer instead:
//
//   avcC  the AVCDecoderConfigurationRecord inside the sample entry; bytes
//         1..3 of its payload are profile_idc, profile_compatibility and
//         level_idc (ISO 14496-15 section 5.2.4.1.1).
//   avc1  the sample entry's own type, which is the "codec tag" players and
//         ffprobe report. x264 writes `avc1` when asked with -tag:v avc1;
//         some muxers write `H264` or `avc3`, which is what the gate refuses.
//
// A box scan, not a full parser: the two type strings are searched for in the
// file and read in place. Good enough for a file this repo encoded itself and
// for the test that pins it; a hostile file is not the threat model here.
import { readFileSync } from "node:fs";

export type H264Probe = {
  /** "High" for profile_idc 100, "Main" for 77, "Baseline" for 66, else the number. */
  profile: string | null;
  /** level_idc as ffprobe reports it: 40 for level 4.0, 50 for 5.0. */
  level: number | null;
  /** The sample entry type: "avc1", "avc3", "H264", or null if none was found. */
  tag: string | null;
};

const PROFILES: Record<number, string> = {
  66: "Baseline",
  77: "Main",
  88: "Extended",
  100: "High",
};

export function probeH264(buf: Buffer): H264Probe {
  const avcC = buf.indexOf("avcC", 0, "latin1");
  let profile: string | null = null;
  let level: number | null = null;
  if (avcC >= 0 && avcC + 8 <= buf.length) {
    // The box: [size:4]["avcC"][payload]. We are at the type; the payload
    // follows: configurationVersion, AVCProfileIndication,
    // profile_compatibility, AVCLevelIndication.
    const p = buf[avcC + 5];
    const l = buf[avcC + 7];
    profile = PROFILES[p] ?? String(p);
    level = l;
  }
  let tag: string | null = null;
  for (const t of ["avc1", "avc3", "H264", "h264"]) {
    if (buf.indexOf(t, 0, "latin1") >= 0) {
      tag = t;
      break;
    }
  }
  return { profile, level, tag };
}

export function probeH264File(path: string): H264Probe {
  return probeH264(readFileSync(path));
}
