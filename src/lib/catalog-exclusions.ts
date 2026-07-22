// Slugs that exist as DB projects but must NEVER surface in the public catalog
// (the /courses skill-tree or the sitemap).
//
// Currently just the shared test fixture that prisma/seed.ts creates on LOCAL.
// It is not a real curriculum board, and only L1.01 is a free public course, so
// it must not render as a course. It is filtered at the QUERY layer rather than
// archived/retiered so the fixture row stays intact for the ~23 DB-backed tests
// that operate on it (see test-seed-fixture). It is not present on prod today;
// this is a belt-and-suspenders guard against a future leak.
export const NON_CATALOG_SLUGS = ["esp32-sensor-breakout"] as const;
