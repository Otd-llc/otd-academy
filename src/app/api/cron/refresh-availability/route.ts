// Nightly DigiKey availability watchdog (parent plan, design
// docs/plans/2026-06-18-digikey-availability-watchdog-design.md). A Vercel Cron
// hits this CRON_SECRET-guarded route; it refreshes each library part's DigiKey
// stock/lifecycle snapshot and appends a PartAvailabilityEvent on a material
// change. No-ops cleanly (200) when DigiKey creds are absent so a keyless
// deploy/CI never errors.
import { env } from "@/env";
import { db } from "@/lib/db";
import { digikeyConfigured, makeDigikeyClient } from "@/lib/digikey";
import { refreshAvailability } from "@/lib/refresh-availability";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60; // V1: Vercel Hobby cap. With batch-5 concurrency, ~200 parts fit easily.

export async function GET(req: Request): Promise<Response> {
  const auth = req.headers.get("authorization");
  if (!env.CRON_SECRET || auth !== `Bearer ${env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!digikeyConfigured()) {
    return Response.json({ ok: true, skipped: "digikey not configured" });
  }
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 200), 500);
  const client = await makeDigikeyClient();
  const result = await refreshAvailability({ db, client, limit, now: new Date() });
  return Response.json({ ok: true, ...result });
}
