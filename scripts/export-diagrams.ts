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
/**
 * `--dark-png`: emit the dark `<name>.png` the Library OG card reads off disk.
 * Nothing has ever written this file; see the block in main().
 */
const DARK_PNG = argv.includes("--dark-png");
/** Enough for the card's 480x420 box at 2x, and no more. */
const DARK_PNG_MAX = 960;
// Diagrams that still carry literal dark hex in SVG attributes (var() isn't valid
// in a presentation attribute) do NOT re-theme under data-theme="light" yet, so
// their light raster would be broken. Skip them until they're tokenized. None are
// used by the EEG/BCI Library / Field Guide, so the PDF is unaffected.
const LIGHT_SKIP = new Set<string>([]);

function registryBasenames(): string[] {
  // Scan the core registry PLUS every per-cluster registry file
  // (diagram-registry-<cluster>.tsx, added by the parallel-authoring split) so a
  // diagram registered only in its cluster's file is still discovered. Regex the
  // FILES (not an import) to keep React client components out of Node.
  const dir = path.join(ROOT, "src/components/guide");
  const files = readdirSync(dir).filter((f) => /^diagram-registry.*\.tsx$/.test(f));
  const keys = new Set<string>();
  for (const f of files) {
    const reg = readFileSync(path.join(dir, f), "utf8");
    for (const line of reg.split(/\r?\n/)) {
      // Skip `//` comment lines so a scaffold's EXAMPLE key (shown in a comment,
      // e.g. `//   "/guide-diagrams/comms-uart-frame.svg": CommsUartFrame,`) is not
      // mistaken for a real registration. Registry entries are one key per line.
      if (line.trimStart().startsWith("//")) continue;
      const m = line.match(/"\/guide-diagrams\/([^"]+)\.svg"\s*:/);
      if (m) keys.add(m[1]);
    }
  }
  return [...keys];
}

const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex").slice(0, 12);

/**
 * Hide every floating overlay before a screenshot, and prove none is left.
 *
 * A Playwright ELEMENT screenshot captures the page REGION under the element's
 * box, not the element's own paint tree, so anything floating over the figure
 * lands inside the exported file. The cookie-consent widget does exactly that:
 * a scan of the committed rasters found it baked into 27 of the 86
 * `-light.png` — the files react-pdf embeds in the Field Guide books.
 *
 * Swept by COMPUTED POSITION rather than by selector. The widget is client
 * rendered with no stable class in the markup (the server HTML carries only a
 * `#c15t-theme` style tag), and a selector list would rot the next time the
 * consent library changes. Anything fixed or sticky that is not part of the
 * figure has no business in a diagram raster whatever it is called.
 */
async function hideOverlays(page: import("playwright").Page) {
  const left = await page.evaluate(() => {
    const fig = document.querySelector('figure[role="img"]');
    let hidden = 0;
    for (const el of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
      if (fig && (fig === el || fig.contains(el))) continue;
      const cs = getComputedStyle(el);
      if (cs.position !== "fixed" && cs.position !== "sticky") continue;
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      el.style.setProperty("display", "none", "important");
      hidden += 1;
    }
    // Re-read after hiding: a parent going away can reveal a sibling, and the
    // point is that NOTHING floats over the figure when the shutter opens.
    let remaining = 0;
    for (const el of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
      if (fig && (fig === el || fig.contains(el))) continue;
      const cs = getComputedStyle(el);
      if ((cs.position === "fixed" || cs.position === "sticky") && cs.display !== "none" && cs.visibility !== "hidden") {
        remaining += 1;
      }
    }
    return { hidden, remaining };
  });
  if (left.remaining > 0) {
    throw new Error(`${left.remaining} floating element(s) still overlay the figure — the raster would bake them in`);
  }
  return left.hidden;
}

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
      // `?bare=1`: the light PNG is the Library PDF's raster, and the PDF should
      // match the in-lesson BARE figure (no echoed title/eyebrow/caption).
      await page.goto(`${BASE}/diagram-render/${basename}?bare=1`, { waitUntil: "networkidle", timeout: 60_000 });
      const figure = page.locator('figure[role="img"]').first();
      await figure.waitFor({ state: "visible", timeout: 30_000 });
      await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
      await page.waitForTimeout(250); // let the token flip settle
      await hideOverlays(page);
      const out = path.join(OUT, `${basename}-light.png`);
      await figure.screenshot({ path: out, type: "png" });
      n++;
      console.log(`  ${basename}-light.png`);
    }
    await browser.close();
    console.log(`\nExported ${n} light diagram rasters.`);
    return;
  }

  // ── dark PNG export ─────────────────────────────────────────────────────
  //
  // THIS WAS NEVER WRITTEN BY ANYTHING. `/library/[slug]/opengraph-image` reads
  // `public/guide-diagrams/<name>.png` off disk to put the lesson's hero
  // diagram on its social card, and falls back to a text-only card when the
  // read throws. The full export below emits `<name>.webp` and, under --light,
  // `<name>-light.png` — but never the dark `<name>.png`. `git log -S` finds no
  // commit that ever added one: the 39 on disk are hand-landed leftovers.
  //
  // So 47 of the 86 published lessons ship a card with a title and empty space
  // where the diagram belongs, and because the route catches ENOENT and returns
  // null, nothing anywhere reported it. Verified on a real deploy before fixing:
  // `ads1299-explained` carries its figure, `batteries-101` does not.
  //
  // A SEPARATE MODE, not folded into the full export, deliberately. A full
  // export re-renders every diagram and rewrites all 86 .webp files, whose
  // bytes differ across OS and font rendering — running it here to add a
  // missing PNG would churn every raster in the repo and rewrite every hash.
  // This mirrors --light: render, write one file, touch nothing else.
  if (DARK_PNG) {
    let n = 0;
    for (const basename of names) {
      await page.goto(`${BASE}/diagram-render/${basename}`, { waitUntil: "networkidle", timeout: 60_000 });
      const figure = page.locator('figure[role="img"]').first();
      await figure.waitFor({ state: "visible", timeout: 30_000 });
      // Force dark explicitly, exactly as the full export does: the render
      // bootstrap otherwise resolves from prefers-color-scheme, and a LIGHT
      // raster baked into the dark card is the failure that looks fine locally.
      await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
      await page.waitForTimeout(250);
      await hideOverlays(page);
      const shot = await figure.screenshot({ type: "png" });

      // Capped at 960 px. The card paints this into at most 480x420
      // (`fit(ratio, 480, 420)` in the OG route), so 960 covers it at 2x and
      // anything beyond is weight in a public repo's history for pixels no
      // crawler will ever sample. Only downscale — never enlarge a small one.
      const meta = await sharp(shot).metadata();
      const out = path.join(OUT, `${basename}.png`);
      // ALWAYS through the encoder, resize or not. Writing Playwright's buffer
      // straight through when a diagram was already under the cap made those
      // files BIGGER than the ones they replaced (3,649 KB -> 5,400 KB across
      // the 39 that already existed): a screenshot is emitted at a low
      // compression level, and the hand-landed originals had evidently been
      // squeezed. Same pixels either way; this just stops the fix from being a
      // regression on the files it was not meant to touch.
      const pipe = sharp(shot);
      if ((meta.width ?? 0) > DARK_PNG_MAX) pipe.resize({ width: DARK_PNG_MAX });
      const buf = await pipe.png({ compressionLevel: 9, effort: 10 }).toBuffer();
      writeFileSync(out, buf);
      n++;
      console.log(`  ${basename}.png  ${meta.width}px -> ${Math.min(meta.width ?? 0, DARK_PNG_MAX)}px  (${(buf.length / 1024).toFixed(0)} KB)`);
    }
    await browser.close();
    console.log(`\nExported ${n} dark diagram rasters for the social cards.`);
    return;
  }

  const manifest: Entry[] = [];
  const stale: string[] = [];
  /** basename -> sha of the committed .webp. Populated only under --check. */
  const onDisk = new Map<string, string>();

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
      // committed image exists. Do NOT RE-ENCODE and byte-compare pixels — WebP
      // bytes differ across OS/font rendering, so a re-encode gate would fail
      // every cross-platform CI run. Pixel staleness relies on local re-export.
      //
      // HASHING THE COMMITTED FILE IS A DIFFERENT THING, and it IS portable:
      // no encoder runs, so the same bytes give the same digest on every
      // platform. It is done here because the field had drifted on 7 of 86
      // entries and nothing had ever noticed — `hash` was written on export and
      // then dropped by the comparison below, so it recorded a claim that was
      // never checked against the file it described.
      if (!existsSync(file)) stale.push(`${basename}: missing exported image`);
      else {
        const actual = sha(readFileSync(file));
        onDisk.set(basename, actual);
      }
      manifest.push({ basename, image: rel, alt, hash: "" });
    } else {
      await hideOverlays(page);
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

    // The hash, verified against the bytes on disk. Encoder-free on both sides,
    // so it says nothing about how the file was made and everything about
    // whether the manifest still describes it.
    //
    // REFUSE TO PASS ON AN EMPTY SET. If nothing resolved, this loop would find
    // no mismatches and report success having compared nothing — the exact
    // green-check-on-an-empty-machine this check exists to prevent.
    if (!onDisk.size) {
      stale.push("hash verification compared 0 files — refusing to report the manifest clean");
    } else {
      for (const e of committed) {
        const actual = onDisk.get(e.basename);
        if (actual === undefined) continue; // absence is already reported above
        if (!e.hash) stale.push(`${e.basename}: manifest carries no hash`);
        else if (e.hash !== actual) {
          stale.push(`${e.basename}: manifest hash ${e.hash} but the committed .webp is ${actual}`);
        }
      }
    }

    if (stale.length) {
      console.error("Diagram export check FAILED:\n" + stale.map((s) => "  - " + s).join("\n") + "\n\nRun `pnpm diagrams:export` and commit the result.");
      process.exit(1);
    }
    console.log(
      `Diagram export check OK (${manifest.length} diagrams; presence + alt verified, ` +
        `${onDisk.size} image hashes matched the manifest).`,
    );
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
