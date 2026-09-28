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
//   4. any query string                → 307 to the bare path (the route takes
//      none; 307 while the launch settles, 308 once it has)
// Only then does GET touch R2: HEAD the object (absent → 404, any other error →
// 503 no-store + `r2_error`), presign, count the download, 302.
//
// HEAD runs the same refusals and then answers from the path alone: no R2 read,
// no event. A link checker or a slicer probing a URL is not a download.
import type { NextRequest } from "next/server";

import { capture } from "@/lib/analytics";
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

  if (req.nextUrl.search) {
    // Built from the validated segments, never echoed from the request.
    return new Response(null, {
      status: 307,
      headers: {
        Location: `/api/printable/${path.join("/")}`,
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
  // Stitched to the browser's PostHog person where there is one. Sent ONLY with
  // the visitor's analytics consent: `capture()` drops it otherwise (class (b),
  // the consent rule in `@/lib/analytics`), and nothing counts the refusal. After the
  // object is known to exist and the URL is signed, so a 404 or a 503 is never
  // counted as a download.
  try {
    capture(
      "printable_downloaded",
      {
        key: resolved.key,
        release: path[0],
        kind: resolved.ext,
        filename: resolved.filename,
        bytes: contentLength,
        referrer: req.headers.get("referer") ?? undefined,
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
