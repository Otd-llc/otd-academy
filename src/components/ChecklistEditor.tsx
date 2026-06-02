"use client";

// Checklist item editor (Task 13.4).
//
// Renders one checklist's item list with inline edit + tick + reorder +
// delete. Mounted as the expanded body of each Checklist row on the
// Build / Board panes (BuildChecklistsPane, BoardChecklistsPane).
//
// Reorder uses up/down arrow buttons (no external dnd library) — the
// `reorderChecklistItems` action takes the canonical final order as a list
// of ids and swaps ordinals atomically inside a Serializable tx (negative-
// ordinal scratch pass to dodge the `@@unique` constraint mid-swap).
//
// Tick semantics: the server stamps `completedAt` + `completedById` on
// first transition to `checked = true` and clears them on `false`. The UI
// just sends the next boolean — no client-side audit logic.
//
// Completion percentage is computed from `items.length` + the number of
// `checked` rows; pane rows expect the parent to pass the latest items
// snapshot so the % stays in sync without a re-fetch.
import { useActionState, useEffect, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import {
  addChecklistItemFormAction,
  type ChecklistFormState,
  deleteChecklistItemFormAction,
  editChecklistItemFormAction,
  reorderChecklistItemsFormAction,
  toggleChecklistItemFormAction,
  toggleChecklistItemNotApplicableFormAction,
} from "@/lib/actions/checklists-form";
import { InlineBanner } from "@/components/InlineBanner";
import { ChecklistItemLabelCell } from "@/components/ChecklistItemLabelCell";
import { SaveButton } from "@/components/SaveButton";

const initialState: ChecklistFormState = {};

// Fire an optional post-commit callback once a form action settles with
// `ok: true`. Used only by the guide route (via `onMutated`) to trigger a
// router.refresh(); non-guide panes pass no callback, so this is a no-op for
// them and their behavior is unchanged.
function useMutatedEffect(
  state: ChecklistFormState,
  onMutated?: () => void,
): void {
  useEffect(() => {
    if (state.ok) onMutated?.();
  }, [state, onMutated]);
}

export type ChecklistItemRow = {
  id: string;
  ordinal: number;
  label: string;
  expectedValue: string | null;
  actualValue: string | null;
  checked: boolean;
  // m16: when true the row is exempt from the gate predicates' unchecked-items
  // branch. Mutually exclusive with `checked` (DB CHECK
  // `checklist_item_checked_xor_napplicable` + Zod refinement enforce it).
  notApplicable: boolean;
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded border border-command-gold bg-navy-dark px-2 py-1 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space disabled:opacity-50"
    >
      {pending ? "WORKING…" : label}
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

function ReorderButton({
  ids,
  checklistId,
  label,
  ariaLabel,
  disabled,
  onMutated,
}: {
  ids: string[];
  checklistId: string;
  label: string;
  ariaLabel: string;
  disabled?: boolean;
  onMutated?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  return (
    <form
      action={(fd: FormData) => {
        fd.set("checklistId", checklistId);
        for (const id of ids) fd.append("orderedIds", id);
        startTransition(async () => {
          const result = await reorderChecklistItemsFormAction(
            initialState,
            fd,
          );
          if (result.ok) onMutated?.();
        });
      }}
      className="inline-block"
    >
      <button
        type="submit"
        aria-label={ariaLabel}
        disabled={disabled || isPending}
        className="rounded border border-panel-border bg-navy-dark px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-link-muted hover:border-command-gold hover:text-command-gold disabled:opacity-40"
      >
        {label}
      </button>
    </form>
  );
}

function ItemRow({
  item,
  reorderUpIds,
  reorderDownIds,
  canMoveUp,
  canMoveDown,
  checklistId,
  disabled,
  onMutated,
}: {
  item: ChecklistItemRow;
  reorderUpIds: string[];
  reorderDownIds: string[];
  canMoveUp: boolean;
  canMoveDown: boolean;
  checklistId: string;
  disabled?: boolean;
  onMutated?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editState, editAction] = useActionState(
    editChecklistItemFormAction,
    initialState,
  );
  const [toggleState, toggleAction] = useActionState(
    toggleChecklistItemFormAction,
    initialState,
  );
  const [naState, naAction] = useActionState(
    toggleChecklistItemNotApplicableFormAction,
    initialState,
  );
  const [deleteState, deleteAction] = useActionState(
    deleteChecklistItemFormAction,
    initialState,
  );

  useMutatedEffect(editState, onMutated);
  useMutatedEffect(toggleState, onMutated);
  useMutatedEffect(naState, onMutated);
  useMutatedEffect(deleteState, onMutated);

  return (
    <li className="space-y-2 py-3 font-mono text-sm">
      <div className="flex items-start gap-3">
        {/* Checkbox — a tiny dedicated form so the checkbox toggle posts
            on change. Disabled when the surrounding pane is frozen OR when
            the row is flagged N/A (mutually exclusive per the DB CHECK
            and Zod refinement). */}
        <form action={toggleAction} className="pt-1">
          <input type="hidden" name="id" value={item.id} />
          <input
            type="hidden"
            name="nextChecked"
            value={item.checked ? "false" : "true"}
          />
          <button
            type="submit"
            aria-label={item.checked ? "Mark unchecked" : "Mark checked"}
            disabled={disabled || item.notApplicable}
            className={`inline-flex h-5 w-5 items-center justify-center rounded border font-mono text-xs ${
              item.checked
                ? "border-status-green bg-status-green text-deep-space"
                : "border-panel-border bg-navy-dark text-muted hover:border-command-gold"
            } ${disabled || item.notApplicable ? "opacity-40" : ""}`}
          >
            {item.checked ? "✓" : ""}
          </button>
        </form>

        <div className="min-w-0 flex-1">
          <ChecklistItemLabelCell
            ordinal={item.ordinal}
            label={item.label}
            checked={item.checked}
            notApplicable={item.notApplicable}
          />
          {item.expectedValue || item.actualValue ? (
            <p className="mt-1 font-mono text-xs uppercase tracking-wider text-muted">
              {item.expectedValue ? (
                <>Expected: <span className="text-link-muted">{item.expectedValue}</span></>
              ) : null}
              {item.expectedValue && item.actualValue ? " · " : null}
              {item.actualValue ? (
                <>Actual: <span className="text-link-muted">{item.actualValue}</span></>
              ) : null}
            </p>
          ) : null}
          {toggleState.message ? (
            <p className="mt-1 font-mono text-xs font-bold text-alert-red">
              {toggleState.message}
            </p>
          ) : null}
          {naState.message ? (
            <p className="mt-1 font-mono text-xs font-bold text-alert-red">
              {naState.message}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <div className="flex gap-1">
            <ReorderButton
              ids={reorderUpIds}
              checklistId={checklistId}
              label="↑"
              ariaLabel="Move up"
              disabled={disabled || !canMoveUp}
              onMutated={onMutated}
            />
            <ReorderButton
              ids={reorderDownIds}
              checklistId={checklistId}
              label="↓"
              ariaLabel="Move down"
              disabled={disabled || !canMoveDown}
              onMutated={onMutated}
            />
          </div>
          {/* N/A toggle pill (m16 / Task 16.10). Posts to
              `editChecklistItem({ id, notApplicable })` via the dedicated
              form-action wrapper. When the row is already checked we'd
              violate the Zod refinement by flipping N/A on, so the button
              is disabled in that case — the user un-checks first. */}
          <form action={naAction} className="inline-block">
            <input type="hidden" name="id" value={item.id} />
            <input
              type="hidden"
              name="nextNotApplicable"
              value={item.notApplicable ? "false" : "true"}
            />
            <button
              type="submit"
              aria-label={item.notApplicable ? "Clear N/A" : "Mark as N/A"}
              disabled={disabled || item.checked}
              className={`rounded border px-2 py-1 font-mono text-[10px] uppercase tracking-wider ${
                item.notApplicable
                  ? "border-command-gold bg-command-gold text-deep-space"
                  : "border-panel-border bg-navy-dark text-muted hover:border-command-gold hover:text-command-gold"
              } disabled:opacity-40`}
            >
              N/A
            </button>
          </form>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            disabled={disabled}
            className="rounded border border-panel-border bg-navy-dark px-2 py-1 font-mono text-xs uppercase tracking-wider text-link-muted hover:border-command-gold hover:text-command-gold disabled:opacity-40"
          >
            {editing ? "Cancel" : "Edit"}
          </button>
        </div>
      </div>

      {editing ? (
        <form
          action={editAction}
          className="space-y-2 border-t border-panel-border pt-3"
        >
          <input type="hidden" name="id" value={item.id} />
          {editState.message ? (
            <InlineBanner variant="error">{editState.message}</InlineBanner>
          ) : null}

          <div>
            <label className="block font-mono text-xs uppercase tracking-wider text-muted">
              Label
            </label>
            <input
              name="label"
              defaultValue={item.label}
              maxLength={500}
              className="mt-1 w-full rounded border border-panel-border bg-deep-space px-2 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
            />
            <FieldError messages={editState.errors?.label} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-mono text-xs uppercase tracking-wider text-muted">
                Expected
              </label>
              <input
                name="expectedValue"
                defaultValue={item.expectedValue ?? ""}
                maxLength={500}
                className="mt-1 w-full rounded border border-panel-border bg-deep-space px-2 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-mono text-xs uppercase tracking-wider text-muted">
                Actual
              </label>
              <input
                name="actualValue"
                defaultValue={item.actualValue ?? ""}
                maxLength={500}
                className="mt-1 w-full rounded border border-panel-border bg-deep-space px-2 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <SaveButton />
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded border border-panel-border bg-navy-dark px-2 py-1 font-mono text-xs uppercase tracking-wider text-muted hover:border-command-gold hover:text-command-gold"
            >
              Done
            </button>
          </div>
        </form>
      ) : null}

      <form action={deleteAction} className="flex justify-end">
        <input type="hidden" name="id" value={item.id} />
        <button
          type="submit"
          disabled={disabled}
          className="rounded border border-panel-border bg-navy-dark px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-alert-red hover:bg-alert-red hover:text-deep-space disabled:opacity-40"
        >
          Delete item
        </button>
      </form>
      {deleteState.message ? (
        <InlineBanner variant="error">{deleteState.message}</InlineBanner>
      ) : null}
    </li>
  );
}

export function ChecklistEditor({
  checklistId,
  items,
  disabled,
  disabledReason,
  onMutated,
}: {
  checklistId: string;
  items: ChecklistItemRow[];
  disabled?: boolean;
  disabledReason?: string;
  /**
   * Optional post-commit hook. Fired once after ANY successful item mutation
   * (add / edit / toggle / N/A / delete / reorder — each gated on `ok: true`).
   * Existing non-guide panes (Revision/Build/Board checklist panes) omit it,
   * so their behavior is unchanged; the guide route supplies it to trigger a
   * router.refresh(), since the checklist actions revalidate the owner pane
   * route, not the guide route.
   */
  onMutated?: () => void;
}) {
  const [addState, addAction] = useActionState(
    addChecklistItemFormAction,
    initialState,
  );

  useMutatedEffect(addState, onMutated);

  // Pre-compute the reorder id-lists so each ItemRow gets the exact final
  // order for "move up" and "move down" without recomputing.
  const sorted = [...items].sort((a, b) => a.ordinal - b.ordinal);

  return (
    <div className="space-y-3">
      {disabled && disabledReason ? (
        <p className="font-mono text-xs uppercase tracking-wider text-muted">
          {disabledReason}
        </p>
      ) : null}

      {sorted.length === 0 ? (
        <p className="font-mono text-xs uppercase tracking-wider text-muted">
          NO ITEMS YET.
        </p>
      ) : (
        <ul className="divide-y divide-panel-border border-t border-panel-border">
          {sorted.map((item, idx) => {
            // Build the orderedIds for an up-swap (item at idx → idx-1):
            const reorderUpIds = sorted.map((i) => i.id);
            if (idx > 0) {
              [reorderUpIds[idx - 1], reorderUpIds[idx]] = [
                reorderUpIds[idx]!,
                reorderUpIds[idx - 1]!,
              ];
            }
            // Build the orderedIds for a down-swap (item at idx → idx+1):
            const reorderDownIds = sorted.map((i) => i.id);
            if (idx < sorted.length - 1) {
              [reorderDownIds[idx], reorderDownIds[idx + 1]] = [
                reorderDownIds[idx + 1]!,
                reorderDownIds[idx]!,
              ];
            }
            return (
              <ItemRow
                key={item.id}
                item={item}
                reorderUpIds={reorderUpIds}
                reorderDownIds={reorderDownIds}
                canMoveUp={idx > 0}
                canMoveDown={idx < sorted.length - 1}
                checklistId={checklistId}
                disabled={disabled}
                onMutated={onMutated}
              />
            );
          })}
        </ul>
      )}

      {/* Add-item form */}
      {!disabled ? (
        <form
          action={addAction}
          className="space-y-2 border-t border-panel-border pt-3"
        >
          <input type="hidden" name="checklistId" value={checklistId} />
          {addState.message ? (
            <InlineBanner variant="error">{addState.message}</InlineBanner>
          ) : null}
          <div>
            <label className="block font-mono text-xs uppercase tracking-wider text-muted">
              New item label
            </label>
            <input
              name="label"
              required
              maxLength={500}
              className="mt-1 w-full rounded border border-panel-border bg-deep-space px-2 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
            />
            <FieldError messages={addState.errors?.label} />
          </div>
          <div>
            <label className="block font-mono text-xs uppercase tracking-wider text-muted">
              Expected value (optional)
            </label>
            <input
              name="expectedValue"
              maxLength={500}
              className="mt-1 w-full rounded border border-panel-border bg-deep-space px-2 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
            />
          </div>
          <SubmitButton label="Add item" />
        </form>
      ) : null}
    </div>
  );
}
