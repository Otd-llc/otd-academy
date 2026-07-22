"use client";

// Browser-side funnel helpers (posthog-js). Thin wrappers over `posthog.capture`
// that are a NO-OP when analytics is disabled (no key) or before init. Import
// these from "use client" components (buttons, the pricing view) to fire the
// top-of-funnel events the server never sees.
//
// These intentionally do NOT require any specific page (e.g. /pricing) to
// exist — they're plain functions a component calls on mount or on click.

import posthog from "posthog-js";
import { env } from "@/env";

function enabled(): boolean {
  // `__loaded` is set by posthog.init (PostHogProvider). Guards the pre-init
  // window and the disabled (no-key) case in one check.
  return Boolean(env.NEXT_PUBLIC_POSTHOG_KEY) && Boolean(posthog.__loaded);
}

/** Fire when the pricing / paywall surface is viewed (top of the buy funnel). */
export function trackPricingViewed(properties?: Record<string, unknown>): void {
  if (!enabled()) return;
  try {
    posthog.capture("pricing_viewed", properties);
  } catch {
    /* telemetry must never break the UI */
  }
}

/** Fire on a funnel CTA click (e.g. "Unlock", "Enroll", "Buy"). */
export function trackCtaClicked(
  cta: string,
  properties?: Record<string, unknown>,
): void {
  if (!enabled()) return;
  try {
    posthog.capture("cta_clicked", { cta, ...properties });
  } catch {
    /* telemetry must never break the UI */
  }
}

/** Fire when the one-time /library Logbook intro is shown (design §10b). */
export function trackLogbookIntroSeen(): void {
  if (!enabled()) return;
  try {
    posthog.capture("logbook_intro_seen");
  } catch {
    /* telemetry must never break the UI */
  }
}

/** Fire when a signed-out reader clicks the "sign in to log XP" affordance. */
export function trackSigninToLogClicked(slug: string): void {
  if (!enabled()) return;
  try {
    posthog.capture("signin_to_log_clicked", { slug });
  } catch {
    /* telemetry must never break the UI */
  }
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
  if (!enabled()) return;
  try {
    posthog.capture("formative_check_engaged", { kind, action });
  } catch {
    /* telemetry must never break the UI */
  }
}
