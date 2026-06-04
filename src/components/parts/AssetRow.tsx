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
  deletePartAssetForm,
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
import type { RenderBounds } from "@/lib/schemas/part-asset";
import { ModelViewerLazy } from "@/components/ModelViewerLazy";
import { IconButton } from "@/components/IconButton";
import {
  CheckIcon,
  AlertTriangleIcon,
  CloseIcon,
  UndoIcon,
  DocumentIcon,
  TrashIcon,
} from "@/components/icons";
import { VerifyBadge } from "@/components/parts/VerifyBadge";
import { AssetUpload } from "@/components/parts/AssetUpload";
import {
  inputClass as fieldInputClass,
  labelClass,
} from "@/components/guide/field-styles";

const inputClass = `mt-1 w-full ${fieldInputClass}`;

/** Human-readable byte size (B / KB / MB) for the CAD metadata panel. */
function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// Serialized existing asset (dates → ISO strings cross the server→client seam).
export type SerializedAsset = {
  id: string;
  trust: FactTrust;
  ref: string | null;
  source: string | null;
  license: string | null;
  filename: string;
  byteSize: number;
  renderBytes: number | null;
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
  renderUrl,
  renderBounds,
}: {
  partId: string;
  kind: PartAssetKindT;
  asset: SerializedAsset | null;
  canEdit: boolean;
  /** `r2Enabled && canEdit` — gates the upload/replace controls. */
  canUpload: boolean;
  /** Presigned GET URL resolved server-side; null when R2 off / no row. */
  downloadUrl: string | null;
  /** Inline presigned GET for the MODEL_3D `.glb` render; null when none.
   *  Meaningful only for MODEL_3D — minted for ANYONE (not gated on canEdit). */
  renderUrl?: string | null;
  /** Bounding sphere that frames the viewer camera; null when no render. */
  renderBounds?: RenderBounds | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Two-step inline delete confirm (mirrors DeleteConfirmButton's UX): a first
  // tap ARMS the control (trash → red confirm ✓ + cancel ✕) so a stray tap can't
  // drop an asset; the confirm ✓ dispatches deletePartAssetForm. NOT the shared
  // DeleteConfirmButton component — that posts a `<form action>` with only a
  // hidden id and can't carry the loaded `updatedAt` optimistic-lock fence this
  // delete requires. Do NOT "simplify" this back into it without that fence.
  const [confirmingDelete, setConfirmingDelete] = useState(false);

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

  // ─── delete (armed confirm → dispatch deletePartAssetForm) ────────────────
  // On success the row re-renders as the empty Upload affordance (the part
  // route revalidates server-side + router.refresh() repaints the client).
  function runDelete() {
    if (!asset) return;
    setError(null);
    startTransition(async () => {
      try {
        const r = await deletePartAssetForm({
          id: asset.id,
          updatedAt: asset.updatedAt,
        });
        if (r.ok) {
          setConfirmingDelete(false);
          router.refresh();
        } else {
          setError(r.message ?? "Could not delete.");
        }
      } catch (err) {
        setError(
          err instanceof ZodError
            ? "Invalid request."
            : "Could not delete — check your connection and try again.",
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
  // Filename / download link (presigned GET resolved server-side).
  const downloadEl = (
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
  );

  // Inline ref / source / license editor (canEdit only). No own separator —
  // the layout below adds one contextually (stacked vs side-by-side).
  const provenanceEl = canEdit ? (
    <fieldset className="space-y-3">
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
  ) : null;

  // Compact CAD metadata panel — shown beside the viewer (MODEL_3D w/ a render).
  // Source format ← filename ext; render is always glTF. Extent = the bounding-
  // sphere diameter from renderBounds (STEP/SnapEDA models are mm-valued).
  const ext = asset.filename.slice(asset.filename.lastIndexOf(".")).toLowerCase();
  const sourceFmt =
    ext === ".step" || ext === ".stp"
      ? "STEP"
      : ext === ".wrl"
        ? "VRML"
        : ext.replace(".", "").toUpperCase() || "—";
  const extentMm = renderBounds ? (renderBounds.radius * 2).toFixed(1) : null;
  const infoEl = renderUrl ? (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 font-mono text-xs">
      <dt className="uppercase tracking-wider text-muted">Format</dt>
      <dd className="text-link-muted">{sourceFmt} → glTF</dd>
      <dt className="uppercase tracking-wider text-muted">Size</dt>
      <dd className="text-link-muted">
        {fmtBytes(asset.byteSize)}
        {asset.renderBytes ? ` → ${fmtBytes(asset.renderBytes)}` : ""}
      </dd>
      {extentMm ? (
        <>
          <dt className="uppercase tracking-wider text-muted">Extent</dt>
          <dd className="text-link-muted">⌀ {extentMm} mm</dd>
        </>
      ) : null}
    </dl>
  ) : null;

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

            {/* Delete (two-step inline confirm — mirrors DeleteConfirmButton).
                Shown for ANY existing asset; the deliberate confirm is the
                safeguard (the server action has no trust precondition). */}
            {confirmingDelete ? (
              <>
                <IconButton
                  type="button"
                  tone="danger"
                  hint="Confirm delete"
                  ariaLabel={`Confirm delete ${label}`}
                  disabled={isPending}
                  onClick={runDelete}
                >
                  {/* Armed confirm reads red at rest so the destructive step is
                      unmistakable while the button stays ghost-light. */}
                  <span className="text-alert-red">
                    <CheckIcon className="h-5 w-5" />
                  </span>
                </IconButton>
                <IconButton
                  type="button"
                  hint="Keep"
                  ariaLabel={`Cancel delete ${label}`}
                  disabled={isPending}
                  onClick={() => {
                    setConfirmingDelete(false);
                    setError(null);
                  }}
                >
                  <CloseIcon className="h-5 w-5" />
                </IconButton>
              </>
            ) : (
              <IconButton
                type="button"
                tone="danger"
                hint="Delete"
                ariaLabel={`Delete ${label}`}
                disabled={isPending}
                onClick={() => setConfirmingDelete(true)}
              >
                <TrashIcon className="h-5 w-5" />
              </IconButton>
            )}
          </div>
        ) : null}
      </div>

      {/* Body: with a 3D render, lay the viewer beside the metadata on wide
          screens (viewer left, provenance right); otherwise stack download +
          provenance as before. The viewer is trust-agnostic AND ungated — it
          renders whenever a render URL exists, for ANYONE (signed-out included)
          and at any `asset.trust`. A render-less asset shows just the download. */}
      {renderUrl ? (
        <div className="grid gap-4 md:grid-cols-2">
          <ModelViewerLazy src={renderUrl} bounds={renderBounds ?? null} />
          {/* Right column: file identity + CAD metadata + provenance — fills the
              space beside the viewer instead of stranding the download under it. */}
          <div className="space-y-4">
            {downloadEl}
            {infoEl}
            {provenanceEl ? (
              <div className="border-t border-panel-border/60 pt-4">
                {provenanceEl}
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          {downloadEl}
          {provenanceEl ? (
            <div className="border-t border-panel-border pt-4">{provenanceEl}</div>
          ) : null}
        </>
      )}

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
