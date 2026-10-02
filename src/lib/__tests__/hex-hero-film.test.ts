// The /hex hero film's files, pinned to what the page promises (plan 4.3).
import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { HEX_HERO_CLIP_BUDGET_BYTES, HEX_HERO_FILM } from "@/lib/hex-hero-film";

const PUBLIC = join(process.cwd(), "public");
const clips = [HEX_HERO_FILM.dark, HEX_HERO_FILM.light];

function probe(file: string): {
  profile?: string;
  level?: number;
  tag?: string;
} {
  const out = execFileSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=profile,level,codec_tag_string",
      "-of",
      "json",
      file,
    ],
    { encoding: "utf8" },
  );
  const st = (JSON.parse(out).streams?.[0] ?? {}) as {
    profile?: string;
    level?: number;
    codec_tag_string?: string;
  };
  return { profile: st.profile, level: st.level, tag: st.codec_tag_string };
}

describe("the /hex hero film", () => {
  it("ships both clips and both posters", () => {
    for (const c of clips) {
      expect(existsSync(join(PUBLIC, c.src)), c.src).toBe(true);
      expect(existsSync(join(PUBLIC, c.poster)), c.poster).toBe(true);
    }
  });

  it("keeps every clip inside the per-theme budget", () => {
    for (const c of clips) {
      const bytes = statSync(join(PUBLIC, c.src)).size;
      expect(bytes, c.src).toBeGreaterThan(0);
      expect(bytes, c.src).toBeLessThanOrEqual(HEX_HERO_CLIP_BUDGET_BYTES);
    }
  });

  it("is the phone-safe encode, read off the file: High, level 4.0, avc1", () => {
    for (const c of clips) {
      const got = probe(join(PUBLIC, c.src));
      expect(got, c.src).toEqual({ profile: "High", level: 40, tag: "avc1" });
    }
  });

  it("describes the film, not the configurator, with no em-dash", () => {
    expect(HEX_HERO_FILM.label).toMatch(/build/i);
    expect(HEX_HERO_FILM.label).not.toContain("—");
  });
});
