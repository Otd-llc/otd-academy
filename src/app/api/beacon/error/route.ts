// Client error beacon. The error boundaries (`error.tsx`, `global-error.tsx`)
// POST a tiny JSON body here and the capture happens SERVER-side, so it works
// with no PostHog key in the browser, no consent-gated client SDK, and no ad
// blocker in the way.
//
// Public on purpose: a render fault is as likely signed-out as signed-in. It is
// admitted by `isPublicPath` in `@/lib/admin-routes` rather than by the proxy
// matcher, so the proxy still runs (and still refreshes the JWT); the matcher
// is the deny-by-default gate and is never narrowed.
//
// What keeps an open endpoint cheap: a same-origin check, a 2 KB body cap read
// incrementally (a missing or lying Content-Length cannot make it buffer more),
// a strict parse that keeps only sanitized fields (`@/lib/error-telemetry`),
// and a per-IP limit through the shared limiter (fail-OPEN: dropping telemetry
// on an Upstash outage is fine; blocking nothing is fine too).
import type { NextRequest } from "next/server";

import { captureNow } from "@/lib/analytics";
import { enforce } from "@/lib/abuse-limit";
import { clientIp, ipCheckFor } from "@/lib/abuse-policy";
import {
  CLIENT_ERROR_EVENT,
  HEX_BEACON_EVENT,
  hexBeaconOrigins,
  parseClientBeacon,
  parseHexBeacon,
} from "@/lib/error-telemetry";

const MAX_BODY_BYTES = 2048;

const empty = (status: number) =>
  new Response(null, { status, headers: { "Cache-Control": "no-store" } });

/** The body as text, or null once it passes the cap. */
async function readCapped(req: NextRequest): Promise<string | null> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return null;
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

export async function POST(req: NextRequest) {
  // Browsers send Sec-Fetch-Site on every fetch/sendBeacon. Our own pages
  // report same-origin; a header-less client (curl) still meets the limiter.
  //
  // The ONE cross-site sender is the Hex configurator, on its own host. It is
  // admitted only from an exact Origin allow-list AND only in its own body
  // shape: a cross-site academy-shaped body is still refused. It sends with
  // credentials omitted and text/plain, so there is no preflight and no CORS
  // response header is needed (its fetch is `no-cors`; it never reads us).
  const site = req.headers.get("sec-fetch-site");
  const crossSite = site !== null && site !== "same-origin";
  const origin = req.headers.get("origin");
  if (crossSite && !(origin && hexBeaconOrigins().has(origin))) return empty(403);

  const raw = await readCapped(req);
  if (raw === null) return empty(413);

  const hex = crossSite ? parseHexBeacon(raw) : null;
  const props = crossSite ? hex : parseClientBeacon(raw);
  if (!props) return empty(400);

  const check = ipCheckFor("beacon:ip:hour", clientIp(req.headers));
  if (check && !(await enforce([check], "open")).ok) return empty(429);

  await captureNow(hex ? HEX_BEACON_EVENT : CLIENT_ERROR_EVENT, props, "server:beacon");
  return empty(204);
}
