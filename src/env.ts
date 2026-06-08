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
  },
  client: {
    // Public site origin used as the metadataBase for absolute SEO URLs
    // (canonical / OG / sitemap). OPTIONAL: layout.tsx falls back to the prod
    // origin when unset, so an unconfigured local/CI build never breaks.
    NEXT_PUBLIC_SITE_URL: z.url().optional(),
  },
  runtimeEnv: {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
    PARTS_MCP_DATABASE_URL: process.env.PARTS_MCP_DATABASE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID,
    AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET,
    ALLOWED_EMAILS: process.env.ALLOWED_EMAILS,
    R2_ENABLED: process.env.R2_ENABLED,
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
    R2_BUCKET: process.env.R2_BUCKET,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    KICAD_EXPORT_COMPANY: process.env.KICAD_EXPORT_COMPANY,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  },
});
