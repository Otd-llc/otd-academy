-- Purchase.stripePaymentIntentId is the PRIMARY refund-correlation key (the
-- schema already said so), but it was never indexed: the only indexes on
-- Purchase were (userId) and (entitlementId). Both refund branches of the Stripe
-- webhook look a Purchase up by it --
--   charge.refunded  -> findFirst({ where: { stripePaymentIntentId } })
--   refund.created   -> findFirst({ where: { stripePaymentIntentId } })
-- so every refund event sequentially scanned the whole Purchase table, inside a
-- transaction Stripe retries if it times out.
--
-- Plain CREATE INDEX, not CONCURRENTLY: prisma migrate deploy applies each
-- migration in a transaction and CONCURRENTLY cannot run inside one. Same
-- reasoning as 20260722060000_xpevent_composite_index; the table is small and
-- the brief lock is fine.
--
-- Nullable column (the $0 upgrade grant writes a Purchase with no Stripe
-- session), so this is a plain non-unique index -- NULLs are simply not useful
-- lookup keys and are never queried for.
CREATE INDEX "Purchase_stripePaymentIntentId_idx"
  ON "Purchase" ("stripePaymentIntentId");
