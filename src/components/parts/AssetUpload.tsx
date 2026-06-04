"use client";

// Per-kind CAD asset upload control for the part detail page (design §3.1 /
// Stage C Task 6). Generalizes DatasheetUpload across the three asset kinds
// (SYMBOL / FOOTPRINT / MODEL_3D), parameterized by `kind`.
//
// Client island that runs the presigned-PUT pipeline:
//   1. createPartAssetUploadUrl({ partId, kind, filename, byteSize })
//      → { uploadUrl, r2Key, contentType }
//   2. fetch(uploadUrl, { method: PUT, body: file }) — direct browser → R2 PUT,
//      sending the SERVER-RETURNED `contentType` (NOT file.type) in the
//      Content-Type header — R2's presigned signature requires the PUT header
//      to byte-match the signed ContentType, and KiCad files (.kicad_sym /
//      .kicad_mod / .step) report an EMPTY file.type in browsers.
//   3. recordPartAsset({ partId, kind, r2Key, filename, byteSize }) → upsert row
// then router.refresh() so the server re-reads the PartAsset and the row's
// filename + cached download link appear.
//
// Validation is by file EXTENSION (`isExtAllowed`), never file.type. The
// <input accept> is the kind's exts joined (advisory only — the real guard is
// the isExtAllowed check, which lists the kind's allowed exts on a mismatch).
//
// This island is rendered by AssetRow ONLY when the page passes through
// `r2Enabled && canEdit` (R2 internals never reach the client).

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createPartAssetUploadUrl,
  recordPartAsset,
} from "@/lib/actions/part-assets";
import {
  ASSET_KIND_CONFIG,
  isExtAllowed,
  type PartAssetKindT,
} from "@/lib/schemas/part-asset";
import { extractKicadMeta } from "@/lib/kicad-meta";
import { DocumentIcon, SpinnerIcon } from "@/components/icons";

export function AssetUpload({
  partId,
  kind,
  hasAsset,
}: {
  partId: string;
  kind: PartAssetKindT;
  /** Whether a PartAsset row already exists (label "Replace" vs "Upload"). */
  hasAsset: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const cfg = ASSET_KIND_CONFIG[kind];

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset the input so picking the same file twice re-fires onChange.
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;

    setError(null);

    // Validate by EXTENSION (KiCad files report an empty file.type), NOT type.
    if (!isExtAllowed(kind, file.name)) {
      setError(`${cfg.label} must be one of: ${cfg.exts.join(", ")}`);
      return;
    }

    startTransition(async () => {
      try {
        const { uploadUrl, r2Key, contentType } =
          await createPartAssetUploadUrl({
            partId,
            kind,
            filename: file.name,
            byteSize: file.size,
          });

        // Send the SERVER-RETURNED contentType — NEVER file.type. R2's presigned
        // signature requires the PUT Content-Type header to byte-match the
        // signed ContentType.
        const put = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": contentType },
          body: file,
        });
        if (!put.ok) {
          throw new Error(`Upload failed (${put.status}).`);
        }

        // For the TWO TEXT kinds (SYMBOL / FOOTPRINT) only, best-effort
        // auto-extract ref/source from the KiCad text to pre-seed the new
        // UNVERIFIED row. We decide text-vs-binary by KIND (not file.type):
        // MODEL_3D is binary and can be tens of MB, so it's NEVER text-read.
        // A parse/read failure must never block the upload — on failure we just
        // record the asset without metadata.
        let meta: { ref?: string; source?: string } = {};
        if (kind !== "MODEL_3D") {
          try {
            meta = extractKicadMeta(await file.text());
          } catch {
            meta = {};
          }
        }

        await recordPartAsset({
          partId,
          kind,
          r2Key,
          filename: file.name,
          byteSize: file.size,
          ref: meta.ref,
          source: meta.source,
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
          : hasAsset
            ? `Replace ${cfg.label}`
            : `Upload ${cfg.label}`}
      </button>
      <input
        ref={inputRef}
        type="file"
        // `accept` is advisory only — the isExtAllowed check above is the real
        // guard. KiCad extensions aren't standard MIME-mapped, so accept lists
        // the raw extensions.
        accept={cfg.exts.join(",")}
        className="hidden"
        onChange={onPick}
      />
      {error ? (
        <p className="font-mono text-xs font-bold text-alert-red">{error}</p>
      ) : null}
    </div>
  );
}
