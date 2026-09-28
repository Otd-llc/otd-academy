import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

// The academy's four faces are served from public/fonts, not from Google Fonts.
// A top-level document must not contact fonts.googleapis.com / fonts.gstatic.com
// (a third-party request on every page view, and a privacy disclosure we would
// otherwise owe). This pins the three things that make that true: the stylesheet
// names no Google host, every @font-face points at a file that exists, and every
// family ships with its OFL text beside it.

const ROOT = process.cwd();
const css = readFileSync(path.join(ROOT, "src/app/globals.css"), "utf8");

const faces = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => {
  const body = m[1];
  const family = /font-family:\s*"([^"]+)"/.exec(body)?.[1];
  const weight = /font-weight:\s*(\d+)/.exec(body)?.[1];
  const url = /url\("([^"]+)"\)/.exec(body)?.[1];
  return { family, weight, url };
});

describe("self-hosted academy fonts", () => {
  it("globals.css requests nothing from a Google Fonts host", () => {
    expect(css).not.toMatch(/fonts\.g(oogleapis|static)\.com/);
  });

  it("declares exactly the families + weights the design system uses", () => {
    const got = faces.map((f) => `${f.family} ${f.weight}`).sort();
    expect(got).toEqual(
      [
        "Bebas Neue 400",
        "Lora 400",
        "Lora 500",
        "Saira Condensed 800",
        "Space Mono 400",
        "Space Mono 700",
      ].sort(),
    );
  });

  it("points every @font-face at a non-empty woff2 in public/", () => {
    for (const f of faces) {
      expect(f.url, `${f.family} ${f.weight}`).toMatch(/^\/fonts\/.+\.woff2$/);
      const file = path.join(ROOT, "public", f.url!);
      expect(existsSync(file), file).toBe(true);
      expect(statSync(file).size, file).toBeGreaterThan(1000);
    }
  });

  it("ships the OFL licence text for every family", () => {
    for (const family of new Set(faces.map((f) => f.family!))) {
      const slug = family.toLowerCase().replace(/\s+/g, "-");
      const file = path.join(ROOT, "public/fonts", `OFL-${slug}.txt`);
      expect(existsSync(file), file).toBe(true);
      expect(readFileSync(file, "utf8")).toContain("SIL Open Font License");
    }
  });
});
