"use client";

// Derive-rails button (design §4 / Task 3). Calls the `deriveRails` form-wrapper
// for the revision, then surfaces the returned summary — how many nets + nodes
// THIS invocation created, and the set of proposed POWER net names. On success
// it also `router.refresh()`es so the NetEditor pane repaints with the newly
// reconciled rails. A handled rejection surfaces inline (mirrors AssetRow's
// `error`).
//
// `deriveRails` is idempotent: a re-run reconciles against the unique
// constraints and creates nothing new, so the button is always safe to press
// again — the summary simply reports `0 / 0` on a no-op pass.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ZodError } from "zod";

import { deriveRailsForm } from "@/lib/actions/nets-form";

type Summary = {
  netsCreated: number;
  nodesCreated: number;
  proposedPowerNets: string[];
};

export function DeriveRailsButton({ revisionId }: { revisionId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);

  function run() {
    setError(null);
    setSummary(null);
    startTransition(async () => {
      try {
        const r = await deriveRailsForm({ revisionId });
        if (r.ok && r.summary) {
          setSummary(r.summary);
          router.refresh();
        } else {
          setError(r.message ?? "Could not derive rails.");
        }
      } catch (err) {
        setError(
          err instanceof ZodError
            ? "Invalid request."
            : "Could not derive rails — check your connection and try again.",
        );
      }
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={run}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 rounded border border-command-gold bg-navy-dark px-3 py-1 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space disabled:opacity-50"
      >
        {isPending ? "Deriving…" : "Derive rails"}
      </button>

      {summary ? (
        <p className="font-mono text-xs uppercase tracking-wider text-link-muted">
          {summary.netsCreated} net{summary.netsCreated === 1 ? "" : "s"} ·{" "}
          {summary.nodesCreated} node
          {summary.nodesCreated === 1 ? "" : "s"} created
          {summary.proposedPowerNets.length > 0
            ? ` · proposed: ${summary.proposedPowerNets.join(", ")}`
            : ""}
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded border border-alert-red bg-navy-dark px-3 py-2 font-mono text-xs text-alert-red"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
