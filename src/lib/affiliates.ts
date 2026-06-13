// Central affiliate-link config (GTM monetization). The course features ONE board
// house (PCBWay), ONE parts distributor (Newark), and Amazon for the lab-bench
// kit; their referral URLs live in env (set after signing up to each program —
// see `src/env.ts`). Each falls back to the plain vendor URL, so a CTA always
// works — just untracked — before the IDs are in place. SERVER module (read by the
// server-rendered guide CTA); the href is public once rendered, but resolving it
// here keeps the affiliate IDs in env, never in guide content.
import { env } from "@/env";

export type AffiliateVendor = "pcbway-order" | "newark-bom" | "amazon-bench";

export interface AffiliateLink {
  href: string;
  /** True once a referral URL is configured in env — i.e. the link is earning. */
  tracked: boolean;
}

// Plain vendor destinations used until a referral URL is configured in env.
const FALLBACK: Record<AffiliateVendor, string> = {
  "pcbway-order": "https://www.pcbway.com/orderonline.aspx",
  "newark-bom": "https://www.newark.com/",
  "amazon-bench": "https://www.amazon.com/",
};

const CONFIGURED: Record<AffiliateVendor, string | undefined> = {
  "pcbway-order": env.PCBWAY_AFFILIATE_URL,
  "newark-bom": env.NEWARK_AFFILIATE_URL,
  "amazon-bench": env.AMAZON_AFFILIATE_URL,
};

/** Resolve a vendor key to its (configured-or-fallback) outbound link. */
export function affiliateLink(vendor: AffiliateVendor): AffiliateLink {
  const configured = CONFIGURED[vendor];
  return {
    href: configured ?? FALLBACK[vendor],
    tracked: Boolean(configured),
  };
}

/** Build a tagged Amazon product link from an ASIN (kit blocks). The associate
 *  tag lives in env (AMAZON_ASSOCIATE_TAG), never in content — without it the
 *  link still works, just untracked. Post-April-2026, attribution is per-ASIN,
 *  so these specific product links are how the kit actually earns. */
export function amazonProductLink(asin: string): AffiliateLink {
  const tag = env.AMAZON_ASSOCIATE_TAG;
  const base = `https://www.amazon.com/dp/${encodeURIComponent(asin)}/`;
  return {
    href: tag ? `${base}?tag=${encodeURIComponent(tag)}` : base,
    tracked: Boolean(tag),
  };
}
