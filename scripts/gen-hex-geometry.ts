// Regenerates `src/lib/hex-geometry.ts` from the published mesh set:
//
//   pnpm tsx scripts/gen-hex-geometry.ts
//
// RUN IT IN THE SAME COMMIT that re-cuts the meshes and bumps HEX_RELEASE and
// HEX_PART_SLUGS. A stale table packs against sizes the meshes no longer have,
// and the symptom is parts overlapping on a plate in someone else's slicer --
// nothing about which points back at a committed data file. The generated file
// carries a release stamp and the guard test pins it to HEX_RELEASE, so the
// commonest half of that mistake (bump, forget to regenerate) fails a test
// instead of shipping.
//
// WHY A COMMITTED TABLE AT ALL. The meshes are not in this repo -- `hex-cluster`
// is a sibling checkout and its build output never ships here -- so there is no
// build step that could reach them, and the app only ever sees the objects in
// R2. Reading them back to measure would mean pulling ~20 MB and parsing about
// 130,000 vertices per request, to learn six numbers per part that change once a
// release.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import JSZip from "jszip";

import { HEX_RELEASE } from "@/lib/hex-spec";

// Paths are resolved from this FILE, not from the shell's working directory, so
// the script writes the same output whichever directory it is invoked from.
const REPO = fileURLToPath(new URL("..", import.meta.url));

/** The published printables tree. Overridable so a re-cut can be measured from
 *  a build directory elsewhere; the default assumes `hex-cluster` sits beside
 *  this repo, which is how both are checked out. */
const PRINTABLES = resolve(
  REPO,
  process.env.PRINTABLES_DIR ?? "../hex-cluster/build/printables",
);
const MESHES = join(PRINTABLES, "3mf");
const MANIFEST = join(PRINTABLES, "manifest.json");
const OUT = join(REPO, "src", "lib", "hex-geometry.ts");

/**
 * How far the two derivations of a part's size may differ before it counts as a
 * disagreement.
 *
 * They are NOT the same computation, which is the point of comparing them. This
 * script measures the tessellated vertices inside the shipped 3MF; the manifest
 * records `printBboxMm`, the FreeCAD B-Rep solid's own BoundBox taken before it
 * was ever meshed (`tools/export_printables.py` in hex-cluster). Two things can
 * separate them honestly: each side rounds to 3 dp independently (up to 0.001),
 * and the 3MF stores coordinates as roughly 6-significant-figure text (up to
 * ~0.0002 across an 88 mm part). Anything past that is a real divergence -- a
 * mesh that no longer matches the solid it was cut from, or a manifest
 * describing a different cut than the files sitting beside it -- and either way
 * the table would be wrong about a part.
 *
 * Measured 2026-08-14 against release 2026-08-03: all 53 parts agreed EXACTLY on
 * all three axes, so this tolerance has never had to absorb anything.
 */
const TOLERANCE_MM = 0.002;

type Box = {
  x0: number;
  y0: number;
  z0: number;
  dx: number;
  dy: number;
  dz: number;
};

type ManifestPart = {
  part: string;
  printBboxMm: { x: number; y: number; z: number };
};

/** The R2 key spelling. Same transform `scripts/upload-printables.ts` applies,
 *  so the table is keyed by the name the endpoint is asked for.
 *
 *  A LOCAL COPY of `slug()` in `src/lib/r2.ts` rather than an import of it: that
 *  module pulls in `@/env`, which validates the whole server environment at
 *  module-eval time, and this script deliberately needs nothing but a directory
 *  of meshes. The copy is not left to drift -- `__tests__/hex-geometry.test.ts`
 *  runs every emitted display name through the REAL `slug()` and insists it
 *  lands back on its own key, so a divergence between the two transforms fails a
 *  test rather than mislabelling a mesh. */
const slugOf = (file: string) =>
  file
    .replace(/\.3mf$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-");

const round3 = (v: number) => Math.round(v * 1000) / 1000;

/**
 * Measure one part's bounding box, asserting the source is shaped the way the
 * whole feature assumes.
 *
 * The assertions are not defensive noise. The 3MF writer lifts THE single
 * `<object>` out of each source and emits its own `<item>` transform, so a
 * source carrying two objects would have one silently dropped, and a source
 * carrying a transform of its own would be MEASURED in one frame and PLACED in
 * another -- a part off the bed, or overlapping a neighbour, with nothing in the
 * output naming the cause.
 */
async function measure(file: string): Promise<Box> {
  const zip = await JSZip.loadAsync(readFileSync(join(MESHES, file)));
  const entry = zip.file("3D/3dmodel.model");
  if (!entry) throw new Error(`${file}: no 3D/3dmodel.model, not a 3MF package`);
  const model = await entry.async("string");

  const objects = (model.match(/<object /g) ?? []).length;
  if (objects !== 1) throw new Error(`${file}: ${objects} objects, expected 1`);

  const items = model.match(/<item\b[^>]*>/g) ?? [];
  if (items.length !== 1) {
    throw new Error(`${file}: ${items.length} build items, expected 1`);
  }
  if (!items[0].includes('transform="1 0 0 0 1 0 0 0 1 0 0 0"')) {
    throw new Error(`${file}: build item is not an identity transform: ${items[0]}`);
  }

  let x0 = Infinity;
  let y0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  let z1 = -Infinity;
  let read = 0;
  const re = /<vertex x="([-+\d.eE]+)" y="([-+\d.eE]+)" z="([-+\d.eE]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(model))) {
    read++;
    const x = +m[1];
    const y = +m[2];
    const z = +m[3];
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
    if (z < z0) z0 = z;
    if (z > z1) z1 = z;
  }

  // Count the tags, then insist we read every one. A regex that matches SOME of
  // the vertices is the dangerous failure here: it yields a box that is merely
  // too small, which looks entirely plausible in the committed table and packs
  // parts into each other. An exporter writing the attributes in another order,
  // or on separate lines, would do exactly that.
  const declared = (model.match(/<vertex /g) ?? []).length;
  if (declared === 0) throw new Error(`${file}: no vertices found`);
  if (read !== declared) {
    throw new Error(
      `${file}: read ${read} of ${declared} vertices, so the vertex spelling changed`,
    );
  }

  return {
    x0: round3(x0),
    y0: round3(y0),
    z0: round3(z0),
    dx: round3(x1 - x0),
    dy: round3(y1 - y0),
    dz: round3(z1 - z0),
  };
}

// Wrapped in a function rather than run at the top level: this repo's package
// is CommonJS, so tsx compiles a `.ts` script to CJS and a top-level `await`
// fails to transform at all.
async function main(): Promise<void> {
  const files = readdirSync(MESHES)
    .filter((f) => f.toLowerCase().endsWith(".3mf"))
    .sort();
  if (files.length === 0) throw new Error(`no .3mf files under ${MESHES}`);

  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8")) as {
    parts: ManifestPart[];
  };
  const byPart = new Map(manifest.parts.map((p) => [p.part, p]));

  const rows: { slug: string; name: string; box: Box }[] = [];
  const bySlug = new Map<string, string>();
  const disagreements: string[] = [];

  for (const file of files) {
    const name = file.replace(/\.3mf$/i, "");
    const slug = slugOf(file);

    // Two filenames folding onto one slug would put one part in the table and
    // drop the other with no other trace -- the table would simply be short, and
    // the guard test would blame the wrong thing.
    const seen = bySlug.get(slug);
    if (seen) throw new Error(`${file} and ${seen} both slugify to "${slug}"`);
    bySlug.set(slug, file);

    const box = await measure(file);

    // The cross-check is part of the contract, not a nicety: a table derived
    // from one source, checked against nothing, agrees with itself forever. A
    // mesh with no manifest entry cannot be cross-checked at all, so it is
    // refused rather than emitted unverified.
    const mf = byPart.get(name);
    if (!mf) throw new Error(`${file}: no "${name}" entry in ${MANIFEST}`);
    const axes: [string, number, number][] = [
      ["dx", box.dx, mf.printBboxMm.x],
      ["dy", box.dy, mf.printBboxMm.y],
      ["dz", box.dz, mf.printBboxMm.z],
    ];
    for (const [axis, mine, theirs] of axes) {
      const delta = Math.abs(mine - theirs);
      if (delta > TOLERANCE_MM) {
        disagreements.push(
          `${name} ${axis}: mesh ${mine} vs manifest ${theirs} (off by ${round3(delta)} mm)`,
        );
      }
    }
    byPart.delete(name);

    // The BASENAME travels with the box, and this is the only place it can be
    // picked up: the slug is a lossy projection of it (`Hex-TB-Main` and
    // `hex_tb_main` both land on `hex-tb-main`), so nothing downstream can
    // recover the published spelling once this loop has thrown it away. It is
    // what a slicer shows in its object list, and carrying it is the whole
    // argument for 3MF over STL.
    rows.push({ slug, name, box });
  }

  // A manifest part with no mesh means the two halves of the release disagree
  // about what it contains, the same class of fault as a size mismatch.
  if (byPart.size > 0) {
    throw new Error(
      `${MANIFEST} lists parts with no .3mf: ${[...byPart.keys()].join(", ")}`,
    );
  }

  // REPORTED, never reconciled. A disagreement means one of the two is measuring
  // something other than what we think, and picking a winner here would bury
  // exactly the question that needs answering -- so nothing is written at all.
  if (disagreements.length > 0) {
    throw new Error(
      `manifest cross-check FAILED for ${disagreements.length} value(s):\n` +
        disagreements.map((d) => `  ${d}`).join("\n") +
        "\n\nNothing was written. One of the mesh set and the manifest is measuring\n" +
        "something other than what we think; find out which before regenerating.",
    );
  }

  // Sorted by SLUG rather than by filename, so the table reads in the same order
  // as HEX_PART_SLUGS and the two can be diffed against each other by eye.
  rows.sort((a, b) => a.slug.localeCompare(b.slug));

  const body = rows
    .map(
      ({ slug, box }) =>
        `  "${slug}": { x0: ${box.x0}, y0: ${box.y0}, z0: ${box.z0}, ` +
        `dx: ${box.dx}, dy: ${box.dy}, dz: ${box.dz} },`,
    )
    .join("\n");

  // `JSON.stringify` rather than `"${name}"`, because this is the one value here
  // that is not already constrained to a safe alphabet. A slug is `[a-z0-9.-]`
  // by construction; a display name is whatever the exporter called the file, so
  // a quote or a backslash in one would emit a TypeScript file that does not
  // parse -- or, worse, one that parses as something else.
  const names = rows
    .map(({ slug, name }) => `  "${slug}": ${JSON.stringify(name)},`)
    .join("\n");

  writeFileSync(
    OUT,
    `// GENERATED by scripts/gen-hex-geometry.ts. Do not edit by hand.
//
// Axis-aligned bounding box of every published part, in the PRINT orientation
// the mesh ships in: the minimum corner and the size, in millimetres. The packer
// needs both -- the size to place, the minimum corner to turn a target position
// into the translation that gets it there. \`z0\` is not always zero (one part's
// mesh rests 0.144 mm above the bed), which is why the 3MF writer translates by
// \`-z0\` instead of assuming a part is already seated.
//
// REGENERATE THIS IN THE SAME COMMIT that re-cuts the meshes and bumps
// HEX_RELEASE and HEX_PART_SLUGS:
//
//   pnpm tsx scripts/gen-hex-geometry.ts
//
// A stale table packs against sizes the meshes no longer have. The symptom is
// parts overlapping on a plate in someone else's slicer, and nothing about that
// points back at a committed data file -- so the rule is gated rather than
// trusted: \`__tests__/hex-geometry.test.ts\` holds this table to HEX_PART_SLUGS
// and the stamp below to HEX_RELEASE.
//
// Every size here was cross-checked at generation time against \`printBboxMm\` in
// the hex-cluster manifest, which is the same geometry taken from the FreeCAD
// solid rather than from the mesh. A table that agrees with itself and with
// nothing else cannot get committed.
//
// The second table is the published SPELLING of each part, which the 3MF writer
// puts on the \`<object>\` so a slicer's object list reads \`Hex-TB-Main\` rather
// than \`hex-tb-main\`. It is recoverable at generation time and nowhere else.
import type { PartBox } from "@/lib/hex-plate";

/** The mesh release these boxes were measured from.
 *
 *  Pinned to HEX_RELEASE by the guard test. It catches the half of staleness
 *  this file cannot notice on its own: a release bumped without the generator
 *  being re-run leaves every number here describing the previous cut. */
export const HEX_GEOMETRY_RELEASE = "${HEX_RELEASE}";

export const HEX_PART_BOX: Record<string, PartBox> = {
${body}
};

/** The PUBLISHED spelling of each part -- what a slicer shows in its object list
 *  once a plate is opened.
 *
 *  Kept here because this is the only place it survives. The slug is a LOSSY
 *  projection of the filename (lowercased, with everything outside
 *  \`[a-z0-9.-]\` collapsed to a hyphen), so \`hex-tb-main\` cannot be turned back
 *  into \`Hex-TB-Main\` by any rule -- only looked up. Measured against the
 *  known-good reference plate: all 15 names survive a Creality Print round trip,
 *  and carrying them is the whole argument for 3MF over STL.
 *
 *  A SEPARATE table rather than a field on the box, because \`PartBox\` is the
 *  geometry the packer needs and a name is not geometry. Sharing a row would not
 *  protect the pairing anyway -- a wrong name in the right row is still a wrong
 *  name. What protects it is the guard test that runs every name back through
 *  the R2 uploader's own \`slug()\` and insists it lands on its own key. */
export const HEX_PART_NAME: Record<string, string> = {
${names}
};
`,
  );

  console.log(`wrote ${rows.length} parts to ${OUT}`);
  console.log(
    `manifest cross-check: ${rows.length} parts x 3 axes agree within ${TOLERANCE_MM} mm`,
  );
}

main().catch((err: unknown) => {
  // The failures above are all deliberate, message-carrying ones, and the
  // message IS the finding -- printing a stack over it would bury the sentence
  // that says which part disagreed and by how much.
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
