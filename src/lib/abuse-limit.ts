// The rate-limiter shell (design §8). A PLAIN module — NEVER "use server" (a
// "use server" file may export only async functions; `const redis = ...` there
// crashes at runtime, tsc-silent). Runs the pure checks (abuse-policy) against
// Upstash and DEGRADES on infrastructure failure — it never throws and never
// silently allows on Tier 1. The CALLER decides how to surface a Verdict (the
// locus throws a plain Error; the IP pre-check returns a redirect string).
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "@/env";
import { RULES, nsPrefix, type RuleName, type Check } from "@/lib/abuse-policy";
import type { AlertKind } from "@/lib/abuse-alert";
import { capture } from "@/lib/analytics";

// Fire an admin alert (design §10) without blocking the request. The dynamic
// import keeps abuse-alert (db + Resend) out of this module's static graph, which
// rides into the middleware bundle via auth.ts.
function fireAlert(kind: AlertKind): void {
  void import("@/lib/abuse-alert")
    .then((m) => m.alertAbuse(kind))
    .catch(() => {});
}

export type Verdict = { ok: true } | { ok: false; rule: RuleName | "degraded" };

/** Tier 1 escalates to fail-CLOSED under a sustained outage; Tier 2/guest-tip
 *  fail OPEN (reversible, cheap). The signature the whole plan uses (design §8). */
export type FailMode = "escalate-closed" | "open";

// ── Upstash client + per-rule limiters (constructed lazily on first use) ──────
const configured = Boolean(env.KV_REST_API_URL && env.KV_REST_API_TOKEN);

const redis = configured
  ? new Redis({
      url: env.KV_REST_API_URL!,
      token: env.KV_REST_API_TOKEN!, // the WRITE token — READ_ONLY cannot INCR
      // Default is 5 retries (~4290ms of backoff) which would beat the 1s timeout
      // and throw; one short retry keeps a rejection well under the timer.
      retry: { retries: 1, backoff: () => 200 },
    })
  : null;

const limiters = new Map<RuleName, Ratelimit>();
function limiterFor(rule: RuleName): Ratelimit | null {
  if (!redis) return null;
  let rl = limiters.get(rule);
  if (!rl) {
    const spec = RULES[rule];
    const limit = typeof spec.limit === "function" ? spec.limit() : spec.limit;
    rl = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, spec.window),
      prefix: nsPrefix(rule),
      // A slow/hung Upstash RESOLVES { success:true, reason:"timeout" } — it never
      // throws. We treat reason:"timeout" as a degrade signal below, BEFORE
      // reading success (D4), so this is not a fail-open.
      timeout: 1000,
      // analytics:false: the +1 command/call is not worth it — app-level capture()
      // is the source of truth (design §10).
      analytics: false,
    });
    limiters.set(rule, rl);
  }
  return rl;
}

// ── The circuit breaker: a rolling failure-RATE over a window (design §8.1). ──
// NOT a consecutive count (a flapping-but-alive Upstash would keep resetting it —
// the exact Stalloris regime). Requires a minimum in-window sample so the rate is
// never "50%-of-2" on low traffic. Half-open probe after a cooldown.
const WINDOW_MS = 30_000; // rolling window
const MIN_SAMPLE = 20; // ignore the rate below this many in-window calls
const TRIP_RATE = 0.5; // open at >= 50% failures in-window
const COOLDOWN_MS = 30_000; // when open, allow one probe this often

function makeBreaker() {
  let recent: { ts: number; ok: boolean }[] = [];
  let openedAt: number | null = null;

  return {
    /** Record a live Redis outcome; may trip (closed) or heal/re-open (a probe). */
    record(ok: boolean) {
      const now = Date.now();
      recent.push({ ts: now, ok });
      recent = recent.filter((r) => r.ts >= now - WINDOW_MS);
      if (openedAt === null) {
        const total = recent.length;
        const failures = recent.filter((r) => !r.ok).length;
        if (total >= MIN_SAMPLE && failures / total >= TRIP_RATE) {
          openedAt = now; // trip
          fireAlert("breaker-tripped");
        }
      } else {
        // A half-open probe just recorded its outcome.
        if (ok) {
          openedAt = null; // healed → closed
          recent = [];
        } else {
          openedAt = Date.now(); // still down → re-open, restart the cooldown
        }
      }
    },
    /** May we make a live Redis call now? Open → only a probe, once per cooldown. */
    allowCall(): boolean {
      if (openedAt === null) return true;
      return Date.now() - openedAt >= COOLDOWN_MS;
    },
    isTripped(): boolean {
      return openedAt !== null;
    },
  };
}

// Module-scope: shared across every enforce() call ON THIS INSTANCE (the locus
// and the IP pre-check share one breaker; design §8.1). Per-instance by nature —
// no per-instance count is claimed to bound AGGREGATE sends (D6, option B).
const breaker = makeBreaker();

function degradeVerdict(failMode: FailMode): Verdict {
  if (failMode === "open") return { ok: true }; // Tier 2/guest-tip: reversible
  // Tier 1 escalate-closed: allow while the breaker is still gathering evidence
  // (a brief bounded grace so a transient blip does not block sign-ins), then
  // fail CLOSED once a sustained outage trips it.
  return breaker.isTripped() ? { ok: false, rule: "degraded" } : { ok: true };
}

let loggedUnconfigured = false;

/**
 * Run every check SEQUENTIALLY (ordered — the global rule is consumed LAST, so an
 * earlier denial never spends global quota, design §7.3), first denial wins. On
 * an infrastructure failure OR a `reason:"timeout"`, DEGRADE per failMode. Never
 * throws; never silently allows on Tier 1.
 */
export async function enforce(checks: Check[], failMode: FailMode): Promise<Verdict> {
  if (!redis) {
    if (!loggedUnconfigured) {
      console.warn("[abuse-limit] KV_REST_API_* unset — rate limiting is OFF (keyless build).");
      loggedUnconfigured = true;
    }
    return { ok: true };
  }

  // Open and not yet probe-time → fast-fail without touching Redis.
  if (!breaker.allowCall()) return degradeVerdict(failMode);

  for (const check of checks) {
    const rl = limiterFor(check.rule);
    if (!rl) return { ok: true };
    try {
      const res = await rl.limit(check.identity);
      if (res.reason === "timeout") {
        // DIAGNOSTIC (2026-07-18): the degrade path was silent, so a Preview where
        // every call timed out looked like "the limiter does nothing". Log the rule
        // and cause so a redeploy shows WHY enforce degrades (timeout vs error).
        console.warn(`[abuse-limit] degrade: Upstash TIMEOUT on ${check.rule} (>1000ms)`);
        capture("abuse_limiter_degraded", { rule: check.rule, cause: "timeout" });
        breaker.record(false);
        return degradeVerdict(failMode);
      }
      breaker.record(true);
      if (!res.success) {
        if (check.rule === "magic:global:day") fireAlert("global-cap");
        return { ok: false, rule: check.rule };
      }
    } catch (e) {
      console.warn(
        `[abuse-limit] degrade: Upstash ERROR on ${check.rule}: ${e instanceof Error ? e.message : String(e)}`,
      );
      capture("abuse_limiter_degraded", { rule: check.rule, cause: "error" });
      breaker.record(false);
      return degradeVerdict(failMode);
    }
  }
  return { ok: true };
}
