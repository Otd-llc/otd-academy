"use client";

// Admin-only affordance on the Lesson Complete screen: attach or replace the
// VERIFIED REFERENCE GERBERS for this board. Mirrors the proof-upload dance
// (presign → PUT to R2 → record) but hits the freeze-exempt reference-asset
// actions so it works on the already-published (frozen) revision. Learners never
// see this; the download CTA picks up the newest upload automatically.
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createReferenceGerberUploadUrl,
  recordReferenceGerber,
} from "@/lib/actions/reference-assets";

export function ReferenceGerberAdmin({
  projectId,
  hasGerbers,
  published,
}: {
  projectId: string;
  hasGerbers: boolean;
  published: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Choose a .zip first.");
      return;
    }
    start(async () => {
      setError(null);
      setDone(false);
      try {
        const mime = file.type || "application/zip";
        const presign = await createReferenceGerberUploadUrl({
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
        if (!put.ok) throw new Error("Upload to storage failed — try again.");
        await recordReferenceGerber({
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
    <section className="glass-card w-full max-w-2xl border-signal-blue/30 p-5 text-left">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-signal-blue">
        Admin · reference gerbers
      </p>
      <p className="mt-2 font-mono text-xs uppercase tracking-wider text-muted">
        {!published
          ? "No published revision — publish this board first."
          : hasGerbers
            ? "Verified gerbers attached. Upload a new .zip to replace."
            : "No verified gerbers yet — learners see a placeholder until you attach them."}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept=".zip,application/zip"
          disabled={!published || pending}
          className="font-mono text-xs text-gray-2 file:mr-3 file:rounded file:border file:border-panel-border file:bg-navy-dark file:px-3 file:py-1.5 file:font-mono file:text-xs file:uppercase file:tracking-wider file:text-command-gold disabled:opacity-50"
        />
        <button
          type="button"
          onClick={upload}
          disabled={!published || pending}
          className="inline-flex items-center gap-1.5 rounded border border-signal-blue bg-navy-dark px-4 py-2 font-mono text-xs uppercase tracking-wider text-signal-blue transition-colors hover:bg-signal-blue hover:text-deep-space disabled:opacity-50"
        >
          {pending ? "Uploading…" : hasGerbers ? "↑ Replace gerbers" : "↑ Attach gerbers"}
        </button>
      </div>
      {done && (
        <p className="mt-2 font-mono text-xs uppercase tracking-wider text-status-green">
          ✓ Saved — learners can download it now.
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
