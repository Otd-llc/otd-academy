// Unit tests for the static brief-page data (src/lib/brief-pages.ts). These are
// pure data + a tiny resolver, so no DB is touched. They guard the two things
// that matter: the resolver maps keys correctly, and the copy stays voice-clean
// (no em-dashes anywhere) with the load-bearing facts present and accurate.

import { describe, it, expect } from "vitest";
import {
  BRIEFS,
  BRIEF_KEYS,
  PROOF_STATS,
  SYSTEM_MAP,
  getBrief,
} from "@/lib/brief-pages";

// Every PROSE string reachable from the brief data, flattened for scanning.
// `seoTitle` is intentionally excluded: it carries the site-wide browser-tab
// separator ("X — One Thousand Drones Academy"), a separator and not prose, the
// same convention every other page's <title> uses.
function allStrings(): string[] {
  const out: string[] = [];
  for (const key of BRIEF_KEYS) {
    const b = BRIEFS[key];
    out.push(b.eyebrow, b.title, b.lead, b.seoDescription, b.valueHeading, b.proofHeading);
    out.push(...b.valueBody);
    for (const m of b.meta) out.push(m.label, m.value);
    for (const p of b.proofPoints) out.push(p.lead, p.body);
    for (const c of b.ctas) out.push(c.label, c.href);
  }
  for (const s of PROOF_STATS) out.push(s.value, s.label);
  return out;
}

describe("getBrief", () => {
  it("resolves the two known keys", () => {
    expect(getBrief("overview")?.key).toBe("overview");
    expect(getBrief("learner")?.key).toBe("learner");
  });

  it("returns null for an unknown key", () => {
    expect(getBrief("educators")).toBeNull();
    expect(getBrief("")).toBeNull();
    expect(getBrief("__proto__")).toBeNull();
  });

  it("BRIEF_KEYS lists exactly the two public briefs", () => {
    expect(BRIEF_KEYS).toEqual(["overview", "learner"]);
  });
});

describe("voice rules (absolute)", () => {
  it("uses no em-dashes anywhere in the brief copy", () => {
    for (const s of allStrings()) {
      expect(s, `em-dash in: ${s}`).not.toMatch(/—/);
    }
  });

  it("uses no en-dashes as punctuation in the brief copy", () => {
    for (const s of allStrings()) {
      expect(s, `en-dash in: ${s}`).not.toMatch(/–/);
    }
  });
});

describe("load-bearing facts", () => {
  it("keeps the four headline proof stats accurate", () => {
    const values = PROOF_STATS.map((s) => s.value);
    expect(values).toContain("22"); // boards
    expect(values).toContain("8"); // build stages
    expect(values.some((v) => v.includes("DRC"))).toBe(true); // the real gate
    expect(PROOF_STATS.some((s) => /no subscription/i.test(s.label))).toBe(true);
  });

  it("maps the four tracks and two capstones", () => {
    expect(SYSTEM_MAP.tracks.map((t) => t.code)).toEqual([
      "SENSE",
      "ACT",
      "COMMS",
      "POWER",
    ]);
    expect(SYSTEM_MAP.capstones.map((c) => c.code)).toEqual(["EEG", "HUB"]);
    expect(SYSTEM_MAP.root.label).toBe("ESP32-S3");
  });

  it("points the learner's primary CTA at the free L1 public guide", () => {
    const cta = BRIEFS.learner.ctas.find((c) => c.primary);
    expect(cta?.href).toBe("/projects/l1-01-wroom-breakout/v1/guide");
  });

  it("points the overview down-funnel CTAs at /courses and /pricing", () => {
    const hrefs = BRIEFS.overview.ctas.map((c) => c.href);
    expect(hrefs).toContain("/courses");
    expect(hrefs).toContain("/pricing");
  });
});
