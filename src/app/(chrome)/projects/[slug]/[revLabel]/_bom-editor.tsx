"use client";

// In-page BomLine editor for the Artifacts pane. Phase 5a: simple add-form
// + line-row list with delete buttons. Edit-in-place per-row is out of
// scope; Phase 8+ will refine the UX. The "Create new Part" modal mounts
// inside this component (Task 5.5).
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import type { PartLifecycle } from "@prisma/client";
import {
  createBomLineFormAction,
  deleteBomLineAction,
  importBomCsvFormAction,
  type BomLineFormState,
} from "@/lib/actions/bom-lines";
import { CreatePartDialog, type PartOption } from "@/components/CreatePartDialog";
import { DeleteConfirmButton } from "@/components/DeleteConfirmButton";
import { InlineBanner } from "@/components/InlineBanner";
import { PlusIcon } from "@/components/icons";
import { formatUsd } from "@/lib/format-money";
import type { BomCost, BomWarning } from "@/lib/bom-cost";
import { assessPartAvailability, availabilityBadge } from "@/lib/part-availability";

type BomLineRow = {
  id: string;
  refDes: string;
  quantity: number;
  notes: string | null;
  altMpn: string | null;
  altManufacturer: string | null;
  unitPriceCents: number | null;
  part: PartOption & {
    lifecycle: PartLifecycle;
    dkInStock: boolean | null;
    dkLifecycle: string | null;
    dkCheckedAt: Date | null;
  };
};

const initialState: BomLineFormState = {};

// Mirrors the structural return type of `importBomCsvFormAction` (the
// `"use server"` action file can't export a type alias).
type ImportBomState = {
  report?: {
    created: number;
    updated: number;
    unmatched: { manufacturer: string; mpn: string; row: number }[];
    rowErrors: { row: number; message: string }[];
  };
  message?: string;
};

const importInitialState: ImportBomState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded border border-command-gold bg-deep-space px-4 py-2 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space disabled:opacity-50"
    >
      {pending ? "WORKING…" : "Add line"}
    </button>
  );
}

function ImportButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="rounded border border-command-gold bg-deep-space px-4 py-2 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space disabled:opacity-50"
    >
      {pending ? "IMPORTING…" : "Import CSV"}
    </button>
  );
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) return null;
  return (
    <p className="mt-1 font-mono text-xs font-bold text-alert-red">
      {messages.join("; ")}
    </p>
  );
}

// WS3: admin lifecycle chip. Deliberately DUPLICATES the private `LifecycleBadge`
// in src/components/guide/GuideBlocks.tsx (a public component this workstream
// leaves untouched) rather than exporting it. Same semantics: EOL/OBSOLETE =
// danger (red), NRND = caution (amber/gold).
function AdminLifecycleChip({ lifecycle }: { lifecycle: string }) {
  if (lifecycle === "ACTIVE") return null;
  const danger = lifecycle === "EOL" || lifecycle === "OBSOLETE";
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-px font-mono text-[10px] font-bold uppercase tracking-wider ${
        danger
          ? "border-alert-red/50 bg-alert-red/15 text-alert-red"
          : "border-command-gold/50 bg-command-gold/15 text-command-gold"
      }`}
      title={
        danger
          ? "End-of-life / obsolete — find a replacement before sourcing"
          : "Not recommended for new designs — prefer an active alternative"
      }
    >
      {lifecycle}
    </span>
  );
}

const ADMIN_DK_TONE: Record<string, string> = {
  green: "border-signal-blue/50 bg-signal-blue/15 text-signal-blue",
  amber: "border-command-gold/50 bg-command-gold/15 text-command-gold",
  red: "border-alert-red/50 bg-alert-red/15 text-alert-red",
  grey: "border-panel-border bg-deep-space text-muted",
};

// DigiKey live-availability chip (watchdog). Always rendered for admins so a
// never-checked / stale part is visible here (unlike the public BOM, which hides
// the healthy/unchecked cases). Reuses the pure assessor + badge mapping.
function AdminDkChip({
  inStock,
  lifecycle,
  checkedAt,
}: {
  inStock: boolean | null;
  lifecycle: string | null;
  checkedAt: Date | null;
}) {
  const { status } = assessPartAvailability(
    { dkInStock: inStock, dkLifecycle: lifecycle, dkCheckedAt: checkedAt },
    new Date(),
  );
  const { label, tone, title } = availabilityBadge(status);
  return (
    <span
      title={title}
      className={`ml-1 inline-flex items-center rounded border px-1.5 py-px font-mono text-[10px] font-bold uppercase tracking-wider ${ADMIN_DK_TONE[tone]}`}
    >
      DK: {label}
    </span>
  );
}

// WS3: cost roll-up badge — "BOM total $X / target $Y", gold under target, red
// over; total-only when no target; "(N lines unpriced)" caveat appended.
function CostBadge({ cost }: { cost: BomCost }) {
  const { totalCents, targetCents, overTarget, unpricedCount } = cost;
  return (
    <span
      className={`inline-flex items-center rounded border border-panel-border bg-deep-space px-2 py-1 font-mono text-xs ${
        overTarget ? "text-alert-red" : "text-command-gold"
      }`}
    >
      BOM total {formatUsd(totalCents)}
      {targetCents != null ? (
        <span className="text-muted">
          {" / "}target {formatUsd(targetCents)}
        </span>
      ) : null}
      {unpricedCount > 0 ? (
        <span className="ml-1 text-muted">
          ({unpricedCount} line{unpricedCount === 1 ? "" : "s"} unpriced)
        </span>
      ) : null}
    </span>
  );
}

// WS3: lifecycle/cost sourcing advisory. Lists each warning from
// assessBomSourcing; a green "No sourcing warnings." when clean.
function SourcingAdvisory({ warnings }: { warnings: BomWarning[] }) {
  return (
    <div className="border border-panel-border bg-deep-space p-4">
      <h3 className="font-mono text-xs uppercase tracking-wider text-muted">
        Sourcing advisory
      </h3>
      {warnings.length === 0 ? (
        <p className="mt-2 font-mono text-xs text-status-green">
          No sourcing warnings.
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5 font-mono text-xs">
          {warnings.map((w, idx) => {
            if (w.kind === "lifecycle") {
              return (
                <li
                  key={`lifecycle-${w.refDesOrMpn}-${idx}`}
                  className="flex items-center gap-2 text-link-muted"
                >
                  <AdminLifecycleChip lifecycle={w.lifecycle} />
                  <span>
                    {w.refDesOrMpn || "(part)"} —{" "}
                    {w.lifecycle === "NRND"
                      ? "not recommended for new designs"
                      : "end-of-life / obsolete; find a replacement"}
                  </span>
                </li>
              );
            }
            if (w.kind === "unpriced") {
              return (
                <li key={`unpriced-${idx}`} className="text-alert-red">
                  {w.count} line{w.count === 1 ? "" : "s"} have no unit price —
                  BOM total is understated.
                </li>
              );
            }
            return (
              <li key={`over-target-${idx}`} className="text-alert-red">
                Over target: total {formatUsd(w.totalCents)} exceeds target{" "}
                {formatUsd(w.targetCents)}.
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function BomEditor({
  revisionId,
  lines,
  parts,
  cost,
  warnings,
  disabled,
  disabledReason,
}: {
  revisionId: string;
  lines: BomLineRow[];
  parts: PartOption[];
  cost: BomCost;
  warnings: BomWarning[];
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [state, action] = useActionState(
    createBomLineFormAction,
    initialState,
  );
  const [importState, importAction] = useActionState(
    importBomCsvFormAction,
    importInitialState,
  );
  const [showImport, setShowImport] = useState(false);
  const [showPartDialog, setShowPartDialog] = useState(false);
  // Track parts created during this session so the dropdown reflects them
  // immediately. The server-rendered list is the source of truth on next
  // navigation/revalidation.
  const [sessionParts, setSessionParts] = useState<PartOption[]>([]);
  const allParts = [...parts, ...sessionParts];

  return (
    <div className="space-y-4">
      {/* WS3: cost roll-up badge — sits above the editor so the design-to-cost
          total vs target is always in view. */}
      <div className="flex flex-wrap items-center justify-end">
        <CostBadge cost={cost} />
      </div>

      {/* WS3: lifecycle/cost sourcing advisory (always visible). */}
      <SourcingAdvisory warnings={warnings} />

      <div className="border border-panel-border bg-deep-space p-4">
        <h3 className="font-mono text-xs uppercase tracking-wider text-muted">
          Add BOM line
        </h3>
        {disabled && (
          <p className="mt-2 font-mono text-xs font-bold text-alert-red">
            {disabledReason ?? "BOM editing disabled."}
          </p>
        )}
        {state.message && (
          <div className="mt-2">
            <InlineBanner variant="error">{state.message}</InlineBanner>
          </div>
        )}
        <form action={action} className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-5">
          <input type="hidden" name="revisionId" value={revisionId} />

          <div className="md:col-span-2 min-w-0">
            <label className="block font-mono text-xs uppercase tracking-wider text-muted">
              Part
            </label>
            <div className="mt-1 flex min-w-0 gap-1">
              <select
                name="partId"
                required
                disabled={disabled}
                className="min-w-0 flex-1 rounded border border-panel-border bg-deep-space px-2 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none disabled:opacity-50"
              >
                <option value="">— select —</option>
                {allParts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.manufacturer} {p.mpn}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowPartDialog(true)}
                disabled={disabled}
                className="inline-flex items-center gap-1 rounded border border-panel-border bg-deep-space px-2 py-2 font-mono text-xs uppercase tracking-wider text-signal-blue transition-colors hover:border-signal-blue disabled:opacity-50"
                title="Create new Part"
              >
                <PlusIcon className="h-4 w-4" />
                Part
              </button>
            </div>
            <FieldError messages={state.errors?.partId} />
          </div>

          <div className="min-w-0">
            <label className="block font-mono text-xs uppercase tracking-wider text-muted">
              RefDes
            </label>
            <input
              name="refDes"
              required
              disabled={disabled}
              placeholder="R1 or C1,C2,C3"
              className="mt-1 w-full rounded border border-panel-border bg-deep-space px-2 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none disabled:opacity-50"
            />
            <FieldError messages={state.errors?.refDes} />
          </div>

          <div className="min-w-0">
            <label className="block font-mono text-xs uppercase tracking-wider text-muted">
              Qty
            </label>
            <input
              name="quantity"
              type="number"
              min="1"
              required
              disabled={disabled}
              defaultValue="1"
              className="mt-1 w-full rounded border border-panel-border bg-deep-space px-2 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none disabled:opacity-50"
            />
            <FieldError messages={state.errors?.quantity} />
          </div>

          <div className="flex min-w-0 items-end">
            <SubmitButton />
          </div>

          <div className="md:col-span-5">
            <label className="block font-mono text-xs uppercase tracking-wider text-muted">
              Notes (optional)
            </label>
            <input
              name="notes"
              disabled={disabled}
              maxLength={1000}
              className="mt-1 w-full rounded border border-panel-border bg-deep-space px-2 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none disabled:opacity-50"
            />
            <FieldError messages={state.errors?.notes} />
          </div>

          {/* WS1: optional second-source (alternate MPN / manufacturer). */}
          <div className="md:col-span-3">
            <label className="block font-mono text-xs uppercase tracking-wider text-muted">
              Alt. MPN (optional)
            </label>
            <input
              name="altMpn"
              disabled={disabled}
              maxLength={200}
              placeholder="second-source part number"
              className="mt-1 w-full rounded border border-panel-border bg-deep-space px-2 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none disabled:opacity-50"
            />
            <FieldError messages={state.errors?.altMpn} />
          </div>
          <div className="md:col-span-2">
            <label className="block font-mono text-xs uppercase tracking-wider text-muted">
              Alt. mfr. (optional)
            </label>
            <input
              name="altManufacturer"
              disabled={disabled}
              maxLength={200}
              placeholder="second-source maker"
              className="mt-1 w-full rounded border border-panel-border bg-deep-space px-2 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none disabled:opacity-50"
            />
            <FieldError messages={state.errors?.altManufacturer} />
          </div>

          {/* WS3: per-line quoted unit price (dollars in UI → cents stored). */}
          <div className="md:col-span-2">
            <label className="block font-mono text-xs uppercase tracking-wider text-muted">
              Unit price (USD)
            </label>
            <input
              name="unitPrice"
              type="number"
              step="0.01"
              min="0"
              disabled={disabled}
              placeholder="0.00"
              className="mt-1 w-full rounded border border-panel-border bg-deep-space px-2 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none disabled:opacity-50"
            />
            <FieldError messages={state.errors?.unitPriceCents} />
          </div>
        </form>
      </div>

      {/* WS3: collapsible CSV import. Strict-matches (manufacturer, mpn) and
          upserts on [revisionId, partId]; unmatched rows are reported. */}
      <div className="border border-panel-border bg-deep-space p-4">
        <button
          type="button"
          onClick={() => setShowImport((v) => !v)}
          className="flex w-full items-center justify-between font-mono text-xs uppercase tracking-wider text-muted hover:text-command-gold"
        >
          <span>Import CSV</span>
          <span className="text-command-gold">{showImport ? "−" : "+"}</span>
        </button>

        {showImport && (
          <div className="mt-3 space-y-3">
            {disabled && (
              <p className="font-mono text-xs font-bold text-alert-red">
                {disabledReason ?? "BOM editing disabled."}
              </p>
            )}
            {importState.message && (
              <InlineBanner variant="error">
                {importState.message}
              </InlineBanner>
            )}

            <form action={importAction} className="space-y-3">
              <input type="hidden" name="revisionId" value={revisionId} />
              <p className="font-mono text-xs text-muted">
                Header row required:{" "}
                <span className="text-link-muted">
                  refDes,manufacturer,mpn,quantity
                </span>{" "}
                (optional: unitPrice,altMpn,altManufacturer,notes). Parts match
                on exact manufacturer + MPN.
              </p>
              <textarea
                name="csv"
                rows={8}
                disabled={disabled}
                placeholder={
                  "refDes,manufacturer,mpn,quantity,unitPrice\nR1,Yageo,RC0805JR-070R0L,1,0.02"
                }
                className="w-full rounded border border-panel-border bg-deep-space px-2 py-2 font-mono text-xs text-link-muted focus:border-command-gold focus:outline-none disabled:opacity-50"
              />
              <ImportButton disabled={disabled} />
            </form>

            {importState.report && (
              <div className="space-y-2 border border-panel-border bg-deep-space p-3 font-mono text-xs">
                <p className="text-link-muted">
                  <span className="text-command-gold">
                    {importState.report.created} created
                  </span>{" "}
                  ·{" "}
                  <span className="text-signal-blue">
                    {importState.report.updated} updated
                  </span>{" "}
                  ·{" "}
                  <span className="text-muted">
                    {importState.report.unmatched.length} skipped
                  </span>
                </p>

                {importState.report.unmatched.length > 0 && (
                  <div>
                    <p className="text-alert-red">Unmatched MPNs (skipped):</p>
                    <ul className="mt-1 list-inside list-disc text-muted">
                      {importState.report.unmatched.map((u, idx) => (
                        <li key={`${u.manufacturer}-${u.mpn}-${idx}`}>
                          row {u.row}: {u.manufacturer} {u.mpn}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {importState.report.rowErrors.length > 0 && (
                  <div>
                    <p className="text-alert-red">Row errors (skipped):</p>
                    <ul className="mt-1 list-inside list-disc text-muted">
                      {importState.report.rowErrors.map((e, idx) => (
                        <li key={`${e.row}-${idx}`}>
                          row {e.row}: {e.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <h3 className="font-mono text-xs uppercase tracking-wider text-muted">
          Lines ({lines.length})
        </h3>
        {lines.length === 0 ? (
          <p className="mt-2 font-mono text-xs uppercase tracking-wider text-muted">
            NO BOM LINES YET.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-panel-border border border-panel-border">
            {lines.map((line) => (
              <li
                key={line.id}
                className="grid grid-cols-1 gap-2 px-3 py-2 font-mono text-sm md:grid-cols-[1fr_auto_auto_auto]"
              >
                <span className="text-link-muted">
                  <span className="text-command-gold">{line.refDes}</span>{" "}
                  <span className="text-muted">·</span>{" "}
                  {line.part.manufacturer} {line.part.mpn}{" "}
                  <AdminLifecycleChip lifecycle={line.part.lifecycle} />
                  <AdminDkChip
                    inStock={line.part.dkInStock}
                    lifecycle={line.part.dkLifecycle}
                    checkedAt={line.part.dkCheckedAt}
                  />
                  {line.altMpn || line.altManufacturer ? (
                    <span className="mt-0.5 block text-xs text-muted">
                      alt:{" "}
                      {[line.altManufacturer, line.altMpn]
                        .filter(Boolean)
                        .join(" ")}
                    </span>
                  ) : null}
                </span>
                <span className="text-muted">
                  qty {line.quantity}
                  {line.unitPriceCents != null ? (
                    <span className="ml-2 text-muted">
                      · {formatUsd(line.unitPriceCents)}
                    </span>
                  ) : null}
                </span>
                <span className="text-muted">{line.notes ?? ""}</span>
                {/* Delete — shared two-tap trash confirm. Posts the unchanged
                    deleteBomLineAction (plain FormData action); the hidden `id`
                    is carried inside DeleteConfirmButton's own form. */}
                <div className="flex items-center justify-end">
                  <DeleteConfirmButton
                    action={deleteBomLineAction}
                    id={line.id}
                    hint="Delete BOM line"
                    ariaLabel="Delete BOM line"
                    confirmAriaLabel="Confirm delete BOM line"
                    disabled={disabled}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <CreatePartDialog
        open={showPartDialog}
        onClose={() => setShowPartDialog(false)}
        onCreated={(p) => {
          setSessionParts((prev) => [...prev, p]);
          setShowPartDialog(false);
        }}
      />
    </div>
  );
}
