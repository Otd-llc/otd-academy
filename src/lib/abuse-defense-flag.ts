// The runtime kill switch (design §12.1). ONE predicate gating EVERY abuse denial
// point — the Turnstile / honeypot / dwell throws, the locus enforce() throw, and
// the callback IP pre-check. Read from Vercel Edge Config at request time, so it
// flips WITHOUT a redeploy (a Vercel env change would need one).
//
// Fail-safe-ON: an absent key, no store connected, or any read error/timeout → the
// defense stays ENABLED. A security control must never turn itself off because its
// config store had a blip. Env-pair presence is an ORTHOGONAL per-layer guard (each
// layer self-checks its own keys) — this predicate is the kill switch alone.
import { get } from "@vercel/edge-config";

const READ_TIMEOUT_MS = 200;

export async function defenseEnabled(): Promise<boolean> {
  // No Edge Config store connected → nothing to flip → stay on.
  if (!process.env.EDGE_CONFIG) return true;
  try {
    const value = await Promise.race([
      get<boolean>("defenseEnabled"),
      new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), READ_TIMEOUT_MS)),
    ]);
    // Only an explicit `false` disables; absent/undefined/timeout → enabled.
    return value !== false;
  } catch {
    return true;
  }
}

/**
 * The soft-cap escalation flag (design §7.3): when the global magic-link volume
 * nears the daily cap (the `global-cap` alert fires), an operator flips this to
 * make the Turnstile widget interactive (a visible challenge) instead of
 * invisible. Default OFF — absent key, no store, or any read error/timeout →
 * false (never escalate a legit user on a blip). Read server-side (on the
 * already-dynamic sign-in page) and passed to the widget as a prop.
 */
export async function turnstileInteractive(): Promise<boolean> {
  if (!process.env.EDGE_CONFIG) return false;
  try {
    const value = await Promise.race([
      get<boolean>("turnstileInteractive"),
      new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), READ_TIMEOUT_MS)),
    ]);
    return value === true;
  } catch {
    return false;
  }
}
