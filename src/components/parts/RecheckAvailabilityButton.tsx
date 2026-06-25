"use client";

// Admin: on-demand "re-check this part's DigiKey availability". Re-resolves by the
// part's CURRENT mpn, so a swapped part stops showing the old part's stale stock +
// FastAdd cart link without waiting for the nightly oldest-first sweep.

import { useState, useTransition } from "react";
import { recheckPartAvailability } from "@/lib/actions/parts";

export function RecheckAvailabilityButton({ partId }: { partId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setMsg(null);
            try {
              const r = await recheckPartAvailability(partId);
              setMsg(
                r.ok
                  ? `Re-checked · ${r.checked} updated${r.changed ? `, ${r.changed} changed` : ""}${r.failed ? `, ${r.failed} failed` : ""}.`
                  : r.reason,
              );
            } catch (e) {
              setMsg(e instanceof Error ? e.message : "Re-check failed.");
            }
          })
        }
        className="glass-button inline-flex items-center gap-2 px-3 py-1.5 font-mono text-xs uppercase tracking-[0.14em] disabled:opacity-50"
      >
        {pending ? "Re-checking…" : "↻ Re-check DigiKey"}
      </button>
      {msg ? (
        <span className="font-mono text-[11px] normal-case text-muted">{msg}</span>
      ) : null}
    </span>
  );
}
