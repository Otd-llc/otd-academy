-- Guarantee a Part's cached DigiKey snapshot can never outlive its identity.
--
-- DigiKey data (dkPartNumber → FastAdd cart, dkInStock/dkStockQty, dkUnitPriceCents,
-- dkLifecycle, dkProductUrl) is RESOLVED from the part's mpn. When a part is swapped
-- to a new mpn/manufacturer — via an app action, a seed, a script, or raw SQL — that
-- snapshot is stale (it describes the OLD part), so the cart/price/stock would point
-- at the pre-swap part. App-layer hooks can't cover "for any reason"; enforce it at
-- the data layer with a BEFORE UPDATE trigger that clears the snapshot in the same
-- write whenever identity changes. The nightly availability watchdog re-resolves
-- cleared parts FIRST (it orders by dkCheckedAt nulls-first), so they self-heal — and
-- until then the UI shows "not yet checked" (honest absence), never stale data.

CREATE OR REPLACE FUNCTION clear_digikey_on_part_identity_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."mpn" IS DISTINCT FROM OLD."mpn"
     OR NEW."manufacturer" IS DISTINCT FROM OLD."manufacturer" THEN
    NEW."dkStockQty"       := NULL;
    NEW."dkUnitPriceCents" := NULL;
    NEW."dkInStock"        := NULL;
    NEW."dkLifecycle"      := NULL;
    NEW."dkProductUrl"     := NULL;
    NEW."dkPartNumber"     := NULL;
    NEW."dkCheckedAt"      := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS part_identity_clears_digikey ON "Part";
CREATE TRIGGER part_identity_clears_digikey
  BEFORE UPDATE ON "Part"
  FOR EACH ROW
  EXECUTE FUNCTION clear_digikey_on_part_identity_change();
