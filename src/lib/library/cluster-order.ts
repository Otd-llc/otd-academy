// Ordering + grouping for the clustered public Library. Replaces the retired
// narrative-order.ts: the within-cluster arc now lives in the `clusterOrdinal`
// column (backfilled by 20260707120000_minilesson_cluster), and cross-cluster
// order comes from the LIBRARY_CLUSTERS registry `order`, NOT the alphabetical
// `cluster` string. Pure over rows (no DB) so it is unit-testable.
import { LIBRARY_CLUSTERS, clusterByKey } from "@/lib/library/clusters";

// The trailing bucket for rows whose cluster is null or an unknown key. A
// null-cluster lesson must never disappear from the landing (§4.1), so it is
// grouped here rather than dropped. NOT a real `cluster` value — a row's
// `cluster` stays null; this key only exists in the in-memory grouping.
export const OTHER_CLUSTER_KEY = "other";

type Clusterable = { cluster: string | null; clusterOrdinal: number };

// Cross-cluster order = registry `order`; within-cluster order = `clusterOrdinal`.
// A null/unknown cluster gets a defined TRAILING rank — NEVER dereference
// `clusterByKey(...).order` directly (undefined would throw, and `undefined - n`
// is NaN, which corrupts the whole sort). Stable: equal keys keep input order.
export function byClusterThenOrdinal<T extends Clusterable>(rows: T[]): T[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const ra = clusterByKey(a.row.cluster)?.order ?? Number.POSITIVE_INFINITY;
      const rb = clusterByKey(b.row.cluster)?.order ?? Number.POSITIVE_INFINITY;
      if (ra !== rb) return ra - rb;
      if (a.row.clusterOrdinal !== b.row.clusterOrdinal)
        return a.row.clusterOrdinal - b.row.clusterOrdinal;
      return a.index - b.index;
    })
    .map((e) => e.row);
}

// Group rows into per-cluster buckets in registry order, plus a trailing "other"
// bucket for null/unknown-cluster rows. Every registry cluster gets a bucket (may
// be empty, so the landing can iterate a deterministic order); each bucket is
// sorted by `clusterOrdinal`. The landing renders non-empty buckets and only
// gives registry clusters (not "other") a Field Guide download.
export function bucketByCluster<T extends Clusterable>(rows: T[]): Map<string, T[]> {
  const buckets = new Map<string, T[]>();
  for (const c of LIBRARY_CLUSTERS) buckets.set(c.key, []);
  buckets.set(OTHER_CLUSTER_KEY, []);
  for (const row of rows) {
    const key = clusterByKey(row.cluster) ? (row.cluster as string) : OTHER_CLUSTER_KEY;
    buckets.get(key)!.push(row);
  }
  for (const list of buckets.values()) {
    list.sort((a, b) => a.clusterOrdinal - b.clusterOrdinal);
  }
  return buckets;
}
