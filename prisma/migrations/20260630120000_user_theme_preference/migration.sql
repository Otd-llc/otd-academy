-- Signed-in UI theme preference. Nullable (null = follow the device: theme
-- cookie / prefers-color-scheme). Additive, non-breaking.
ALTER TABLE "User" ADD COLUMN "theme" TEXT;
