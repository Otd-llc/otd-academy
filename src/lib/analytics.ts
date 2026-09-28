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
import { serverAnalyticsConsent } from "@/lib/server-consent";

// THE CONSENT RULE (decision 1.14)
//
// Nothing about a PERSON is counted without consent. This file is the ONE
// choke point every server event passes through, so the rule lives here and
// not at thirty call sites.
//
// Class (a), OPERATIONAL: telemetry we need to run the service, which names no
// person. Sent WITHOUT consent, because it is not about the visitor. By
// construction it cannot carry a person: the caller's distinctId is IGNORED and
// replaced with a fixed server identity, `$process_person_profile: false` stops
// PostHog minting a profile, and every property not on the event's allow-list
// is DROPPED here. A free-text error message is never on a list (a Resend or
// Prisma message can echo an address or a row).
//
// Class (b), everything else: account events, funnel steps, purchases,
// downloads, attribution, anything keyed to a user id or a browser's PostHog
// id. Sent ONLY when the request carries a c15t cookie with `measurement`
// granted (`@/lib/server-consent`). Without it the event is dropped whole: no
// user id, no anonymous stand-in, no "rejected" counter. A path with no visitor
// request (cron, the Stripe webhook) therefore never sends a class (b) event.
//
// An event not listed below is class (b). A new event defaults to gated;
// making one operational is a deliberate edit to this table.

/** A class (a) event: its fixed server identity and the ONLY property keys it
 *  may carry. */
type Operational = { readonly id: string; readonly keys: readonly string[] };

export const OPERATIONAL_EVENTS: Readonly<Record<string, Operational>> = {
  // Sign-in abuse defense + the magic-link send (src/auth.ts, abuse-limit,
  // magic-link-send). No address, no IP: a rule name, a status, a boolean.
  magic_link_send_failed: { id: "server:auth", keys: ["status"] },
  honeypot_tripped: { id: "server:auth", keys: [] },
  turnstile_failed: { id: "server:auth", keys: ["tokenPresent"] },
  magic_link_denied: { id: "server:auth", keys: ["rule"] },
  abuse_limiter_degraded: { id: "server:auth", keys: ["rule", "cause"] },
  // Error reporting. Already sanitized upstream (`@/lib/error-telemetry`): a
  // pathname without query, enums, tokens. The hex beacon is cookieless and
  // cross-origin.
  server_error: {
    id: "server:error",
    keys: [
      "path",
      "method",
      "routePath",
      "routeType",
      "routerKind",
      "renderSource",
      "name",
      "digest",
    ],
  },
  client_error: { id: "server:beacon", keys: ["boundary", "path", "name", "digest"] },
  hex_configurator_beacon: {
    id: "server:beacon",
    keys: ["kind", "outcome", "ms", "name", "where", "release"],
  },
  // Storage + background jobs. Counts, slugs, sequence names, an error NAME.
  r2_error: { id: "server:r2", keys: ["route", "op", "name"] },
  availability_refresh_failed: { id: "server:cron", keys: ["checked", "changed", "failed"] },
  waitlist_notify_failed: { id: "server:cron", keys: ["projectSlug"] },
  lifecycle_send_failed: { id: "server:email", keys: ["sequence", "errorName"] },
  dunning_send_failed: { id: "server:email", keys: ["stage", "sequence"] },
  review_seed_failed: { id: "server:review", keys: ["surface", "errorName"] },
  // A paid checkout whose Purchase row was not written: billing integrity.
  // The Stripe session id stays in the server log, not here.
  purchase_record_missing: { id: "server:billing", keys: ["kind"] },
};

/** The error's NAME only, never its message: safe for a class (a) event. */
export function errorNameOf(e: unknown): string {
  return e instanceof Error && /^[A-Za-z0-9_.:-]{1,64}$/.test(e.name) ? e.name : "unknown";
}

type Resolved = { distinctId: string; properties: Record<string, unknown> };

/** Class (a): the fixed identity + allow-listed properties + no person. */
function operational(op: Operational, properties?: Record<string, unknown>): Resolved {
  const kept: Record<string, unknown> = {};
  for (const k of op.keys) {
    if (properties && k in properties) kept[k] = properties[k];
  }
  return { distinctId: op.id, properties: { ...kept, $process_person_profile: false } };
}

/**
 * Apply the rule. Class (a) never reads a cookie; class (b) resolves to null
 * unless the current request has granted `measurement`.
 */
async function resolveEvent(
  event: string,
  properties: Record<string, unknown> | undefined,
  distinctId: string | undefined,
): Promise<Resolved | null> {
  const op = Object.hasOwn(OPERATIONAL_EVENTS, event) ? OPERATIONAL_EVENTS[event] : undefined;
  if (op) return operational(op, properties);
  if (!(await serverAnalyticsConsent())) return null;
  return {
    distinctId: distinctId ?? `anon-${randomUUID()}`,
    properties: { ...properties },
  };
}

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

let pending: Promise<void> = Promise.resolve();

/**
 * Emit a server-side event, subject to THE CONSENT RULE above.
 *
 * NO-OP when analytics is disabled (no key). Never throws: a telemetry failure
 * cannot propagate into, and break, the request that fired it. Pass
 * `distinctId` (the user id) to tie a class (b) event to a person; it is used
 * only with consent, and ignored for a class (a) event. A consented class (b)
 * event with no id gets a UNIQUE anonymous id per event, rather than every
 * anonymous event collapsing into one shared PostHog person.
 *
 * Fire-and-forget: the consent read is async, so the send lands a microtask
 * later. The read itself starts synchronously, inside the caller's request.
 */
export function capture(
  event: string,
  properties?: Record<string, unknown>,
  distinctId?: string,
): void {
  const ph = getClient();
  if (!ph) return; // disabled -> no-op
  try {
    pending = resolveEvent(event, properties, distinctId)
      .then((r) => {
        if (r) ph.capture({ distinctId: r.distinctId, event, properties: r.properties });
      })
      .catch(() => {
        // Telemetry must never block or break the caller.
      });
  } catch {
    // Telemetry must never block or break the caller.
  }
}

/** TEST-ONLY: settles once the most recent `capture()` has decided and sent. */
export function __lastCaptureForTests(): Promise<void> {
  return pending;
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
 * Subject to THE CONSENT RULE above: a class (a) event goes out under its
 * fixed server identity (the `distinctId` argument is ignored for it) with only
 * its allow-listed properties. `$process_person_profile: false` is set on every
 * event sent this way.
 */
export async function captureNow(
  event: string,
  properties?: Record<string, unknown>,
  distinctId?: string,
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const ph = getClient();
    if (!ph) return;
    // The same rule as capture(). Every current caller is class (a); a class
    // (b) event sent through here is still gated on consent.
    const r = await resolveEvent(event, properties, distinctId);
    if (!r) return;
    const send = ph.captureImmediate({
      distinctId: r.distinctId,
      event,
      properties: { ...r.properties, $process_person_profile: false },
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
