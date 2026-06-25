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
 * omitted we use an "anonymous-server" id so the event is still captured (e.g.
 * an anonymous waitlist email_captured).
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
      distinctId: distinctId ?? "anonymous-server",
      event,
      properties,
    });
  } catch {
    // Telemetry must never block or break the caller.
  }
}

/**
 * Reset the cached singleton. TEST-ONLY: lets a test toggle the env key and get
 * a fresh client decision. Not used in production code paths.
 */
export function __resetAnalyticsClientForTests(): void {
  client = null;
}
