"use client";

// Client island for an in-guide `action` block — the button the guide tells the
// student to click. Today it handles "downloadKicadStarter": fetch a presigned
// URL for the board's KiCad starter and open it. Add new action kinds here as
// the guide needs them; the schema's `action` enum gates what can appear.
import { useState, useTransition } from "react";
import { getKicadStarterUrl } from "@/lib/actions/learner-resources";

export function GuideActionButton({
  action,
  label,
  projectId,
}: {
  action: string;
  label: string;
  projectId?: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (action !== "downloadKicadStarter") return null;

  function run() {
    start(async () => {
      setError(null);
      if (!projectId) {
        setError("Open this from a board to download.");
        return;
      }
      try {
        const url = await getKicadStarterUrl(projectId);
        if (url) {
          window.open(url, "_blank", "noopener,noreferrer");
        } else {
          setError("The KiCad starter isn't available for this board yet.");
        }
      } catch {
        setError("Couldn't fetch the download — try again.");
      }
    });
  }

  return (
    <div className="my-2 space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={run}
        className="inline-flex items-center gap-1.5 rounded border border-command-gold bg-navy-dark px-4 py-2 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space disabled:opacity-50"
      >
        ↓ {pending ? "Preparing…" : label}
      </button>
      {error && (
        <p className="font-mono text-xs uppercase tracking-wider text-alert-red">
          {error}
        </p>
      )}
    </div>
  );
}
