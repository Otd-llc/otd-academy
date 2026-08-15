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
 * separate them honestly: the MANIFEST rounds to 3 dp (up to 0.0005), and the
 * 3MF stores coordinates as roughly 6-significant-figure text (up to ~0.0002
 * across an 88 mm part). Anything past that is a real divergence -- a mesh that
 * no longer matches the solid it was cut from, or a manifest describing a
 * different cut than the files sitting beside it -- and either way the table
 * would be wrong about a part.
 *
 * ONE SIDE ROUNDS NOW, NOT TWO. This script used to round its own measurements
 * to 3 dp as well, which made the two sides agree EXACTLY on all 53 parts x 3
 * axes -- a suspiciously perfect result that was really just both sides landing
 * on the same coarse grid. Carrying full precision (the seat fix; see `measure`)
 * costs that exact agreement and buys a check that can actually see a
 * sub-millimetre divergence. Measured 2026-08-15 against release 2026-08-03: the
 * largest disagreement is 0.0005 mm (`Hex-TB-Spike-Ball-Zip-Single` dx, mesh
 * 17.3205 vs manifest 17.321), i.e. exactly the manifest's own rounding, and
 * nothing is near this bound.
 */
const TOLERANCE_MM = 0.002;

type Box = {
  x0: number;
  y0: number;
  z0: number;
  dx: number;
  dy: number;
  dz: number;
  /** The VERBATIM `z` attribute of the lowest vertex in the mesh -- the source
   *  text, never turned into a number on its way here.
   *
   *  Carried separately from `z0` on purpose. `z0` is that text parsed, and the
   *  point of keeping both is that a rounding introduced anywhere in the numeric
   *  path cannot reach the string: the two stop agreeing, and the check in
   *  `main` says so. A table derived from one source and checked against nothing
   *  agrees with itself forever, which is the same argument the manifest
   *  cross-check is built on. */
  z0Text: string;
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

/** Three significant figures, for a HUMAN-READABLE disagreement message only.
 *  Nothing measured passes through here -- rounding a measurement is what this
 *  file was fixed for. */
const brief = (v: number) => v.toPrecision(3);

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
  let z0Text = "";
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
    if (z < z0) {
      z0 = z;
      // The SOURCE TEXT of the same vertex, kept beside the number it parsed to.
      // Taken here rather than reconstructed afterwards: `String(z0)` would be
      // this script's own spelling of the double, which is precisely the thing
      // the cross-check in `main` is trying not to trust.
      z0Text = m[3];
    }
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

  // FULL DOUBLE PRECISION, deliberately, and this is the load-bearing line of
  // the file.
  //
  // These numbers were rounded to 3 dp until 2026-08-15. `z0` is the value the
  // 3MF writer negates to seat a part on the bed, so rounding it does not
  // "tidy" anything -- it MOVES the part. `Hex-TB-Spike-Ball-Joint`'s mesh
  // bottom is 0.144338 mm above its own origin (the upstream exporter's
  // drop-to-bed used a slightly enlarged OCC bounding box for it), so a stored
  // 0.144 left it floating 0.000338 mm while every other object on the plate sat
  // at 0. Creality Print reads one object at a different height as a different
  // OBJECT and offers to fuse the whole plate into a single multi-part body --
  // which destroys the named-parts list that is the entire reason this feature
  // ships 3MF instead of STL. Nothing about that dialog points back at a
  // committed data file.
  //
  // `x0`/`y0` for the same reason one step weaker: they set where a part lands
  // on the bed, so a 3 dp round quantised every plate's edge margin by up to
  // 0.0005 mm (`Hex-TB-Main` measures -43.8786 and was stored as -43.879). No
  // slicer notices that, but it is the same mistake and there is no reason to
  // keep it.
  //
  // The sizes go the same way for consistency: a box whose corner is exact and
  // whose size is rounded describes a maximum corner that is neither.
  //
  // COSTS NOTHING TO CARRY. Every coordinate in the source 3MF is about
  // 6-significant-figure text, so the doubles here are short -- the longest
  // number the table emits is 18 characters.
  return { x0, y0, z0, dx: x1 - x0, dy: y1 - y0, dz: z1 - z0, z0Text };
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

    // THE SEAT GATE, and it is the reason nothing rounds in `measure` any more.
    //
    // `z0` is what the 3MF writer negates to drop a part onto the bed, so the
    // whole feature rests on it being the mesh's real minimum rather than a
    // tidied version of it. Held to the SOURCE TEXT of the same vertex, which no
    // arithmetic in this file touches: reintroduce a rounding anywhere in the
    // numeric path and `0.144` stops equalling `Number("0.144338")` here, at
    // generation time, before a wrong table can be committed.
    //
    // It fires on a REAL past defect rather than a hypothetical one. Stored as
    // 0.144, `Hex-TB-Spike-Ball-Joint` seated 3.38e-4 mm above a bed every other
    // object on the plate sat exactly on, and Creality Print answered by offering
    // to fuse fifteen named parts into one multi-part body. The only symptom was
    // a dialog in someone else's slicer.
    if (Number(box.z0Text) !== box.z0) {
      throw new Error(
        `${file}: the mesh's lowest vertex reads z="${box.z0Text}" but the table ` +
          `would record ${box.z0}. Something in this script is rounding a ` +
          `measurement, and a part that does not seat at exactly zero is what ` +
          `makes a slicer treat a plate as one multi-part object.\n\n` +
          `Nothing was written.`,
      );
    }

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
          `${name} ${axis}: mesh ${mine} vs manifest ${theirs} (off by ${brief(delta)} mm)`,
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

  // `JSON.stringify` for the same reason as the names: this is text lifted out
  // of an XML attribute, not a number this script formatted.
  const bottoms = rows
    .map(({ slug, box }) => `  "${slug}": ${JSON.stringify(box.z0Text)},`)
    .join("\n");

  writeFileSync(
    OUT,
    `// GENERATED by scripts/gen-hex-geometry.ts. Do not edit by hand.
//
// Axis-aligned bounding box of every published part, in the PRINT orientation
// the mesh ships in: the minimum corner and the size, in millimetres. The packer
// needs both -- the size to place, the minimum corner to turn a target position
// into the translation that gets it there. \`z0\` is not always zero (one part's
// mesh rests 0.144338 mm above its own origin), which is why the 3MF writer
// translates by \`-z0\` instead of assuming a part is already seated.
//
// NOT ROUNDED, and that is a fix rather than an accident. Every value here is
// the FULL double the mesh text parsed to. The writer seats a part by emitting
// \`-z0\`, so a rounded \`z0\` does not tidy the table -- it leaves that one part
// hanging above the bed while its neighbours sit on it, and Creality Print reads
// a plate with one object at a different height as a multi-part body it offers
// to fuse. Sixteen of the 53 parts have a non-zero \`z0\`; fifteen of those are
// the exporter's own float noise (1e-19 to 2e-12 mm) and one, the spike ball
// joint, is real. Long decimals below are that precision, not damage.
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
//
// The third is the verbatim source text of each part's lowest vertex, kept so
// the seat can be tested against what the MESH says rather than against what
// this table believes. Nothing in the app reads it; the test suite does.
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

/** The VERBATIM \`z\` attribute of each part's LOWEST VERTEX, as the published
 *  mesh spells it.
 *
 *  A SECOND TRANSCRIPTION of the fact \`z0\` records, and the redundancy is the
 *  whole point. \`z0\` is this text parsed into a double by a script that used to
 *  round it; this is the text, which no arithmetic can reach. The generator
 *  refuses to write the pair if they disagree, and \`__tests__/hex-3mf.test.ts\`
 *  builds a plate whose lowest vertex is THIS string and insists every part
 *  lands at exactly z = 0 -- so the seat is checked against what the mesh says
 *  rather than against what the table believes. Without it that test would be
 *  circular: a table that quantised a part's floor would produce a fixture at
 *  the same wrong height and seat perfectly against itself, which is precisely
 *  how the real defect would have passed.
 *
 *  TEXT and not a number, because a number here would be this script's spelling
 *  of the double and the spelling is what is under test. The exponential forms
 *  (\`8.13152e-19\`) are the exporter's, not ours.
 *
 *  Nothing in the app reads this. The test suite does. */
export const HEX_PART_MESH_BOTTOM: Record<string, string> = {
${bottoms}
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
