// KiCad export coverage report (export-engine Task 6, design §3.5).
//
// 16 of 17 BOM parts have no curated CAD assets, so the export degrades
// gracefully (stub symbols/footprints — see `stubs.ts`). `EXPORT_REPORT.md`
// records, per part, the coverage of each asset kind so the learner sees
// exactly what is real vs. placeholder and what to fix before fabrication.
//
// PURE (no React/DB/env/network/fs) and DETERMINISTIC: same input → byte-identical
// markdown (parts are emitted in the order given; counts are stable).

/** Coverage state of one asset kind for one part. */
export type AssetStatus = "verified" | "unverified" | "stubbed" | "missing";

/** Per-part asset coverage row. `refDes` is the BOM line's (possibly grouped) designator string. */
export type PartCoverage = {
  mpn: string;
  refDes: string;
  symbol: AssetStatus;
  footprint: AssetStatus;
  model3d: AssetStatus;
};

export type BuildExportReportOpts = {
  /** Project name for the report heading (defaults to a generic title). */
  projectName?: string;
  /** A short generated-on / provenance note rendered under the heading. */
  generatedNote?: string;
};

const STATUSES: readonly AssetStatus[] = ["verified", "unverified", "stubbed", "missing"];

/** Count how many parts have `status` for the given asset selector. */
function countBy(
  parts: PartCoverage[],
  pick: (p: PartCoverage) => AssetStatus,
  status: AssetStatus,
): number {
  let n = 0;
  for (const p of parts) if (pick(p) === status) n++;
  return n;
}

/** One summary table row: the asset kind + its four status counts. */
function summaryRow(
  label: string,
  parts: PartCoverage[],
  pick: (p: PartCoverage) => AssetStatus,
): string {
  const cells = STATUSES.map((s) => countBy(parts, pick, s));
  return `| ${label} | ${cells.join(" | ")} |`;
}

/**
 * Build the `EXPORT_REPORT.md` markdown for a revision's BOM asset coverage:
 *   - a per-part table (MPN · ref des · symbol · footprint · 3D model),
 *   - a summary table counting verified/unverified/stubbed/missing per asset kind,
 *   - a legend explaining the four statuses.
 *
 * Deterministic: parts render in the supplied order; output is identical for
 * identical input.
 */
export function buildExportReport(
  parts: PartCoverage[],
  opts: BuildExportReportOpts = {},
): string {
  const title = opts.projectName
    ? `# Export coverage report — ${opts.projectName}`
    : `# Export coverage report`;

  const lines: string[] = [];
  lines.push(title);
  lines.push("");
  if (opts.generatedNote) {
    lines.push(opts.generatedNote);
    lines.push("");
  }
  lines.push(
    "This report lists the CAD-asset coverage for every part on the BOM. Parts",
  );
  lines.push(
    "marked **stubbed** received an auto-generated placeholder symbol/footprint so",
  );
  lines.push(
    "the KiCad project opens; replace them with verified assets before fabrication.",
  );
  lines.push("");

  // ── Per-part coverage ──
  lines.push("## Per-part coverage");
  lines.push("");
  lines.push("| MPN | Ref des | Symbol | Footprint | 3D model |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const p of parts) {
    lines.push(
      `| ${p.mpn} | ${p.refDes} | ${p.symbol} | ${p.footprint} | ${p.model3d} |`,
    );
  }
  lines.push("");

  // ── Summary ──
  lines.push("## Summary");
  lines.push("");
  lines.push("| Asset | Verified | Unverified | Stubbed | Missing |");
  lines.push("| --- | --- | --- | --- | --- |");
  lines.push(summaryRow("Symbol", parts, (p) => p.symbol));
  lines.push(summaryRow("Footprint", parts, (p) => p.footprint));
  lines.push(summaryRow("3D model", parts, (p) => p.model3d));
  lines.push("");

  // ── Legend ──
  lines.push("## Legend");
  lines.push("");
  lines.push("- **verified** — a curated asset that passed the Foundry verify gate.");
  lines.push("- **unverified** — an uploaded asset not yet verified; used as-is.");
  lines.push(
    "- **stubbed** — no asset; an auto-generated placeholder was synthesized (replace before fabrication).",
  );
  lines.push(
    "- **missing** — no asset and no stub emitted (3D models are optional and omitted when absent).",
  );

  return lines.join("\n") + "\n";
}
