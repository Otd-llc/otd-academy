import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    // The DEV database — LOCAL Postgres since 2026-07-15 (was PROD Neon). The
    // Next app, scripts, and `pnpm db:seed` all resolve prod-vs-local through
    // these two, so pointing them at localhost is what keeps dev off the Neon
    // meters. See docs/plans/2026-07-15-dev-off-prod-local-postgres.md.
    DATABASE_URL: z.url(),
    DIRECT_URL: z.url(),
    // PROD Neon, reached only by the explicit escape hatches (`pnpm db:prod`,
    // `pnpm db:migrate:prod`, `pnpm db:pull-prod`). Optional: only those local
    // tooling paths read them — Vercel and CI must not be forced to define them,
    // and requiring them would break `next build` everywhere they are unset.
    PROD_DATABASE_URL: z.url().optional(),
    PROD_DIRECT_URL: z.url().optional(),
    // Supplied by Vercel: "production" | "preview" | "development", absent
    // everywhere else. Declared here because PRODUCTION BEHAVIOUR branches on it
    // -- it namespaces the abuse-limiter's Redis keys so Preview cannot drain
    // Prod's counters (src/lib/abuse-policy.ts) -- and a variable that decides
    // that should be listed among the things this app reads, not discovered by
    // grep.
    //
    // Deliberately a plain optional string rather than z.enum: the value comes
    // from the platform, and a schema that rejects a value Vercel decides to add
    // later would fail env validation at import and take the site down for a
    // naming change. Documented, not enforced.
    VERCEL_ENV: z.string().optional(),
    // Read-only role for the standalone parts MCP server (Stage B). Optional:
    // only that server reads it (asserting its own presence + that it differs from
    // DATABASE_URL at startup); the Next app never uses it, so requiring it would
    // break `next build` anywhere it is unset.
    PARTS_MCP_DATABASE_URL: z.url().optional(),
    AUTH_SECRET: z.string().min(32),
    AUTH_GOOGLE_ID: z.string().min(1),
    AUTH_GOOGLE_SECRET: z.string().min(1),
    // GitHub OAuth (sign-in provider #2). Required: all three providers ship
    // together, so a misconfigured deploy should fail loud at build rather than
    // silently drop the GitHub button. Callback:
    // https://academy.onethousanddrones.com/api/auth/callback/github
    AUTH_GITHUB_ID: z.string().min(1),
    AUTH_GITHUB_SECRET: z.string().min(1),
    // Email magic-link via the Auth.js Resend provider (sign-in provider #3).
    // AUTH_RESEND_KEY — Resend API key. AUTH_RESEND_FROM — verified sender; the
    // sending domain (onethousanddrones.com) must be verified in Resend.
    AUTH_RESEND_KEY: z.string().min(1),
    AUTH_RESEND_FROM: z
      .string()
      .min(1)
      .default("OTD Academy <login@onethousanddrones.com>"),
    ALLOWED_EMAILS: z.string().min(1),
    R2_ENABLED: z.coerce.boolean().default(false),
    R2_ACCOUNT_ID: z.string().optional(),
    // S3 endpoint override. UNSET in every real environment -- production and
    // dev both derive the endpoint from R2_ACCOUNT_ID below. It exists so CI can
    // point the same client at an S3-compatible server running as a service
    // container, which is what lets the live-integration suites run with no
    // Cloudflare credential anywhere near this PUBLIC repo's Actions secrets.
    // Setting it also switches the client to path-style addressing (see
    // src/lib/r2.ts): virtual-host style needs wildcard DNS, which a container
    // on localhost does not have.
    R2_ENDPOINT: z.string().url().optional(),
    R2_BUCKET: z.string().optional(),
    R2_ACCESS_KEY_ID: z.string().optional(),
    R2_SECRET_ACCESS_KEY: z.string().optional(),
    // Company name stamped into the KiCad export's schematic title block. Optional
    // (omitted from the title block if unset).
    KICAD_EXPORT_COMPANY: z.string().optional(),
    // Set by Vercel on every deploy; the commit the running build came from. The
    // KiCad export stamps its short form into the board title block's Comment1 so a
    // downloaded starter records which build produced it. Optional: unset locally,
    // in which case the comment is omitted rather than stamped with a lie.
    VERCEL_GIT_COMMIT_SHA: z.string().optional(),
    // Stripe (GTM Phase 3). OPTIONAL: the Stripe client is lazily constructed and
    // the payment paths throw a clear "not configured" only when called without a
    // key, so a build/CI with no keys must still pass.
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    // Affiliate referral URLs (GTM monetization). OPTIONAL: the affiliate CTA in a
    // guide card falls back to the plain vendor URL when unset, so the link works
    // (untracked) before you've joined the program and pasted your referral link.
    // PCBWAY_AFFILIATE_URL — your PCBWay referral/order link.
    // DIGIKEY_AFFILIATE_URL — your DigiKey affiliate deep link to digikey.com
    //   (the parts-cart CTA; distinct from the DIGIKEY_CLIENT_ID/SECRET API creds).
    // AMAZON_AFFILIATE_URL — your Amazon Associates link (e.g. an idea-list) for
    //   the lab-bench CTA on the REQUIREMENTS card.
    // AMAZON_ASSOCIATE_TAG — your Associates tracking tag (e.g. otdacademy-20),
    //   appended to per-item kit-block product links so purchases attribute to you.
    PCBWAY_AFFILIATE_URL: z.url().optional(),
    JLCPCB_AFFILIATE_URL: z.url().optional(),
    DIGIKEY_AFFILIATE_URL: z.url().optional(),
    AMAZON_AFFILIATE_URL: z.url().optional(),
    AMAZON_ASSOCIATE_TAG: z.string().optional(),
    // DigiKey Product Information API v4 (parts availability watchdog). OPTIONAL:
    // the refresh job + watchdog UI degrade gracefully (no-op / "unknown") when unset.
    DIGIKEY_CLIENT_ID: z.string().optional(),
    DIGIKEY_CLIENT_SECRET: z.string().optional(),
    DIGIKEY_API_BASE: z.url().optional(), // default api.digikey.com; set to sandbox to test
    // Shared secret the Vercel cron sends as `Authorization: Bearer` to the refresh route.
    CRON_SECRET: z.string().optional(),
    // Lifecycle email automation (Resend). OPTIONAL so a keyless build/CI passes.
    //   LAUNCH_WINDOW_END — ISO timestamp the 14-day All-Access Pass launch window
    //     closes. The launch-window sequence (5.x) only fires while now < this; if
    //     unset the launch-window sends are skipped (no fabricated urgency).
    //   REACTIVATION_DAYS — the "no progress for N days" threshold the build-along
    //     nudge + win-back triggers use. Default 7.
    //   LIFECYCLE_EMAIL_ENABLED — master kill-switch for the lifecycle cron. Default
    //     true; set to false to pause all lifecycle sends without un-scheduling the cron.
    LAUNCH_WINDOW_END: z.string().datetime().optional(),
    REACTIVATION_DAYS: z.coerce.number().int().positive().default(7),
    LIFECYCLE_EMAIL_ENABLED: z.coerce.boolean().default(true),
    //   LAUNCH_WINDOW_DAYS — length of the launch window in days, used to pace the
    //     four launch beats (5.1 open, 5.2 mid, 5.3 48h-left, 5.4 last call) off the
    //     window END so they never all fire on one tick. Default 14.
    LAUNCH_WINDOW_DAYS: z.coerce.number().int().positive().default(14),
    //   LIFECYCLE_RESEND_FROM — dedicated marketing sender, kept separate from the
    //     transactional AUTH_RESEND_FROM (login@) so a marketing complaint can't hurt
    //     sign-in deliverability. Verify this identity in Resend. Falls back to
    //     AUTH_RESEND_FROM when unset.
    LIFECYCLE_RESEND_FROM: z.string().min(1).optional(),
    //   LIFECYCLE_POSTAL_ADDRESS — physical mailing address in every lifecycle email
    //     footer (CAN-SPAM requires a valid postal address). Set the real registered
    //     address here.
    LIFECYCLE_POSTAL_ADDRESS: z
      .string()
      .min(1)
      .default("One Thousand Drones, LLC, Broken Arrow, OK 74012, USA"),
    // ── Signup abuse defense (docs/plans/2026-07-16-signup-abuse-defense-design.md) ──
    // Upstash Redis for the magic-link rate limiter. Names come from the Vercel
    // Marketplace integration (`otd-academy-ratelimit`), NOT the UPSTASH_REDIS_REST_*
    // names Redis.fromEnv() prefers — the client is constructed explicitly. This is the
    // WRITE token (READ_ONLY cannot INCR). OPTIONAL so a keyless build/CI passes; UNSET
    // IN PROD = the rate-limit floor is off (Turnstile still holds). Cross-validated
    // below (both-or-neither) in createFinalSchema.
    KV_REST_API_URL: z.url().optional(),
    KV_REST_API_TOKEN: z.string().min(1).optional(),
    // Cloudflare Turnstile (Layer 0 bot detection) — server-side verifier secret. Pairs
    // with NEXT_PUBLIC_TURNSTILE_SITE_KEY (both-or-neither, enforced below): site-set +
    // secret-unset waves everyone through, secret-set + site-unset denies everyone.
    // OPTIONAL so a keyless build/CI passes.
    TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
    // The magic:global:day HARD ceiling (design §7.3), env-overridable so it can be
    // raised at 3am without a code edit. OPTIONAL — the policy module supplies the
    // default when unset.
    MAGIC_GLOBAL_DAILY_CAP: z.coerce.number().int().positive().optional(),
    // Vercel Edge Config connection string — the runtime kill-switch store
    // (`defenseEnabled`, `turnstileInteractive`, design §12.1). Vercel injects it when
    // an Edge Config store is connected. OPTIONAL: absent → the flag reads default-on
    // (fail-safe), so the build works before the store exists.
    EDGE_CONFIG: z.string().min(1).optional(),
  },
  client: {
    // Public site origin used as the metadataBase for absolute SEO URLs
    // (canonical / OG / sitemap). OPTIONAL: layout.tsx falls back to the prod
    // origin when unset, so an unconfigured local/CI build never breaks.
    NEXT_PUBLIC_SITE_URL: z.url().optional(),
    // PostHog funnel instrumentation. OPTIONAL by design: when
    // NEXT_PUBLIC_POSTHOG_KEY is unset, both the client provider and the
    // server-side `capture()` helper become NO-OPS — so CI, tests, and any
    // unconfigured build run with analytics simply disabled (no init, no
    // network calls). The same public key is used by posthog-js (browser) and
    // posthog-node (server). HOST defaults to PostHog US cloud.
    NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1).optional(),
    NEXT_PUBLIC_POSTHOG_HOST: z.url().default("https://us.i.posthog.com"),
    // Cloudflare Turnstile site key (Layer 0 widget). Pairs with the server-side
    // TURNSTILE_SECRET_KEY (both-or-neither, enforced in createFinalSchema).
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1).optional(),
    // Public R2 custom-domain base (audit Phase 9), e.g. https://media.onethousanddrones.com.
    // OPTIONAL: unset → part-model/avatar URLs fall back to the Vercel fn proxies
    // (metered egress). Set once the R2 domain is provisioned; the URL builders
    // switch to direct zero-egress R2 URLs with no code change.
    NEXT_PUBLIC_R2_PUBLIC_BASE_URL: z.url().optional(),
    // Origin of the hex configurator that /hex embeds. OPTIONAL: unset → the
    // production demo. It exists so the frame can be pointed at a local Vite
    // build (http://localhost:5180) or a LAN address for handset testing.
    // Without it, every configurator-side change could only be exercised after
    // it was already in production, which is not a review loop.
    NEXT_PUBLIC_HEX_CONFIGURATOR_URL: z.url().optional(),
    // The embed kill switch. Set to "off" to make /hex's buttons plain
    // cross-origin links again, which is exactly the behaviour that shipped
    // before the frame existed.
    //
    // A BUILD-TIME variable, not an Edge Config flag, and that is a deliberate
    // trade. /hex is statically prerendered with no request-time read at all;
    // an Edge Config lookup would have to be awaited somewhere in the tree and
    // would turn a fully static public spec page dynamic, which costs more on
    // every visit than the flag saves on the one day it is used. The price is
    // that flipping it needs a redeploy rather than a `vercel edge-config
    // update`. Accepted: the fallback path is a link that already works, so the
    // failure this guards against degrades rather than breaks.
    NEXT_PUBLIC_HEX_EMBED: z.enum(["on", "off"]).default("on"),
  },
  runtimeEnv: {
    NEXT_PUBLIC_HEX_CONFIGURATOR_URL:
      process.env.NEXT_PUBLIC_HEX_CONFIGURATOR_URL,
    NEXT_PUBLIC_HEX_EMBED: process.env.NEXT_PUBLIC_HEX_EMBED,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_R2_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
    VERCEL_ENV: process.env.VERCEL_ENV,
    PROD_DATABASE_URL: process.env.PROD_DATABASE_URL,
    PROD_DIRECT_URL: process.env.PROD_DIRECT_URL,
    PARTS_MCP_DATABASE_URL: process.env.PARTS_MCP_DATABASE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID,
    AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET,
    AUTH_GITHUB_ID: process.env.AUTH_GITHUB_ID,
    AUTH_GITHUB_SECRET: process.env.AUTH_GITHUB_SECRET,
    AUTH_RESEND_KEY: process.env.AUTH_RESEND_KEY,
    AUTH_RESEND_FROM: process.env.AUTH_RESEND_FROM,
    ALLOWED_EMAILS: process.env.ALLOWED_EMAILS,
    R2_ENABLED: process.env.R2_ENABLED,
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
    R2_ENDPOINT: process.env.R2_ENDPOINT,
    R2_BUCKET: process.env.R2_BUCKET,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    KICAD_EXPORT_COMPANY: process.env.KICAD_EXPORT_COMPANY,
    VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    PCBWAY_AFFILIATE_URL: process.env.PCBWAY_AFFILIATE_URL,
    JLCPCB_AFFILIATE_URL: process.env.JLCPCB_AFFILIATE_URL,
    DIGIKEY_AFFILIATE_URL: process.env.DIGIKEY_AFFILIATE_URL,
    AMAZON_AFFILIATE_URL: process.env.AMAZON_AFFILIATE_URL,
    AMAZON_ASSOCIATE_TAG: process.env.AMAZON_ASSOCIATE_TAG,
    DIGIKEY_CLIENT_ID: process.env.DIGIKEY_CLIENT_ID,
    DIGIKEY_CLIENT_SECRET: process.env.DIGIKEY_CLIENT_SECRET,
    DIGIKEY_API_BASE: process.env.DIGIKEY_API_BASE,
    CRON_SECRET: process.env.CRON_SECRET,
    LAUNCH_WINDOW_END: process.env.LAUNCH_WINDOW_END,
    REACTIVATION_DAYS: process.env.REACTIVATION_DAYS,
    LIFECYCLE_EMAIL_ENABLED: process.env.LIFECYCLE_EMAIL_ENABLED,
    LAUNCH_WINDOW_DAYS: process.env.LAUNCH_WINDOW_DAYS,
    LIFECYCLE_RESEND_FROM: process.env.LIFECYCLE_RESEND_FROM,
    LIFECYCLE_POSTAL_ADDRESS: process.env.LIFECYCLE_POSTAL_ADDRESS,
    KV_REST_API_URL: process.env.KV_REST_API_URL,
    KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN,
    TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
    MAGIC_GLOBAL_DAILY_CAP: process.env.MAGIC_GLOBAL_DAILY_CAP,
    EDGE_CONFIG: process.env.EDGE_CONFIG,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  },
  // Cross-field validation the per-key schemas can't express (design §12.2, R2-3): each
  // pair is both-set-or-both-unset. Only meaningful server-side (the client validation
  // pass lacks the server vars), so guard on isServer.
  createFinalSchema: (shape, isServer) => {
    const schema = z.object(shape);
    if (!isServer) return schema;
    return schema
      .refine(
        (v) => Boolean(v.KV_REST_API_URL) === Boolean(v.KV_REST_API_TOKEN),
        {
          message:
            "KV_REST_API_URL and KV_REST_API_TOKEN must both be set or both unset (the Upstash rate limiter needs both).",
        },
      )
      .refine(
        (v) =>
          Boolean(v.TURNSTILE_SECRET_KEY) ===
          Boolean(v.NEXT_PUBLIC_TURNSTILE_SITE_KEY),
        {
          message:
            "TURNSTILE_SECRET_KEY and NEXT_PUBLIC_TURNSTILE_SITE_KEY must both be set or both unset (widget + verifier ship together).",
        },
      );
  },
});

// Production safety net (design §12.2): warn once at server startup when a prod deploy
// has NO abuse defense configured at all. WARN, not throw — a keyless preview/CI must
// still pass. The typeof-window guard short-circuits before any server-var access, so
// this stays client-safe.
if (
  typeof window === "undefined" &&
  process.env.VERCEL_ENV === "production" &&
  !process.env.TURNSTILE_SECRET_KEY &&
  !process.env.KV_REST_API_URL
) {
  console.warn(
    "[signup-abuse-defense] PRODUCTION DEPLOY IS UNPROTECTED: neither Cloudflare Turnstile nor the Upstash rate limiter is configured. Set TURNSTILE_SECRET_KEY + NEXT_PUBLIC_TURNSTILE_SITE_KEY and/or KV_REST_API_URL + KV_REST_API_TOKEN. See docs/plans/2026-07-16-signup-abuse-defense-design.md §12.2.",
  );
}
