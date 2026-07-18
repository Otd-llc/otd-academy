// Server-side Cloudflare Turnstile verification. Layer 0 (design §9): the PRIMARY
// control, and the only layer that still works when Upstash is down.
//
// FAIL CLOSED on any verification error, deliberately — the opposite of the
// limiter's degradation (design §6). Turnstile is Cloudflare-hosted and
// independent of Upstash; if it is unreachable AND we let the send through, we
// have no layer left. Google/GitHub sign-in never reaches this (they don't hit
// sendVerificationRequest).
import { env } from "@/env";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// A HANG is not a verdict: without a timeout a slow Cloudflare blocks the send
// unboundedly and never trips fail-closed (design §9). Separate from the §8.1
// Upstash budget.
const TIMEOUT_MS = 2000;

let loggedKeyless = false;

/**
 * Verify a Turnstile token server-side. Returns true to allow, false to deny.
 *
 * - No secret configured (local / CI): no widget renders, so there is nothing to
 *   verify — pass, and log once. An unconfigured PRODUCTION deploy is unprotected
 *   (the env.ts boot-warn says so), but a keyless build/CI must still pass.
 * - Secret set, no token: fail closed.
 * - Timeout or any network/parse error: fail closed.
 */
export async function verifyTurnstile(
  token: string | undefined,
  ip: string | null,
): Promise<boolean> {
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    if (!loggedKeyless) {
      console.warn(
        "[turnstile] TURNSTILE_SECRET_KEY unset — bot detection is OFF (keyless build).",
      );
      loggedKeyless = true;
    }
    return true;
  }
  if (!token) return false;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      body,
      signal: controller.signal,
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
