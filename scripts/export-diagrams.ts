// Registry-driven diagram exporter. Renders each guide diagram via the dev
// server's /diagram-render/<basename> route, screenshots figure[role="img"] at
// 2x with reduced-motion forced (so the entrance animation shows its final
// state), encodes WebP, and reads aria-label for alt text. Builds an export
// manifest (basename -> image path, alt, content hash).
//
// Flags:
//   --only=<basename>  render just one diagram (validation; no manifest write)
//   --check            verify presence + freshness; non-zero exit if stale
//
// The key list is read from the registry FILE (regex), NOT imported — importing
// pulls 14 React client components into Node. See diagram-registry.tsx.
import { chromium } from "playwright";
import sharp from "sharp";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const ROOT = process.cwd();
const BASE = process.env.DIAGRAM_BASE_URL ?? "http://localhost:3000";
const OUT = path.join(ROOT, "public", "guide-diagrams");
const MANIFEST = path.join(ROOT, "src", "components", "guide", "diagram-export-manifest.json");

const argv = process.argv.slice(2);
const CHECK = argv.includes("--check");
const ONLY = (argv.find((a) => a.startsWith("--only=")) ?? "").split("=")[1] || null;

function registryBasenames(): string[] {
  const reg = readFileSync(path.join(ROOT, "src/components/guide/diagram-registry.tsx"), "utf8");
  return [...reg.matchAll(/"\/guide-diagrams\/([^"]+)\.svg"\s*:/g)].map((m) => m[1]);
}

const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex").slice(0, 12);

type Entry = { basename: string; image: string; alt: string; hash: string };

async function main() {
  mkdirSync(OUT, { recursive: true });
  let names = registryBasenames();
  if (ONLY) names = names.filter((n) => n === ONLY);
  if (!names.length) {
    console.error(`No diagrams matched${ONLY ? ` --only=${ONLY}` : ""}.`);
    process.exit(1);
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 2 });
  await page.emulateMedia({ reducedMotion: "reduce" });

  const manifest: Entry[] = [];
  const stale: string[] = [];

  for (const basename of names) {
    await page.goto(`${BASE}/diagram-render/${basename}`, { waitUntil: "networkidle", timeout: 60_000 });
    const figure = page.locator('figure[role="img"]').first();
    await figure.waitFor({ state: "visible", timeout: 30_000 });
    const alt = (await figure.getAttribute("aria-label")) ?? "";
    if (!alt.trim()) throw new Error(`Diagram "${basename}" has no aria-label — alt text is required`);

    const file = path.join(OUT, `${basename}.webp`);
    const rel = `/guide-diagrams/${basename}.webp`;

    if (CHECK) {
      // CI-portable check: confirm the diagram renders + carries alt, and a
      // committed image exists. Do NOT re-encode and byte-compare pixels — WebP
      // bytes differ across OS/font rendering, so a hash gate would fail every
      // cross-platform CI run. Pixel staleness relies on local re-export.
      if (!existsSync(file)) stale.push(`${basename}: missing exported image`);
      manifest.push({ basename, image: rel, alt, hash: "" });
    } else {
      const png = await figure.screenshot({ type: "png" });
      const webp = await sharp(png).webp({ quality: 90 }).toBuffer();
      writeFileSync(file, webp);
      manifest.push({ basename, image: rel, alt, hash: sha(webp) });
      console.log(`  ${basename}.webp  (${(webp.length / 1024).toFixed(0)} KB)  alt: "${alt.slice(0, 64)}${alt.length > 64 ? "…" : ""}"`);
    }
  }

  await browser.close();

  if (CHECK) {
    const committed: Entry[] = existsSync(MANIFEST)
      ? JSON.parse(readFileSync(MANIFEST, "utf8"))
      : [];
    // Compare portable fields only (basename, image, alt) — never the pixel hash.
    const norm = (arr: Entry[]) =>
      JSON.stringify(
        arr
          .map((e) => ({ basename: e.basename, image: e.image, alt: e.alt }))
          .sort((a, b) => a.basename.localeCompare(b.basename)),
      );
    if (norm(committed) !== norm(manifest))
      stale.push("manifest out of date (a diagram was added/renamed or its alt text changed) — run `pnpm diagrams:export`");
    if (stale.length) {
      console.error("Diagram export check FAILED:\n" + stale.map((s) => "  - " + s).join("\n") + "\n\nRun `pnpm diagrams:export` and commit the result.");
      process.exit(1);
    }
    console.log(`Diagram export check OK (${manifest.length} diagrams; presence + alt verified).`);
  } else if (ONLY) {
    console.log(`\nSingle-diagram validation run for "${ONLY}" done. Manifest NOT written (partial run).`);
  } else {
    writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
    console.log(`\nExported ${manifest.length} diagrams + manifest.`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
