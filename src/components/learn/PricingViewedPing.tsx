"use client";

// Fires the top-of-buy-funnel `pricing_viewed` event on mount. The helper
// existed since the PostHog funnel shipped but had ZERO call sites, so the
// funnel's first measurable step was checkout_started — pricing→checkout
// drop-off (the core monetization question) was invisible. Renders nothing.
import { useEffect } from "react";
import { trackPricingViewed } from "@/lib/analytics-client";

export function PricingViewedPing() {
  useEffect(() => {
    trackPricingViewed();
  }, []);
  return null;
}
