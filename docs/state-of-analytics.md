# State of Analytics

The single source of truth for analytics on both One Thousand Drones sites: what
is collected, under which consent rules, how personal data is kept out, which
settings in Google Analytics must stay as they are, and what has happened so far.
Keep it current. Update it in the same PR whenever you add an event, add a route
that puts a name, email, secret or lookup code in its URL or `<title>`, change the
consent setup, or change a GA setting.

- **Last reconciled:** 2026-10-09. Academy #526 and #529 and apex
  (`Otd-llc/otd-site`) #36 and #40 are merged and live.
- **Who owns which account, and the DNS record:** kept out of this public repo, in
  the private store at `otd-classified/internal/analytics-accounts-and-access.md`.
- **The older PostHog event map** (server-side funnel events): `docs/sales/funnel-events.md`.
  It predates GA and is not maintained here (`docs/sales/` is gitignored since 2026-07-25),
  so this file is the current record.

---

## TL;DR

- **Two tools.** Google Analytics 4 runs on the academy and the apex. PostHog runs
  on the academy only, and only when `NEXT_PUBLIC_POSTHOG_KEY` is set.
- **One GA property, one web stream, both sites.** The measurement ID is
  `G-WKBTPE6YCN`. It is public, since it ships in every page. Both hosts share the
  `_ga` cookie on `.onethousanddrones.com`, so an apex → academy visit counts as one
  user and one session, with no cross-domain setup.
- **The consent banner shows only where the law asks for consent first.** Elsewhere,
  measurement is on unless the browser sends Global Privacy Control.
- **Google Consent Mode is "basic".** gtag.js is never requested until the visitor
  allows measurement.
- **Page views are sent by our code, not by GA.** Each one is scrubbed first,
  because one route puts a learner's name in both its URL and its title.
- **No event may carry** a name, an email, free text, a token or a lookup code.

---

## Principles (load-bearing; do not break)

1. **Fail closed.** No location, no consent decision, or no configured ID means no
   analytics. A missing value only ever makes the site stricter.
2. **Nothing identifies a person.** That means no names, emails, free text,
   certificate tokens, `/verify` codes, Stripe session IDs or presigned URLs. Google's
   terms forbid it, and `/privacy` promises it.
3. **Every page view and every link URL goes through the scrubber,**
   `src/lib/analytics-sanitize.ts`. If a new route puts any of the above in its
   path, query or `<title>`, add it to the scrubber with a test.
4. **One consent gate.** c15t's `measurement` category controls both PostHog and GA.
   There is no second switch.
5. **Never load Google ad features.** Ads signals are always denied, Google signals
   and ad personalisation are off, and nothing is linked to Google Ads.
   `/privacy` says so.

---

## How it works

### Consent (both sites)

- **Banner:** c15t `@c15t/nextjs` 2.2.1 in offline mode. Each site stores its own
  decision, so a visitor in an opt-in region answers once per site. The banner's
  title, text, theme and button emphasis are owner-approved and identical on the
  academy, the apex and the hex configurator.
- **Location:** `src/proxy.ts` (apex: `proxy.ts`) copies Vercel's
  `x-vercel-ip-country` and `x-vercel-ip-country-region` headers into an `otd-geo`
  cookie, for example `US-OK`. c15t reads it as `overrides`. This is an essential
  cookie; it only decides which rules apply.
- **The cookie alone does nothing.** Offline c15t consults location only through
  `offlinePolicy.policyPacks`. Without packs, everyone got the opt-in banner,
  whatever their country (measured). The packs are in `src/lib/consent-geo.ts`
  (apex: `app/lib/consent-geo.ts`):
  - **Opt-in:** EU, EEA and UK, plus Switzerland, Brazil, Japan and South Korea,
    plus any visitor with no country. Offline c15t treats a missing country as GB,
    so a missing location always lands here.
  - **Quebec:** opt-in, matched on the region, so the rest of Canada is unaffected.
  - **Everyone else:** no banner. Measurement is on unless the browser sends GPC.
  - This list is repeated in `/privacy` §2. Change all three copies or none.
- **The bridge:** `ConsentBridge` mirrors the decision into `consent-signal.ts`,
  which `getPosthog()` and `loadGa()` read. It also sets an `otd-measure=1` cookie
  on a grant. The server reads that cookie before leaving the sign-up and login
  flags described below.
- **Revoking consent:** only an explicit "no" deletes the `_ga` cookies, on every
  domain they could have been written under, and sets `ga-disable-<id>`. A consent
  update on its own leaves a loaded tag still sending pings (measured).

### Google Analytics (`src/lib/ga-client.ts`; apex: `app/lib/ga-client.ts`)

- **Loading:** gtag.js loads only after a grant. Consent defaults are analytics
  granted and every ad signal denied. Config sets `allow_google_signals: false`,
  `allow_ad_personalization_signals: false` and `send_page_view: false`.
- **Queue:** events fired before consent resolves wait in memory as whole gtag
  commands, then flush in order when GA loads. A revoke drops them.
- **Page views:** the academy's route tracker is in `PostHogProvider`; the apex's is
  `AnalyticsTracker`. On each navigation it runs
  `gtag('set', {page_location, page_title, page_referrer})` with scrubbed values,
  then sends `page_view`.
  - It has to be a `set`, because gtag stamps the live URL and title on **every**
    hit (scroll, user_engagement, form_start…), not just page views.
  - A path change counts after a 150 ms pause, so the new title has landed.
  - A query-only change counts after the address has been still for 1.5 s, so the
    parts search no longer logs every half-typed term.
  - On a full load, the referrer is `document.referrer`, scrubbed. On an in-app
    navigation it is the previous scrubbed page.
- **What the scrubber does** (`src/lib/analytics-sanitize.ts`):
  - The certificate path `/learn/<slug>/certificate/<token>` becomes `/certificate/[token]`.
  - That route's title becomes "Certificate · One Thousand Drones Academy".
  - These query parameters are dropped: `code`, `token`, `email`, `session_id`,
    `callbackUrl`.
  - PostHog gets the same scrubbed URL, and a `before_send` hook scrubs the
    `$current_url`, `$pathname` and `$referrer` that posthog-js stamps on every event.
- **Sign-up and login:** the redirect discards the browser's own event, so the
  Auth.js events `createUser` and `signIn` leave a short-lived, identity-free flag
  cookie (`otd-signup` / `otd-login`, with the method only). They do this **only**
  when the request carries `otd-measure=1`. `ConsentBridge` turns the flag into
  `sign_up` or `login` once GA is live.
- **Downloads and plain video:** `AnalyticsListeners` is a page-wide listener for
  what server-rendered markup can't wire itself.
  - It reports a download whose extension isn't on GA's own list, such as the `.3mf`
    jigs and the `/api/printable-pack` print pack. Extensions GA already counts are
    left to GA.
  - It reports plain `<video>` plays, skipping muted autoplay loops.

---

## Events

★ = key event in GA. "PH server" = PostHog already records it server-side, so the
client sends it to GA only and PostHog doesn't count it twice.

| Event | Fires from | Params | GA | PostHog |
|---|---|---|---|---|
| `page_view` | route trackers (both sites) | scrubbed location, title, referrer | ✓ | `$pageview` |
| `sign_up` ★ | `consumeSignupFlag` ← `auth.ts` createUser | none | ✓ | PH server `signed_up` |
| `login` | `consumeLoginFlag` ← `auth.ts` signIn | `method`: google, github or email | ✓ | none |
| `generate_lead` ★ | waitlists, field guide by email, molded waitlist, apex briefing form | `lead_source` | ✓ | PH server `email_captured` |
| `begin_checkout` ★ | course, pass, upgrade and tip buttons | `items[].item_category`; `value` for tips | ✓ | PH server `checkout_started` |
| `purchase` ★ | `/checkout/success`, after Stripe confirms payment | `transaction_id`, `value`, `currency` | ✓ | PH server `purchase_completed` |
| `lesson_started` | `EnrollButton`, first enrollment only | `project_id` | ✓ | PH server |
| `stage_advanced` | `AdvanceEnrollmentButton` | `from_stage`, `to_stage` | ✓ | PH server |
| `course_completed` | when `to_stage` is `REVISION` | `project_id` | ✓ | PH server |
| `exam_submitted` | `ExamForm` | `passed`, `score`, `total` | ✓ | PH server |
| `share` | `ShareCard`, `VerifyLinkShare` | `method`, `content_type`, `item_id` (the slug; never the link) | ✓ | ✓ |
| `file_download` | PDF builds, KiCad/gerber/bring-up files (action name only), certificate PDF, `.3mf`, print pack | `file_name`, `file_extension`, scrubbed `link_url` | ✓ (GA also counts listed extensions itself) | ✓ |
| `onboarding_goal_selected` | `GoalSurvey` | `goal` (a fixed key) | ✓ | PH server |
| `email_opt_in` | `StartConsent`, `EmailPreferences` | `opted_in` | ✓ | ✓ |
| `hex_part_interest` | "I want this made" | `stem` | ✓ | PH server |
| `level_up`, `unlock_achievement` | `Fanfare` (every celebration passes through it) | `level_name`, `achievement_id` | ✓ | PH server |
| `tool_used` | calculator inputs, once per tool per page | `tool` | ✓ | ✓ |
| `feedback_submitted` | `FeedbackBox` | `page_ref` (never the text) | ✓ | PH server |
| `video_start` | YouTube thumbnail click, plain `<video>` play | `video_provider`, `video_id` | ✓ | ✓ |
| `pricing_viewed`, `cta_clicked`, `logbook_intro_seen`, `signin_to_log_clicked`, `formative_check_engaged`, `hex_save_completed` | `analytics-client.ts` helpers | as before | ✓ | ✓ |
| `cta_clicked` `{cta: 'academy'}` | apex: any link into the academy | `placement`, `target_path` | ✓ | none |
| `demo_scenario_selected` | apex: BioScale picker | `scenario` | ✓ | none |

GA's enhanced measurement also records `scroll`, outbound clicks, site search
(`?q=` on `/parts`), form start/submit, and `file_download` for the extensions on
its own list.

---

## GA settings that must stay as they are

| Setting | Value | Why |
|---|---|---|
| Admin → Data collection → Google signals | **Off** | `/privacy`: we don't track people across sites |
| Admin → Data retention | **14 months** for both | longest on the free tier |
| Admin → Account details → Data sharing | Only **Technical support** ticked | `/privacy`: providers use data only to run the service |
| Admin → Account details → Data Processing Terms | **Accepted 2026-10-06** | Google is named as a processor |
| Product links → Google Ads | **None** | `/privacy`: not linked to any ad account |
| Product links → Search Console | **Domain property `onethousanddrones.com`** | covers both sites (swapped 2026-10-09 from the academy-only property) |
| Stream → Enhanced measurement → Page views → **"Page changes based on browser history events"** | **Off** | our code sends scrubbed page views. Switching it on double-counts them, and its page_view would carry whatever page is set |
| Stream → Enhanced measurement → Page views → "Page loads" | On (no effect) | `send_page_view: false` in config overrides it |
| Key events | `sign_up`, `generate_lead`, `begin_checkout`, `purchase` | `close_convert_lead` and `qualify_lead` came with the "Generate leads" objective. Nothing sends them; leave them. |
| Custom dimensions | `lead_source` (event) | add more as reports need them: `to_stage`, `goal`, `tool`, `passed` |

`NEXT_PUBLIC_GA_MEASUREMENT_ID` is set on **Production only** for the Vercel
projects `project-foundry` and `otd-site`. Leaving it unset (preview builds, local,
CI) means no GA at all.

---

## Verified

- **2026-10-06, launch, dummy ID, collect requests intercepted:**
  - No location: banner shown, and nothing sent until Accept.
  - US and Ontario: no banner, GA live with `gcs=G101 npa=1` (analytics on, ads off).
  - Germany, Quebec, and US with GPC: nothing sent.
  - Revoke: `_ga` and `otd-measure` deleted, no further hits.
  - The same six cases were run on the apex production build.
- **2026-10-06, live:** one `_ga` and one session across both hosts (Playwright
  cookie trace). Realtime showed page views from both sites.
- **2026-10-09, the name-leak fix:** a signed test certificate for "Ada Lovelace",
  whose page title really contained the name.
  - 11 of 11 hits carried `/certificate/[token]` and the generic title: page view,
    engagement, a soft navigation out, and a full reload out with the certificate
    as `document.referrer`.
  - None matched the name, its base64 form, or the token.
- **2026-10-09, production with the real ID** (hits intercepted, so nothing reached GA):
  - `/verify?code=…` arrived as `/verify`.
  - The certificate route arrived scrubbed.
  - Our code pushes exactly one `page_view` per navigation.

---

## History

- **2026-10-06, launch** (academy #526, apex #36):
  - GA4 added behind the existing c15t gate, and the apex got its own banner.
  - Location-aware consent fixed a pre-existing bug: offline c15t had shown the
    UK opt-in banner to everyone, US included, so US visitors were never measured
    unless they clicked Accept.
  - `/privacy` widened to cover both sites.
- **2026-10-06, one-time side effect:**
  - c15t discards consent saved under an older policy, and the new location rules
    count as a new policy. So a US visitor who had clicked **Reject** on the old
    banner is now measured by default. With almost no traffic yet, that is
    realistically only the owner.
  - The owner's own browser briefly had two `_ga` IDs for the same reason.
- **2026-10-09, name leak found and fixed** (academy #529, apex #40):
  - **Since 2026-10-06, certificate pages had sent the learner's name to GA**: the
    `<title>` "<Name> · Verified Certificate…", and the path token, which is base64url
    JSON containing the name. `/verify?code=` sent a code that resolves to a name.
  - Exposure was 2026-10-06 to 2026-10-09, with near-zero traffic.
  - Fixed with manual, scrubbed page views (above).
  - Fixed in the same change: every event after GA loaded had re-sent a consent
    update. Now that happens only after a real revoke.
  - The same PRs added the learning, sharing, download, lead and engagement events.
- **2026-10-09, settings and Search Console:**
  - Turned off "page changes based on browser history events" (checked again after
    reloading). On production, one soft navigation produces one `page_view`.
  - Two traps that cost an afternoon, so nobody repeats them:
    - **The served tag's `"vtp_enableHistoryEvents": true` is NOT this setting.** It
      is GA's general history listener (`__ogt_auto_events`) and stays on. What the
      setting removes is the page view sent on a history change.
    - **An intercepted test can show the same hit twice.** GA re-sends its batch
      when the page unloads. Two `page_view` hits with the same `_s` (hit sequence)
      and `tfd` are one hit, not a double count. A genuine second page view has its
      own `_s`.
  - Added the Search Console Domain property (DNS TXT) and swapped the GA link to it.
  - Submitted the apex sitemap.

---

## Open

- **Share one consent decision across subdomains** (c15t `storageConfig.crossSubdomain`).
  This only works if every site running c15t switches together, the hex configurator
  included. Otherwise host-only and domain cookies shadow each other.
- **The hex configurator** (`hex.onethousanddrones.com`) has its own PostHog and no
  GA. Adding it to the same stream would complete the apex → academy → configurator
  journey.
