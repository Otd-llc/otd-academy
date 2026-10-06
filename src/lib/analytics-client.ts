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
//
// Every event here also goes to GA4 under the same name (gaEvent, same consent
// gate). The four GA-only helpers at the bottom use Google's RECOMMENDED event
// names, which are the ones marked as key events in the GA property. PostHog
// already receives those moments server-side (signed_up, email_captured,
// checkout_started, purchase_completed), so they are not sent to it twice.

import { getPosthog } from "@/lib/posthog-client";
import { gaEvent } from "@/lib/ga-client";
import { SIGNUP_FLAG_COOKIE } from "@/lib/signup-flag";

function fire(event: string, properties?: Record<string, unknown>): void {
  void getPosthog()
    .then((ph) => ph?.capture(event, properties))
    .catch(() => {
      /* telemetry must never break the UI */
    });
  try {
    gaEvent(event, properties);
  } catch {
    /* telemetry must never break the UI */
  }
}

/** GA-only, guarded the same way as fire(). */
function ga(event: string, params?: Record<string, unknown>): void {
  try {
    gaEvent(event, params);
  } catch {
    /* telemetry must never break the UI */
  }
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

// ---------------------------------------------------------------------------
// GA4 key events (Google's recommended names). GA-only, see the header.
// ---------------------------------------------------------------------------

/** Key event: a visitor left an email to hear more (a waitlist, a field guide). */
export function trackLead(source: "waitlist" | "pass_waitlist" | "field_guide"): void {
  ga("generate_lead", { lead_source: source });
}

/** Key event: about to be sent to Stripe Checkout. */
export function trackBeginCheckout(item: "course" | "pass" | "upgrade", itemId?: string): void {
  ga("begin_checkout", {
    items: [{ item_id: itemId ?? item, item_category: item }],
  });
}

/** Key event: a paid Stripe session, reported from /checkout/success.
 *
 *  Once per session id per tab (sessionStorage), so a reload of the success
 *  page does not count the sale again. GA also de-duplicates on transaction_id,
 *  so this is the cheap first line, not the only one. */
export function trackPurchase(p: {
  transactionId: string;
  value: number;
  currency: string;
  itemId: string;
}): void {
  const key = `otd:ga-purchase:${p.transactionId}`;
  try {
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "1");
  } catch {
    /* storage blocked: fall through, GA's own dedupe still applies */
  }
  ga("purchase", {
    transaction_id: p.transactionId,
    value: p.value,
    currency: p.currency,
    items: [{ item_id: p.itemId, price: p.value, quantity: 1 }],
  });
}

/** Report a sign-up the auth flow flagged (see src/lib/signup-flag.ts), once.
 *  Called by ConsentBridge after GA boots, so it only ever fires post-consent. */
export function consumeSignupFlag(): void {
  if (typeof document === "undefined") return;
  const flagged = document.cookie
    .split(";")
    .some((c) => c.trim() === `${SIGNUP_FLAG_COOKIE}=1`);
  if (!flagged) return;
  document.cookie = `${SIGNUP_FLAG_COOKIE}=; Max-Age=0; path=/`;
  ga("sign_up");
}
