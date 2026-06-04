"use client";

// KiCad export button (export-engine Task 8, design §1). Triggers the
// `exportKicad` server action for a revision, which builds the project tree,
// PUTs the zip to R2, and records a `BOM_EXPORT` FILE artifact. On success it
// surfaces an inline download link (via `ArtifactDownloadLink`) for the freshly
// created artifact AND `router.refresh()`es so the Artifacts pane repaints with
// the new row. A handled rejection surfaces inline.
//
// The export reads the revision's BOM + curated part assets (the schematic is
// UNWIRED — placed parts only); missing assets degrade to clearly-marked stubs
// (see EXPORT_REPORT.md inside the zip), so the button is always safe to press —
// it never blocks on coverage.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ZodError } from "zod";

import { exportKicad } from "@/lib/actions/kicad-export";
import { ArtifactDownloadLink } from "@/components/ArtifactDownloadLink";

type Done = { id: string; title: string };

export function KicadExportButton({ revisionId }: { revisionId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);

  function run() {
    setError(null);
    setDone(null);
    startTransition(async () => {
      try {
        const artifact = await exportKicad({ revisionId });
        setDone({ id: artifact.id, title: artifact.title });
        // Repaint the Artifacts pane so the new BOM_EXPORT row appears there too.
        router.refresh();
      } catch (err) {
        setError(
          err instanceof ZodError
            ? "Invalid request."
            : err instanceof Error
              ? err.message
              : "Could not generate the KiCad export — try again.",
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
        {isPending ? "Generating…" : "Export to KiCad"}
      </button>

      {done ? (
        <div className="font-mono text-xs text-link-muted">
          <p className="uppercase tracking-wider text-signal-blue">
            Export ready
          </p>
          <ArtifactDownloadLink artifactId={done.id} filename="kicad-export.zip" />
        </div>
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
