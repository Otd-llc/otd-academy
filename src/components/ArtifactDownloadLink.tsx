"use client";

// Inline download button for FILE-kind artifacts (design §7, Phase 10 / M8b).
//
// Renders a clickable that calls `getDownloadUrl()` server-side, then opens
// the resulting presigned R2 GET URL in a new tab. We don't preflight the
// download — the user clicks, we mint the URL, we navigate. URL TTL is
// 5 min per design §7; if the user lingers and the tab can't load, they
// click again.
import { useState } from "react";
import { getDownloadUrl } from "@/lib/actions/uploads";

export function ArtifactDownloadLink({
  artifactId,
  filename,
}: {
  artifactId: string;
  filename: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setError(null);
    try {
      const url = await getDownloadUrl(artifactId);
      // Open in a new tab so navigating away doesn't blow up the parent page.
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="mt-1 inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="inline-block w-fit font-mono text-xs text-link-muted underline hover:text-command-gold disabled:opacity-50"
      >
        {busy ? "Generating link…" : `Download ${filename}`}
      </button>
      {error ? (
        <span className="font-mono text-xs text-alert-red">{error}</span>
      ) : null}
    </span>
  );
}
