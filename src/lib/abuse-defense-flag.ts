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
