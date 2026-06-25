import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.url(),
    DIRECT_URL: z.url(),
    // Read-only Neon role for the standalone parts MCP server (Stage B). Optional:
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
    AUTH_RESEND_FROM: z.string().min(1).default("OTD Academy <login@onethousanddrones.com>"),
    ALLOWED_EMAILS: z.string().min(1),
    R2_ENABLED: z.coerce.boolean().default(false),
    R2_ACCOUNT_ID: z.string().optional(),
    R2_BUCKET: z.string().optional(),
    R2_ACCESS_KEY_ID: z.string().optional(),
    R2_SECRET_ACCESS_KEY: z.string().optional(),
    // Company name stamped into the KiCad export's schematic title block. Optional
    // (omitted from the title block if unset).
    KICAD_EXPORT_COMPANY: z.string().optional(),
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
  },
  runtimeEnv: {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
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
    R2_BUCKET: process.env.R2_BUCKET,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    KICAD_EXPORT_COMPANY: process.env.KICAD_EXPORT_COMPANY,
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
  },
});
