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
// FOR THE v2 RELEASE THE ROWS ARE MEASURED (launch readiness 4.7).
// ===========================================================================
// The list is the SLICER'S answer, never a measurement of ours: two homemade
// metrics (a facet-normal footprint and a floating-region detector) were both
// wrong about the v1 set, in the direction that reads as a clean result. It is
// collected by opening a calibration plate carrying every released part once,
// with no settings at all, in Creality Print and writing the warnings down --
// the owner's slice, 4.4, which hex-cluster turns into
// `build/support-data-<release>.json`.
//
// The rows live in `hex-support-data.ts`, GENERATED from that file by
// `scripts/gen-hex-support-data.ts` and held to its own content hash. Nothing
// here types a part name. A released part without a row was sliced and raised
// nothing, so it is known to need neither support nor a brim; the generator
// refuses a released part the slice never saw, which is what makes "no row"
// mean "nothing needed" rather than "nobody looked".
import {
  HEX_SUPPORT_ROWS,
  HEX_SUPPORT_SOURCE,
} from "@/lib/hex-support-data";

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

/** The support data for the release the app serves: the slicer sweep's rows,
 *  and every part without a row is known to need nothing. */
export type HexSupportData = {
  readonly state: "measured";
  /** Where the rows came from: the support-data file's name. */
  readonly source: string;
  readonly rows: readonly HexSupportRow[];
};

/** v2 publishes every part under its slug, so the published name IS the slug.
 *  `hex-support.test.ts` holds that through the real `slug()` transform. */
export const HEX_SUPPORT_DATA: HexSupportData = {
  state: "measured",
  source: HEX_SUPPORT_SOURCE.file,
  rows: HEX_SUPPORT_ROWS.map((r) => ({
    name: r.slug,
    slug: r.slug,
    support: r.support,
    brim: r.brim,
    note: r.note,
  })),
};

const ROWS: readonly HexSupportRow[] = HEX_SUPPORT_DATA.rows;

/** As PUBLISHED names -- the spelling `manifest.json` and the mesh filenames use. */
export const NEEDS_SUPPORT_NAMES: readonly string[] = ROWS.map((p) => p.name);

/** As SLUGS -- the spelling an R2 key, a pack request and a `Placement` use. */
export const NEEDS_SUPPORT_SLUGS: ReadonlySet<string> = new Set(
  ROWS.map((p) => p.slug),
);

/** What each listed part actually needs, keyed by slug. Two independent flags,
 *  because a brim answers "will it stick" and support answers "is anything
 *  printing into thin air". */
export const PART_REMEDY: Readonly<
  Record<string, { support: boolean; brim: boolean }>
> = Object.fromEntries(
  ROWS.map((p) => [p.slug, { support: p.support, brim: p.brim }]),
);

/** Is anything in this pack KNOWN to need a remedy?
 *
 *  Takes SLUGS. The route asks it to decide whether to archive; the README asks
 *  it to decide whether to warn. Both must answer from the same set, or the box
 *  looks right and says nothing. True for a brim-only part too: its per-object
 *  brim rides in the plate, and the README is what says so out loud. */
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
 * earns its place because it is counter-intuitive and costs a wasted plate to
 * discover: PETG supports do not snap off the way PLA does; PETG stretches and
 * tears, taking surface with it, so cutting the contact down beats opening the
 * gap up. Rendered only beside a part that needs SUPPORT (a brim-only part has
 * nothing to say it to).
 *
 * The v1 version also said a tree "has under half a millimetre of height to
 * build in here". That was measured on the v1 spikes, and the v2 parts the
 * sweep flags are a handle, a zip insert, a half base and two quarter bases,
 * none of which it describes, so the clause is gone rather than carried over.
 * "Normal, not tree" stays: it is what the plate itself asks for (the
 * `support_type` row in `hex-print-intent.ts`).
 */
export const SUPPORT_SLICER_NOTE =
  "If you turn supports on, use normal supports rather than tree or organic, " +
  "which is what the plate already asks for. PETG supports tear rather than " +
  "snap, so less contact serves you better than a wider gap.";
