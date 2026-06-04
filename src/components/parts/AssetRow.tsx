"use client";

// One CAD-asset kind's row on the part detail page (design §4 / Stage C Task 6).
// The curate → verify → download surface for a single PartAsset (SYMBOL /
// FOOTPRINT / MODEL_3D). Client island; mirrors FactGroupCard's gate-control +
// inline-editor structure over the PartAsset wrappers.
//
// Header: the kind label (ASSET_KIND_CONFIG[kind].label) + a VerifyBadge.
//
// When an asset EXISTS: its filename, a download link (the presigned GET URL
// resolved server-side, passed as `downloadUrl` — may be null when R2 is off),
// and — when `canEdit` — the gate IconButtons (Verify when UNVERIFIED · Undo
// verify when VERIFIED · Flag when not FLAGGED else Clear flag), each dispatched
// via `runGate` carrying the loaded `updatedAt` (the optimistic-lock fence). A
// rejection (the verify "needs a stated source" precondition, the optimistic-lock
// "reload" conflict, the non-VERIFIED/non-FLAGGED guards) surfaces inline.
//
// An inline ref / source / license editor (three text inputs + Save) dispatches
// `editPartAssetForm` with ALL THREE current values + the loaded `updatedAt`
// (omitting a field CLEARS it server-side, so we always send all three).
//
// REPLACE: an AssetUpload for this kind (rendered only when `canUpload`, i.e.
// the page's `r2Enabled && canEdit`). When NO asset exists, the row renders just
// the AssetUpload (label "Upload {label}").

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ZodError } from "zod";
import type { FactTrust } from "@prisma/client";

import {
  clearPartAssetFlagForm,
  editPartAssetForm,
  flagPartAssetForm,
  unverifyPartAssetForm,
  verifyPartAssetForm,
  type AssetFormState,
} from "@/lib/actions/part-assets-form";
import {
  ASSET_KIND_CONFIG,
  type PartAssetKindT,
} from "@/lib/schemas/part-asset";
import { IconButton } from "@/components/IconButton";
import {
  CheckIcon,
  AlertTriangleIcon,
  CloseIcon,
  UndoIcon,
  DocumentIcon,
} from "@/components/icons";
import { VerifyBadge } from "@/components/parts/VerifyBadge";
import { AssetUpload } from "@/components/parts/AssetUpload";
import {
  inputClass as fieldInputClass,
  labelClass,
} from "@/components/guide/field-styles";

const inputClass = `mt-1 w-full ${fieldInputClass}`;

// Serialized existing asset (dates → ISO strings cross the server→client seam).
export type SerializedAsset = {
  id: string;
  trust: FactTrust;
  ref: string | null;
  source: string | null;
  license: string | null;
  filename: string;
  verifiedAt: string | null;
  verifierName: string | null;
  updatedAt: string;
};

export function AssetRow({
  partId,
  kind,
  asset,
  canEdit,
  canUpload,
  downloadUrl,
}: {
  partId: string;
  kind: PartAssetKindT;
  asset: SerializedAsset | null;
  canEdit: boolean;
  /** `r2Enabled && canEdit` — gates the upload/replace controls. */
  canUpload: boolean;
  /** Presigned GET URL resolved server-side; null when R2 off / no row. */
  downloadUrl: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Edit drafts — seeded from the existing asset (controlled inputs).
  const [ref, setRef] = useState(asset?.ref ?? "");
  const [source, setSource] = useState(asset?.source ?? "");
  const [license, setLicense] = useState(asset?.license ?? "");

  const cfg = ASSET_KIND_CONFIG[kind];
  const label = cfg.label;

  // ─── gate control dispatch (verify / unverify / flag / clearFlag) ─────────
  function runGate(wrapper: (input: unknown) => Promise<AssetFormState>) {
    if (!asset) return;
    setError(null);
    startTransition(async () => {
      try {
        const r = await wrapper({ id: asset.id, updatedAt: asset.updatedAt });
        if (r.ok) {
          router.refresh();
        } else {
          setError(r.message ?? "Action failed.");
        }
      } catch (err) {
        setError(
          err instanceof ZodError
            ? "Invalid request."
            : "Action failed — check your connection and try again.",
        );
      }
    });
  }

  // ─── inline metadata save (ref / source / license) ────────────────────────
  // Always send ALL THREE current values + the loaded updatedAt — omitting a
  // field CLEARS it server-side (the strict edit envelope).
  function save() {
    if (!asset) return;
    setError(null);
    startTransition(async () => {
      try {
        const r = await editPartAssetForm({
          id: asset.id,
          updatedAt: asset.updatedAt,
          ref: ref.trim() || undefined,
          source: source.trim() || undefined,
          license: license.trim() || undefined,
        });
        if (r.ok) {
          router.refresh();
        } else {
          setError(r.message ?? "Could not save.");
        }
      } catch (err) {
        setError(
          err instanceof ZodError
            ? "Invalid request."
            : "Could not save — check your connection and try again.",
        );
      }
    });
  }

  // ─── no asset yet → just the upload affordance ────────────────────────────
  if (!asset) {
    return (
      <section className="rounded border border-dashed border-panel-border bg-navy-dark/10 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h3 className="font-display text-xl tracking-wider text-muted">
              {label}
            </h3>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
              Not uploaded
            </span>
          </div>
          {canUpload ? (
            <AssetUpload partId={partId} kind={kind} hasAsset={false} />
          ) : null}
        </div>
      </section>
    );
  }

  // ─── existing asset → header + download + gate controls + editor + replace ─
  return (
    <section className="space-y-4 rounded border border-panel-border bg-navy-dark/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="font-display text-xl tracking-wider text-white">
            {label}
          </h3>
          <VerifyBadge
            trust={asset.trust}
            verifierName={asset.verifierName}
            verifiedAt={asset.verifiedAt}
          />
        </div>

        {canEdit ? (
          <div className="flex items-center gap-1">
            {asset.trust === "UNVERIFIED" ? (
              <IconButton
                type="button"
                hint="Verify"
                ariaLabel={`Verify ${label}`}
                disabled={isPending}
                onClick={() => runGate(verifyPartAssetForm)}
              >
                <CheckIcon className="h-5 w-5" />
              </IconButton>
            ) : null}

            {asset.trust === "VERIFIED" ? (
              <IconButton
                type="button"
                hint="Undo verify"
                ariaLabel={`Undo verify on ${label}`}
                disabled={isPending}
                onClick={() => runGate(unverifyPartAssetForm)}
              >
                <UndoIcon className="h-5 w-5" />
              </IconButton>
            ) : null}

            {asset.trust !== "FLAGGED" ? (
              <IconButton
                type="button"
                tone="danger"
                hint="Flag"
                ariaLabel={`Flag ${label}`}
                disabled={isPending}
                onClick={() => runGate(flagPartAssetForm)}
              >
                <AlertTriangleIcon className="h-5 w-5" />
              </IconButton>
            ) : (
              <IconButton
                type="button"
                hint="Clear flag"
                ariaLabel={`Clear flag on ${label}`}
                disabled={isPending}
                onClick={() => runGate(clearPartAssetFlagForm)}
              >
                <CloseIcon className="h-5 w-5" />
              </IconButton>
            )}
          </div>
        ) : null}
      </div>

      {/* filename + download link (presigned GET resolved server-side) */}
      <div className="flex flex-wrap items-center gap-4 font-mono text-xs uppercase tracking-wider">
        {downloadUrl ? (
          <a
            href={downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-command-gold underline"
          >
            <DocumentIcon className="h-4 w-4" />
            Download: {asset.filename}
          </a>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-command-gold">
            <DocumentIcon className="h-4 w-4" />
            {asset.filename}
          </span>
        )}
      </div>

      {/* inline ref / source / license editor (canEdit only) */}
      {canEdit ? (
        <fieldset className="space-y-3 border-t border-panel-border pt-4">
          <legend className={labelClass}>Provenance</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className={labelClass}>Ref</label>
              <input
                type="text"
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                placeholder="symbol/footprint name"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Source</label>
              <input
                type="text"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="SnapEDA · manufacturer · hand-made"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>License</label>
              <input
                type="text"
                value={license}
                onChange={(e) => setLicense(e.target.value)}
                placeholder="free text"
                className={inputClass}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={save}
            disabled={isPending}
            className="rounded border border-command-gold bg-command-gold px-3 py-2 font-mono text-xs uppercase tracking-wider text-deep-space transition-colors hover:border-gold-light hover:bg-gold-light disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Save"}
          </button>
        </fieldset>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded border border-alert-red bg-navy-dark px-4 py-3 font-mono text-sm text-alert-red"
        >
          {error}
        </p>
      ) : null}

      {/* replace affordance (r2Enabled && canEdit) */}
      {canUpload ? (
        <div className="border-t border-panel-border pt-4">
          <AssetUpload partId={partId} kind={kind} hasAsset={true} />
        </div>
      ) : null}
    </section>
  );
}
