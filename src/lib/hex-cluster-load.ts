import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { ONE_HOUR, hexClusterTag } from "@/lib/cache-profile";
import {
  SHARE_CODE_LENGTH,
  formatDrawingLabel,
  formatRevLabel,
} from "@/lib/hex-cluster";
import type { StoredSummary } from "@/lib/hex-cluster";

// Reading one saved cluster for its public /c/ page.
//
// A `use cache` function may not read the session — this one does not, and must
// not: the page is what a printed QR resolves to, so it renders the same for
// everyone.

export interface PublicCluster {
  drawingLabel: string;
  revLabel: string;
  /** The name AT SAVE, from the immutable revision — not the drawing's current
   *  name. The page exists so a reader can compare it against paper, and paper
   *  says what the name was when it was printed. The account list is where a
   *  rename should be visible. */
  nameAtSave: string;
  savedAt: string;
  summary: StoredSummary;
  archived: boolean;
  /** The full payload, so "Open in the configurator" can carry it. */
  payload: string;
  payloadHash: string;
  shareCode: string;
}

export type ClusterLookup =
  | { outcome: "hit"; cluster: PublicCluster }
  | { outcome: "archived" }
  | { outcome: "account-deleted"; cluster: PublicCluster }
  | { outcome: "unknown-code" };

/**
 * Look one share code up.
 *
 * The membership check on the code's SHAPE is not redundant with the query — it
 * is what bounds the cache. `use cache` keys on arguments and the route param
 * matches any string, so without it a scanner spraying paths mints one cache
 * entry and one DB query per distinct nonsense path.
 *
 * ONE tag, cluster-level. Revisions are immutable, and every event that changes
 * this render — archive, unarchive, account deletion — is cluster-level. A
 * per-revision tag would also have left 99 stale pages after archiving a
 * 100-revision cluster.
 */
export async function loadClusterByShareCode(
  shareCode: string,
): Promise<ClusterLookup> {
  if (
    !/^[0-9A-Za-z]+$/.test(shareCode) ||
    shareCode.length !== SHARE_CODE_LENGTH
  ) {
    return { outcome: "unknown-code" };
  }
  return cachedCluster(shareCode);
}

async function cachedCluster(shareCode: string): Promise<ClusterLookup> {
  "use cache";
  cacheLife(ONE_HOUR);

  const row = await db.hexClusterRevision.findUnique({
    where: { shareCode },
    select: {
      revNo: true,
      createdAt: true,
      summary: true,
      payload: true,
      payloadHash: true,
      shareCode: true,
      cluster: {
        select: {
          id: true,
          drawingNo: true,
          name: true,
          archivedAt: true,
          userId: true,
        },
      },
    },
  });
  if (!row) return { outcome: "unknown-code" };

  // Tagged AFTER the lookup, because the tag needs the cluster id. Everything
  // that can change this page fires it.
  cacheTag(hexClusterTag(row.cluster.id));

  if (row.cluster.archivedAt) return { outcome: "archived" };

  const summary = row.summary as unknown as StoredSummary;
  const cluster: PublicCluster = {
    drawingLabel: formatDrawingLabel(row.cluster.drawingNo),
    revLabel: formatRevLabel(row.revNo),
    // The scrub in deleteStudent cannot reach summary.nameAtSave — it is frozen
    // inside an immutable revision, and rewriting it would break "never
    // UPDATEd". So fall back to the cluster's name whenever userId is null,
    // which is exactly the deleted case: revisions stay immutable, and the
    // public page stops showing a deleted user's title.
    nameAtSave:
      row.cluster.userId === null
        ? row.cluster.name
        : (summary?.nameAtSave ?? row.cluster.name),
    savedAt: row.createdAt.toISOString(),
    summary,
    archived: false,
    payload: row.payload,
    payloadHash: row.payloadHash,
    shareCode: row.shareCode,
  };

  if (row.cluster.userId === null)
    return { outcome: "account-deleted", cluster };
  return { outcome: "hit", cluster };
}
