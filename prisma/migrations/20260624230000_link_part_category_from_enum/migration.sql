-- Keep a Part's Category-TREE link (categoryId) in sync with its legacy PartCategory
-- enum, automatically, for ANY write path — app action, seed script, raw SQL, import.
--
-- Why: every Part carries BOTH the legacy `category` enum (e.g. MLCC_CAPACITOR) and an
-- optional `categoryId` into the newer Category tree. `categoryLabel()` prefers the tree
-- name (`categoryRef?.name`) and falls back to the raw enum token — so a part that has
-- the enum but no tree link renders the ugly raw "MLCC_CAPACITOR" instead of the human
-- "MLCC Capacitors", inconsistent with its siblings. Seed scripts / bulk writes routinely
-- set the enum but forget the link → drift. App-layer hooks can't cover "for any reason";
-- enforce it at the data layer, exactly like part_identity_clears_digikey.
--
-- The 6 migrated tree leaves carry `Category.slug = <enum token>`, so the enum→leaf map is
-- simply `Category.slug = category::text`.
--
-- Rule: AUTO-FILL categoryId from the enum ONLY when categoryId IS NULL. Never override an
-- explicit tree link — a deliberately finer/different node wins (and categoryRef wins
-- display anyway). Enum null, or no matching leaf (a future enum not yet in the tree) →
-- leave categoryId untouched (honest absence, never fabricated).

CREATE OR REPLACE FUNCTION link_part_category_from_enum()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."categoryId" IS NULL AND NEW."category" IS NOT NULL THEN
    SELECT "id" INTO NEW."categoryId"
    FROM "Category"
    WHERE "slug" = NEW."category"::text;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS part_category_link_from_enum ON "Part";
CREATE TRIGGER part_category_link_from_enum
  BEFORE INSERT OR UPDATE ON "Part"
  FOR EACH ROW
  EXECUTE FUNCTION link_part_category_from_enum();

-- One-shot backfill of any existing drift (idempotent; the explicit SET means the trigger
-- short-circuits on these rows).
UPDATE "Part" p
SET "categoryId" = c."id"
FROM "Category" c
WHERE p."categoryId" IS NULL
  AND p."category" IS NOT NULL
  AND c."slug" = p."category"::text;
