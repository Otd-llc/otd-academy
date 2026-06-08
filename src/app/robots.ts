// robots.txt for the public SEO surface.
//
// Next App Router serves this at `/robots.txt`. Server-evaluated (no
// "use client").
//
// We allow the whole site and only disallow:
//   - `/api/` — JSON endpoints, never content to index.
//   - `/learn` — the signed-in learner area (auth-gated, no public content).
//
// IMPORTANT: we deliberately do NOT disallow `/projects`. The PUBLIC guide
// lessons live under `/projects/[slug]/[revLabel]/guide` and MUST stay
// crawlable — they are the entire point of the SEO surface. Operator project
// pages (e.g. `/projects/[slug]` and its editor subroutes) are already kept from
// crawlers by the auth redirect in middleware (anonymous hits → /sign-in), so no
// robots disallow is needed for them; adding `/projects` here would instead
// block the public lessons from indexing.
import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/seo/jsonld";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/learn"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
