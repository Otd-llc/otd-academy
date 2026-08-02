// robots.txt for the public SEO surface.
//
// Next App Router serves this at `/robots.txt`. Server-evaluated (no
// "use client").
//
// Disallow:
//   - `/api/`     — JSON endpoints, never content to index.
//   - `/learn`    — the signed-in learner area (auth-gated, no public content).
//   - `/projects` — the operator/authoring shells (project/revision/build pages),
//                   which only 307→/sign-in for crawlers and otherwise add
//                   redirect/soft-404 noise to Search Console.
//
// CRUCIAL: the PUBLIC guide lessons ALSO live under `/projects` (at
// `/projects/[slug]/[revLabel]/guide…`) and MUST stay crawlable — they are the
// whole point of the SEO surface. So we re-`allow` the `/projects/*/*/guide`
// subtree; a more-specific `allow` wins over a broader `disallow` (Google's
// longest-match rule). The sitemap also lists those URLs explicitly as a backstop.
import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/seo/jsonld";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/projects/*/*/guide"],
      // `/c/` carries the TRAILING SLASH deliberately. Disallow is a prefix
      // match, so a bare `/c` would also de-index `/courses`, `/courses/*` and
      // `/checkout/success`. Those pages are unlisted records reached by an
      // unguessable token off a printed sheet; they are noindex as well.
      disallow: ["/api/", "/learn", "/projects", "/c/", "/account"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
