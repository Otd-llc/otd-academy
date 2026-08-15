// Deciding what goes in a custom pack, and what the request is allowed to ask
// for. Separated from the route so it can be unit-tested directly: a Next route
// module may only export the handler names, and this is the part with rules.

import { HEX_PART_SLUGS, isHexPartSlug } from "@/lib/hex-parts";

/** Immutable release segment, e.g. `2026-07-31`. Same grammar as the proxy. */
const RELEASE = /^\d{4}-\d{2}-\d{2}$/;

/** Mesh formats a pack may contain. STEP is deliberately absent: it is the
 *  archival solid for remixing, it is kept in the CAD orientation rather than
 *  the print one, and shipping it inside a "here are your parts to print" zip
 *  would hand someone a file that slices wrong. The full set still carries it. */
export const PACK_FORMATS = ["3mf", "stl"] as const;
export type PackFormat = (typeof PACK_FORMATS)[number];

/** A pack of every part would be the published set, which already exists as one
 *  immutable object. Capping at the real part count is not a limit anyone can
 *  reach by choosing parts; it exists so a malformed or hostile request cannot
 *  fan out into unbounded R2 reads. */
export const MAX_PACK_PARTS = HEX_PART_SLUGS.length;

/** One line of the pack: a published part and how many of it. */
export type PackPart = { slug: string; qty: number };

/**
 * Total ITEMS a pack may contain, across all parts.
 *
 * MAX_PACK_PARTS bounds how many DISTINCT parts are named, which is what bounds
 * the R2 reads. It does not bound the work any more, because a quantity costs no
 * extra read but does cost an `<item>` line and a slot on a plate. This bounds
 * exactly those two: the number of items, and therefore the SIZE of the document
 * a single cheap GET can demand.
 *
 * It does NOT bound the PLATE COUNT, and the two are three orders of magnitude
 * apart: 250 of the largest part (87.8 x 78 mm) is 63 plates on the default 220
 * bed and 250 plates on a 100 mm one, each a separate 3MF carrying its own full
 * copy of the mesh. That cap belongs at the route (Task A7), which is the first
 * place both facts are in hand, and it has to run BEFORE any R2 read or the
 * refusal costs more than the work it refuses. It cannot live here because it
 * needs the per-part geometry table, which does not exist yet (Task A3).
 */
export const MAX_PACK_INSTANCES = 250;

/** The SHAPE of a part slug, as the R2 keys spell it. Exported because the test
 *  that holds this grammar and `HEX_PART_SLUGS` to the same idea of a slug must
 *  IMPORT it rather than transcribe it: a second copy agrees with itself forever
 *  while the real one drifts, and the symptom is a published part the endpoint
 *  refuses to name. One source string, both regexes. */
const SLUG_SRC = "[a-z0-9][a-z0-9-]*";
export const PART_SLUG_RE = new RegExp(`^${SLUG_SRC}$`);

/** A part token: a slug, optionally `:n`.
 *
 *  `\d` is deliberate -- it excludes a sign and a decimal point, so a malformed
 *  quantity fails the SHAPE check and never reaches arithmetic that would round
 *  it into something plausible.
 *
 *  `{1,3}` is deliberate too, for the same reason `BED_RE` bounds its own digits.
 *  `:0007` is seven and `:000...1` is one, so unbounded digits mean unbounded
 *  SPELLINGS of one pack -- and the response is cached `public, max-age=86400`
 *  keyed on the URL, so every spelling is a fresh cache entry holding identical
 *  bytes. Three digits covers every quantity `MAX_PACK_INSTANCES` can accept and
 *  still leaves room to overshoot it, so a plausible over-ask is refused by the
 *  cap (an honest `too-many`) rather than by the grammar. Raising that cap past
 *  999 means widening this, or the regex silently becomes the real limit. */
const PART_TOKEN = new RegExp(`^(${SLUG_SRC})(?::(\\d{1,3}))?$`);

/** The bed a pack is laid out for, in millimetres. */
export type Bed = { x: number; y: number };

/** Ships when the caller names no bed. Small enough to be right on almost any
 *  printer; a larger bed only means fewer plates, never a failure.
 *
 *  FROZEN, and handed out only as a copy (see `parseBed`). A resolved bed
 *  travels on to the packer and the README, so a clamp or a normalisation added
 *  downstream would otherwise write straight into this object and change the
 *  default for every later request on the same warm serverless instance -- one
 *  user's bed silently becoming everyone's. The freeze makes that attempt a
 *  throw instead of a drift nobody can reproduce. */
export const DEFAULT_BED: Readonly<Bed> = Object.freeze({ x: 220, y: 220 });

/** Sane range for a consumer FDM bed. This is a LOOP BOUND and a CACHE KEY, not
 *  merely a typo check: the packer iterates rows across it, and the response is
 *  cached per URL.
 *
 *  The floor clears the largest part PLUS the gap the packer keeps on both
 *  sides: `87.8 + 2 * PLATE_GAP = 95.8 <= 100`. State it that way and not as
 *  "above the largest part" -- the sloppy version reads as 12 mm of headroom
 *  when there is 4.2, so a later widening of the gap looks free and is not. It
 *  is that gap-inclusive invariant that lets the bed picker change the plate
 *  COUNT and never make a part unprintable.
 *
 *  Exported because the account setting must validate against these exact
 *  numbers. A second copy of them somewhere else would drift, and the symptom
 *  would be a bed the settings page accepts and the endpoint refuses. */
export const BED_MIN = 100;
export const BED_MAX = 1000;

/** Two integers and nothing else -- no signs, no decimals, no third dimension.
 *  `{1,4}` bounds the string before `Number` ever sees it. */
const BED_RE = /^(\d{1,4})x(\d{1,4})$/;

export type PackRequest = {
  release: string;
  format: PackFormat;
  parts: PackPart[];
  bed: Bed;
};

export type PackProblem =
  | "bad-release"
  | "bad-format"
  | "bad-bed"
  | "empty"
  | "too-many"
  | "unknown-part";

export type PackResolution =
  { ok: true; request: PackRequest } | { ok: false; problem: PackProblem };

/** Parse `350x350`, or null if it is anything else. An ABSENT bed is not an
 *  error: links written before the bed existed must keep working, and the
 *  default is the conservative choice, so they get more plates rather than a
 *  refusal. */
function parseBed(raw: string | null | undefined): Bed | null {
  // A COPY, never the shared constant -- see the note on DEFAULT_BED. Returning
  // the object itself would hand every caller the same mutable default.
  if (raw == null || raw === "") return { ...DEFAULT_BED };
  const m = BED_RE.exec(raw);
  if (!m) return null;
  const x = Number(m[1]);
  const y = Number(m[2]);
  if (x < BED_MIN || x > BED_MAX || y < BED_MIN || y > BED_MAX) return null;
  return { x, y };
}

/** Parse `slug,slug:3,slug:6` into one line per distinct slug, or null if any
 *  token is malformed. A bare slug means one, so every link written before
 *  quantities existed still resolves to what it used to mean. */
function parseParts(raw: string): PackPart[] | null {
  const bySlug = new Map<string, number>();
  for (const token of raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)) {
    const m = PART_TOKEN.exec(token);
    if (!m) return null;
    const qty = m[2] === undefined ? 1 : Number(m[2]);
    // The shape check already excluded a sign and a decimal point, so the only
    // thing left to reject is an explicit zero -- which would put a part in the
    // manifest and nothing in the box.
    if (!Number.isInteger(qty) || qty < 1) return null;
    // SUMMED, not replaced. Naming a part twice is a UI slip, and silently
    // dropping the second mention is the bug the quantity grammar exists to fix.
    // One entry per slug is still one R2 read, which is what the caps bound.
    bySlug.set(m[1], (bySlug.get(m[1]) ?? 0) + qty);
  }
  return [...bySlug].map(([slug, qty]) => ({ slug, qty }));
}

/**
 * Validate a pack request.
 *
 * Every part name is checked for MEMBERSHIP of the published list, not merely
 * for a well-formed shape. The single-file proxy can afford a grammar because a
 * miss there is one 404; this endpoint fans a list out into one R2 read each, so
 * a grammar alone would let a caller spray plausible slugs and read existence
 * off the response. Membership bounds the work and answers the real question.
 *
 * TWO caps, because a quantity and a name bound different things: distinct names
 * bound the R2 reads, total instances bound the size of the document and the
 * number of plates a single cheap request can demand.
 */
export function resolvePack(input: {
  release?: string | null;
  format?: string | null;
  parts?: string | null;
  plate?: string | null;
}): PackResolution {
  const release = input.release ?? "";
  if (!RELEASE.test(release)) return { ok: false, problem: "bad-release" };

  const format = (input.format ?? "3mf") as PackFormat;
  if (!(PACK_FORMATS as readonly string[]).includes(format)) {
    return { ok: false, problem: "bad-format" };
  }

  const bed = parseBed(input.plate);
  if (bed === null) return { ok: false, problem: "bad-bed" };

  const parts = parseParts(input.parts ?? "");
  if (parts === null) return { ok: false, problem: "unknown-part" };
  if (parts.length === 0) return { ok: false, problem: "empty" };
  if (parts.length > MAX_PACK_PARTS) return { ok: false, problem: "too-many" };
  if (packInstances(parts) > MAX_PACK_INSTANCES) {
    return { ok: false, problem: "too-many" };
  }
  // Checked BEFORE any R2 work, so an unknown name costs a string lookup rather
  // than a network round trip.
  if (!parts.every((p) => isHexPartSlug(p.slug)))
    return { ok: false, problem: "unknown-part" };

  return { ok: true, request: { release, format, parts, bed } };
}

/** How many physical objects a pack contains, which is not the same as how many
 *  parts it names -- the caps, the filename and the plate count all want this
 *  one and not `parts.length`. */
export function packInstances(parts: PackPart[]): number {
  return parts.reduce((n, p) => n + p.qty, 0);
}

/** A stable, human-readable filename for the download. */
export function packFilename(parts: PackPart[]): string {
  return parts.length === 1 && parts[0].qty === 1
    ? `hex-cluster-${parts[0].slug}.zip`
    : `hex-cluster-${packInstances(parts)}-parts.zip`;
}

/** Where a plate lives inside a multi-plate zip.
 *
 *  ONE function, called both by the route that WRITES the entry and by the
 *  README that LISTS it. They sit either side of a module boundary and are
 *  compared by a human holding a text file against a directory listing, so a
 *  second spelling of this string would disagree in silence -- which is the
 *  defect class this endpoint has already shipped once, a filename contradicting
 *  its contents under a green suite, because nothing compared the two.
 *
 *  One-based and stated as "1 of 3", because it is read by a person: a folder of
 *  three plates whose first file is `plate-0-of-3.3mf` invites the question of
 *  where plate 3 went.
 *
 *  The README that travels beside these lives in `hex-pack-readme.ts`, which
 *  imports this. The dependency runs that way and not back: this module is the
 *  request grammar and knows nothing about prose. */
export function platePath(index: number, total: number): string {
  return `plates/plate-${index}-of-${total}.3mf`;
}
