import { describe, it, expect } from "vitest";
import {
  byClusterThenOrdinal,
  bucketByCluster,
  OTHER_CLUSTER_KEY,
} from "@/lib/library/cluster-order";

type Row = { slug: string; cluster: string | null; clusterOrdinal: number };

const row = (slug: string, cluster: string | null, clusterOrdinal: number): Row => ({
  slug,
  cluster,
  clusterOrdinal,
});

describe("byClusterThenOrdinal", () => {
  it("orders fundamentals (registry order 0) before eeg-bci (order 1)", () => {
    const rows = [
      row("eeg-a", "eeg-bci", 0),
      row("fund-b", "fundamentals", 1),
      row("fund-a", "fundamentals", 0),
      row("eeg-b", "eeg-bci", 1),
    ];
    expect(byClusterThenOrdinal(rows).map((r) => r.slug)).toEqual([
      "fund-a",
      "fund-b",
      "eeg-a",
      "eeg-b",
    ]);
  });

  it("cross-cluster order is registry `order`, NOT the alphabetical cluster string", () => {
    // "eeg-bci" < "fundamentals" alphabetically, but fundamentals must come first.
    const rows = [row("e", "eeg-bci", 0), row("f", "fundamentals", 0)];
    expect(byClusterThenOrdinal(rows).map((r) => r.slug)).toEqual(["f", "e"]);
  });

  it("a null/unknown cluster sorts to the trailing rank without throwing or NaN", () => {
    const rows = [
      row("nullish", null, 0),
      row("unknown", "made-up-cluster", 0),
      row("eeg", "eeg-bci", 0),
      row("fund", "fundamentals", 0),
    ];
    const ordered = byClusterThenOrdinal(rows).map((r) => r.slug);
    expect(ordered.slice(0, 2)).toEqual(["fund", "eeg"]);
    // null + unknown both trail; relative input order preserved (stable).
    expect(ordered.slice(2)).toEqual(["nullish", "unknown"]);
  });

  it("reproduces the frozen eeg-bci arc from clusterOrdinal alone (matches the old byNarrativeOrder)", () => {
    const arc = [
      "what-is-a-bci",
      "what-is-eeg",
      "eeg-bci-guide",
      "eeg-frequency-bands",
      "motor-imagery-bci",
      "eeg-electrodes-10-20-system",
      "eeg-safety-and-isolation",
      "biopotential-afe",
      "ads1299-explained",
      "eeg-noise-and-right-leg-drive",
      "eeg-classification-csp-eegnet",
      "control-a-drone-with-your-brain",
    ];
    const shuffled = arc
      .map((slug, i) => row(slug, "eeg-bci", i))
      .reverse();
    expect(byClusterThenOrdinal(shuffled).map((r) => r.slug)).toEqual(arc);
  });
});

describe("bucketByCluster", () => {
  it("buckets in registry order, sorts within a bucket by clusterOrdinal", () => {
    const rows = [
      row("eeg-b", "eeg-bci", 1),
      row("fund-b", "fundamentals", 1),
      row("eeg-a", "eeg-bci", 0),
      row("fund-a", "fundamentals", 0),
    ];
    const buckets = bucketByCluster(rows);
    expect([...buckets.keys()]).toEqual(["fundamentals", "eeg-bci", OTHER_CLUSTER_KEY]);
    expect(buckets.get("fundamentals")!.map((r) => r.slug)).toEqual(["fund-a", "fund-b"]);
    expect(buckets.get("eeg-bci")!.map((r) => r.slug)).toEqual(["eeg-a", "eeg-b"]);
    expect(buckets.get(OTHER_CLUSTER_KEY)).toEqual([]);
  });

  it("routes null and unknown-cluster rows into the 'other' bucket", () => {
    const rows = [row("n", null, 0), row("u", "nope", 0), row("f", "fundamentals", 0)];
    const buckets = bucketByCluster(rows);
    expect(buckets.get("fundamentals")!.map((r) => r.slug)).toEqual(["f"]);
    expect(buckets.get(OTHER_CLUSTER_KEY)!.map((r) => r.slug)).toEqual(["n", "u"]);
  });
});
