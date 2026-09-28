// Public download route for the hex-cluster printables. It answers with a 302 to
// a short-lived presigned R2 URL rather than streaming the bytes itself, so a
// download costs one HEAD and one signature here, not a function held open for
// the length of the transfer and the egress on top.
//
// PUBLIC by design. The release is CC BY 4.0 and deliberately ungated: lead
// capture belongs on the configurator ("save your build"), not on the download.
// Exempted from the auth middleware in `src/proxy.ts`.
//
// The order of refusals is the point of the file, cheapest first, and nothing
// reaches R2 until the request has passed all of them:
//   1. R2 unconfigured                → 404
//   2. path fails the key grammar      → 404  (`@/lib/printable-key`: traversal is
//      structurally impossible, every key is REBUILT from validated tokens)
//   3. release not published           → 404  (`@/lib/printable-releases`)
//   4. any query string but a listed `src` → 307 to the canonical URL: the bare
//      path, or the path plus `?src=<listed value>` (6.6 attribution). 307
//      while the launch settles, 308 once it has.
// Only then does GET touch R2: HEAD the object (absent → 404, any other error →
// 503 no-store + `r2_error`), presign, count the download, 302.
//
// HEAD runs the same refusals and then answers from the path alone: no R2 read,
// no event. A link checker or a slicer probing a URL is not a download.
import type { NextRequest } from "next/server";

import { capture } from "@/lib/analytics";
import { hexAttribution, readHexSource } from "@/lib/hex-attribution";
import { env } from "@/env";
import { headR2Object, presignGet } from "@/lib/part-r2";
import { isR2NotFound } from "@/lib/r2-errors";
import {
  PRINTABLE_CONTENT_TYPE,
  resolvePrintable,
  type ResolvedPrintable,
} from "@/lib/printable-key";
import { isPublishedRelease } from "@/lib/printable-releases";
import { distinctIdFromCookies } from "@/lib/posthog-distinct-id";

/** A hard ceiling on one download's wall clock (launch readiness 5.5), so a
 *  stalled R2 call cannot hold a function open for the platform maximum. */
export const maxDuration = 30;

/** One hour: long enough for a download manager or slicer to retry. */
const PRESIGN_TTL_SECONDS = 3600;

type Ctx = { params: Promise<{ path: string[] }> };

const notFound = () => new Response("Not found", { status: 404 });

function unavailable(): Response {
  return new Response("Temporarily unavailable", {
    status: 503,
    headers: { "Cache-Control": "no-store", "Retry-After": "30" },
  });
}

function recordR2Error(op: string, e: unknown): void {
  try {
    capture("r2_error", {
      route: "printable",
      op,
      name: e instanceof Error ? e.name : "unknown",
    });
  } catch {
    // Telemetry must never change the answer.
  }
}

/** The one query this route takes: `?src=` naming a LISTED source (6.6). Any
 *  other spelling -- an unknown source, a stray or repeated parameter, a utm
 *  tail -- has one canonical form, and it is this. An unlisted `src` canonicalises
 *  to the bare path, which is counted as `src: "unknown"` under consent, exactly
 *  what the enum would have said. */
function canonicalSearch(params: URLSearchParams): string {
  const src = readHexSource(params.get("src"));
  return src === undefined || src === "unknown" ? "" : `?src=${src}`;
}

/** The shared refusals. Either a finished Response, or a resolved object. */
async function admit(
  req: NextRequest,
  ctx: Ctx,
): Promise<Response | { resolved: ResolvedPrintable; path: string[] }> {
  if (!env.R2_ENABLED || !env.R2_BUCKET) return notFound();

  const { path: raw } = await ctx.params;
  const path = raw ?? [];
  const resolved = resolvePrintable(path);
  if (!resolved || !isPublishedRelease(path[0])) return notFound();

  const canon = canonicalSearch(req.nextUrl.searchParams);
  if (req.nextUrl.search !== canon) {
    // Built from the validated segments and the closed `src` enum, never
    // echoed from the request.
    return new Response(null, {
      status: 307,
      headers: {
        Location: `/api/printable/${path.join("/")}${canon}`,
        "Cache-Control": "no-store",
      },
    });
  }
  return { resolved, path };
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const admitted = await admit(req, ctx);
  if (admitted instanceof Response) return admitted;
  const { resolved, path } = admitted;

  let contentLength: number | undefined;
  try {
    ({ contentLength } = await headR2Object(resolved.key));
  } catch (e) {
    // Absent is a 404: the release is published but that part is not in it.
    // Anything else is OUR fault, so it must not read as "no such file".
    if (isR2NotFound(e)) return notFound();
    recordR2Error("head", e);
    return unavailable();
  }

  let location: string;
  try {
    // The Location is signed from the validated key only.
    location = await presignGet(
      resolved.key,
      resolved.filename,
      PRESIGN_TTL_SECONDS,
    );
  } catch (e) {
    recordR2Error("presign", e);
    return unavailable();
  }

  // Counted HERE rather than with a click handler on the page. This is the top
  // of the maker funnel and the one hop we can measure without cooperation: no
  // ad blocker, no `<a download>` quirk and no direct-link share can drop it.
  // Stitched to the browser's PostHog person where there is one. After the
  // object is known to exist and the URL is signed, so a 404 or a 503 is never
  // counted as a download.
  try {
    // ATTRIBUTION ONLY WITH CONSENT (6.6, 1.14): `src` (a closed enum, never
    // the raw query value), the first-touch `otd_src` and the referrer are all
    // absent without a c15t measurement grant. The download itself was
    // counted before consent existed, and still is.
    const attribution = hexAttribution(
      req.nextUrl.searchParams.get("src"),
      req.cookies,
    );
    const consented = attribution.src !== undefined;
    capture(
      "printable_downloaded",
      {
        key: resolved.key,
        release: path[0],
        kind: resolved.ext,
        filename: resolved.filename,
        bytes: contentLength,
        ...attribution,
        ...(consented
          ? { referrer: req.headers.get("referer") ?? undefined }
          : {}),
      },
      distinctIdFromCookies(req.cookies) ?? undefined,
    );
  } catch {
    // Never let instrumentation break the thing it is instrumenting.
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: location,
      // The signature expires; a cached redirect would outlive it.
      "Cache-Control": "no-store",
    },
  });
}

export async function HEAD(req: NextRequest, ctx: Ctx) {
  const admitted = await admit(req, ctx);
  if (admitted instanceof Response) return admitted;
  const { resolved } = admitted;
  return new Response(null, {
    status: 200,
    headers: {
      "Content-Type":
        PRINTABLE_CONTENT_TYPE[resolved.ext] ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${resolved.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
