// The text that travels inside a download.
//
// TWO READMEs, because there are two boxes and they hold different things.
// `packReadme` describes a zip of LOOSE files -- one mesh per named part, which
// is what `format=stl` ships. `plateReadme` describes a zip of PLATES, where a
// quantity is real repeated objects arranged on a bed. Printing "x 3" in the
// first would describe a box that holds one file; leaving it out of the second
// would hide the thing the person is about to print. Same reason they list
// different identifiers: the loose zip's entries are named by SLUG, so it names
// slugs; a plate's objects are named by their published spelling, so it names
// those, and the list reads straight across to the slicer's object panel.
//
// PURE ASCII, deliberately. These are opened in Notepad and read in terminals at
// least as often as in a GUI, and the shared spec is written for the WEB page --
// it carries U+00D7, U+00B0 and en dashes. Fold them here rather than
// ASCII-ifying the page, which is the one surface those glyphs are correct on.
//
// SEPARATE from `hex-pack.ts` so the dependency runs one way. This module reads
// the spec constants, the geometry-bearing `Placement` and the plate naming; the
// grammar module reads none of it. A re-export back through `hex-pack.ts` would
// close that into a cycle, because `platePath` lives beside `packFilename`.
import type { Bed, PackFormat, PackPart } from "@/lib/hex-pack";
import { platePath } from "@/lib/hex-pack";
import type { Placement } from "@/lib/hex-plate";
import { PLATE_GAP } from "@/lib/hex-plate";
import {
  HEX_CLEARANCE,
  HEX_ORIENTATION,
  HEX_PRINT_PARAMS,
} from "@/lib/hex-spec";

/** ASCII-fold a string from the shared spec.
 *
 *  The archive is read in a terminal as often as a GUI, and the spec carries
 *  U+00D7 and U+00B0. Single-line values only: it collapses whitespace, so
 *  folding a whole block would join its lines. */
function ascii(s: string): string {
  return (
    s
      .replace(/×/g, "x")
      .replace(/°/g, " deg ")
      .replace(/[–—]/g, "-")
      .replace(/[^\x20-\x7e]/g, "")
      // "240 °C" folds to "240  deg C" -- the degree sign already had a space
      // before it. Collapse, or every temperature in the archive reads as a typo.
      .replace(/\s+/g, " ")
      .trim()
  );
}

/** Hard-wrap prose, with a fixed indent.
 *
 *  Because the reader is a TERMINAL or Notepad, not a browser. Neither reflows,
 *  so a 160-character sentence is either cut off at the column or scrolls
 *  sideways out of view -- and the sentences this file has to state (what the
 *  layout does and does not promise; why a preset dialog is not an error) are
 *  exactly the long ones. Written as a helper rather than hand-counted columns
 *  so an edit to the prose cannot silently produce a 200-character line.
 *
 *  Splits on whitespace only. A single word longer than the width is left long
 *  rather than broken, because a broken URL is worse than a wide line. */
function wrap(text: string, indent = "  ", width = 72): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (line !== "" && `${indent}${line} ${word}`.length > width) {
      lines.push(indent + line);
      line = word;
    } else {
      line = line === "" ? word : `${line} ${word}`;
    }
  }
  if (line !== "") lines.push(indent + line);
  return lines;
}

/** The slicer band and the fit band, folded once.
 *
 *  DERIVED from the shared spec rather than transcribed. /hex, the printed build
 *  sheet and every archive README state the same numbers, and the whole point of
 *  a dimensioned spec is that nobody converts one by hand -- two surfaces
 *  disagreeing about the same dimension undoes that completely. */
const PRINT_LINES: readonly string[] = [
  ...HEX_PRINT_PARAMS,
  ...HEX_CLEARANCE,
].map(
  (p) =>
    `${p.label}: ${ascii(p.value)}${p.aside ? ` (${ascii(p.aside)})` : ""}`,
);

/** The two parts that rest on a line BY DESIGN, so nobody is surprised
 *  mid-print. Kept in sync with `orientationNote` in
 *  `scripts/upload-printables.ts`, which spells them as published names because
 *  it reads the manifest; here they are the slugs, because a slug is what a
 *  request and a `Placement` both carry. */
const NEEDS_SUPPORT: ReadonlySet<string> = new Set([
  "hex-tb-spike-solid",
  "hex-tb-spike-ball-joint",
]);

/** What to say about supports, given what is actually in the box.
 *
 *  `label` is how the caller names its parts -- slugs in a loose zip, published
 *  names on a plate -- so the note points at something the reader can find in
 *  front of them. Deduplicated: a plate holding six of one part must not name
 *  it six times. */
function supportLines(
  parts: readonly { slug: string; label: string }[],
): string[] {
  const present = [
    ...new Set(
      parts.filter((p) => NEEDS_SUPPORT.has(p.slug)).map((p) => ascii(p.label)),
    ),
  ];
  if (present.length === 0) {
    return ["Every part here stands on a flat face. No supports needed."];
  }
  return [
    `Support required -- ${present.join(", ")}.`,
    ...wrap(
      "These are laid on their side on purpose: a spike is loaded along its " +
        "axis, and lying down runs the layers ACROSS that load instead of " +
        "letting them peel apart. The cost is that they touch the bed along a " +
        "line, so give them supports or a brim.",
      "",
    ),
  ];
}

/** How the parts are posed, stated from the shared spec.
 *
 *  Load-bearing rather than decorative: it is the one instruction that changes
 *  whether a joint survives being pulled apart. The packer's own contribution to
 *  it is a NEGATIVE -- it never rotates anything -- which is worth saying,
 *  because a reader who assumes we turned parts to fit would also assume we
 *  checked they still sit flat. */
const ORIENTATION_LINES: readonly string[] = [
  "Orientation:",
  // Worded so it is true of BOTH boxes. A loose zip places nothing, so
  // "every part is PLACED in..." would describe a plate that is not in there.
  ...wrap(
    "Every part is in the orientation its mesh ships in, which is the print " +
      "orientation. Nothing here is rotated to make it fit. Hex bases print " +
      `${HEX_ORIENTATION.value}. ${ascii(HEX_ORIENTATION.why)} However you ` +
      "arrange these in your slicer, keep every part flat on the bed.",
  ),
];

/** The dialog Creality Print raises on a plain core 3MF.
 *
 *  Measured 2026-08-15 on V7.2.1 (see the design doc). It is not an error and it
 *  is not something we could suppress without shipping printer and process
 *  settings -- which belong to the person printing, not to us. Said plainly
 *  here, because an unexplained "this file is not from Creality Print" reads as
 *  a corrupt download and the support question that follows is unanswerable
 *  after the fact. */
const PRESET_LINES: readonly string[] = [
  "Opening a plate:",
  ...wrap(
    'Creality Print may say "This project file is not from Creality Print. ' +
      'Please select the printer preset." That is expected, not an error. ' +
      "These files carry geometry only, with no printer or process settings, " +
      "because those belong to you and to your machine. Pick your preset and " +
      "slice.",
  ),
];

/**
 * The README that travels inside a LOOSE pack -- one file per named part.
 *
 * A pack is a REDISTRIBUTION of a CC BY work, and the licence's one condition is
 * that the credit travels with it. Shipping a subset without the notice would be
 * us breaking the terms we ask every downstream remixer to keep, on our own
 * files. So every pack carries LICENSE.txt and this, which also says plainly
 * that it is a subset and where the whole set lives.
 */
export function packReadme(opts: {
  release: string;
  format: PackFormat;
  parts: readonly PackPart[];
  credit: string;
  specUrl: string;
}): string {
  return [
    "Hex Cluster -- selected parts",
    "",
    "Hex Cluster modular tile system -- One Thousand Drones, LLC",
    ascii(opts.specUrl),
    "",
    `This is a SUBSET: ${opts.parts.length} of the published parts, as ${opts.format.toUpperCase()},`,
    `chosen in the configurator. Release ${ascii(opts.release)}. The complete set,`,
    "every format, and every part individually are at the address above.",
    "",
    "Print settings:",
    ...PRINT_LINES.map((l) => `  ${l}`),
    "",
    ...ORIENTATION_LINES,
    "",
    ...supportLines(opts.parts.map((p) => ({ slug: p.slug, label: p.slug }))),
    "",
    // Quantities are deliberately NOT listed here: this README travels with a
    // zip that holds one file per part, so printing "x 3" would describe a box
    // that has one. The plated README states quantities because its box has them.
    `Parts (${opts.parts.length}):`,
    ...opts.parts.map((p) => `  - ${ascii(p.slug)}`),
    "",
    "Licensed CC BY 4.0 -- see LICENSE.txt.",
    ascii(opts.credit),
    "",
  ].join("\n");
}

/** One line of a plate's manifest: a part and how many of it are on that plate. */
type PlateRow = { slug: string; name: string; qty: number };

/** Count each distinct part on one plate.
 *
 *  Insertion order, with NO comparator. The packer's output is already
 *  deterministic, so preserving its order makes this deterministic too -- and it
 *  avoids the one hazard a comparator would add here: `localeCompare` reads the
 *  host's ICU locale, and in several locales punctuation is ignorable, so two
 *  hyphen-dense names can compare EQUAL and reorder per host. The response is
 *  cached per URL, so that failure would serve different bytes for one address
 *  depending on where it was rendered. `hex-plate.ts` documents the same trap on
 *  the sort that produces this input. */
function tally(plate: readonly Placement[]): PlateRow[] {
  const rows = new Map<string, PlateRow>();
  for (const p of plate) {
    const row = rows.get(p.slug);
    if (row) row.qty += 1;
    else rows.set(p.slug, { slug: p.slug, name: p.name, qty: 1 });
  }
  return [...rows.values()];
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/**
 * The README that travels inside a PLATED pack -- one 3MF per bed's worth.
 *
 * It has to answer three questions a loose zip never raises: which bed this was
 * arranged for, what is on each plate and how many, and how much of the
 * arrangement is actually a promise. The third one is the reason this text
 * exists rather than being a copy of `packReadme` with a bed line: the layout is
 * a STARTING POINT, and saying so is the difference between a slicer that
 * recentres the scene being expected behaviour and being a bug report.
 */
export function plateReadme(opts: {
  release: string;
  bed: Bed;
  plates: readonly (readonly Placement[])[];
  credit: string;
  specUrl: string;
}): string {
  const plateCount = opts.plates.length;
  const instances = opts.plates.reduce((n, p) => n + p.length, 0);
  const bed = `${opts.bed.x} x ${opts.bed.y} mm`;

  return [
    "Hex Cluster -- packed plates",
    "",
    "Hex Cluster modular tile system -- One Thousand Drones, LLC",
    ascii(opts.specUrl),
    "",
    ...wrap(
      `This is a SUBSET: ${plural(instances, "part")} on ` +
        `${plural(plateCount, "plate")}, packed for a ${bed} bed, as 3MF, ` +
        `chosen in the configurator. Release ${ascii(opts.release)}. The ` +
        "complete set, every format, and every part individually are at the " +
        "address above.",
      "",
    ),
    "",
    // The manifest names the file it describes, using the SAME helper the route
    // names the zip entry with. A README that lists `plate-1-of-3.3mf` beside a
    // folder holding `plate-1.3mf` is the defect class this feature has already
    // shipped once: a filename disagreeing with its contents passed a green
    // suite, because nothing compared the two.
    `Plates (${plateCount}):`,
    ...opts.plates.flatMap((plate, i) => [
      `  ${platePath(i + 1, plateCount)} -- ${plural(plate.length, "part")}`,
      ...tally(plate).map((r) => `    ${r.qty} x ${ascii(r.name)}`),
    ]),
    "",
    "The arrangement is a STARTING POINT, not a guarantee.",
    // MEASURED, not hedging. Creality Print V7.2.1 centres an imported scene on
    // the bed as a rigid group, and every slicer's auto-arrange is one click
    // away, so an exact layout is a claim we could not keep even if we wanted
    // to. What IS promised is the part that matters: it fits.
    ...wrap(
      "Slicers recentre the scene on the bed as they import it, and your own " +
        "auto-arrange overrides this layout completely. Both are fine, and " +
        "neither breaks anything. What the layout does promise is narrower: " +
        `everything on a plate fits the ${bed} bed named above, sitting flat, ` +
        `with ${PLATE_GAP} mm of clearance at the edges and between parts.`,
    ),
    "",
    ...PRESET_LINES,
    "",
    "Print settings:",
    ...PRINT_LINES.map((l) => `  ${l}`),
    "",
    ...ORIENTATION_LINES,
    "",
    // Named by their PUBLISHED spelling, matching the plate manifest above and
    // the slicer's own object list -- the reader is looking at both.
    ...supportLines(
      opts.plates.flat().map((p) => ({ slug: p.slug, label: p.name })),
    ),
    "",
    "Licensed CC BY 4.0 -- see LICENSE.txt.",
    ascii(opts.credit),
    "",
  ].join("\n");
}
