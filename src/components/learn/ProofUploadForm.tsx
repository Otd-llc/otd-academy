"use client";

// Client island: the learner attaches a design-stage proof artifact. PRIMARY
// path = a real file upload straight to R2 (presign → PUT → record), mirroring
// the author upload flow. SECONDARY = paste a link to an already-hosted file
// (some learners keep their CAD in the cloud). Either creates an enrollment-
// scoped artifact that satisfies the learner gate.
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createEnrollmentProofUploadUrl,
  recordEnrollmentProof,
  submitEnrollmentProof,
} from "@/lib/actions/enrollment";

export function ProofUploadForm({
  projectId,
  stage,
  label,
}: {
  projectId: string;
  stage: string;
  label: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [showLink, setShowLink] = useState(false);
  const [url, setUrl] = useState("");
  const router = useRouter();

  function uploadSelected() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Choose a file first.");
      return;
    }
    start(async () => {
      setError(null);
      try {
        const mime = file.type || "application/octet-stream";
        const presign = await createEnrollmentProofUploadUrl({
          projectId,
          stage,
          filename: file.name,
          mime,
          sizeBytes: file.size,
        });
        const put = await fetch(presign.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": presign.mime },
          body: file,
        });
        if (!put.ok) throw new Error("Upload to storage failed — try again.");
        await recordEnrollmentProof({
          projectId,
          stage,
          key: presign.key,
          filename: presign.filename,
          mime: presign.mime,
          sizeBytes: presign.sizeBytes,
        });
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not upload.");
      }
    });
  }

  function submitLink() {
    start(async () => {
      setError(null);
      try {
        await submitEnrollmentProof({ projectId, stage, linkUrl: url });
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not submit link.");
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <label className="block font-mono text-xs uppercase tracking-wider text-muted">
          Upload your {label}
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            className="min-w-0 flex-1 font-mono text-xs text-gray-1 file:mr-3 file:rounded file:border file:border-panel-border file:bg-navy-dark file:px-3 file:py-1.5 file:font-mono file:text-xs file:uppercase file:tracking-wider file:text-command-gold"
          />
          <button
            type="button"
            disabled={pending}
            onClick={uploadSelected}
            className="inline-flex items-center gap-1.5 rounded border border-command-gold bg-navy-dark px-3 py-2 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space disabled:opacity-50"
          >
            {pending ? "Uploading…" : "Upload"}
          </button>
        </div>
      </div>

      {showLink ? (
        <div className="space-y-2">
          <label className="block font-mono text-xs uppercase tracking-wider text-muted">
            …or paste a link to a hosted file
          </label>
          <div className="flex flex-wrap items-center gap-2">
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
              onClick={submitLink}
              className="inline-flex items-center gap-1.5 rounded border border-panel-border bg-navy-dark px-3 py-2 font-mono text-xs uppercase tracking-wider text-signal-blue transition-colors hover:border-signal-blue disabled:opacity-50"
            >
              Add link
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowLink(true)}
          className="font-mono text-[11px] uppercase tracking-wider text-link-muted underline transition-colors hover:text-command-gold"
        >
          or paste a link instead
        </button>
      )}

      {error && (
        <p className="font-mono text-xs uppercase tracking-wider text-alert-red">
          {error}
        </p>
      )}
    </div>
  );
}
