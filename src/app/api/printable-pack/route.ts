// Hand someone the parts they configured, arranged for their printer's bed.
//
// WHY THIS EXISTS. The published set is 53 parts and 13.7 MB. Someone who
// configured a three-tile cluster needs six of them, and the alternative to this
// route is telling them to download everything and go fishing, or clicking
// through six single-file links and assembling a folder by hand.
//
// A GET WITH A QUERY, not a POST with a body, and that is the load-bearing
// choice. The configurator is a SEPARATE ORIGIN. A cross-origin fetch would need
// CORS on this route and would then have to hand the bytes back through the page
// to trigger a save; a plain link or form navigation needs neither, works
// identically whether the configurator is embedded or standalone, and lets the
// browser own the download exactly as it does for every other file here.
//
// PUBLIC, like the rest of the release. Gating this while the full set is open
// would be theatre: every byte it can produce is already one click away.
//
// Traversal is structurally impossible: `resolvePack` checks each name for
// MEMBERSHIP of the published list, and the keys are rebuilt by the same helpers
// the uploader used. Nothing from the request reaches a key.
//
// WHAT COMES BACK, decided before any byte is read (launch readiness 5.5):
//
//   3MF, whole pack      ->  a zip of plates/ plus README and LICENSE, only when
//                            the byte budget prices it at 8 MB or less.
//                            Otherwise an actionable 400 listing one canonical
//                            link per plate.
//   3MF, `plate_index=N` ->  a zip of that ONE plate plus README and LICENSE,
//                            reading only the parts on it. Year-long CDN life.
//   STL                  ->  the LOOSE zip, one file per distinct part, under
//                            the same budget.
//
// Every refusal (grammar, bed floor, unknown part, budget, plan) is arithmetic
// on committed tables, so it costs zero R2 reads. Any non-canonical spelling of
// a request is 307'd to the canonical one first.
//
// The two boxes hold different things, so their filenames COUNT different
// things: a plate holds instances, the loose zip holds one file per name. That
// is `PackContents`, and both are asserted in the route test.
import type { NextRequest } from "next/server";
import JSZip from "jszip";

import { capture } from "@/lib/analytics";
import { env } from "@/env";
import { getR2ObjectBytes } from "@/lib/part-r2";
import { HEX_LICENSE } from "@/lib/hex-spec";
import {
  HEX_GEOMETRY_RELEASE,
  HEX_PART_BOX,
  HEX_PART_NAME,
} from "@/lib/hex-geometry";
import {
  BED_FLOOR_MM,
  MAX_PACK_INSTANCES,
  PACK_PATH,
  canonicalPackQuery,
  packFilename,
  packInstances,
  packPlateLinks,
  platePath,
  resolvePack,
  type Bed,
  type BedSource,
  type PackContents,
  type PackFormat,
  type PackPart,
  type PackRequest,
} from "@/lib/hex-pack";
import {
  PACK_BYTE_BUDGET,
  estimatePackBytes,
  estimatePlateBytes,
  formatMegabytes,
} from "@/lib/hex-pack-budget";
import { asciiStem, contentDisposition } from "@/lib/hex-pack-name";
import {
  packNeedsSupport,
  packReadme,
  plateDescription,
  plateReadme,
} from "@/lib/hex-pack-readme";
import { buildPlate3mf, ZIP_EPOCH } from "@/lib/hex-3mf";
import {
  packPlates,
  PlatePackError,
  type PackInput,
  type Placement,
} from "@/lib/hex-plate";
import { printableKey, printableLicenseKey } from "@/lib/r2";
import { distinctIdFromCookies } from "@/lib/posthog-distinct-id";
import { hexFlag } from "@/lib/hex-flags";

const SITE = "https://academy.onethousanddrones.com/hex";

/**
 * The `Content-Disposition` for a response, in both spellings of the name.
 *
 * ONE FUNCTION for all three response shapes, because the thing that goes wrong
 * otherwise is not a crash: it is one shape quietly ending up with a different
 * naming rule from the other two, which is a defect this endpoint has shipped
 * twice under a green suite.
 *
 * The two filenames are built from the SAME template with two stems -- the real
 * one and its ASCII fold -- so the count, the extension and the single-part rule
 * cannot differ between the parameter a modern browser reads and the parameter
 * an old one falls back to.
 */
function disposition(
  parts: readonly PackPart[],
  opts: { holds: PackContents; stem: string; ext?: "zip" | "3mf" },
): string {
  return contentDisposition({
    filename: packFilename(parts, opts),
    ascii: packFilename(parts, { ...opts, stem: asciiStem(opts.stem) }),
  });
}

/** Join the request's parts to the geometry the packer needs.
 *
 *  Both tables are held to `HEX_PART_SLUGS` by the geometry guard test, and
 *  `resolvePack` has already proved every slug is a member, so a miss here means
 *  the committed tables and the published list have drifted apart. Checked
 *  rather than assumed because the alternative failure is `undefined.dx`, which
 *  surfaces as a TypeError with no clue in it. */
function packInputs(parts: readonly PackPart[]): PackInput[] {
  return parts.map((p) => {
    const box = HEX_PART_BOX[p.slug];
    const name = HEX_PART_NAME[p.slug];
    if (!box || !name) {
      throw new Error(`no geometry table row for ${p.slug}`);
    }
    return { slug: p.slug, name, qty: p.qty, box };
  });
}

type Tracked = {
  release: string;
  format: PackFormat;
  parts: readonly PackPart[];
  bed: Bed;
  bedSource: BedSource | undefined;
  /** Absent when the response was not plated -- a loose zip has no plates, and
   *  reporting 0 would drag every average toward it. */
  plates?: number;
  /** Set on a per-plate download: which plate of `plates` this was. */
  plateIndex?: number;
  bytes: number;
  sourceBytes: number;
};

function track(req: NextRequest, t: Tracked): void {
  try {
    capture(
      "printable_pack_downloaded",
      {
        release: t.release,
        format: t.format,
        parts: t.parts.length,
        // What they are about to PRINT, which is not the number of names: six
        // of one cap is one part and six things on a bed.
        instances: packInstances(t.parts),
        plates: t.plates,
        plate_index: t.plateIndex,
        bed_x: t.bed.x,
        bed_y: t.bed.y,
        bed_source: t.bedSource,
        bytes: t.bytes,
        source_bytes: t.sourceBytes,
        referrer: req.headers.get("referer") ?? undefined,
      },
      distinctIdFromCookies(req.cookies) ?? undefined,
    );
  } catch {
    // Never let instrumentation break the thing it is instrumenting.
  }
}

/** Assembled per request from a selection in the query, so the URL is stable but
 *  the response is a derivative rather than a published artefact -- NOT
 *  immutable, unlike the objects it is built from. A day absorbs a double-click
 *  without pinning a zip in a CDN for a year.
 *
 *  THE BUILD NAME IS IN THE CACHE KEY, and it is there by being a QUERY
 *  PARAMETER rather than by anything written here. That is the reason it is a
 *  query parameter and not a header: this cache is keyed on the URL and nothing
 *  else, so a name carried in, say, `X-Build-Name` would be invisible to it and
 *  the first person to download a given build would decide what every later
 *  person's file was called for the next 24 hours. The name is not decoration
 *  either -- it is in the zip entry names, the README manifest and each plate's
 *  `Title` -- so two people with the same parts and different names would be
 *  served each other's BYTES, not merely each other's filename. No `Vary` is
 *  needed for the same reason: nothing in this response is read from a request
 *  header. */
const CACHE = "public, max-age=86400";

/** The CDN lifetime of a per-plate URL (5.5): a year, purged by `pack-<release>`. */
const PLATE_CDN_CACHE = "public, s-maxage=31536000";

/** A hard ceiling on one request's wall clock (5.5). */
export const maxDuration = 30;

/** The actionable 400: a real request we will not serve as asked, with a
 *  message that says what to do instead. */
function tooBig(message: string): Response {
  return new Response(message, {
    status: 400,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(req: NextRequest) {
  if (!env.R2_ENABLED || !env.R2_BUCKET) {
    return new Response("Not found", { status: 404 });
  }

  // The kill switch (`hexPackEnabled`), checked before any parsing or R2 read.
  // 503 with no-store so a CDN never pins the refusal past the flip back.
  if (!(await hexFlag("hexPackEnabled"))) {
    return new Response("Downloads are paused. Try again later.", {
      status: 503,
      headers: { "Cache-Control": "no-store", "Retry-After": "300" },
    });
  }

  const q = req.nextUrl.searchParams;
  const resolved = resolvePack({
    release: q.get("release"),
    format: q.get("format"),
    parts: q.get("parts"),
    plate: q.get("plate"),
    // The build's own name, from the configurator. HOSTILE TEXT until
    // `resolvePack` says otherwise -- it is about to become a filename and an
    // HTTP header parameter. Everything that decides which is in
    // `hex-pack-name.ts`; nothing here touches the raw string.
    name: q.get("name"),
    bedFrom: q.get("bedFrom"),
    plateIndex: q.get("plate_index"),
  });
  if (!resolved.ok) {
    // A real printer we do not pack for, so it is told why. This reveals
    // nothing about the parts: the bed is checked before any name is.
    if (resolved.problem === "below-bed-floor") {
      return tooBig(
        `Hex Cluster packs for print beds of at least ${BED_FLOOR_MM} x ` +
          `${BED_FLOOR_MM} mm. The largest parts do not fit a smaller bed.`,
      );
    }
    // One status for every malformed request. The problem code is not echoed:
    // "unknown-part" vs "bad-format" would tell a prober which of its guesses
    // was a real part name, which is the only thing this endpoint could leak.
    return new Response("Bad request", { status: 400 });
  }

  const request = resolved.request;
  const { release, format, parts, bed, stem, bedFrom, plateIndex } = request;

  // ONLY THE RELEASE THE TABLES WERE MEASURED FROM. The plan needs the geometry
  // table and the budget needs the byte table, and neither describes any other
  // cut. v1 is dead: an older release is not served, loose or otherwise.
  if (release !== HEX_GEOMETRY_RELEASE) {
    return new Response("Not found", { status: 404 });
  }

  // ONE URL PER PACK. Any other spelling of the same request -- unsorted parts,
  // `:1`, a raw name, an unknown `bedFrom`, a stray parameter -- is redirected
  // to the canonical one, so the CDN holds one copy and the year-long plate
  // lifetime is safe. 307 for launch week (a 308 is cached by browsers for
  // good). The Location carries no host, so a Host header cannot steer it.
  const canon = canonicalPackQuery(request);
  if (req.nextUrl.search !== `?${canon}`) {
    return new Response(null, {
      status: 307,
      headers: {
        Location: `${PACK_PATH}?${canon}`,
        "Cache-Control": "no-store",
      },
    });
  }

  // THE BUDGET, BEFORE ANY R2 READ. A part with no row cannot be priced, so it
  // is an unknown part: the same flat 400.
  const estimate = estimatePackBytes(parts, format);
  if (estimate === null) return new Response("Bad request", { status: 400 });

  // PLATING IS 3MF-ONLY. An STL is a flat triangle soup: no transforms, no
  // units, no object names. Baking placements into its vertices would hand
  // someone one anonymous blob where fifteen named parts used to be, so STL
  // keeps shipping loose files and the configurator greys the bed picker out.
  if (format === "stl") {
    if (estimate > PACK_BYTE_BUDGET) {
      return tooBig(
        `These STL files come to about ${formatMegabytes(estimate)}, more than ` +
          `the ${formatMegabytes(PACK_BYTE_BUDGET)} one download can carry. ` +
          "Download fewer parts at a time, or download them as 3MF plates, " +
          "one plate at a time.",
      );
    }
    return looseZip(req, {
      release,
      format,
      parts,
      bed,
      bedSource: bedFrom,
      stem,
    });
  }

  const plates = planPlates(parts, bed);
  if (plates instanceof Response) return plates;

  if (plateIndex !== undefined) {
    if (plateIndex > plates.length) {
      return new Response("Not found", { status: 404 });
    }
    // The same budget, per plate. On a realistic bed a plate is a few meshes;
    // a huge bed full of a heavy part is what this refuses.
    const plateBytes = estimatePlateBytes(plates[plateIndex - 1]);
    if (plateBytes === null) {
      return new Response("Bad request", { status: 400 });
    }
    if (plateBytes > PACK_BYTE_BUDGET) {
      return tooBig(
        `Plate ${plateIndex} comes to about ${formatMegabytes(plateBytes)}, ` +
          `more than the ${formatMegabytes(PACK_BYTE_BUDGET)} one download ` +
          "can carry. Choose a smaller bed, so each plate holds fewer parts.",
      );
    }
    return platedPack(req, {
      release,
      parts,
      bed,
      bedSource: bedFrom,
      stem,
      plates,
      only: plateIndex,
    });
  }

  // The whole pack in one zip only when it fits the budget. Otherwise the
  // answer is the plan: one link per plate, each its own small download.
  if (estimate > PACK_BYTE_BUDGET) {
    return tooBig(
      [
        `This build comes to about ${formatMegabytes(estimate)}, more than ` +
          `the ${formatMegabytes(PACK_BYTE_BUDGET)} one download can carry.`,
        `Download it one plate at a time instead (${plates.length} ` +
          `${plates.length === 1 ? "plate" : "plates"}):`,
        ...packPlateLinks(request, plates.length),
      ].join("\n"),
    );
  }
  return platedPack(req, {
    release,
    parts,
    bed,
    bedSource: bedFrom,
    stem,
    plates,
  });
}

/**
 * Lay the request out on plates: pure arithmetic on the committed geometry
 * table, so every refusal below costs zero R2 reads.
 *
 * Returns the plan, or the Response that refuses it.
 */
function planPlates(parts: readonly PackPart[], bed: Bed): Placement[][] | Response {
  try {
    // THE PLATE CAP IS THE INSTANCE CAP. One plate per request means a plan's
    // plate count no longer bounds any single response -- the byte budget does
    // -- and a v2 `hex-main` (190.8 x 169.2 mm) is one to a plate even on a
    // 350 mm bed, so a 20-cell build is dozens of plates. Each instance opens at most one plate, so
    // passing the instance cap makes "too-many-plates" unreachable here; the
    // case below stays as the answer if that ever stops being true.
    return packPlates(packInputs(parts), bed, MAX_PACK_INSTANCES);
  } catch (err) {
    const reason = err instanceof PlatePackError ? err.reason : null;
    switch (reason) {
      case "too-many-plates":
        // THE CALLER'S REQUEST, and a legal one -- every name is a published
        // part and the bed is inside the range we advertise. It is simply
        // bigger than we will assemble in one response, and the two things they
        // can do about it are a larger bed or fewer parts. So the message says
        // that, instead of the flat "Bad request" the malformed cases get.
        //
        // That is a DELIBERATE widening of the one-status rule at the top of
        // this file, and it costs one bit: a prober can tell "all your names
        // were real, but too big" from "something was malformed". Acceptable
        // because the thing it discloses is membership of a list that ships
        // publicly as one 13.7 MB zip, and because the part withheld on
        // disclosure grounds is not IN that list -- it answers exactly like an
        // invented name does. Nothing here reaches the withheld set.
        //
        // NAME THE CHANNEL PRECISELY, though, because it is not the same
        // question as the paragraph above answers. What decides this response is
        // aggregate FOOTPRINT against the bed, so binary-searching `plate=WxH`
        // against a single published name recovers that name's bounding box to
        // bed quantisation -- geometry, not merely existence. Harmless as
        // written, because those boxes ship publicly inside a 13.7 MB download
        // anyone can take; but the existence argument alone would NOT cover a
        // future release that published a part's name while withholding its
        // geometry, and reading it as though it did is exactly how a widening
        // gets waved through on a precedent it never had.
        return new Response(
          `${err instanceof Error ? err.message : "too many plates"}. ` +
            "Choose a larger bed, or fewer parts.",
          { status: 400 },
        );
      case "part-too-large":
      // A published part does not fit a bed we said we accept. OURS, not the
      // caller's: `BED_MIN` is chosen so the largest part clears it with the
      // packer's gap counted twice, and the geometry guard test holds every
      // part to that on both axes. Reaching it means the table, `BED_MIN` or
      // `PLATE_GAP` drifted.
      //
      // 500 rather than 400 even though a bigger bed would sometimes work
      // around it. The promise this feature is built on is that a bed choice
      // changes the plate COUNT and can never make a part unprintable; if that
      // is false, blaming the request would hide a broken invariant behind a
      // client-side retry and nobody would ever be paged. A 5xx is also the
      // only answer a CDN will not cache as an answer.
      // falls through
      case "bad-quantity":
      // Unreachable through this route: the grammar in `hex-pack.ts` refuses a
      // quantity that is not a positive whole number before we get here, so it
      // means a caller skipped `resolvePack`. A programming fault, shaped like
      // one.
      // falls through
      default:
        // Includes the non-`PlatePackError` throws -- a missing geometry row,
        // anything else unforeseen. All ours.
        return new Response("Server error", { status: 500 });
    }
  }

}

/**
 * The plated path: read, then write, for a plan already made and priced.
 *
 * THE ORDER IS THE POINT. `GET` planned and priced this request on the
 * committed tables alone, so everything refused was refused with zero network
 * calls. By the time this runs, the response is known to fit the budget.
 *
 * `only` is a per-plate download: the archive holds that one plate of the plan,
 * and only the parts ON it are read from R2.
 */
async function platedPack(
  req: NextRequest,
  ctx: {
    release: string;
    parts: PackPart[];
    bed: Bed;
    bedSource: BedSource | undefined;
    stem: string;
    plates: Placement[][];
    only?: number;
  },
): Promise<Response> {
  const { release, parts, bed, bedSource, stem, plates, only } = ctx;
  // The plates this archive holds, each with its number in the plan, so a
  // per-plate file keeps its `i-of-N` name.
  const held =
    only === undefined
      ? plates.map((plate, i) => ({ plate, n: i + 1 }))
      : [{ plate: plates[only - 1], n: only }];
  // What gets READ: the distinct parts on the held plates, in request order.
  const reads =
    only === undefined
      ? parts
      : parts.filter((p) => held[0].plate.some((x) => x.slug === p.slug));

  const multi = plates.length > 1;
  const warned = packNeedsSupport(reads.map((p) => p.slug));
  // EVERY DOWNLOAD IS AN ARCHIVE. This used to be `multi || warned`, so a
  // single plate of parts that needed no warning came back as a bare `.3mf`.
  // Two independent things killed that branch, and either alone would have.
  //
  // THE LICENCE HAS TO TRAVEL. Owner, 2026-08-17: "we also have a license file
  // we need to include, so zip is not optional." These are CC BY works and the
  // attribution is the one condition of the licence; a bare plate carried it
  // only as `<metadata>` inside the file, which is real but is not the notice.
  //
  // AND THE BRANCH BECAME UNREACHABLE IN PRACTICE. The comment that stood here
  // argued the bare file was "the commonest response" and that only a build
  // containing a spike needed the zip. A calibration sweep -- every published
  // part on one plate, opened in Creality Print, warnings written down -- put
  // 25 of 53 parts on the support list, including `hex-tb-main`, which is in
  // very nearly every build anyone assembles. So "everything else still gets
  // the one file" had quietly become "almost nothing does". Keeping a branch
  // alive for the cases that no longer occur is how a rarely-taken path rots.
  //
  // `multi` and `warned` are still computed: they decide what the README SAYS,
  // which is a different question from what shape the box is.
  const archived = true;

  const sources = new Map<string, string>();
  let licence: Buffer | null = null;
  let bytesIn = 0;
  try {
    // Sequential, deliberately. Fanning 53 reads at R2 in parallel to build one
    // response is a good way to turn one visitor into a burst; the parts are a
    // few hundred KB each and the wall-clock difference does not justify it.
    // One read per DISTINCT part, however many of it are on the plates: the mesh
    // is embedded once as an `<object>` and repeated as `<item>` lines.
    for (const part of reads) {
      const buf = await getR2ObjectBytes(
        printableKey(release, "3mf", part.slug, "3mf"),
      );
      bytesIn += buf.byteLength;
      const entry = (await JSZip.loadAsync(buf)).file("3D/3dmodel.model");
      if (!entry) throw new Error(`${part.slug} carries no 3D/3dmodel.model`);
      sources.set(part.slug, await entry.async("string"));
    }
    // Only when there is an archive to put it in. A bare plate ships its CC BY
    // notice INSIDE the file as `<metadata name="LicenseTerms">` -- which is
    // also why a bare plate is licence-safe in a way a bare .stl would not be.
    if (archived) {
      licence = await getR2ObjectBytes(printableLicenseKey(release));
    }
  } catch {
    // A part that is not in THIS release, or R2 unreachable, or a published
    // object we cannot open. 404 for all three: from the caller's side the pack
    // as asked for does not exist, and which of the three it was is not
    // something they could act on.
    return new Response("Not found", { status: 404 });
  }

  const built: Buffer[] = [];
  try {
    for (const { plate, n } of held) {
      built.push(
        await buildPlate3mf(plate, sources, {
          // What the plate was packed for, and therefore the outline the package
          // thumbnail draws the parts inside. The same `bed` the packer used, not
          // a re-read of the query: a thumbnail showing the right parts against
          // the wrong bed is a picture that disagrees with its own file.
          bed,
          // The document's `CreationDate` and `ModificationDate`. The RELEASE,
          // because a plate is a derivative assembled on demand from an
          // immutable published set: the geometry in it really was created then,
          // and it is the only date that is both true and the same on every
          // request for this URL.
          release,
          // The build's own name, then which plate of how many. ONE string for
          // the title and the filename, so a slicer's title bar and the file it
          // was opened from cannot be saying different things -- the same reason
          // the README lists plates through the helper that names them.
          title: `${stem} -- plate ${n} of ${plates.length}`,
          credit: HEX_LICENSE.credit,
          // Per PLATE, not per pack: a plate with no spike on it says so, and
          // the one that has them names them. A pack-wide note would tell four
          // people out of five to support a part that is not in front of them.
          description: plateDescription(plate),
        }),
      );
    }
  } catch (err) {
    // ==================================================================
    // LOG IT. THIS USED TO BE A BARE `catch {}` AND THE REASON DIED HERE.
    // ==================================================================
    // Every throw the plate writer can raise is a defect in OUR data, and each
    // one is specific: a source that is not the uniform single-object shape it
    // lifts from, a slug with no mesh, a malformed release, a duplicated object
    // id -- and, once the Prusa payload is wired in, an object with no triangle
    // count, which is the one whose alternative outcome is a customer's plate
    // silently arriving empty.
    //
    // Discarding that message cost more than it looks. The failure is a 500 with
    // no body, no log and no metric, raised AFTER the request has already read
    // every mesh for the pack from R2 -- so the expensive part is paid, the
    // cause is unknowable after the fact, and `track()` records only an absence.
    // `hex-print-intent.ts` spends twelve lines arguing which of two error
    // messages a bad table should produce; that argument had no audience at all
    // while this line threw the string away.
    //
    // `console.error` rather than a telemetry call on purpose: this route has no
    // error-reporting dependency today, and adding one here would be a bigger
    // change than the fix. Vercel surfaces stderr in Runtime Logs, which is the
    // difference between "unknowable" and "one search away".
    console.error("[printable-pack] plate build failed", {
      release,
      stem,
      parts: parts.map((p) => `${p.slug}:${p.qty}`).join(","),
      bed: `${bed.x}x${bed.y}`,
      error: err instanceof Error ? err.message : String(err),
    });
    return new Response("Server error", { status: 500 });
  }

  if (!archived) {
    const out = built[0];
    track(req, {
      release,
      format: "3mf",
      parts,
      bed,
      bedSource,
      plates: 1,
      bytes: out.byteLength,
      sourceBytes: bytesIn,
    });
    return new Response(new Uint8Array(out), {
      headers: {
        "Content-Type": "model/3mf",
        "Content-Length": String(out.byteLength),
        // `.3mf`, not `.zip`. A 3MF *is* a zip underneath, which is exactly why
        // the extension has to be right: named `.zip` it opens in an archiver
        // and shows the reader an XML file instead of their parts.
        //
        // INSTANCES, because a plate really does hold that many objects.
        "Content-Disposition": disposition(parts, {
          holds: "instances",
          ext: "3mf",
          stem,
        }),
        "Cache-Control": CACHE,
      },
    });
  }

  const zip = new JSZip();
  // `plates/plate-1-of-1.3mf` in the one-plate-plus-warning case, which reads
  // slightly oddly in a folder listing and is still the right answer: the README
  // beside it lists its contents through the same `platePath`, so the two agree,
  // and a reader who takes a second plate later meets the same naming.
  //
  // The directory entry is written EXPLICITLY, and only so its timestamp can be
  // fixed: JSZip creates it implicitly for a nested path, stamped `new Date()`,
  // which would leave the archive non-reproducible for the sake of one entry
  // nobody reads. Same reasoning as inside each plate.
  zip.file("plates/", null, { dir: true, date: ZIP_EPOCH });
  built.forEach((buf, i) =>
    zip.file(platePath(held[i].n, plates.length, stem), buf, {
      date: ZIP_EPOCH,
    }),
  );
  zip.file(
    "README.txt",
    plateReadme({
      release,
      bed,
      plates,
      credit: HEX_LICENSE.credit,
      specUrl: SITE,
      // The SAME stem the entries above were written with. The README's manifest
      // and the zip's directory are compared by a human holding one against the
      // other, so they are built from one value or they are not checkable at all.
      stem,
      only,
    }),
    { date: ZIP_EPOCH },
  );
  // The published notice itself, not a regenerated copy: byte-identical to the
  // one inside the full set and beside every single mesh.
  //
  // Checked rather than asserted. `multi` gated the read that fills it and the
  // catch above owns every way that read can fail, so this is unreachable -- but
  // the alternative to a check is `licence!`, and the failure that assertion
  // waves through is a pack redistributing a CC BY work with the notice quietly
  // missing. That is the one failure here we cannot let be silent.
  if (!licence) return new Response("Server error", { status: 500 });
  zip.file("LICENSE.txt", licence, { date: ZIP_EPOCH });

  const out = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    // The meshes are already the bulk and compress poorly past this; level 9
    // spends noticeably more CPU per request for a percent or two.
    compressionOptions: { level: 6 },
  });

  track(req, {
    release,
    format: "3mf",
    parts,
    bed,
    bedSource,
    plates: plates.length,
    ...(only === undefined ? {} : { plateIndex: only }),
    bytes: out.byteLength,
    sourceBytes: bytesIn,
  });

  if (only !== undefined) {
    // Named after the PLATE, not the pack: this archive holds one plate of the
    // plan, and a folder of them must sort and read as "plate 3 of 12".
    const name = (s: string) => `${s}-plate-${only}-of-${plates.length}.zip`;
    return new Response(new Uint8Array(out), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Length": String(out.byteLength),
        "Content-Disposition": contentDisposition({
          filename: name(stem),
          ascii: name(asciiStem(stem)),
        }),
        "Cache-Control": CACHE,
        // A DETERMINISTIC URL: the canonical query names the release (immutable
        // keys), the parts, the bed, the name and the plate, and nothing else
        // reaches the bytes. So the CDN may keep it for a year; a code change
        // that alters plate bytes purges it by the release tag.
        "Vercel-CDN-Cache-Control": PLATE_CDN_CACHE,
        "Vercel-Cache-Tag": `pack-${release}`,
      },
    });
  }

  return new Response(new Uint8Array(out), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Length": String(out.byteLength),
      // INSTANCES: the plates inside really do carry that many objects.
      "Content-Disposition": disposition(parts, { holds: "instances", stem }),
      "Cache-Control": CACHE,
    },
  });
}

/**
 * The loose path: one published file per distinct part, in a zip.
 *
 * UNCHANGED, and that is the requirement rather than an accident. It is what
 * `format=stl` gets and what every pre-plating link keeps getting: no packer, no
 * bed, no plates. The bed still rides in the analytics because the caller stated
 * it, but nothing here reads it.
 *
 * One byte-level exception, deliberately taken: the entries are stamped
 * `ZIP_EPOCH` like every other zip this feature writes. JSZip otherwise stamps
 * `new Date()`, so two identical requests a second apart produced different
 * bytes for a response that is cached per URL and is meant to be a pure function
 * of it. The CONTENTS -- which files, named how, holding what -- are what
 * "unchanged" is about, and they are pinned by test.
 */
async function looseZip(
  req: NextRequest,
  ctx: {
    release: string;
    format: PackFormat;
    parts: PackPart[];
    bed: Bed;
    bedSource: BedSource | undefined;
    stem: string;
  },
): Promise<Response> {
  const { release, format, parts, bed, bedSource, stem } = ctx;

  const zip = new JSZip();
  let bytesIn = 0;
  try {
    // Sequential, deliberately -- see the note on the plated path.
    // One file per DISTINCT part. Quantity rides in the request but does not
    // change this zip: a second copy of an identical mesh is bytes nobody needs.
    for (const part of parts) {
      const buf = await getR2ObjectBytes(
        printableKey(release, format, part.slug, format),
      );
      bytesIn += buf.byteLength;
      zip.file(`${format}/${part.slug}.${format}`, buf, { date: ZIP_EPOCH });
    }

    // The published notice itself, not a regenerated copy: byte-identical to the
    // one inside the full set and beside every single mesh.
    zip.file(
      "LICENSE.txt",
      await getR2ObjectBytes(printableLicenseKey(release)),
      { date: ZIP_EPOCH },
    );
  } catch {
    // A part that is not in THIS release, or R2 unreachable. 404 is honest for
    // both: the pack as asked for does not exist.
    return new Response("Not found", { status: 404 });
  }

  // The print settings, the orientation note and the support note are DERIVED
  // inside `packReadme` from the shared spec, rather than composed here and
  // passed in. Two READMEs ship from this route now, and a caller that assembles
  // the prose is a caller that can assemble it two ways.
  zip.file(
    "README.txt",
    packReadme({
      release,
      format,
      parts,
      credit: HEX_LICENSE.credit,
      specUrl: SITE,
    }),
    { date: ZIP_EPOCH },
  );

  const out = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  track(req, {
    release,
    format,
    parts,
    bed,
    bedSource,
    bytes: out.byteLength,
    sourceBytes: bytesIn,
  });

  return new Response(new Uint8Array(out), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Length": String(out.byteLength),
      // FILES, not instances, and this is the count the loop above just wrote:
      // one entry per DISTINCT part. Naming the box after the instance total
      // shipped `?format=stl&parts=hex-tb-main:6` as `hex-cluster-6-parts.zip`
      // holding one file, beside a README reading "1 of the published parts" --
      // the filename said six, the README said one, the box held one.
      //
      // Fixed by counting what is in the box rather than by teaching the README
      // to explain a six: this zip HAS one file per name, `packReadme` already
      // counts names, and quantity legitimately does not change it (a second
      // copy of an identical mesh is bytes nobody needs). Making the name agree
      // with both is the smaller change and leaves one idea, not two.
      "Content-Disposition": disposition(parts, { holds: "files", stem }),
      "Cache-Control": CACHE,
    },
  });
}
