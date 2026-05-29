"use client";

// In-page BomLine editor for the Artifacts pane. Phase 5a: simple add-form
// + line-row list with delete buttons. Edit-in-place per-row is out of
// scope; Phase 8+ will refine the UX. The "Create new Part" modal mounts
// inside this component (Task 5.5).
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  createBomLineFormAction,
  deleteBomLineAction,
  type BomLineFormState,
} from "@/lib/actions/bom-lines";
import { CreatePartDialog, type PartOption } from "@/components/CreatePartDialog";
import { InlineBanner } from "@/components/InlineBanner";

type BomLineRow = {
  id: string;
  refDes: string;
  quantity: number;
  notes: string | null;
  part: PartOption;
};

const initialState: BomLineFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded border border-command-gold bg-navy-dark px-4 py-2 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space disabled:opacity-50"
    >
      {pending ? "WORKING…" : "Add line"}
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

export function BomEditor({
  revisionId,
  lines,
  parts,
  disabled,
  disabledReason,
}: {
  revisionId: string;
  lines: BomLineRow[];
  parts: PartOption[];
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [state, action] = useActionState(
    createBomLineFormAction,
    initialState,
  );
  const [showPartDialog, setShowPartDialog] = useState(false);
  // Track parts created during this session so the dropdown reflects them
  // immediately. The server-rendered list is the source of truth on next
  // navigation/revalidation.
  const [sessionParts, setSessionParts] = useState<PartOption[]>([]);
  const allParts = [...parts, ...sessionParts];

  return (
    <div className="space-y-4">
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

          <div className="md:col-span-2">
            <label className="block font-mono text-xs uppercase tracking-wider text-muted">
              Part
            </label>
            <div className="mt-1 flex gap-1">
              <select
                name="partId"
                required
                disabled={disabled}
                className="flex-1 rounded border border-panel-border bg-navy-dark px-2 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none disabled:opacity-50"
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
                className="rounded border border-panel-border bg-deep-space px-2 py-2 font-mono text-xs uppercase tracking-wider text-signal-blue transition-colors hover:border-signal-blue disabled:opacity-50"
                title="Create new Part"
              >
                +Part
              </button>
            </div>
            <FieldError messages={state.errors?.partId} />
          </div>

          <div>
            <label className="block font-mono text-xs uppercase tracking-wider text-muted">
              RefDes
            </label>
            <input
              name="refDes"
              required
              disabled={disabled}
              placeholder="R1 or C1,C2,C3"
              className="mt-1 w-full rounded border border-panel-border bg-navy-dark px-2 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none disabled:opacity-50"
            />
            <FieldError messages={state.errors?.refDes} />
          </div>

          <div>
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
              className="mt-1 w-full rounded border border-panel-border bg-navy-dark px-2 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none disabled:opacity-50"
            />
            <FieldError messages={state.errors?.quantity} />
          </div>

          <div className="flex items-end">
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
              className="mt-1 w-full rounded border border-panel-border bg-navy-dark px-2 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none disabled:opacity-50"
            />
            <FieldError messages={state.errors?.notes} />
          </div>
        </form>
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
                  {line.part.manufacturer} {line.part.mpn}
                </span>
                <span className="text-muted">qty {line.quantity}</span>
                <span className="text-muted">{line.notes ?? ""}</span>
                <form action={deleteBomLineAction}>
                  <input type="hidden" name="id" value={line.id} />
                  <button
                    type="submit"
                    disabled={disabled}
                    className="rounded border border-panel-border bg-deep-space px-2 py-0.5 font-mono text-xs uppercase tracking-wider text-alert-red transition-colors hover:border-alert-red disabled:opacity-50"
                  >
                    Delete
                  </button>
                </form>
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
