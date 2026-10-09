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
import { LOGIN_FLAG_COOKIE, SIGNUP_FLAG_COOKIE } from "@/lib/signup-flag";
import { sanitizeUrl } from "@/lib/analytics-sanitize";

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
export function trackLead(
  source: "waitlist" | "pass_waitlist" | "field_guide" | "molded_waitlist",
): void {
  ga("generate_lead", { lead_source: source });
}

/** Key event: about to be sent to Stripe Checkout. `valueCents` when the
 *  amount is known on the client (a tip is; a course price is server-side). */
export function trackBeginCheckout(
  item: "course" | "pass" | "upgrade" | "tip",
  itemId?: string,
  valueCents?: number,
): void {
  ga("begin_checkout", {
    items: [{ item_id: itemId ?? item, item_category: item }],
    ...(valueCents != null && { value: valueCents / 100, currency: "USD" }),
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

/** Report a returning sign-in the auth flow flagged, once, with its method
 *  (google | github | email). Same hand-off and consent rule as sign-up: the
 *  click itself is lost to the redirect, so the server leaves the flag. */
export function consumeLoginFlag(): void {
  if (typeof document === "undefined") return;
  const m = document.cookie.match(
    new RegExp(`(?:^|; )${LOGIN_FLAG_COOKIE}=(google|github|email)(?:;|$)`),
  );
  if (!m) return;
  document.cookie = `${LOGIN_FLAG_COOKIE}=; Max-Age=0; path=/`;
  ga("login", { method: m[1] });
}

// ---------------------------------------------------------------------------
// Learning progress. PostHog already records each of these server-side
// (lesson_started, stage_advanced, course_completed, exam_submitted), so they
// go to GA only, under the same names.
// ---------------------------------------------------------------------------

/** First enrollment in a course (not a re-open; see enroll()'s `created`). */
export function trackLessonStarted(projectId: string): void {
  ga("lesson_started", { project_id: projectId });
}

/** A stage cleared. `toStage === "REVISION"` is the course finished, which is
 *  also reported as its own event so it can be a key event on its own. */
export function trackStageAdvanced(p: {
  projectId: string;
  fromStage: string;
  toStage: string;
}): void {
  ga("stage_advanced", { project_id: p.projectId, from_stage: p.fromStage, to_stage: p.toStage });
  if (p.toStage === "REVISION") ga("course_completed", { project_id: p.projectId });
}

/** A final exam scored. Numbers only. */
export function trackExamSubmitted(p: {
  projectId: string;
  passed: boolean;
  score: number;
  total: number;
}): void {
  ga("exam_submitted", {
    project_id: p.projectId,
    passed: p.passed ? "yes" : "no",
    score: p.score,
    total: p.total,
  });
}

// ---------------------------------------------------------------------------
// Sharing and downloads. New to both tools.
// ---------------------------------------------------------------------------

/** GA's recommended `share`. Never the URL: a certificate link is the name. */
export function trackShare(p: {
  method: "native" | "copy_link" | "copy_code";
  contentType: "certificate" | "certificate_verify";
  itemId?: string;
}): void {
  fire("share", {
    method: p.method,
    content_type: p.contentType,
    ...(p.itemId && { item_id: p.itemId }),
  });
}

/** A download GA's automatic tracking cannot see: a blob, a presigned URL, or
 *  a link with no (or an unlisted) file extension. Same event name and params
 *  as GA's own, so the reports merge. The link is scrubbed. */
export function trackFileDownload(p: {
  fileName: string;
  fileExtension: string;
  linkUrl?: string;
}): void {
  fire("file_download", {
    file_name: p.fileName,
    file_extension: p.fileExtension,
    ...(p.linkUrl && { link_url: sanitizeUrl(p.linkUrl) }),
  });
}

// ---------------------------------------------------------------------------
// Leads, onboarding, interest.
// ---------------------------------------------------------------------------

/** /start's goal survey. The goal is one of a fixed set of keys. PostHog has
 *  onboarding_goal_selected server-side, so GA only. */
export function trackOnboardingGoal(goal: string): void {
  ga("onboarding_goal_selected", { goal });
}

/** The marketing-email checkbox changed. A boolean only, never the address. */
export function trackEmailOptIn(optedIn: boolean): void {
  fire("email_opt_in", { opted_in: optedIn ? "yes" : "no" });
}

/** "I want this made" on a molded part. PostHog has hex_part_interest server-side. */
export function trackHexPartInterest(stem: string): void {
  ga("hex_part_interest", { stem });
}

// ---------------------------------------------------------------------------
// Engagement extras.
// ---------------------------------------------------------------------------

/** Rank-up, from the one place every celebration passes through (Fanfare).
 *  GA's recommended name; PostHog has level_up server-side. */
export function trackLevelUp(levelName: string): void {
  ga("level_up", { level_name: levelName });
}

/** A patch earned, same place. GA's recommended name; PostHog has patch_earned. */
export function trackAchievement(achievementId: string): void {
  ga("unlock_achievement", { achievement_id: achievementId });
}

const usedTools = new Set<string>();
/** First input on a calculator, once per tool per page load. */
export function trackToolUsed(tool: string): void {
  if (usedTools.has(tool)) return;
  usedTools.add(tool);
  fire("tool_used", { tool });
}

/** Feedback sent. The page reference only; never the text. GA only, since
 *  PostHog has feedback_submitted server-side. */
export function trackFeedbackSent(pageRef: string): void {
  ga("feedback_submitted", { page_ref: pageRef });
}

/** A lesson video started. GA's own name; its automatic video tracking cannot
 *  see a youtube-nocookie iframe without the JS API, or a plain <video>. */
export function trackVideoStart(p: { provider: "youtube" | "self"; videoId?: string }): void {
  fire("video_start", { video_provider: p.provider, ...(p.videoId && { video_id: p.videoId }) });
}
