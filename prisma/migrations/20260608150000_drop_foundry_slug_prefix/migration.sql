-- Brand cleanup: drop the legacy `foundry-` codename prefix from project slugs.
--
-- Project slugs are PUBLIC URLs. The product was renamed "Project Foundry" →
-- "One Thousand Drones Academy"; the `foundry-` prefix is the stale codename.
-- This strips ONLY the leading `foundry-` token, preserving the rest of each
-- slug (e.g. `foundry-l1-01-wroom-breakout` → `l1-01-wroom-breakout`). Old URLs
-- are kept alive by a 308 redirect in middleware (src/proxy.ts). Idempotent: the
-- WHERE clause matches only un-migrated rows, so re-running is a no-op.
UPDATE "Project" SET slug = regexp_replace(slug, '^foundry-', '') WHERE slug LIKE 'foundry-%';
