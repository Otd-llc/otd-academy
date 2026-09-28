// Server-side funnel instrumentation (posthog-node).
//
// This is the single server entry point for emitting funnel events. It is a
// HARD NO-OP whenever NEXT_PUBLIC_POSTHOG_KEY is unset (CI, tests, any
// unconfigured build): `capture()` early-returns before touching the network,
// and `getClient()` returns null so no posthog-node client is ever constructed.
// That is what lets `pnpm build` / `pnpm test` pass with no analytics config.
//
// Callers wrap `capture()` in try/catch at the call site so a telemetry failure
// can never block the request — but the function itself is also defensive
// (catch + swallow) so a misbehaving SDK can't throw into a caller that forgot.
//
// The client is a lazily-constructed singleton. We do NOT flush per call
// (PostHog batches); in the serverless/edge-adjacent Next runtime there is no
// reliable shutdown hook, so events flush on the SDK's own interval. For
// fire-and-forget funnel events that is the right trade-off.

import { randomUUID } from "node:crypto";
import { PostHog } from "posthog-node";
import { env } from "@/env";

let client: PostHog | null = null;

/**
 * The singleton posthog-node client, or `null` when analytics is disabled
 * (NEXT_PUBLIC_POSTHOG_KEY unset). Exported for tests; prefer `capture()`.
 */
export function getClient(): PostHog | null {
  const key = env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;
  if (!client) {
    client = new PostHog(key, {
      host: env.NEXT_PUBLIC_POSTHOG_HOST,
      // Flush promptly for short-lived server invocations.
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return client;
}

/**
 * Emit a server-side funnel event.
 *
 * NO-OP when analytics is disabled (no key). Never throws: the call is wrapped
 * so a telemetry failure cannot propagate into — and break — the request that
 * fired it. Pass `distinctId` (the user id) to tie the event to a person; when
 * omitted a UNIQUE anonymous id is minted per event so the event is still
 * captured (e.g. an anonymous waitlist email_captured) WITHOUT collapsing every
 * anonymous event into one shared PostHog person — the old "anonymous-server"
 * constant made "unique waitlist joiners" read as 1, forever.
 */
export function capture(
  event: string,
  properties?: Record<string, unknown>,
  distinctId?: string,
): void {
  const ph = getClient();
  if (!ph) return; // disabled → no-op
  try {
    ph.capture({
      distinctId: distinctId ?? `anon-${randomUUID()}`,
      event,
      properties,
    });
  } catch {
    // Telemetry must never block or break the caller.
  }
}

/** How long `captureNow` will wait on PostHog before giving up. */
export const CAPTURE_NOW_TIMEOUT_MS = 1500;

/**
 * Emit an operational event and WAIT for it to be sent, for the paths where the
 * batched `capture()` would be lost: a function that is about to throw (a failed
 * magic-link send) or that is reporting its own failure (`onRequestError`). A
 * serverless invocation can be frozen the moment it returns, and the batch never
 * flushes.
 *
 * Bounded and inert by construction. NO-OP without a key. Never throws, and never
 * waits longer than CAPTURE_NOW_TIMEOUT_MS: a slow or unreachable PostHog costs a
 * failing request at most that, and cannot hang it.
 *
 * `distinctId` is a fixed server identity, not a person, and
 * `$process_person_profile: false` keeps PostHog from minting a profile for it.
 * Callers pass no PII in `properties`.
 */
export async function captureNow(
  event: string,
  properties?: Record<string, unknown>,
  distinctId = "server",
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const ph = getClient();
    if (!ph) return;
    const send = ph.captureImmediate({
      distinctId,
      event,
      properties: { ...properties, $process_person_profile: false },
    });
    // A late rejection after the timeout wins must not surface as unhandled.
    send.catch(() => {});
    await Promise.race([
      send,
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, CAPTURE_NOW_TIMEOUT_MS);
      }),
    ]);
  } catch {
    // Telemetry must never block or break the caller.
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Reset the cached singleton. TEST-ONLY: lets a test toggle the env key and get
 * a fresh client decision. Not used in production code paths.
 */
export function __resetAnalyticsClientForTests(): void {
  client = null;
}
