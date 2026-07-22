// Nightly DigiKey availability watchdog (parent plan, design
// docs/plans/2026-06-18-digikey-availability-watchdog-design.md). A Vercel Cron
// hits this CRON_SECRET-guarded route; it refreshes each library part's DigiKey
// stock/lifecycle snapshot and appends a PartAvailabilityEvent on a material
// change. No-ops cleanly (200) when DigiKey creds are absent so a keyless
// deploy/CI never errors.
import { env } from "@/env";
import { cronAuthorized } from "@/lib/cron-auth";
import { db } from "@/lib/db";
import { digikeyConfigured, makeDigikeyClient } from "@/lib/digikey";
import { refreshAvailability } from "@/lib/refresh-availability";
import { activeBomUnorderable, newlyUnorderableCount } from "@/lib/active-bom-sourcing";
import { sendSourcingDigest } from "@/lib/sourcing-digest-email";

// Never prerendered: GET reads `authorization` off the request for the CRON_SECRET
// check, which forces request-time execution on its own. Under cacheComponents
// dynamic is the default and a route-segment config is rejected outright.
// If this ever DID freeze at build, the DigiKey availability watchdog would stop with
// no error at all — `await connection()` (next/server) is the escape hatch.
export const maxDuration = 60; // V1: Vercel Hobby cap. With batch-5 concurrency, ~200 parts fit easily.

export async function GET(req: Request): Promise<Response> {
  if (!cronAuthorized(req.headers.get("authorization"), env.CRON_SECRET)) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!digikeyConfigured()) {
    return Response.json({ ok: true, skipped: "digikey not configured" });
  }
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 200), 500);
  const client = await makeDigikeyClient();
  const now = new Date();
  const result = await refreshAvailability({ db, client, limit, now });

  // Active-BOM sourcing watch: email admins when a part on a board's frozen BOM newly
  // goes unorderable. Best-effort — a digest failure must not fail the refresh cron.
  let notified = false;
  try {
    const issues = await activeBomUnorderable(db, now);
    const partIds = issues.flatMap((b) => b.lines.map((l) => l.partId));
    if ((await newlyUnorderableCount(db, now, partIds)) > 0) {
      notified = await sendSourcingDigest(db, issues, url.origin);
    }
  } catch (e) {
    console.error("sourcing digest failed:", e instanceof Error ? e.message : e);
  }

  return Response.json({ ok: true, ...result, notified });
}
