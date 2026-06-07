"use client";

// Client island: a learner attaches a design-stage proof artifact by URL (link
// to their requirements doc / schematic / layout). Calls submitEnrollmentProof,
// which creates an enrollment-scoped LINK artifact that satisfies the gate.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitEnrollmentProof } from "@/lib/actions/enrollment";

export function ProofSubmitForm({
  projectId,
  stage,
  label,
}: {
  projectId: string;
  stage: string;
  label: string;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <div className="space-y-2">
      <label className="block font-mono text-xs uppercase tracking-wider text-muted">
        Link to your {label}
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          className="min-w-0 flex-1 rounded border border-panel-border bg-deep-space px-3 py-2 font-mono text-sm text-gray-1"
        />
        <button
          type="button"
          disabled={pending || url.length === 0}
          onClick={() =>
            start(async () => {
              setError(null);
              try {
                await submitEnrollmentProof({ projectId, stage, linkUrl: url });
                router.refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Could not submit.");
              }
            })
          }
          className="inline-flex items-center gap-1.5 rounded border border-panel-border bg-navy-dark px-3 py-2 font-mono text-xs uppercase tracking-wider text-signal-blue transition-colors hover:border-signal-blue disabled:opacity-50"
        >
          {pending ? "Saving…" : "Add proof"}
        </button>
      </div>
      {error && (
        <p className="font-mono text-xs uppercase tracking-wider text-alert-red">
          {error}
        </p>
      )}
    </div>
  );
}
