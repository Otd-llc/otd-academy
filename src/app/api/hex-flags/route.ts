// The Hex Cluster kill switches, read by the configurator (a separate origin).
//
// The body is EXACTLY `{ hexPackEnabled, hexSaveEnabled }` and nothing else. The
// configurator only uses these to hide controls; the real refusal is server-side,
// in the pack route (503) and the save action, so this endpoint is advisory and
// a stale or failed read costs a button, never a bypass.
//
// CORS is a STATIC origin from configuration (`hexFlagsAllowOrigin`), never a
// reflection of the request's Origin, and no credentials: nothing here depends on
// who is asking. `s-maxage=30` so a flip reaches everyone within half a minute
// while the edge absorbs the polling.
//
// `await connection()` is load-bearing. Under cacheComponents a GET handler that
// reads no request data is PRERENDERED at build, which would freeze both flags at
// whatever the store said during the deploy and make the switch a no-op.
import { connection } from "next/server";
import { readHexFlags, hexFlagsAllowOrigin } from "@/lib/hex-flags";

const CACHE = "public, s-maxage=30";

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": hexFlagsAllowOrigin(),
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };
}

export async function GET(): Promise<Response> {
  await connection();
  // The configurator reads exactly these two; hexInterestEnabled is an
  // academy-side switch and stays off the cross-origin body.
  const { hexPackEnabled, hexSaveEnabled } = await readHexFlags();
  return Response.json(
    { hexPackEnabled, hexSaveEnabled },
    {
      headers: {
        ...corsHeaders(),
        "Cache-Control": CACHE,
      },
    },
  );
}

export function OPTIONS(): Response {
  return new Response(null, {
    status: 204,
    headers: { ...corsHeaders(), "Access-Control-Max-Age": "600" },
  });
}
