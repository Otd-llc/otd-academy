"use client";

// Datasheet upload control for the part detail page (design §3.1 / Task 9).
//
// Client island that runs the presigned-PUT pipeline:
//   1. createPartDatasheetUploadUrl({ partId, filename, byteSize, contentType })
//      → { uploadUrl, r2Key }
//   2. fetch(uploadUrl, { method: PUT, body: file }) — direct browser → R2 PUT
//   3. recordPartDatasheet({ partId, r2Key, filename, byteSize }) → upsert row
// then router.refresh() so the server re-reads the PartDatasheet and the
// "datasheet (cached)" link appears.
//
// This island is rendered by the part page ONLY when `r2Enabled` is true (the
// server passes that boolean — R2 internals never reach the client). When R2 is
// off the page renders nothing here and provenance falls back to
// `Part.datasheetUrl` + page. PDF-only by construction: the <input> accepts
// `application/pdf` and the action's schema enforces the same contentType.

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createPartDatasheetUploadUrl,
  recordPartDatasheet,
} from "@/lib/actions/part-datasheet";
import { DATASHEET_CONTENT_TYPE } from "@/lib/schemas/part-datasheet";
import { DocumentIcon, SpinnerIcon } from "@/components/icons";

export function DatasheetUpload({
  partId,
  hasDatasheet,
}: {
  partId: string;
  /** Whether a PartDatasheet row already exists (label "Replace" vs "Upload"). */
  hasDatasheet: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset the input so picking the same file twice re-fires onChange.
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;

    setError(null);

    if (file.type !== DATASHEET_CONTENT_TYPE) {
      setError("Datasheet must be a PDF.");
      return;
    }

    startTransition(async () => {
      try {
        const { uploadUrl, r2Key } = await createPartDatasheetUploadUrl({
          partId,
          filename: file.name,
          byteSize: file.size,
          contentType: DATASHEET_CONTENT_TYPE,
        });

        const put = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": DATASHEET_CONTENT_TYPE },
          body: file,
        });
        if (!put.ok) {
          throw new Error(`Upload failed (${put.status}).`);
        }

        await recordPartDatasheet({
          partId,
          r2Key,
          filename: file.name,
          byteSize: file.size,
        });

        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed.");
      }
    });
  }

  return (
    <div className="inline-flex flex-col gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={() => inputRef.current?.click()}
        className="glass-button inline-flex items-center gap-1.5 rounded px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:text-gold-light disabled:opacity-50"
      >
        {isPending ? (
          <SpinnerIcon className="h-4 w-4 animate-spin" />
        ) : (
          <DocumentIcon className="h-4 w-4" />
        )}
        {isPending
          ? "Uploading…"
          : hasDatasheet
            ? "Replace datasheet PDF"
            : "Upload datasheet PDF"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={onPick}
      />
      {error ? (
        <p className="font-mono text-xs font-bold text-alert-red">{error}</p>
      ) : null}
    </div>
  );
}
