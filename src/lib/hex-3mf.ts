// Writing one plate as a single 3MF.
//
// MEASURED BEHAVIOUR THIS RELIES ON (2026-08-15, Creality Print V7.2.1, see
// `docs/plans/2026-08-14-hex-download-plates-design.md`): the slicer preserves
// our relative layout exactly and centres the whole scene on the bed. So
// absolute position is not ours to choose and does not matter; the relative
// arrangement is what carries.
//
// DO NOT rewrite mesh vertices to recentre objects. It was tried and measured.
// It is unnecessary -- the transform alone places correctly -- it would cost a
// multi-megabyte string rewrite per request, and it would break instancing, so
// six identical caps would embed six copies of the mesh instead of one object
// and six items.
//
// THE MERGE IS A STRING LIFT, and it is only allowed to be because every
// published part is uniform: core spec, exactly one `<object id="1"
// type="model">`, one `<item>` with an identity transform, no materials, no
// property groups, no second namespace (verified across all 53 meshes of
// release 2026-08-03). Every one of those assumptions is CHECKED below rather
// than trusted, because the failure mode of a silently wrong lift is a file that
// opens, looks plausible, and is missing a part.
import JSZip from "jszip";

import type { Bed } from "@/lib/hex-pack";
import type { Placement } from "@/lib/hex-plate";
import { escapeXml } from "@/lib/hex-xml";
import {
  intentFor,
} from "@/lib/hex-print-intent";
import { HEX_LICENSE } from "@/lib/hex-spec";
import { PART_REMEDY } from "@/lib/hex-support";
import {
  THUMBNAIL_PATH,
  THUMBNAIL_REL_TYPE,
  plateThumbnail,
} from "@/lib/hex-thumbnail";

/**
 * The CLOSED set of `<model>` metadata names the 3MF core specification defines,
 * spelled exactly as Table 3-1 of the *3MF Core Specification* spells them
 * (3MFConsortium/spec_core).
 *
 * IT IS A CLOSED SET, and that is the whole reason this constant exists rather
 * than the names being written inline. The same specification says: "Metadata in
 * 3MF Documents without a namespace name MUST be restricted to names and values
 * defined by this specification. If a name value is not defined in this
 * specification, it MUST be prefixed with the namespace name of an XML namespace
 * declaration on the <model> element."
 *
 * So an unqualified name that is not on this list is not a harmless extra field
 * -- it is a non-conforming document. And a MISSPELLED core name is exactly
 * that: `Licenceterms`, `CreatedDate` or `Designers` reads as a private
 * extension carrying no namespace, which is the one thing that paragraph
 * forbids. The failure is silent in every way that matters -- the XML is
 * well-formed, the package opens, the slicer prints -- so nothing but a
 * conformance checker or this list would ever notice.
 *
 * Exported so the guard test can hold every name this module writes to it
 * without transcribing a second copy that would agree with itself forever.
 */
export const CORE_META = [
  "Title",
  "Designer",
  "Description",
  "Copyright",
  "LicenseTerms",
  "Rating",
  "CreationDate",
  "ModificationDate",
  "Application",
] as const;

export type CoreMetaName = (typeof CORE_META)[number];

/** `[Content_Types].xml` declares which file extensions the package may contain,
 *  so it is not boilerplate: an entry with an undeclared extension makes the
 *  whole package non-conforming.
 *
 *  `png` joins `rels` and `model` for the package thumbnail. That is the reason
 *  this string is no longer byte-identical to the one in every published part --
 *  the two other entries and their order are unchanged, and a reader that
 *  ignores thumbnails sees exactly the package it saw before. */
const CONTENT_TYPES =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />` +
  `<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml" />` +
  `<Default Extension="png" ContentType="image/png" />` +
  // `config` joins them for `Metadata/model_settings.config`. Declared even
  // though neither Orca nor PrusaSlicer declares it in its own output and both
  // read the part regardless: OPC requires a content type for every part, and
  // the cost of being conforming where the vendors are not is one attribute.
  `<Default Extension="config" ContentType="application/vnd.ms-printing.3dmanufacturing-3dmodel-settings+xml" />` +
  `</Types>`;

/** The package's relationships: which part is the 3D model, and which part is
 *  the picture of it.
 *
 *  THE MODEL ONE IS FIRST AND KEEPS ITS ID. Without it a reader has a zip full
 *  of XML and no entry point; the thumbnail is additive, and a reader that does
 *  not know the type ignores the second `<Relationship>` and behaves exactly as
 *  it did before.
 *
 *  THE THUMBNAIL RELATIONSHIP HANGS OFF THE PACKAGE, not off the model part, and
 *  the two are different things in OPC: a relationship declared here in
 *  `_rels/.rels` is the PACKAGE thumbnail -- what Explorer, Finder and a slicer's
 *  open dialog look for -- while the same type declared in
 *  `3D/_rels/3dmodel.model.rels` would be a thumbnail OF THAT PART. */
const RELS =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Target="/3D/3dmodel.model" Id="rel0" ` +
  `Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" />` +
  `<Relationship Target="/${THUMBNAIL_PATH}" Id="rel1" ` +
  `Type="${THUMBNAIL_REL_TYPE}" /></Relationships>`;

/** Where the Orca family looks for per-object settings. Exported so the tests
 *  read the same string the writer does, rather than a second spelling of it. */
export const MODEL_SETTINGS_PATH = "Metadata/model_settings.config";

/** A FIXED timestamp on every zip entry, and the reason is the design's
 *  determinism requirement, not tidiness.
 *
 *  JSZip stamps each entry with `new Date()` unless told otherwise, so two
 *  identical requests a second apart produce byte-different files while the
 *  model inside them is identical. The response is cached `public, max-age=86400`
 *  keyed on the URL and is meant to be a pure function of that URL; a body that
 *  changes on every origin hit breaks ETag revalidation and makes any "did this
 *  change?" comparison useless. JSZip reads the date through `getUTC*`, so a
 *  fixed UTC instant gives the same bytes on every host and in every timezone.
 *  1980-01-01 is the DOS epoch -- the earliest a zip can express, and the
 *  conventional "this file has no meaningful timestamp" value.
 *
 *  EXPORTED so the OUTER zip of a multi-plate pack stamps the same instant. One
 *  epoch and one reason: fixing the timestamps inside each plate and letting the
 *  archive around them carry `new Date()` would leave the RESPONSE
 *  non-reproducible while every file in it was reproducible, which is the worst
 *  of both -- it reads as determinism and is not. */
export const ZIP_EPOCH = new Date(Date.UTC(1980, 0, 1));

/** Re-exported from `@/lib/hex-xml`, where it now lives.
 *
 *  MOVED TO A LEAF because two modules write per-object config into the same
 *  archive -- this one in the Orca dialect, `hex-prusa-config.ts` in
 *  PrusaSlicer's -- and both need identical escaping. The wiring step described
 *  in that module's header has `buildPlate3mf` calling into it, which would make
 *  `hex-3mf -> hex-prusa-config -> hex-3mf` a cycle. It resolved today only
 *  because this was a hoisted `function` declaration; a leaf that imports
 *  nothing cannot be in a cycle at all.
 *
 *  Re-exported rather than relocated silently, so existing importers keep
 *  working and the move stays one edit rather than a sweep. */
export { escapeXml } from "@/lib/hex-xml";

/**
 * One number of a transform: TWELVE SIGNIFICANT FIGURES, as a plain decimal.
 *
 * SIGNIFICANT FIGURES, NOT DECIMAL PLACES, and that distinction is the whole
 * defect this replaced. The old rule was `Math.round(v * 1e4) / 1e4` -- four
 * decimals, "a tenth of a micron, orders of magnitude below anything an FDM
 * printer can express". True of a coordinate near 44 mm, where four decimals is
 * eight significant figures. FALSE of the Z translation, which is small by
 * construction: `Hex-TB-Spike-Ball-Joint` seats with `tz = -0.144338`, and four
 * decimals wrote `-0.1443`, leaving the part 3.8e-5 mm above a bed every other
 * object on the plate was sitting exactly on. Creality Print reads one object at
 * a different height as a separate OBJECT and offers to fuse the whole plate
 * into a single multi-part body -- which throws away the named parts list that
 * is the entire reason this feature ships 3MF rather than STL. A fixed decimal
 * count quantises coarsely exactly where the values are smallest, which is
 * exactly where an equality invariant lives.
 *
 * TWELVE is chosen against the SOURCE, not against the printer. Every coordinate
 * in the published meshes is about six-significant-figure text (`z="0.144338"`,
 * `z="8.13152e-19"`), so twelve carries every digit the meshes state with six
 * orders of magnitude to spare -- verified lossless across all 53 parts x 3
 * minimum-corner axes. What it does drop is the noise OUR OWN arithmetic adds:
 * `x - x0` is a subtraction of two doubles, and it produced a 17-digit
 * `204.61919999999998` for 14 of the 45 coordinates on the sample plates.
 * Rounding the seat is a bug; writing the sixteenth digit of a value known to
 * six is merely bytes nobody needs and a diff nobody can read.
 *
 * PLAIN DECIMAL, never an exponent. `String` switches to exponential form below
 * 1e-6, which the fifteen parts whose mesh bottom is float noise (1e-19 to
 * 2e-12 mm) would hit. The meshes are full of exponential VERTEX text -- 3607 of
 * them in the reference plate Creality Print opened correctly -- so its number
 * lexer plainly handles the notation; but `transform` is a different attribute
 * with its own type in the 3MF schema, no measurement covers it, and the
 * reference plate's own transforms are plain decimals (`... 171.0101 -0.1443`).
 * There is nothing to gain by being the first to try it.
 *
 * `-0` needs no special case: `Number::toString` of negative zero is `"0"`, so a
 * part already sitting at z = 0 -- 37 of the 53 -- gets a flat zero rather than
 * the `-0` that reads as a mistake. Non-finite values pass through as `"NaN"` /
 * `"Infinity"` exactly as the old rule did; `hex-plate.ts` refuses a part with a
 * non-finite size before a placement can reach here.
 */
const n = (v: number): string => {
  const s = String(Number(v.toPrecision(12)));
  // `String` writes one digit, then a fraction, then the exponent. A POSITIVE
  // exponent would need the opposite expansion and is unreachable: `hex-pack.ts`
  // caps a bed at BED_MAX = 1000 mm, so no coordinate here approaches the 1e21
  // where `String` starts using one.
  const e = /^(-?)(\d)(?:\.(\d+))?e-(\d+)$/.exec(s);
  if (!e) return s;
  return `${e[1]}0.${"0".repeat(Number(e[4]) - 1)}${e[2]}${e[3] ?? ""}`;
};

/**
 * Lift the single `<object>` out of a published part, renumbered and named.
 *
 * The name is what a slicer shows in its object list, and carrying it is the
 * whole reason 3MF is the primary format and STL the fallback. Measured: all 15
 * names in the reference plate survived a Creality Print round trip.
 */
export function extractObjectBlock(
  model: string,
  id: number,
  name: string,
): string {
  // `<object\b` and not `<object `, so an object tag broken across a line is
  // counted rather than missed. `</object>` cannot match it: the character after
  // `<` there is `/`.
  const count = (model.match(/<object\b/g) ?? []).length;
  if (count !== 1) {
    throw new Error(`source has ${count} objects, expected 1`);
  }

  const start = model.search(/<object\b/);
  const close = model.indexOf("</object>");
  // A self-closing `<object ... />` has no closing tag, and `indexOf` answers
  // -1. Left to the arithmetic that follows, that becomes a slice of the first
  // eight characters -- a truncated tag written straight into the document.
  if (close < start) {
    throw new Error("source object has no closing tag");
  }
  const block = model.slice(start, close + "</object>".length);

  const open = /^<object\b([^>]*?)\s*>/.exec(block);
  if (!open) {
    throw new Error("source object tag is malformed");
  }
  // REBUILT rather than patched, and that is the load-bearing choice here.
  //
  // The obvious `replace(/^<object id="\d+"/, ...)` assumes `id` is the first
  // attribute, and `String.replace` with no match returns the string UNCHANGED
  // -- so a source that spells its attributes in another order keeps `id="1"`,
  // every object on the plate answers to 1, and every item points at the first
  // mesh. It is a well-formed zip, well-formed XML and the right number of
  // items, so nothing downstream can notice.
  //
  // Dropping any `name` the source already carries matters for the same reason
  // in reverse: two `name` attributes on one element is not "last one wins", it
  // is malformed XML that a conforming parser rejects outright.
  const attrs = open[1].replace(/\s+(?:id|name)\s*=\s*"[^"]*"/g, "");
  return (
    `<object id="${id}" name="${escapeXml(name)}"${attrs}>` +
    block.slice(open[0].length)
  );
}

/** What a caller has to say about the plate it is asking for.
 *
 *  `bed` is REQUIRED and everything else is optional, which is the opposite of
 *  how it reads at first glance. The bed is not decoration: it is the outline in
 *  the package thumbnail, and a thumbnail that shows the parts against the wrong
 *  bed is a picture that quietly disagrees with the file it describes. Made
 *  optional -- "draw the parts' own extent if nobody says" -- it would be a
 *  silent wrong answer rather than a compile error, and this module's whole
 *  posture is that a silently wrong plate is the worst outcome available. */
export type PlateMeta = {
  bed: Bed;
  /** The immutable published release the meshes came from, as `YYYY-MM-DD`.
   *
   *  REQUIRED, for the same reason `bed` is: it is the document's `CreationDate`
   *  and `ModificationDate`, and the alternatives are a wall clock (which breaks
   *  the response's identical-bytes promise from inside the file) or the DOS
   *  epoch the zip entries carry (which would be reproducible and untrue). An
   *  optional release would silently produce one of those. */
  release: string;
  title?: string;
  credit?: string;
  description?: string;
};

/**
 * Write one plate: every distinct part once as an `<object>`, every placement as
 * an `<item>` carrying the translation that puts it there.
 *
 * `sources` maps slug to the part's `3D/3dmodel.model` string. A slug with no
 * entry THROWS rather than being skipped: a plate quietly missing one part is
 * the worst outcome available here, because the file opens, the object list
 * looks plausible, and you find out after the print.
 *
 * The SLUG identifies the mesh; the placement's `name` is what the object is
 * called. They are not interchangeable -- the slug is a lossy projection of the
 * published filename -- so a plate names its parts `Hex-TB-Main`, the way the
 * reference plate does and the way the download page lists them.
 */
/**
 * `Metadata/model_settings.config` -- the per-object print settings, in the
 * Orca-family dialect.
 *
 * WHAT IT BUYS. The alpha reports were that nobody reads the README and nobody
 * picks the infill, and gyroid on these parts is structural. Settings written
 * here arrive without being read. See `hex-print-intent.ts` for what survives
 * which load path and what was measured rather than assumed.
 *
 * `extruder` IS WRITTEN even though every plate is single-material, because it
 * is the one key the slicer preserves across a geometry-only import while it
 * discards the rest. Omitting it would leave the object with no extruder
 * assignment on exactly the path where nothing else of ours survives.
 *
 * ONE BLOCK PER PLACEMENT, matching one object per placement in the model. A
 * shared object cannot carry per-copy settings or a per-copy name in this
 * reader -- measured, and the reason instancing was removed. See the comment in
 * `buildPlate3mf`.
 *
 * IDS MUST BE UNIQUE, and this is the one failure here that is not silent: a
 * duplicated `<object id>` was MEASURED to abort the entire import with "The
 * file does not contain any geometry data" -- no partial load, no warning, no
 * file. They are unique by construction (`placed.length + 1`), and the guard is
 * here because the consequence is total rather than because it is expected.
 */
function modelSettingsConfig(
  placed: readonly { id: number; name: string; slug: string }[],
): string {
  const seen = new Set<number>();
  const blocks: string[] = [];
  for (const { slug, ...obj } of placed) {
    if (seen.has(obj.id)) {
      throw new Error(
        `two objects share id ${obj.id}; a duplicate id makes the slicer refuse the whole file`,
      );
    }
    seen.add(obj.id);
    const settings = intentFor(
      PART_REMEDY[slug] ?? { support: false, brim: false },
    );
    const rows = [
      ["name", obj.name],
      ["extruder", "1"],
      ...Object.entries(settings),
    ];
    blocks.push(
      `  <object id="${obj.id}">\n` +
        rows
          .map(
            ([k, v]) =>
              `   <metadata key="${escapeXml(k)}" value="${escapeXml(v)}"/>\n`,
          )
          .join("") +
        `  </object>`,
    );
  }
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n<config>\n` +
    blocks.join("\n") +
    `\n</config>\n`
  );
}

/**
 * THE SUPPORT FAIL-SAFE: one painted facet, so a stripped file still warns.
 *
 * ===========================================================================
 * WHY THIS EXISTS. Per-object settings in `Metadata/model_settings.config` are
 * discarded by `File > Import` -- the slicer parses them and then calls
 * `config.reset()`. On that path a part that needs support silently arrives
 * with support off, prints into thin air, and NOTHING says a word. That is the
 * one gap the settings payload cannot close by itself.
 *
 * `paint_supports` lives on `ModelVolume::supported_facets`, which is MESH
 * data. The config reset never touches it. So a painted facet survives the
 * exact path that strips everything else, and `Print::validate()` raises:
 *
 *   "Support enforcers are used but support is not enabled. Please enable
 *    support."  -- modal, naming our object, with a jump to the setting.
 *
 * ===========================================================================
 * MEASURED 2026-08-18, Creality Print 7.2.1, four files, two controlled pairs.
 * ===========================================================================
 * Each pair byte-identical but for this one attribute:
 *
 *   A/B, support OFF -- B (unpainted) silent; A (one painted facet) FIRES.
 *                       A still fires after `File > Import`. So the tripwire
 *                       survives the path it exists for.
 *   C/D, support ON  -- C (painted) sliced IDENTICALLY to D (unpainted).
 *                       Same support, same places, same time. The paint is
 *                       free on the normal path.
 *
 * That second pair is the one that decides shippability, and the first version
 * of the probe could not have answered it: A and B both had support off, so
 * "no support appeared" was true there for a trivial reason.
 *
 * WHY IT COSTS NOTHING, from source: OrcaSlicer projects only DOWNWARD-facing
 * painted area into the enforcer layers --
 *   `slice_mesh_slabs(custom_facets, zs, trafo, nullptr, &projected, ...)`
 * where `nullptr` is `out_top`. An UPWARD-facing facet therefore contributes an
 * empty polygon on every layer, while `has_facets(ENFORCER)` stays true.
 *
 * WHY PAINT RATHER THAN AN ENFORCER VOLUME. The volume route needs a components
 * parent, child mesh objects, `<part subtype>` entries and a rewrite of object-id
 * allocation -- against nine fatal load failures and one silent catastrophe:
 * `ModelVolume::type_from_string` returns MODEL_PART for any unrecognised
 * subtype, with its assert commented out. A typo there is a solid box fused into
 * the customer's part that slices, prints, and warns nobody. This is one
 * attribute on one triangle, with no such failure mode.
 */
const PAINT_ATTR = 'paint_supports="4"';

/** How upward a normal must point before we call it upward. Well clear of
 *  vertical (0) so no rounding can put the chosen facet on the downward side,
 *  which is the only property the whole argument rests on. */
const UPWARD_MIN = 0.9;

/**
 * Index of a comfortably upward-facing triangle, or -1 if the mesh has none.
 *
 * EXACT ARITHMETIC, NOT A HEURISTIC, and that distinction is load-bearing here.
 * A facet-normal metric has already been wrong once in this project -- it tried
 * to PREDICT WHERE SUPPORT WAS NEEDED and scored curved contacts at zero. This
 * asks only which way one triangle points, which a cross product answers
 * exactly. Nothing downstream needs the BEST facet, only one that faces up.
 *
 * Returns the MOST upward facet, not the first one over the line. Both are
 * correct -- the design only needs "not downward" -- but the first qualifying
 * facet on real parts comes back at normal.z 0.9024, right against the
 * threshold, and WHICH facet that is depends on triangle ORDER. So a re-cut that
 * merely reordered the mesh could move the paint. Taking the maximum is
 * deterministic under reordering and lands at 0.99+ on the parts measured.
 *
 * The scan is not the expensive half either way: the vertex table has to be
 * parsed in full regardless, so an early exit saved nothing worth having.
 */
function upwardFacetIndex(model: string): number {
  const xs: number[] = [];
  const ys: number[] = [];
  const zs: number[] = [];
  for (const m of model.matchAll(
    /<vertex\s+x="([^"]+)"\s+y="([^"]+)"\s+z="([^"]+)"/g,
  )) {
    xs.push(Number(m[1]));
    ys.push(Number(m[2]));
    zs.push(Number(m[3]));
  }
  let i = -1;
  let best = -1;
  let bestUp = -Infinity;
  for (const m of model.matchAll(
    /<triangle\s+v1="(\d+)"\s+v2="(\d+)"\s+v3="(\d+)"/g,
  )) {
    i += 1;
    const a = Number(m[1]);
    const b = Number(m[2]);
    const c = Number(m[3]);
    if (xs[a] === undefined || xs[b] === undefined || xs[c] === undefined) {
      continue;
    }
    const ux = xs[b] - xs[a];
    const uy = ys[b] - ys[a];
    const uz = zs[b] - zs[a];
    const vx = xs[c] - xs[a];
    const vy = ys[c] - ys[a];
    const vz = zs[c] - zs[a];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    if (len === 0) continue;
    const up = nz / len;
    if (up > bestUp) {
      bestUp = up;
      best = i;
    }
  }
  return bestUp >= UPWARD_MIN ? best : -1;
}

/**
 * Paint one upward facet of an already-extracted object block.
 *
 * Returns the block UNCHANGED when the mesh has no upward-facing facet. That is
 * a deliberate degrade rather than a throw: the fail-safe is a second line of
 * defence, and refusing to build a plate because one part is unusually shaped
 * would trade a real download for a hypothetical one.
 *
 * THE SILENCE IS COVERED ELSEWHERE, and not by the unit suite -- a fixture
 * cannot tell you a re-oriented part still has an upward facet. Run
 * `pnpm tsx scripts/hex-paint-check.ts`: it walks every part on the support
 * list against the REAL published meshes, recomputes the painted facet's normal
 * from the emitted bytes, and exits non-zero if any part paints nothing, paints
 * more than once, or paints something not facing up. 27 parts, all passing at
 * normal.z 0.999-1.000 on release 2026-08-17. RUN IT AFTER ANY RE-CUT, beside
 * the calibration plate, because a re-orientation changes which facets face up.
 */
function paintOneFacet(block: string): string {
  // NO CACHE. This memoised the index by SLUG, which is wrong the moment one
  // slug can carry a different mesh -- across a re-cut, or across two tests in
  // one file -- because a stale index is not a slow path, it is a DOWNWARD facet
  // painted on a customer's part, generating support nobody asked for.
  //
  // Removed on that reasoning alone. To be accurate about what happened: I first
  // blamed the cache for the failing suite and was wrong -- the real defect was
  // the container-tag mismatch documented below, and removing the cache did not
  // fix it. The cache was a real hazard and a bad diagnosis at the same time.
  //
  // The cost was never the argument: the scan exits at the first upward facet,
  // against a request that already reads megabytes from R2 and DEFLATEs them.
  const index = upwardFacetIndex(block);
  if (index < 0) return block;
  let seen = -1;
  // MATCHES ON `v1=`, THE SAME SHAPE THE SCAN COUNTS. A bare `<triangle` also
  // matches the `<triangles>` CONTAINER, so the painter numbered its facets one
  // higher than the scan did and painted the triangle BEFORE the upward one. On
  // a closed mesh that neighbour is very often downward-facing -- which is the
  // single failure this design exists to avoid, because a painted downward facet
  // generates real support, silently, on every part we ship. Two regexes that
  // must agree about what counts as a triangle is a drift waiting to happen, so
  // both sides key off `v1=`.
  return block.replace(/<triangle(?=\s+v1=)/g, (m) => {
    seen += 1;
    return seen === index ? `<triangle ${PAINT_ATTR}` : m;
  });
}

export async function buildPlate3mf(
  placements: readonly Placement[],
  sources: ReadonlyMap<string, string>,
  meta: PlateMeta,
): Promise<Buffer> {
  // NO LEGALITY CHECK HERE ANY MORE, and its absence is deliberate.
  //
  // A value the slicer would silently rewrite is the one defect that ships
  // looking correct, so it must stop the build -- and it does, at module scope
  // in `hex-print-intent.ts`, which this file imports. Running it again here
  // bought nothing: by the time a request reaches this line the frozen intent
  // maps have long since been derived, so a check against the table could no
  // longer change what gets written. Worse, the throw landed in the route's bare
  // `catch {}` and became an unlogged 500, after the request had already paid
  // for every R2 read.
  const placed: { id: number; name: string; slug: string }[] = [];
  const objects: string[] = [];
  const items: string[] = [];

  for (const p of placements) {
    // ONE OBJECT PER PLACEMENT. Not per distinct slug.
    //
    // ============================================================
    // THIS FILE USED TO INSTANCE, AND INSTANCING IS INCOMPATIBLE
    // WITH PER-OBJECT SETTINGS. MEASURED, NOT REASONED.
    // ============================================================
    // Six identical caps used to be one 300 KB mesh and six `<item>` lines,
    // which is the better file by every measure except the one that matters
    // once `Metadata/model_settings.config` exists: in Creality Print 7.2.1
    // ONLY THE FIRST INSTANCE gets the settings, and only the first gets the
    // NAME. The rest arrive anonymous and unconfigured. Adding the settings
    // therefore silently broke naming, which had worked before it.
    //
    // Declaring the copies properly does NOT rescue it. A probe carrying a
    // `<plate>` block with one `<model_instance>` per copy -- the exact shape
    // Creality writes in its own saves -- still left the second cap unnamed.
    // So this is not a matter of writing the dialect more correctly; a shared
    // object cannot carry per-copy identity in this reader.
    //
    // THE COST IS REAL AND IS ACCEPTED: a build with six identical caps now
    // embeds the mesh six times. The alternative is a plate where five of six
    // parts have no name and none of our print settings, and the failure is
    // invisible until someone looks at their object list and wonders which
    // anonymous solid is which.
    //
    // The old name-collision guard is gone with the sharing that needed it:
    // nothing is collapsed any more, so no name can be silently overwritten by
    // another placement's.
    const src = sources.get(p.slug);
    if (!src) throw new Error(`no source mesh for ${p.slug}`);
    const obj = { id: placed.length + 1, name: p.name, slug: p.slug };
    placed.push(obj);
    // ONLY the parts the SLICER said need support, from `hex-support.ts`. A
    // tripwire on a part that needs nothing would fire the modal for a plate
    // that is already correct -- a false alarm that trains people to switch
    // support on globally, which is wrong for the 28 parts measured not to
    // need it. So the paint follows the collected list, never a guess.
    const needsPaint = PART_REMEDY[p.slug]?.support === true;
    const block = extractObjectBlock(src, obj.id, p.name);
    objects.push(needsPaint ? paintOneFacet(block) : block);
    // The translation that carries the mesh's OWN minimum corner to the target,
    // and drops the part onto z = 0 whatever its authored height. `x - x0`, not
    // `x`: a mesh carries its own origin, so `hex-tb-main` (x0 = -43.8786) would
    // land 43.8786 mm left of where it was asked for. `-z0` is not decorative
    // either -- `hex-tb-spike-ball-joint` rests 0.144338 mm above its own
    // origin, and without the term it prints floating.
    //
    // THE SEAT IS EXACT, and it is exact by ARITHMETIC rather than by tolerance.
    // The slicer computes each vertex plus this translation; the mesh's lowest
    // vertex IS `z0` (that is where the generator read it), so the sum it
    // evaluates is `z0 + (-z0)`, and IEEE754 addition of a finite double and its
    // own negation is exactly +0 -- no epsilon, no rounding mode, on every
    // platform. That holds only while both halves are carried at full precision:
    // `hex-geometry.ts` stores the unrounded double and `n` above writes it back
    // without quantising, so the identity survives the round trip through text.
    //
    // A SNAP TO ZERO WAS CONSIDERED AND REJECTED. Forcing `tz` to `-z0` only
    // when `|z0|` looks small, or clamping a computed seat to 0, would make a
    // WRONG table produce a right-looking plate -- and the table WAS wrong about
    // one part, with the only symptom a dialog in someone else's slicer. A snap
    // would have hidden it and left the table wrong. The writer inherits the
    // invariant from the data on purpose, so that the data is what has to be
    // right and the geometry test is what says whether it is.
    items.push(
      `  <item objectid="${obj.id}" transform="1 0 0 0 1 0 0 0 1 ` +
        `${n(p.x - p.box.x0)} ${n(p.y - p.box.y0)} ${n(-p.box.z0)}" />`,
    );
  }

  // NOTHING ON AN ITEM THAT THE CORE SPEC DOES NOT DEFINE. `<item>` allows
  // `objectid`, `transform` and `partnumber`, plus attributes from OTHER
  // namespaces. Creality Print writes an unqualified `printable="1"` in its own
  // project files, which is tempting to copy and is outside the schema; the
  // reference plate that was actually opened in a slicer carries none, and an
  // item is printable by default, so it buys nothing and costs conformance.
  // The document's OWN date, and the only honest deterministic answer to it.
  //
  // A wall clock is the obvious value and it is unavailable: this response is
  // cached per URL and promises identical bytes, so `new Date()` here would
  // break that promise from INSIDE the file, where no header comparison would
  // ever look. The DOS epoch the zip entries carry would be reproducible and a
  // lie.
  //
  // The RELEASE is neither. A plate is a derivative assembled on demand from an
  // immutable published release; the geometry in this file really was created on
  // that date, the date is already in the URL (so already in the cache key), and
  // `hex-pack.ts` has already validated it as `^\d{4}-\d{2}-\d{2}$` -- a
  // well-formed `xs:date`.
  //
  // CHECKED, not trusted, because the failure of a bad one is silent: an
  // ill-formed date is still well-formed XML, so the package opens and only a
  // conformance checker would ever say otherwise.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.release)) {
    throw new Error(`release ${meta.release} is not a plain ISO date`);
  }

  // NOTHING ON AN ITEM THAT THE CORE SPEC DOES NOT DEFINE. `<item>` allows
  // `objectid`, `transform` and `partnumber`, plus attributes from OTHER
  // namespaces. Creality Print writes an unqualified `printable="1"` in its own
  // project files, which is tempting to copy and is outside the schema; the
  // reference plate that was actually opened in a slicer carries none, and an
  // item is printable by default, so it buys nothing and costs conformance.
  //
  // THE SAME RULE GOVERNS THE METADATA BLOCK BELOW, and it is stricter than it
  // looks. The core spec defines a FIXED set of `<model>` metadata names --
  // Title, Designer, Description, Copyright, LicenseTerms, Rating, CreationDate,
  // ModificationDate, Application (Table 3-1) -- and states that "Metadata in 3MF
  // Documents without a namespace name MUST be restricted to names and values
  // defined by this specification. If a name value is not defined in this
  // specification, it MUST be prefixed with the namespace name of an XML
  // namespace declaration on the <model> element."
  //
  // So an unqualified name outside that list is not a harmless extra field: it
  // is a non-conforming document. And a MISSPELLED core name is exactly that --
  // `Licenceterms` or `CreatedDate` reads as a private extension with no
  // namespace, which is the one thing the paragraph above forbids. `CORE_META`
  // is the list, and the guard test holds every name written here to it.
  const written: [CoreMetaName, string][] = [
    ["Application", "One Thousand Drones -- Hex Cluster"],
    ["Title", meta.title ?? "Hex Cluster plate"],
    // Who made the parts. Truthful and constant: every mesh in every plate this
    // route can assemble is ours.
    ["Designer", HEX_LICENSE.holder],
    // CC BY is a copyright LICENCE, not a waiver, so there IS a copyright to
    // state, and stating it is what the licence's attribution condition is
    // about. Derived from the shared spec rather than transcribed, so the file,
    // the README and the /hex page cannot end up naming different holders.
    [
      "Copyright",
      `Copyright ${HEX_LICENSE.holder}. Licensed ${HEX_LICENSE.name}.`,
    ],
    // The CC BY credit travels INSIDE the file, not only in the README beside
    // it: a single .3mf gets dragged out of the zip and the notice is gone.
    ["LicenseTerms", meta.credit ?? HEX_LICENSE.credit],
    // Both dates are the release, and they are equal BY CONSTRUCTION rather
    // than by copy-paste: the document is assembled from an immutable release
    // and is never modified afterwards, so "created" and "last modified" name
    // the same instant. A ModificationDate that drifted from CreationDate would
    // be claiming an edit that never happened.
    ["CreationDate", meta.release],
    ["ModificationDate", meta.release],
  ];
  // `Description` is OMITTED rather than emptied when no caller supplies one: an
  // empty `<metadata>` element is a claim that the description is blank, which
  // is a different statement from not making one, and a test fixture has no
  // notes to carry.
  //
  // It is where the one instruction whose absence costs a PRINT lives -- the
  // support and orientation notes. Not the guarantee that a reader sees them:
  // slicers surface metadata inconsistently, which is why the route ships a
  // spike-bearing plate inside an archive with a README. This is what the file
  // still says once it has been separated from that README.
  if (meta.description) written.push(["Description", meta.description]);
  // `Rating` is the one core name deliberately left out: there is nothing
  // truthful to put in it, and an empty element is a claim rather than a
  // silence.

  const model =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    // `unit` is not optional in practice: a 3MF without it defaults to MICRONS,
    // so a plate that forgets it arrives one thousandth of its size.
    `<model unit="millimeter" xml:lang="en-US" ` +
    `xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">\n` +
    written
      .map(([k, v]) => ` <metadata name="${k}">${escapeXml(v)}</metadata>\n`)
      .join("") +
    ` <resources>\n${objects.join("\n")}\n </resources>\n` +
    ` <build>\n${items.join("\n")}\n </build>\n</model>\n`;

  const zip = new JSZip();
  // The two directory entries are written EXPLICITLY, and only so their
  // timestamp can be fixed. JSZip creates them implicitly for a nested path,
  // stamped `new Date()` -- which defeats ZIP_EPOCH on the files and leaves the
  // archive non-reproducible for the sake of two entries nobody reads. Spelled
  // out in this order, the central directory matches the known-good reference
  // plate entry for entry.
  const dir = { dir: true, date: ZIP_EPOCH } as const;
  zip.file("[Content_Types].xml", CONTENT_TYPES, { date: ZIP_EPOCH });
  zip.file("_rels/", null, dir);
  zip.file("_rels/.rels", RELS, { date: ZIP_EPOCH });
  zip.file("3D/", null, dir);
  zip.file("3D/3dmodel.model", model, { date: ZIP_EPOCH });
  // The package thumbnail: a top-down plan of THIS plate, drawn from the same
  // placements the build items above were written from. Registered in
  // `[Content_Types].xml` and `_rels/.rels` at the top of this file -- all three
  // or none, because a `Metadata/thumbnail.png` with no relationship is an
  // orphan file that makes the package larger and shows nobody anything.
  zip.file("Metadata/", null, dir);
  zip.file(THUMBNAIL_PATH, plateThumbnail(placements, meta.bed), {
    date: ZIP_EPOCH,
  });
  // The per-object print settings. Written LAST of the Metadata parts and with
  // no relationship of its own: unlike the thumbnail this is not an OPC-related
  // part, it is a vendor side-car found by path. Readers that do not know it --
  // PrusaSlicer, Cura -- walk past it without complaint, which is what makes it
  // safe to carry for everyone.
  zip.file(MODEL_SETTINGS_PATH, modelSettingsConfig(placed), {
    date: ZIP_EPOCH,
  });
  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    // The meshes are already the bulk and compress poorly past this; level 9
    // spends noticeably more CPU per request for a percent or two.
    compressionOptions: { level: 6 },
  });
}
