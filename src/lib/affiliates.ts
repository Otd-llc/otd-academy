// Central affiliate-link config (GTM monetization). The course features ONE board
// house (PCBWay) and ONE parts distributor (Newark); their referral URLs live in
// env (set after signing up to each program — see `src/env.ts`). Each falls back
// to the plain vendor URL, so a CTA always works — just untracked — before the IDs
// are in place. SERVER module (read by the server-rendered guide CTA); the href is
// public once rendered, but resolving it here keeps the affiliate IDs in env, never
// in guide content.
import { env } from "@/env";

export type AffiliateVendor = "pcbway-order" | "newark-bom";

export interface AffiliateLink {
  href: string;
  /** True once a referral URL is configured in env — i.e. the link is earning. */
  tracked: boolean;
}

// Plain vendor destinations used until a referral URL is configured in env.
const FALLBACK: Record<AffiliateVendor, string> = {
  "pcbway-order": "https://www.pcbway.com/orderonline.aspx",
  "newark-bom": "https://www.newark.com/",
};

/** Resolve a vendor key to its (configured-or-fallback) outbound link. */
export function affiliateLink(vendor: AffiliateVendor): AffiliateLink {
  const configured =
    vendor === "pcbway-order"
      ? env.PCBWAY_AFFILIATE_URL
      : env.NEWARK_AFFILIATE_URL;
  return {
    href: configured ?? FALLBACK[vendor],
    tracked: Boolean(configured),
  };
}
