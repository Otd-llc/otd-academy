"use client";

// Reports a confirmed Stripe purchase to GA4 from /checkout/success. Renders
// nothing. The page has already verified the session with Stripe server-side
// (payment_status paid / no_payment_required) before it renders this, so the
// event is never sent for an unpaid or forged session id.
//
// The webhook stays the source of truth for the GRANT and for PostHog's
// purchase_completed; this exists only because GA4 has no server path here.
import { useEffect } from "react";
import { trackPurchase } from "@/lib/analytics-client";

export function PurchasePing(props: {
  transactionId: string;
  value: number;
  currency: string;
  itemId: string;
}) {
  const { transactionId, value, currency, itemId } = props;
  useEffect(() => {
    trackPurchase({ transactionId, value, currency, itemId });
  }, [transactionId, value, currency, itemId]);
  return null;
}
