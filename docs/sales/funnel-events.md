# Funnel instrumentation — event map

PostHog funnel events for One Thousand Drones Academy. This is the canonical map
from each funnel-scorecard stage to its event name and the exact place it fires.

## Configuration

Analytics is **OPTIONAL and off by default**. It turns on only when
`NEXT_PUBLIC_POSTHOG_KEY` is set (see `.env.local.example`):

- **Unset** → both the browser provider (`src/components/PostHogProvider.tsx`)
  and the server `capture()` helper (`src/lib/analytics.ts`) are **no-ops**. No
  init, no network calls. CI, tests, and unconfigured builds run unaffected.
- **Set** → `posthog-js` (browser pageviews + client funnel helpers) and
  `posthog-node` (server-side funnel events) both use the same public key.
  Host defaults to `https://us.i.posthog.com` (`NEXT_PUBLIC_POSTHOG_HOST`).

Every server-side `capture()` call is wrapped in `try/catch` at the call site so
a telemetry failure can never block or break the request that fired it. Events
fire **after** the state mutation they describe.

## Scorecard → event map

| Funnel stage            | Event                 | Fires where (file · function)                                                      | distinctId        | Notes |
|-------------------------|-----------------------|------------------------------------------------------------------------------------|-------------------|-------|
| Visit (any page)        | `$pageview`           | `src/components/PostHogProvider.tsx` · on pathname/search change (SPA-aware)        | posthog anon/user | Auto on every route change; built-in capture is disabled and re-emitted manually because App Router navigations aren't full page loads. |
| Pricing / paywall view  | `pricing_viewed`      | `src/lib/analytics-client.ts` · `trackPricingViewed()` (client helper)             | posthog anon/user | Call from the pricing/paywall surface on mount. Does not require a `/pricing` route to exist. |
| CTA click               | `cta_clicked`         | `src/lib/analytics-client.ts` · `trackCtaClicked(cta, …)` (client helper)          | posthog anon/user | Wire onto funnel buttons (Unlock/Enroll/Buy). `cta` names the button. |
| Lead captured (email)   | `email_captured`      | `src/auth.ts` · `events.createUser`, `src/lib/actions/waitlist.ts` · `joinWaitlist`, `src/lib/actions/pass-waitlist.ts` · `joinPassWaitlist` | user / anon | `source: "signup"` \| `"waitlist"` \| `"pass_waitlist"`. Each fires once (first time only). Anonymous fires mint a unique anon distinct id. NO raw email in props (PII stays out of analytics; the DB row holds the address). |
| Sign-up                 | `signed_up`           | `src/auth.ts` · `events.createUser`                                                | user              | Auth.js `createUser` fires exactly once when the Prisma adapter creates the User row — the authoritative first sign-in. |
| Lesson started          | `lesson_started`      | `src/lib/actions/enrollment.ts` · `enroll`                                          | user              | Fires only on **first** enrollment (existence checked inside the same Serializable tx), not on idempotent re-enroll. |
| **Board activated**     | `board_activated`     | `src/lib/actions/enrollment.ts` · `advanceEnrollment` (after a learner's successful advance OUT of `DRC_GERBER`) | user | **The leverage metric.** Hooked on the learner's own gated advance through `learnerExitGate`, so it counts a real per-learner activation (clean DRC + valid gerbers submitted), not a curriculum-authoring event. Carries `{ board_slug, level }`. |
| Checkout started        | `checkout_started`    | `src/lib/actions/checkout.ts` · `createCheckoutSession`                             | user              | After the Stripe Checkout session is created, before redirect. |
| Purchase completed      | `purchase_completed`  | `src/app/api/stripe/webhook/route.ts` · `POST` (after the entitlement upsert)       | user              | Fired on the **source-of-truth grant path** (verified `checkout.session.completed`), never on the client redirect. |
| Certificate shared      | `certificate_shared`  | `src/lib/actions/certificate.ts` · `createCertificateShareToken`                   | user              | Fires when a learner mints a shareable certificate/completion card (advocacy signal). Carries `{ slug, variant }`. |

## Notes for maintainers

- **Add new events through `capture()`** (`src/lib/analytics.ts`) on the server,
  or the `analytics-client.ts` helpers on the client — never call the SDK
  directly, so the no-op-when-disabled guarantee holds everywhere.
- **`board_activated` is deliberately single-sourced** in `advanceEnrollment`
  (the learner gate). It must count a learner passing the DRC/gerber gate, not the
  admin `advanceStage` curriculum-authoring transition. If the activation
  definition ever needs to change, change it there; do not add a parallel emitter.
- The exam-pass / `MASTERED` transition (`src/lib/actions/exam.ts` · `submitExam`)
  is **not** currently a scorecard funnel stage — certificate minting is the
  tracked advocacy signal. Add an event there if mastery becomes a scorecard row.
