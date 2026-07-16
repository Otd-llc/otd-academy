// Daily lifecycle-email cron. A Vercel Cron hits this CRON_SECRET-guarded route;
// for each sequence it selects the audience (consent-gated + not-already-sent),
// builds the per-user email, sends via Resend, and records a LifecycleSend row
// (idempotent once-only — see lifecycle-send.ts). Batched + throttled so a big
// audience doesn't burst Resend. No-ops cleanly when disabled or unkeyed.
import { env } from "@/env";
import { db } from "@/lib/db";
import { siteUrl } from "@/lib/seo/jsonld";
import { signUnsubscribeToken } from "@/lib/unsubscribe-token";
import {
  LIFECYCLE_BUILDERS,
  type LifecycleContext,
  type LifecycleSequence,
} from "@/lib/lifecycle-emails";
import { sendLifecycleEmail } from "@/lib/lifecycle-send";
import {
  type AudienceUser,
  welcomeAudience,
  schematicNudgeAudience,
  layoutNudgeAudience,
  drcNudgeAudience,
  activationUpsellAudience,
  payTheDifferenceAudience,
  launchWindowAudience,
  winBackAudience,
} from "@/lib/lifecycle-triggers";

// Never prerendered: GET reads `authorization` off the request for the CRON_SECRET
// check, which forces request-time execution on its own. Under cacheComponents
// dynamic is the default and a route-segment config is rejected outright.
// If this ever DID freeze at build, the nightly lifecycle emails would stop with no
// error at all — `await connection()` (next/server) is the escape hatch.
export const maxDuration = 60;

const FOUNDER_FIRST_NAME = "Josh";
const BATCH = 20; // sends per batch
const BATCH_PAUSE_MS = 1100; // throttle between batches (Resend default ~10 req/s)
// The board 3.1 upsells into ("start L2"). 3.1 stays suppressed until this board
// is published (see plan()).
const UPSELL_TARGET_SLUG = "l2-01-battery-power-module";

/** First name from a User.name ("Ada Lovelace" → "Ada"); falls back to "there". */
function firstName(name: string | null): string {
  const first = (name ?? "").trim().split(/\s+/)[0];
  return first || "there";
}

function host(): string {
  return siteUrl().replace(/^https?:\/\//, "");
}

// Resolve every personalization token for one recipient. Links are env-configured
// where they exist; otherwise they fall back to the published guide / Pass routes.
function contextFor(user: AudienceUser): LifecycleContext {
  const base = siteUrl();
  return {
    firstName: firstName(user.name),
    founderFirstName: FOUNDER_FIRST_NAME,
    unsubscribeUrl: `${base}/email/unsubscribe/${signUnsubscribeToken(user.id)}`,
    host: host(),
    postalAddress: env.LIFECYCLE_POSTAL_ADDRESS,
    l101Url: `${base}/projects/l1-01-wroom-breakout/v1/guide`,
    certUrl: `${base}/verify`,
    l2Url: `${base}/courses`,
    passUrl: `${base}/courses`,
    upgradeUrl: `${base}/courses`,
    projectName: "your project",
    projectPrice: "what you paid",
  };
}

interface SequencePlan {
  sequence: LifecycleSequence;
  audience: AudienceUser[];
}

// Build the full work plan: which users get which sequence on this tick. Order is
// stable (welcome → nudges → activation → purchase → launch → win-back).
async function plan(now: Date): Promise<SequencePlan[]> {
  const days = env.REACTIVATION_DAYS;
  const windowEnd = env.LAUNCH_WINDOW_END ? new Date(env.LAUNCH_WINDOW_END) : null;
  const windowDays = env.LAUNCH_WINDOW_DAYS;

  // 3.1 (activation → upsell) tells a just-activated learner to go start L2.01.
  // Until that board is actually published there is nothing to start, so sending
  // it would push a board that returns "not open for enrollment yet." Suppress
  // the sequence until L2.01 is live rather than paraphrase the founder copy
  // (which is verbatim by contract). Self-healing: once L2.01 publishes, the copy
  // is accurate and already-activated learners pick it up on the next tick (the
  // once-only ledger only records emails actually sent).
  const upsellTargetLive = await db.project.findFirst({
    where: {
      slug: UPSELL_TARGET_SLUG,
      publishedRevisionId: { not: null },
    },
    select: { id: true },
  });

  const [
    welcome,
    schematic,
    layout,
    drc,
    activation,
    purchase,
    launch1,
    launch2,
    launch3,
    launch4,
    winback,
  ] = await Promise.all([
    welcomeAudience(db, now),
    schematicNudgeAudience(db, now, days),
    layoutNudgeAudience(db, now, days),
    drcNudgeAudience(db, now, days),
    upsellTargetLive
      ? activationUpsellAudience(db, now)
      : Promise.resolve<AudienceUser[]>([]),
    payTheDifferenceAudience(db, now),
    launchWindowAudience(db, now, "5.1", windowEnd, windowDays),
    launchWindowAudience(db, now, "5.2", windowEnd, windowDays),
    launchWindowAudience(db, now, "5.3", windowEnd, windowDays),
    launchWindowAudience(db, now, "5.4", windowEnd, windowDays),
    winBackAudience(db, now, days),
  ]);

  return [
    { sequence: "1.1", audience: welcome },
    { sequence: "2.1", audience: schematic },
    { sequence: "2.2", audience: layout },
    { sequence: "2.3", audience: drc },
    { sequence: "3.1", audience: activation },
    { sequence: "4.1", audience: purchase },
    { sequence: "5.1", audience: launch1 },
    { sequence: "5.2", audience: launch2 },
    { sequence: "5.3", audience: launch3 },
    { sequence: "5.4", audience: launch4 },
    { sequence: "6.1", audience: winback },
  ];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(req: Request): Promise<Response> {
  const auth = req.headers.get("authorization");
  if (!env.CRON_SECRET || auth !== `Bearer ${env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!env.LIFECYCLE_EMAIL_ENABLED) {
    return Response.json({ ok: true, skipped: "lifecycle email disabled" });
  }

  const now = new Date();
  const plans = await plan(now);

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];
  const perSequence: Record<string, number> = {};
  // Per-user daily cap: at most one lifecycle email per user per tick. Sequences
  // run in priority order (welcome → nudges → activation → purchase → launch →
  // win-back); a user matching several gets the highest-priority one now and the
  // rest on later ticks. We skip capped users BEFORE claiming the ledger row, so
  // their other sequences stay eligible tomorrow.
  const emailedThisTick = new Set<string>();

  for (const { sequence, audience } of plans) {
    const build = LIFECYCLE_BUILDERS[sequence];
    let batched = 0;
    for (const user of audience) {
      if (!user.email) {
        skipped++;
        continue;
      }
      if (emailedThisTick.has(user.id)) {
        skipped++;
        continue;
      }
      try {
        const ctx = contextFor(user);
        const email = build(ctx);
        const outcome = await sendLifecycleEmail(db, {
          userId: user.id,
          to: user.email,
          sequence,
          email,
          unsubscribeUrl: ctx.unsubscribeUrl,
        });
        if (outcome === "sent") {
          sent++;
          perSequence[sequence] = (perSequence[sequence] ?? 0) + 1;
          emailedThisTick.add(user.id);
        } else {
          skipped++;
        }
      } catch (e) {
        errors.push(`${sequence}/${user.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
      if (++batched % BATCH === 0) await sleep(BATCH_PAUSE_MS);
    }
  }

  return Response.json({ ok: true, sent, skipped, perSequence, errors });
}
