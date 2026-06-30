"use client";

// Admin-only affordance: attach/replace a freeze-exempt REFERENCE ASSET (verified
// reference gerbers OR bring-up measurements CSV) on the board's published revision.
// Mirrors the proof-upload dance but hits the freeze-exempt reference-asset actions.
// Learners never see this; the matching download CTA picks up the newest upload.
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createReferenceAssetUploadUrl,
  recordReferenceAsset,
} from "@/lib/actions/reference-assets";

type Kind = "gerbers" | "measurements";

const COPY: Record<
  Kind,
  { noun: string; accept: string; defaultMime: string; chooseHint: string }
> = {
  gerbers: {
    noun: "gerbers",
    accept: ".zip,application/zip",
    defaultMime: "application/zip",
    chooseHint: "Choose a .zip first.",
  },
  measurements: {
    noun: "measurements",
    accept: ".csv,text/csv",
    defaultMime: "text/csv",
    chooseHint: "Choose a .csv first.",
  },
};

export function ReferenceAssetAdmin({
  kind,
  projectId,
  hasAsset,
  published,
}: {
  kind: Kind;
  projectId: string;
  hasAsset: boolean;
  published: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const copy = COPY[kind];

  function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError(copy.chooseHint);
      return;
    }
    start(async () => {
      setError(null);
      setDone(false);
      try {
        const mime = file.type || copy.defaultMime;
        const presign = await createReferenceAssetUploadUrl({
          kind,
          projectId,
          filename: file.name,
          mime,
          sizeBytes: file.size,
        });
        const put = await fetch(presign.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": presign.mime },
          body: file,
        });
        if (!put.ok) throw new Error("Upload to storage failed. Try again.");
        await recordReferenceAsset({
          kind,
          projectId,
          key: presign.key,
          filename: presign.filename,
          mime: presign.mime,
          sizeBytes: presign.sizeBytes,
        });
        setDone(true);
        if (fileRef.current) fileRef.current.value = "";
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not upload.");
      }
    });
  }

  return (
    <section className="w-full border-t border-panel-border/60 pt-4 text-left">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-command-gold">
        ▸ Admin · {copy.noun}
      </p>
      <p className="mt-2 font-mono text-xs uppercase tracking-wider text-muted">
        {!published
          ? "No published revision. Publish this board first."
          : hasAsset
            ? `Verified ${copy.noun} attached. Upload a new file to replace.`
            : `No verified ${copy.noun} yet. Learners see a placeholder until you attach them.`}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept={copy.accept}
          disabled={!published || pending}
          className="font-mono text-xs text-muted file:mr-3 file:rounded file:border file:border-panel-border file:bg-navy-dark file:px-3 file:py-1.5 file:font-mono file:text-xs file:uppercase file:tracking-wider file:text-command-gold disabled:opacity-50"
        />
        <button
          type="button"
          onClick={upload}
          disabled={!published || pending}
          className="glass-button inline-flex items-center gap-1.5 px-4 py-2 font-mono text-xs uppercase tracking-wider"
        >
          {pending ? "Uploading…" : hasAsset ? `↑ Replace ${copy.noun}` : `↑ Attach ${copy.noun}`}
        </button>
      </div>
      {done && (
        <p className="mt-2 font-mono text-xs uppercase tracking-wider text-status-green">
          ✓ Saved. Learners can download it now.
        </p>
      )}
      {error && (
        <p className="mt-2 font-mono text-xs uppercase tracking-wider text-alert-red">
          {error}
        </p>
      )}
    </section>
  );
}
