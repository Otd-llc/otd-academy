"use client";

// Browser-side funnel helpers. Thin fire-and-forget wrappers over
// `posthog.capture` that are a NO-OP when analytics is disabled (no key).
// Import these from "use client" components (buttons, the pricing view) to
// fire the top-of-funnel events the server never sees.
//
// posthog-js loads lazily via getPosthog() (src/lib/posthog-client.ts), which
// owns init — so these helpers add no bundle weight to the routes that import
// them, and a capture can no longer race ahead of init and be dropped (the old
// `__loaded` guard silently ate pre-init events).
//
// These intentionally do NOT require any specific page (e.g. /pricing) to
// exist — they're plain functions a component calls on mount or on click.

import { getPosthog } from "@/lib/posthog-client";

function fire(event: string, properties?: Record<string, unknown>): void {
  void getPosthog()
    .then((ph) => ph?.capture(event, properties))
    .catch(() => {
      /* telemetry must never break the UI */
    });
}

/** Fire when the pricing / paywall surface is viewed (top of the buy funnel). */
export function trackPricingViewed(properties?: Record<string, unknown>): void {
  fire("pricing_viewed", properties);
}

/** Fire on a funnel CTA click (e.g. "Unlock", "Enroll", "Buy"). */
export function trackCtaClicked(
  cta: string,
  properties?: Record<string, unknown>,
): void {
  fire("cta_clicked", { cta, ...properties });
}

/** Fire when the one-time /library Logbook intro is shown (design §10b). */
export function trackLogbookIntroSeen(): void {
  fire("logbook_intro_seen");
}

/** Fire when a signed-out reader clicks the "sign in to log XP" affordance. */
export function trackSigninToLogClicked(slug: string): void {
  fire("signin_to_log_clicked", { slug });
}

/**
 * Fire when a learner ENGAGES an in-lesson formative check (revealed a
 * self-check answer, opened a "not sure" hint, ticked a do-step, answered a
 * practice quiz). Aggregate funnel signal only — no per-user persistence and no
 * schema — so we can tell whether the checks get used at all, and which types,
 * before investing in more inline-check content. Callers fire it at most once per
 * block per session (a firedRef guard), so this is a low-volume engagement ping,
 * not a per-keystroke stream.
 */
export function trackFormativeCheck(
  kind: "self_check" | "trace_list" | "do_steps" | "quiz",
  action: "revealed" | "hint_opened" | "step_ticked" | "answered",
): void {
  fire("formative_check_engaged", { kind, action });
}

/**
 * Fire when a hex-cluster build actually lands in the register.
 *
 * The BOTTOM of the maker funnel, and the only step that was missing: the
 * configurator fires `hex_save_started` on its own origin, but it cannot see
 * whether the save succeeded, because the write happens here. Without this the
 * funnel's last measurable step is an intent, not an outcome.
 *
 * `embedded` distinguishes the in-frame save from the navigate-away one. They
 * are different flows with different drop-off, and a single event covering both
 * silently averages them.
 */
export function fireHexSaveCompleted(properties: {
  mode: "new" | "rev";
  embedded: boolean;
  rev: string;
}): void {
  fire("hex_save_completed", properties);
}
