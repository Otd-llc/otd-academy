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

import type { Placement } from "@/lib/hex-plate";

/** Byte-identical to the one in every published part and in the known-good
 *  reference plate. `[Content_Types].xml` declares which file extensions the
 *  package may contain, so it is not boilerplate: an entry with an undeclared
 *  extension makes the whole package non-conforming. */
const CONTENT_TYPES =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />` +
  `<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml" />` +
  `</Types>`;

/** The package's one relationship: which part is the 3D model. Without it a
 *  reader has a zip full of XML and no entry point. */
const RELS =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Target="/3D/3dmodel.model" Id="rel0" ` +
  `Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" /></Relationships>`;

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
 *  conventional "this file has no meaningful timestamp" value. */
const ZIP_EPOCH = new Date(Date.UTC(1980, 0, 1));

/** Escape the five-ish characters XML cares about.
 *
 *  Covers BOTH positions this module writes into -- a double-quoted attribute
 *  value and element text -- because one escaper that is a superset of each is
 *  easier to keep right than two that are each exactly minimal. `"` is only
 *  special in an attribute value; `>` is only special in text (and only in the
 *  `]]>` sequence); `&` and `<` are special everywhere. `'` is deliberately
 *  absent: every attribute this module writes is double-quoted, so an apostrophe
 *  needs no escape, and escaping it as `&apos;` is the one entity that is not in
 *  the HTML-compatible set.
 *
 *  THE AMPERSAND GOES FIRST. Escape `<` first and the `&` in the `&lt;` you just
 *  wrote gets escaped in turn, so the name reads back as the literal text
 *  `&lt;`. That ordering is the entire correctness argument for three lines.
 *
 *  No published name needs any of this -- today they are all `[A-Za-z0-9-]` --
 *  but they are FILENAMES from an exporter rather than a constrained slug, so
 *  the next re-cut is free to produce one that does. The title and the credit
 *  are prose and need it already. */
function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Four decimal places: a tenth of a micron, which is orders of magnitude below
 *  anything an FDM printer can express. Without it `0.1 + 0.2` arithmetic writes
 *  `44.00000000000001` into a transform -- not wrong, but bytes nobody needs and
 *  a diff nobody can read. `Math.round` returns `-0` for a small negative, and
 *  `String(-0)` is `"0"`, so a part already sitting at z = 0 gets a flat zero
 *  rather than the `-0` that reads as a mistake. */
const n = (v: number) => String(Math.round(v * 1e4) / 1e4);

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
export async function buildPlate3mf(
  placements: readonly Placement[],
  sources: ReadonlyMap<string, string>,
  meta?: { title?: string; credit?: string },
): Promise<Buffer> {
  const objectBySlug = new Map<string, { id: number; name: string }>();
  const objects: string[] = [];
  const items: string[] = [];

  for (const p of placements) {
    // INSTANCING: one object per DISTINCT slug, one item per placement. Six
    // identical caps are one 300 KB mesh and six lines, not six copies. This is
    // also why mesh vertices are never rewritten -- a recentred mesh belongs to
    // one placement and could not be shared.
    let obj = objectBySlug.get(p.slug);
    if (!obj) {
      const src = sources.get(p.slug);
      if (!src) throw new Error(`no source mesh for ${p.slug}`);
      obj = { id: objectBySlug.size + 1, name: p.name };
      objectBySlug.set(p.slug, obj);
      objects.push(extractObjectBlock(src, obj.id, p.name));
    } else if (obj.name !== p.name) {
      // Instancing collapses every placement of a slug onto ONE object, so the
      // first name silently wins and the rest are lost -- a plate where five of
      // six identical caps are labelled with a name nobody passed. Callers build
      // both fields from one table row, so this cannot happen from the route;
      // it is checked because the failure is invisible in the output, not
      // because it is expected.
      throw new Error(
        `${p.slug} is named both "${obj.name}" and "${p.name}" on one plate`,
      );
    }
    // The translation that carries the mesh's OWN minimum corner to the target,
    // and drops the part onto z = 0 whatever its authored height. `x - x0`, not
    // `x`: a mesh carries its own origin, so `hex-tb-main` (x0 = -43.879) would
    // land 43.879 mm left of where it was asked for. `-z0` is not decorative
    // either -- `hex-tb-spike-ball-joint` rests 0.144 mm above its own origin,
    // and without the term it prints floating.
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
  const model =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    // `unit` is not optional in practice: a 3MF without it defaults to MICRONS,
    // so a plate that forgets it arrives one thousandth of its size.
    `<model unit="millimeter" xml:lang="en-US" ` +
    `xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">\n` +
    ` <metadata name="Application">One Thousand Drones -- Hex Cluster</metadata>\n` +
    ` <metadata name="Title">${escapeXml(meta?.title ?? "Hex Cluster plate")}</metadata>\n` +
    // The CC BY credit travels INSIDE the file, not only in the README beside
    // it: a single .3mf gets dragged out of the zip and the notice is gone.
    ` <metadata name="LicenseTerms">${escapeXml(meta?.credit ?? "CC BY 4.0")}</metadata>\n` +
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
  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    // The meshes are already the bulk and compress poorly past this; level 9
    // spends noticeably more CPU per request for a percent or two.
    compressionOptions: { level: 6 },
  });
}
