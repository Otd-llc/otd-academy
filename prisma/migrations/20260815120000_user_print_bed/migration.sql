-- Print bed size in millimetres for hex-cluster downloads. The pack endpoint lays
-- parts out on a bed; without a stored size every device has to be told again, and
-- the "220 here, 350 there" answer differs per browser. Both null = no stored
-- choice, which is the state every existing row starts in and the state the
-- account UI can return to, so the resolver falls through to localStorage and then
-- to the shipped default.
--
-- Two nullable INTEGERs, not a prefs JSON: the pair is read together and never
-- partially, and a typed column cannot drift. No CHECK constraint on the range --
-- BED_MIN/BED_MAX live in src/lib/hex-pack.ts and are shared by the endpoint and
-- the settings action, and a second copy here would drift into a bed the page
-- accepts and the endpoint refuses. Additive, nullable, non-breaking.
ALTER TABLE "User" ADD COLUMN "printBedXMm" INTEGER;
ALTER TABLE "User" ADD COLUMN "printBedYMm" INTEGER;
