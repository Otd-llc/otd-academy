// Google Analytics 4 (gtag.js), behind the same consent gate as PostHog.
//
// GOOGLE CONSENT MODE, "BASIC" (owner decision, 2026-10-06). gtag.js is never
// requested until the visitor has granted c15t's `measurement` category, so a
// visitor in an opt-in region who has not decided sends Google nothing at all:
// no script fetch, no cookieless ping. That is the same fail-closed posture
// getPosthog() has. c15t ships a stock `gtag()` helper in @c15t/scripts, and it
// is deliberately NOT used: it is "advanced" mode, which loads gtag.js on every
// page with consent denied and lets Google receive pings before consent.
//
// Once loaded, the consent state sent is analytics granted, every ads signal
// denied, and Google signals plus ad personalisation off. /privacy says we do
// not use advertising cookies and do not track people across other sites; those
// four flags are what keep that true for GA.
//
// PAGE VIEWS ARE MANUAL (2026-10-09). The config sends `send_page_view: false`,
// and the stream's "page changes based on browser history events" is switched
// off in GA, because an automatic page_view sends the raw URL and <title> and
// two routes put a learner's name in one or the other (see
// @/lib/analytics-sanitize). gaPageView() below is the only page_view sender. It
// is called from PostHogProvider's route tracker with the scrubbed address.
//
// AND IT SETS THE PAGE, NOT JUST THE PAGE VIEW. gtag attaches the current
// location, title and referrer to EVERY hit (scroll, user_engagement,
// form_start…), read straight off the document at send time. A scrubbed
// page_view alone would still leak the certificate name on the first scroll.
// So each navigation runs `gtag('set', {page_location, page_title,
// page_referrer})` first, and every hit after it carries the scrubbed values.
//
// Events fired before consent resolves (an effect on mount racing the bridge)
// wait in a small in-memory queue and flush when GA boots. Nothing leaves the
// page until then, and a revoke drops the queue.
import { env } from "@/env";
import { analyticsConsentGranted } from "@/lib/consent-signal";

type Gtag = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
    [optOut: `ga-disable-${string}`]: boolean | undefined;
  }
}

const QUEUE_LIMIT = 20;
// Whole gtag commands, so a queued page view keeps its `set` ahead of its event.
const pending: unknown[][] = [];
let booted = false;
// Set by a revoke, cleared by the next grant. Without it, every loadGa() after
// boot (every event goes through it) re-sent a consent update.
let revoked = false;

/** Boot GA if it is configured and consented. Idempotent; safe to call from
 *  anywhere client-side. Returns whether GA is live after the call. */
export function loadGa(): boolean {
  const id = env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  if (!id || typeof window === "undefined") return false;
  if (!analyticsConsentGranted()) return false;

  if (booted) {
    // A re-grant after a revoke in the same page: lift the denial, once.
    if (revoked) {
      revoked = false;
      window[`ga-disable-${id}`] = false;
      window.gtag?.("consent", "update", { analytics_storage: "granted" });
    }
  } else {
    booted = true;
    window.dataLayer = window.dataLayer ?? [];
    // gtag.js reads ARGUMENTS objects off the dataLayer, not arrays. A
    // rest-param version, `(...a) => dataLayer.push(a)`, is silently ignored
    // and GA records nothing. This is Google's own snippet, typed.
    window.gtag = function gtag() {
      window.dataLayer!.push(arguments);
    };
    window.gtag("consent", "default", {
      analytics_storage: "granted",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
    window.gtag("js", new Date());
    window.gtag("config", id, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      send_page_view: false,
    });
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    document.head.appendChild(script);
  }

  for (const cmd of pending.splice(0)) window.gtag?.(...cmd);
  return true;
}

/** Send a GA4 event. Queued (in memory, this page only) until consent
 *  resolves; dropped entirely when GA is unconfigured. */
export function gaEvent(name: string, params?: Record<string, unknown>): void {
  gaCommand("event", name, params);
}

function gaCommand(...cmd: unknown[]): void {
  if (!env.NEXT_PUBLIC_GA_MEASUREMENT_ID || typeof window === "undefined") return;
  if (loadGa()) {
    window.gtag?.(...cmd);
  } else if (pending.length < QUEUE_LIMIT) {
    pending.push(cmd);
  }
}

/** A page view, already scrubbed (@/lib/analytics-sanitize). Queued like any
 *  event until consent resolves. `referrer` is the previous scrubbed location
 *  for an in-app navigation, so GA does not fall back to document.referrer,
 *  which still names the page the visitor first landed on. */
export function gaPageView(page: { location: string; title: string; referrer?: string }): void {
  gaCommand("set", {
    page_location: page.location,
    page_title: page.title,
    page_referrer: page.referrer ?? "",
  });
  gaEvent("page_view");
}

/** The visitor DECIDED against measurement: stop GA and delete its cookies.
 *
 *  Only for an explicit "no". An undecided visitor never had GA loaded here, so
 *  there is nothing to stop, and the `_ga` cookie lives on the parent domain:
 *  it may belong to a visit the apex was given consent for. Consent itself is
 *  still per site (c15t offline mode, this origin's storage), so a "no" here
 *  deletes the shared id and the apex mints a fresh one if it has a "yes". That
 *  errs toward the visitor, which is the direction to err in. */
export function revokeGa(): void {
  pending.length = 0;
  if (typeof window === "undefined") return;
  if (booted) {
    // A consent update ALONE leaves a loaded gtag.js sending cookieless pings
    // (measured: two `user_engagement` hits after a revoke). `ga-disable-<id>`
    // is Google's own opt-out switch and stops the tag sending anything.
    const id = env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    if (id) window[`ga-disable-${id}`] = true;
    window.gtag?.("consent", "update", { analytics_storage: "denied" });
    revoked = true;
  }
  clearGaCookies();
}

// `_ga` and `_ga_<stream>`, deleted on every domain they could have been set
// on. gtag's cookie_domain "auto" picks the widest domain the browser accepts
// (here `.onethousanddrones.com`), and a cookie can only be deleted with the
// domain it was written under, so try each suffix of the hostname. The bare TLD
// is skipped; a browser would refuse it anyway.
function clearGaCookies(): void {
  const names = document.cookie
    .split(";")
    .map((c) => c.trim().split("=")[0])
    .filter((n) => n === "_ga" || n.startsWith("_ga_"));
  if (names.length === 0) return;
  const labels = window.location.hostname.split(".");
  const domains: (string | null)[] = [null];
  for (let i = 0; i < labels.length - 1; i++) domains.push(`.${labels.slice(i).join(".")}`);
  for (const name of names) {
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; path=/${domain ? `; domain=${domain}` : ""}`;
    }
  }
}

/** TEST-ONLY: reset module state between tests. */
export function __resetGaForTests(): void {
  booted = false;
  revoked = false;
  pending.length = 0;
}
