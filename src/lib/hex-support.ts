// The parts that need SUPPORT, a BRIM, or both, and which of the two each one
// needs. They are separate questions: a brim answers "will it stick to the bed"
// and is decided by the first layer; support answers "is anything printing into
// thin air" and is decided by every layer above it.
//
// THIS LIST DECIDES MORE THAN PROSE. A part on it is painted with a support
// tripwire inside its plate, carries per-object support/brim settings, and pulls
// a single-plate download into an archive so the README travelling with it has
// somewhere to say so.
//
// ===========================================================================
// TODO(4.7): FOR THE v2 RELEASE THIS IS UNKNOWN, AND SAYS SO.
// ===========================================================================
// The list is the SLICER'S answer, never a measurement of ours: two homemade
// metrics (a facet-normal footprint and a floating-region detector) were both
// wrong about the v1 set, in the direction that reads as a clean result. It is
// collected by opening a calibration plate carrying every released part once,
// with no settings at all, in Creality Print and writing the warnings down.
//
// That has not been done for v2. The v1 rows that used to live here described
// v1 poses and v1 parts, and v1 is dead; they have been removed rather than
// carried over, because a v1 row keyed to a v2 slug would be a guess wearing a
// measurement's clothes. The v2 slice is launch readiness 4.4 (the owner's
// `hex-cluster/build/slicer-warnings-<release>.json`), and 4.7 turns it into
// rows here.
//
// Until then the state is `unknown`, typed, and every surface that reads it has
// to render that honestly. The README and the plate's Description must NOT say
// "No supports needed" about a part nobody has sliced: that sentence is a
// promise, and the absence of a row is not evidence for it. See `supportLines`
// in `hex-pack-readme.ts`, which renders `SUPPORT_UNKNOWN_NOTE` instead.

/** One measured part: the published name, the slug, and what it needs. */
export type HexSupportRow = {
  /** As PUBLISHED -- the spelling `manifest.json` and the mesh filenames use. */
  readonly name: string;
  /** As a SLUG -- the spelling an R2 key, a pack request and a `Placement` use. */
  readonly slug: string;
  readonly support: boolean;
  readonly brim: boolean;
  /** The sentence a reader acts on, completed after the part's label. */
  readonly note: string;
};

/** The support data for the release the app serves.
 *
 *  `unknown` means the release has NOT been through the slicer sweep: no part is
 *  known to need support, and no part is known NOT to. `measured` carries the
 *  sweep's rows, and every part without a row is then known to need nothing. */
export type HexSupportData =
  | {
      readonly state: "unknown";
      /** The checklist item that replaces this state. */
      readonly owedBy: "4.7";
    }
  | {
      readonly state: "measured";
      /** Where the rows came from, e.g. the slicer-warnings file's name. */
      readonly source: string;
      readonly rows: readonly HexSupportRow[];
    };

/** TODO(4.7): replace with `{ state: "measured", source, rows }` from 4.4's
 *  slicer-warnings file. */
export const HEX_SUPPORT_DATA: HexSupportData = {
  state: "unknown",
  owedBy: "4.7",
};

/** Through a function taking the WIDE type, so the read does not depend on
 *  which state the constant above happens to hold today. */
function rowsOf(data: HexSupportData): readonly HexSupportRow[] {
  return data.state === "measured" ? data.rows : [];
}

const ROWS: readonly HexSupportRow[] = rowsOf(HEX_SUPPORT_DATA);

/** True while the served release has not been through the slicer sweep. */
export const SUPPORT_UNKNOWN: boolean = HEX_SUPPORT_DATA.state === "unknown";

/** What a README or a plate says about supports while they are unknown.
 *
 *  OWNER-WORDING (TODO(4.7)): drafted by an agent, not yet approved. Pure ASCII,
 *  because it lands in a text file read in Notepad and in 3MF metadata. */
export const SUPPORT_UNKNOWN_NOTE =
  "Supports: not yet checked for this release. These parts have not been " +
  "through a slicer's support check, so this file cannot tell you which of " +
  "them need supports or a brim. Leave your slicer's overhang and support " +
  "warnings on and read them before you print.";

/** As PUBLISHED names -- the spelling `manifest.json` and the mesh filenames use. */
export const NEEDS_SUPPORT_NAMES: readonly string[] = ROWS.map((p) => p.name);

/** As SLUGS -- the spelling an R2 key, a pack request and a `Placement` use. */
export const NEEDS_SUPPORT_SLUGS: ReadonlySet<string> = new Set(
  ROWS.map((p) => p.slug),
);

/** What each listed part actually needs, keyed by slug. Two independent flags,
 *  because a brim answers "will it stick" and support answers "is anything
 *  printing into thin air". Empty while the data is unknown: nothing is painted
 *  or configured on a guess. */
export const PART_REMEDY: Readonly<
  Record<string, { support: boolean; brim: boolean }>
> = Object.fromEntries(
  ROWS.map((p) => [p.slug, { support: p.support, brim: p.brim }]),
);

/** Is anything in this pack KNOWN to need a remedy?
 *
 *  Takes SLUGS. The route asks it to decide whether to archive; the README asks
 *  it to decide whether to warn. Both must answer from the same set, or the box
 *  looks right and says nothing. While the data is unknown this is false for
 *  every pack, and the unknown state is stated by `supportLines` instead. */
export function needsSupport(slugs: readonly string[]): boolean {
  return slugs.some((s) => NEEDS_SUPPORT_SLUGS.has(s));
}

/** The per-part sentence, by either spelling, because the uploader holds
 *  published names and cannot reach `slug()`. */
export const SUPPORT_NOTE: Readonly<Record<string, string>> =
  Object.fromEntries(
    ROWS.flatMap((p) => [
      [p.slug, p.note],
      [p.name, p.note],
    ]),
  );

/**
 * The one slicer-shaped sentence worth carrying, and why it is this one.
 *
 * Kept short deliberately: a print profile belongs to whoever is printing. It
 * earns its place because both halves are counter-intuitive and cost a wasted
 * plate to discover. Tree and organic supports have little room to build under
 * a small part lying down, and PETG supports do not snap off the way PLA does;
 * PETG stretches and tears, taking surface with it, so cutting the contact down
 * beats opening the gap up.
 *
 * TODO(4.7): the "half a millimetre" figure was measured on the v1 spikes. It
 * is rendered only beside a measured row, and there are none yet; re-check it
 * against the v2 parts the sweep flags before any row lands.
 */
export const SUPPORT_SLICER_NOTE =
  "If you turn supports on, normal or snug beats tree or organic on parts " +
  "this small: a tree has under half a millimetre of height to build in here. " +
  "And PETG supports tear rather than snap, so less contact serves you better " +
  "than a wider gap.";
