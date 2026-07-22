-- Billing reporting truth (audit Phase 5).
--
-- livemode: /admin/billing summed every row with no test/live dimension, so the
-- admin StartTestSubscriptionButton (and any test-mode webhook delivery) inflated
-- MRR / gross revenue / purchase counts with fake money. DEFAULT true: every
-- existing row came from the live webhook (test-mode subs were cancelled and the
-- live $1 smoke purchase was live-mode).
ALTER TABLE "Purchase"     ADD COLUMN "livemode" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Subscription" ADD COLUMN "livemode" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Invoice"      ADD COLUMN "livemode" BOOLEAN NOT NULL DEFAULT true;

-- Subscriber-priced MRR: the report multiplied active subs by the CURRENT
-- catalog price (Bundle.subscriptionPriceCents) and assumed a monthly interval,
-- misstating MRR for grandfathered prices and overstating annual subs 12x.
-- Store what each subscriber actually pays, stamped from the Stripe price on
-- every subscription upsert. Nullable: rows written before this column backfill
-- on their next webhook update; the metric falls back to the catalog price for
-- null rows (and says so).
ALTER TABLE "Subscription" ADD COLUMN "priceCents" INTEGER;
ALTER TABLE "Subscription" ADD COLUMN "interval" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'usd';
