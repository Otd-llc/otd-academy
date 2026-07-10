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
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const ROOT = process.cwd();
const BASE = process.env.DIAGRAM_BASE_URL ?? "http://localhost:3000";
const OUT = path.join(ROOT, "public", "guide-diagrams");
const MANIFEST = path.join(ROOT, "src", "components", "guide", "diagram-export-manifest.json");

const argv = process.argv.slice(2);
const CHECK = argv.includes("--check");
const ONLY = (argv.find((a) => a.startsWith("--only=")) ?? "").split("=")[1] || null;
// `--light`: also emit a `<name>-light.png` rendered under data-theme="light",
// for print/light surfaces (the Library PDF prefers it). PNG only (react-pdf
// can't embed WebP; the light web webp is the broader light-mode track's job).
const LIGHT = argv.includes("--light");
// Diagrams that still carry literal dark hex in SVG attributes (var() isn't valid
// in a presentation attribute) do NOT re-theme under data-theme="light" yet, so
// their light raster would be broken. Skip them until they're tokenized. None are
// used by the EEG/BCI Library / Field Guide, so the PDF is unaffected.
const LIGHT_SKIP = new Set<string>([]);

function registryBasenames(): string[] {
  // Scan the main registry index AND every per-cluster registry
  // (diagram-registry-<cluster>.tsx, added by the #288 split), unioning their
  // keys. The keys now live in the per-cluster modules, not the index, so reading
  // only the index would miss every cluster diagram. Regex the FILES (not import)
  // to keep React client components out of Node.
  const dir = path.join(ROOT, "src/components/guide");
  const files = readdirSync(dir).filter((f) => /^diagram-registry.*\.tsx$/.test(f));
  const keys = new Set<string>();
  for (const f of files) {
    // Drop `//` line comments first: each empty per-cluster stub carries a
    // worklist example (`"/guide-diagrams/<name>.svg": Comp,`) in a comment that
    // would otherwise match and enqueue an unregistered, unrenderable basename.
    const reg = readFileSync(path.join(dir, f), "utf8")
      .split("\n")
      .filter((ln) => !ln.trim().startsWith("//"))
      .join("\n");
    for (const m of reg.matchAll(/"\/guide-diagrams\/([^"]+)\.svg"\s*:/g)) keys.add(m[1]);
  }
  return [...keys];
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

  // ── light-variant export ────────────────────────────────────────────────
  // Render each diagram under data-theme="light" (the tokens flip via
  // globals.css) and screenshot to `<name>-light.png`. Skips the not-yet-
  // tokenized literal-hex diagrams and never touches the dark webp/png/manifest.
  if (LIGHT) {
    let n = 0;
    for (const basename of names) {
      if (LIGHT_SKIP.has(basename)) {
        console.log(`  ${basename}: skipped (literal hex, not light-ready)`);
        continue;
      }
      await page.goto(`${BASE}/diagram-render/${basename}`, { waitUntil: "networkidle", timeout: 60_000 });
      const figure = page.locator('figure[role="img"]').first();
      await figure.waitFor({ state: "visible", timeout: 30_000 });
      await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
      await page.waitForTimeout(250); // let the token flip settle
      const out = path.join(OUT, `${basename}-light.png`);
      await figure.screenshot({ path: out, type: "png" });
      n++;
      console.log(`  ${basename}-light.png`);
    }
    await browser.close();
    console.log(`\nExported ${n} light diagram rasters.`);
    return;
  }

  const manifest: Entry[] = [];
  const stale: string[] = [];

  for (const basename of names) {
    await page.goto(`${BASE}/diagram-render/${basename}`, { waitUntil: "networkidle", timeout: 60_000 });
    const figure = page.locator('figure[role="img"]').first();
    await figure.waitFor({ state: "visible", timeout: 30_000 });
    // Force the DARK theme explicitly: the diagram-render bootstrap otherwise
    // resolves from prefers-color-scheme, so an exporter run under a light OS /
    // default Playwright colorScheme would silently bake a LIGHT raster into the
    // dark .webp/.png (OG card + web-dark surface). data-theme wins over the media
    // query, making the raster theme deterministic regardless of host.
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
    await page.waitForTimeout(150);
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
