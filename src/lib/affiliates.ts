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
