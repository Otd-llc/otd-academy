// Inbound-dependents advisory rendered inside the regress confirm modal
// (Task 12.8 / proposal §3.1).
//
// Pure, no hooks — split into its own module so the render-walk test can
// import it without pulling the server-action / next-auth chain that
// `StageActions.tsx` brings in.

export type RegressAtRiskEntry = { slug: string; name: string };

export function RegressAtRiskBanner({
  atRisk,
}: {
  atRisk: RegressAtRiskEntry[];
}) {
  if (atRisk.length === 0) return null;
  return (
    <div className="my-3 rounded border border-alert-red bg-navy-dark px-3 py-2 font-mono text-sm font-bold text-alert-red">
      Regressing past {atRisk.length} downstream dependent
      {atRisk.length === 1 ? "" : "s"} who will need to re-validate:{" "}
      {atRisk.map((p) => p.slug).join(", ")}. Continue?
    </div>
  );
}
