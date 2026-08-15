// Zip up just the parts someone selected in the configurator.
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
import type { NextRequest } from "next/server";
import JSZip from "jszip";

import { capture } from "@/lib/analytics";
import { env } from "@/env";
import { getR2ObjectBytes } from "@/lib/part-r2";
import { HEX_LICENSE } from "@/lib/hex-spec";
import { packFilename, resolvePack } from "@/lib/hex-pack";
import { packReadme } from "@/lib/hex-pack-readme";
import { printableKey, printableLicenseKey } from "@/lib/r2";
import { distinctIdFromCookies } from "@/lib/posthog-distinct-id";

const SITE = "https://academy.onethousanddrones.com/hex";

export async function GET(req: NextRequest) {
  if (!env.R2_ENABLED || !env.R2_BUCKET) {
    return new Response("Not found", { status: 404 });
  }

  const q = req.nextUrl.searchParams;
  const resolved = resolvePack({
    release: q.get("release"),
    format: q.get("format"),
    parts: q.get("parts"),
  });
  // One status for every malformed request. The problem code is not echoed:
  // "unknown-part" vs "bad-format" would tell a prober which of its guesses was
  // a real part name, which is the only thing this endpoint could leak.
  if (!resolved.ok) return new Response("Bad request", { status: 400 });

  const { release, format, parts } = resolved.request;

  const zip = new JSZip();
  let bytesIn = 0;
  try {
    // Sequential, deliberately. Fanning 53 reads at R2 in parallel to build one
    // response is a good way to turn one visitor into a burst; the parts are a
    // few hundred KB each and the wall-clock difference does not justify it.
    // One file per DISTINCT part. Quantity rides in the request but does not
    // change this zip: a second copy of an identical mesh is bytes nobody needs.
    // It is the plated 3MF path that turns a quantity into repeated items.
    //
    // INCONSISTENT ON PURPOSE, AND ONLY UNTIL TASK A7. The grammar now accepts
    // `slug:n`, so `?parts=hex-tb-main:6` gets a zip whose FILENAME says six
    // parts (`packFilename` counts instances), whose README lists one, and whose
    // contents hold one mesh. Three different answers to "how many". Nothing
    // here is the intended end state -- A7 replaces this loop with the packer and
    // the plated 3MF writer, at which point the quantity becomes real items on
    // real plates and all three agree. Phase A ships as ONE PR, so this is never
    // a state a user sees; do not "fix" it by making the filename lie the other
    // way, and do not read it as a decision.
    for (const part of parts) {
      const buf = await getR2ObjectBytes(
        printableKey(release, format, part.slug, format),
      );
      bytesIn += buf.byteLength;
      zip.file(`${format}/${part.slug}.${format}`, buf);
    }

    // The published notice itself, not a regenerated copy: byte-identical to the
    // one inside the full set and beside every single mesh.
    zip.file(
      "LICENSE.txt",
      await getR2ObjectBytes(printableLicenseKey(release)),
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
  );

  const out = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    // The meshes are already the bulk and compress poorly past this; level 9
    // spends noticeably more CPU per request for a percent or two.
    compressionOptions: { level: 6 },
  });

  try {
    capture(
      "printable_pack_downloaded",
      {
        release,
        format,
        parts: parts.length,
        bytes: out.byteLength,
        source_bytes: bytesIn,
        referrer: req.headers.get("referer") ?? undefined,
      },
      distinctIdFromCookies(req.cookies) ?? undefined,
    );
  } catch {
    // Never let instrumentation break the thing it is instrumenting.
  }

  return new Response(new Uint8Array(out), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Length": String(out.byteLength),
      "Content-Disposition": `attachment; filename="${packFilename(parts)}"`,
      // NOT immutable, unlike the published objects. This is assembled per
      // request from a selection in the query, so the URL is stable but the
      // response is a derivative rather than a published artefact. A day is
      // enough to absorb a double-click without pinning a zip in a CDN for a
      // year.
      "Cache-Control": "public, max-age=86400",
    },
  });
}
