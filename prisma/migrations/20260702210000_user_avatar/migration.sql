-- Custom uploaded avatar marker. Presence = the user has a custom avatar at the
-- deterministic R2 key avatars/{id}.webp (served via /api/avatar/{id}); the
-- timestamp doubles as a cache-bust version. Null = fall back to the sign-in
-- provider image / initial. Additive, nullable, non-breaking.
ALTER TABLE "User" ADD COLUMN "avatarUpdatedAt" TIMESTAMP(3);
