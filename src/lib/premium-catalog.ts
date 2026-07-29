// How much premium content is actually live. Read by the /pricing storefront and
// by every SELL-side gate, so the button and the checkout can never disagree
// about whether there is anything to sell.
//
// Plain module (NOT "use server"): it is imported from a page AND from a
// "use server" file, which may export only async functions.
import { db } from "@/lib/db";

/**
 * Count of PREMIUM projects a buyer would actually gain access to today.
 *
 * Excludes archived projects and anything without a published revision -- an
 * unpublished project renders nothing to a learner regardless of entitlement.
 *
 * NOT cached: it gates money paths, and a stale positive would sell an empty
 * catalog for the length of the cache window. `Project.accessTier` is unindexed,
 * so this is a sequential scan over ~22 rows -- free at today's catalog size,
 * worth an index past a few hundred.
 */
export async function countPublishedPremiumProjects(): Promise<number> {
  return db.project.count({
    where: {
      accessTier: "PREMIUM",
      publishedRevisionId: { not: null },
      archivedAt: null,
    },
  });
}
