// The /hex hero film's files, pinned to what the page promises (plan 4.3).
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { HEX_HERO_CLIP_BUDGET_BYTES, HEX_HERO_FILM } from "@/lib/hex-hero-film";
import { probeH264File } from "@/lib/mp4-probe";

const PUBLIC = join(process.cwd(), "public");
const clips = [HEX_HERO_FILM.dark, HEX_HERO_FILM.light];

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
      // Off the bytes, not ffprobe: CI has none (spawnSync ffprobe ENOENT, 2026-10-02).
      const got = probeH264File(join(PUBLIC, c.src));
      expect(got, c.src).toEqual({ profile: "High", level: 40, tag: "avc1" });
    }
  });

  it("describes the film, not the configurator, with no em-dash", () => {
    expect(HEX_HERO_FILM.label).toMatch(/build/i);
    expect(HEX_HERO_FILM.label).not.toContain("—");
  });
});
