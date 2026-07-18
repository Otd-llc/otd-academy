// Push alert for an abuse event (design §10): pull-only logs can't detect "under
// attack now" (a bombing run finishes in minutes), so this emails the admins the
// moment the circuit breaker trips or the global daily cap is hit. Reuses the
// sendSourcingDigest admin-email pattern (Resend POST to every ADMIN user).
//
// Dynamically imported from abuse-limit.ts so the limiter's static graph (which
// rides into the middleware bundle via auth.ts) stays lean. Best-effort +
// throttled per kind — an alert must never break, slow, or spam the send path.
import { db } from "@/lib/db";
import { env } from "@/env";

export type AlertKind = "breaker-tripped" | "global-cap";

const THROTTLE_MS = 10 * 60 * 1000; // at most one email per kind per 10 minutes
const lastSent = new Map<AlertKind, number>();

const MESSAGES: Record<AlertKind, { subject: string; body: string }> = {
  "breaker-tripped": {
    subject: "OTD abuse defense: rate-limiter circuit breaker OPEN",
    body:
      "The signup rate limiter's circuit breaker tripped: Upstash is failing or slow, " +
      "so magic-link sends are degrading (Tier 1 escalates to fail-closed). Google/GitHub " +
      "sign-in is unaffected. Check Upstash status; the breaker half-opens and heals on its " +
      "own once Upstash recovers.",
  },
  "global-cap": {
    subject: "OTD abuse defense: global magic-link daily cap hit",
    body:
      "Magic-link sends hit the global daily cap (MAGIC_GLOBAL_DAILY_CAP). Either a real " +
      "campaign spike (raise the cap via the env var) or a global-cap DoS. Check the per-rule " +
      "denial mix in analytics (magic_link_denied by rule) before raising it.",
  },
};

/** Best-effort admin email for an abuse event, throttled per kind. Never throws. */
export async function alertAbuse(kind: AlertKind): Promise<void> {
  try {
    const now = Date.now();
    if (now - (lastSent.get(kind) ?? 0) < THROTTLE_MS) return;
    lastSent.set(kind, now);
    if (!env.AUTH_RESEND_KEY) return;
    const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { email: true } });
    const to = admins.map((a) => a.email).filter((e): e is string => !!e);
    if (to.length === 0) return;
    const { subject, body } = MESSAGES[kind];
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.AUTH_RESEND_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: env.AUTH_RESEND_FROM, to, subject, text: body }),
    });
  } catch {
    // An alert must never break the sign-in path.
  }
}
