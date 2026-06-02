"use client";

// Checklist item editor (Task 13.4) — bench / shop-floor redesign.
//
// Renders one checklist's item list with inline edit + tick + reorder +
// delete + N/A. Mounted as the expanded body of each Checklist row on the
// Revision / Build / Board panes AND inside the guide's StageGate (via
// GuideChecklistEditor). The redesign is shared, so it applies on every
// surface; the component's props + behavior are unchanged.
//
// USE CASE: this list is read on a screen while someone is physically
// assembling / soldering — often one-handed, possibly gloved, glancing up
// between steps. So the design optimizes for: big tap targets, a large
// obvious checkbox, high-contrast glanceable rows (zebra striping), and
// sleek inline-SVG icon buttons (Tooltip + aria-label) instead of small text
// buttons. See `icons.tsx` for the glyphs.
//
// Reorder uses up/down chevron buttons (no external dnd library) — the
// `reorderChecklistItems` action takes the canonical final order as a list
// of ids and swaps ordinals atomically inside a Serializable tx (negative-
// ordinal scratch pass to dodge the `@@unique` constraint mid-swap).
//
// Tick semantics: the server stamps `completedAt` + `completedById` on
// first transition to `checked = true` and clears them on `false`. The UI
// just sends the next boolean — no client-side audit logic.
//
// Delete carries a lightweight inline two-tap confirm (trash → confirm /
// cancel) so an accidental gloved tap can't drop a step; the underlying
// server action + signature are unchanged.
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
import { Tooltip } from "@/components/Tooltip";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CloseIcon,
  NotApplicableIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/icons";

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

// Shared ghost icon button used for every per-row action. Renders a real
// <button> (keyboard + SR accessible via `aria-label`), wrapped in a <Tooltip>
// so the label shows on hover/focus — consistent with SaveButton /
// MarkBringupCompleteButton across the app. No border, no filled background:
// just a muted ghost glyph that warms to gold on hover. The `p-2.5` padding
// around the `h-5 w-5` glyph preserves a ~40px touch target for bench use.
//
// The Tooltip's Radix Trigger forwards a ref + handlers to its single child.
// A disabled <button> fires no pointer/focus events, so (matching SaveButton)
// we wrap the button in a focusable <span> so the tooltip stays reachable;
// the `aria-label` on the button remains the always-available accessible name.
function IconButton({
  hint,
  ariaLabel,
  children,
  type = "submit",
  onClick,
  disabled,
  tone = "default",
}: {
  hint: string;
  ariaLabel: string;
  children: React.ReactNode;
  type?: "submit" | "button";
  onClick?: () => void;
  disabled?: boolean;
  /** `danger` tints toward alert-red on hover (destructive actions). */
  tone?: "default" | "danger";
}) {
  const toneClasses =
    tone === "danger"
      ? "text-muted hover:text-alert-red hover:bg-navy-dark/40"
      : "text-muted hover:text-command-gold hover:bg-navy-dark/40";
  return (
    <Tooltip content={hint}>
      <span
        tabIndex={0}
        className="inline-flex rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-command-gold"
      >
        <button
          type={type}
          aria-label={ariaLabel}
          onClick={onClick}
          disabled={disabled}
          className={`inline-flex shrink-0 items-center justify-center rounded p-2.5 transition-colors disabled:opacity-40 disabled:hover:bg-transparent ${toneClasses} disabled:hover:text-muted`}
        >
          {children}
        </button>
      </span>
    </Tooltip>
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
  direction,
  disabled,
  onMutated,
}: {
  ids: string[];
  checklistId: string;
  direction: "up" | "down";
  disabled?: boolean;
  onMutated?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const isUp = direction === "up";
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
      <IconButton
        hint={isUp ? "Move up" : "Move down"}
        ariaLabel={isUp ? "Move up" : "Move down"}
        disabled={disabled || isPending}
      >
        {isUp ? (
          <ChevronUpIcon className="h-5 w-5" />
        ) : (
          <ChevronDownIcon className="h-5 w-5" />
        )}
      </IconButton>
    </form>
  );
}

// Primary toggle — the most-used action. A real <button> with `role="checkbox"`
// + `aria-checked` conveying the state, named statelessly by the item label (so
// a screen reader announces e.g. "<label>, checkbox, checked" rather than a
// redundant action verb + state). Small gold filled check when checked (dark
// glyph on gold, matching the reference bench guide's gold checkmarks); a thin
// gold-ringed transparent well otherwise. 28px square — small but still a
// comfortable tap target paired with the click-to-toggle label area (see
// ItemRow), which provides the larger hit zone for gloved bench use. This
// remains the explicit, labelled checkbox.
function ToggleCheckbox({
  item,
  disabled,
}: {
  item: ChecklistItemRow;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  const blocked = disabled || item.notApplicable;
  return (
    <button
      type="submit"
      role="checkbox"
      aria-checked={item.checked}
      aria-label={item.label || `Item ${item.ordinal + 1}`}
      disabled={blocked || pending}
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-command-gold ${
        item.checked
          ? "border-command-gold bg-command-gold text-deep-space"
          : "border-command-gold bg-transparent text-transparent hover:border-gold-light"
      } ${blocked ? "opacity-40" : ""}`}
    >
      <CheckIcon className="h-4 w-4" />
    </button>
  );
}

function ItemRow({
  item,
  rowIndex,
  reorderUpIds,
  reorderDownIds,
  canMoveUp,
  canMoveDown,
  checklistId,
  disabled,
  onMutated,
}: {
  item: ChecklistItemRow;
  rowIndex: number;
  reorderUpIds: string[];
  reorderDownIds: string[];
  canMoveUp: boolean;
  canMoveDown: boolean;
  checklistId: string;
  disabled?: boolean;
  onMutated?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
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

  // Visible alternating rows on the near-black (deep-space) table surface — a
  // NEUTRAL light wash (not navy, which vanished against the pane's blue) so the
  // alternation actually reads, like the bench reference table. Light hover.
  // Resolved rows dim a touch. Dividers come from `divide-y` on the <ul>.
  const zebra = rowIndex % 2 === 1 ? "bg-white/[0.04]" : "";
  const resolved = item.checked || item.notApplicable;
  // The label area is a second large toggle target. We render it as a tiny
  // form so the click posts the same toggle action as the explicit checkbox.
  // Disabled when frozen or N/A (matching the checkbox), in which case it is
  // a plain (non-interactive) container.
  const labelToggleDisabled = disabled || item.notApplicable;

  return (
    <li
      className={`transition-colors hover:bg-white/[0.06] ${zebra} ${
        resolved ? "opacity-70" : ""
      }`}
    >
      <div className="flex items-center gap-3 px-2 py-3.5 sm:gap-4">
        {/* Checkbox — its own form so the toggle posts on submit. */}
        <form action={toggleAction} className="flex items-center">
          <input type="hidden" name="id" value={item.id} />
          <input
            type="hidden"
            name="nextChecked"
            value={item.checked ? "false" : "true"}
          />
          <ToggleCheckbox item={item} disabled={disabled} />
        </form>

        <div className="min-w-0 flex-1">
          {/* Click-the-label-to-toggle: a large secondary hit zone wrapping
              the label cell. Same action as the checkbox; we render it as a
              full-width <button> when toggling is allowed, else a plain div.
              The explicit checkbox above remains the labelled control, so we
              mark this convenience target aria-hidden to avoid a duplicate
              announcement for SR users. */}
          {labelToggleDisabled ? (
            <div className="py-1">
              <ChecklistItemLabelCell
                ordinal={item.ordinal}
                label={item.label}
                checked={item.checked}
                notApplicable={item.notApplicable}
              />
            </div>
          ) : (
            <form action={toggleAction}>
              <input type="hidden" name="id" value={item.id} />
              <input
                type="hidden"
                name="nextChecked"
                value={item.checked ? "false" : "true"}
              />
              <button
                type="submit"
                aria-hidden
                tabIndex={-1}
                className="block w-full rounded py-1 text-left transition-colors hover:bg-command-gold/5"
              >
                <ChecklistItemLabelCell
                  ordinal={item.ordinal}
                  label={item.label}
                  checked={item.checked}
                  notApplicable={item.notApplicable}
                />
              </button>
            </form>
          )}

          {item.expectedValue || item.actualValue ? (
            <p className="mt-1 font-mono text-xs uppercase tracking-wider text-muted">
              {item.expectedValue ? (
                <>
                  Expected:{" "}
                  <span className="text-link-muted">{item.expectedValue}</span>
                </>
              ) : null}
              {item.expectedValue && item.actualValue ? " · " : null}
              {item.actualValue ? (
                <>
                  Actual:{" "}
                  <span className="text-link-muted">{item.actualValue}</span>
                </>
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

        {/* Action icon cluster — wraps on narrow screens; every control is a
            44px touch target. */}
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          <ReorderButton
            ids={reorderUpIds}
            checklistId={checklistId}
            direction="up"
            disabled={disabled || !canMoveUp}
            onMutated={onMutated}
          />
          <ReorderButton
            ids={reorderDownIds}
            checklistId={checklistId}
            direction="down"
            disabled={disabled || !canMoveDown}
            onMutated={onMutated}
          />

          {/* N/A toggle (m16 / Task 16.10). Posts to
              `editChecklistItem({ id, notApplicable })` via the dedicated
              form-action wrapper. Disabled when the row is already checked
              (the Zod refinement forbids both true). Active state = gold fill. */}
          <form action={naAction} className="inline-block">
            <input type="hidden" name="id" value={item.id} />
            <input
              type="hidden"
              name="nextNotApplicable"
              value={item.notApplicable ? "false" : "true"}
            />
            <Tooltip content={item.notApplicable ? "Clear N/A" : "Mark N/A"}>
              <span
                tabIndex={0}
                className="inline-flex rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-command-gold"
              >
                <button
                  type="submit"
                  aria-pressed={item.notApplicable}
                  aria-label={
                    item.notApplicable ? "Clear N/A" : "Mark as N/A"
                  }
                  disabled={disabled || item.checked}
                  className={`inline-flex shrink-0 items-center justify-center rounded p-2.5 transition-colors disabled:opacity-40 ${
                    item.notApplicable
                      ? "text-command-gold hover:bg-navy-dark/40"
                      : "text-muted hover:bg-navy-dark/40 hover:text-command-gold"
                  }`}
                >
                  <NotApplicableIcon className="h-5 w-5" />
                </button>
              </span>
            </Tooltip>
          </form>

          {/* Edit toggle (pencil / close). */}
          <IconButton
            type="button"
            hint={editing ? "Cancel edit" : "Edit item"}
            ariaLabel={editing ? "Cancel edit" : "Edit item"}
            onClick={() => setEditing((v) => !v)}
            disabled={disabled}
          >
            {editing ? (
              <CloseIcon className="h-5 w-5" />
            ) : (
              <PencilIcon className="h-5 w-5" />
            )}
          </IconButton>

          {/* Delete — inline two-tap confirm so a stray gloved tap can't drop
              a step. First tap arms it (trash → confirm ✓ / cancel ✕); the
              confirm submits the unchanged deleteChecklistItem action. */}
          {confirmingDelete ? (
            <>
              <form action={deleteAction} className="inline-block">
                <input type="hidden" name="id" value={item.id} />
                <IconButton
                  hint="Confirm delete"
                  ariaLabel="Confirm delete item"
                  disabled={disabled}
                  tone="danger"
                >
                  {/* Armed confirm reads red at rest (the icon inherits this
                      span's color via currentColor) so the destructive step is
                      unmistakable while the button stays ghost-light. */}
                  <span className="text-alert-red">
                    <CheckIcon className="h-5 w-5" />
                  </span>
                </IconButton>
              </form>
              <IconButton
                type="button"
                hint="Keep item"
                ariaLabel="Cancel delete"
                onClick={() => setConfirmingDelete(false)}
                disabled={disabled}
              >
                <CloseIcon className="h-5 w-5" />
              </IconButton>
            </>
          ) : (
            <IconButton
              type="button"
              hint="Delete item"
              ariaLabel="Delete item"
              onClick={() => setConfirmingDelete(true)}
              disabled={disabled}
              tone="danger"
            >
              <TrashIcon className="h-5 w-5" />
            </IconButton>
          )}
        </div>
      </div>

      {editing ? (
        <form
          action={editAction}
          className="space-y-2 border-t border-panel-border px-3 pb-3 pt-3"
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
              className="mt-1 w-full rounded border border-panel-border bg-deep-space px-3 py-2 text-base text-link-muted focus:border-command-gold focus:outline-none"
            />
            <FieldError messages={editState.errors?.label} />
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label className="block font-mono text-xs uppercase tracking-wider text-muted">
                Expected
              </label>
              <input
                name="expectedValue"
                defaultValue={item.expectedValue ?? ""}
                maxLength={500}
                className="mt-1 w-full rounded border border-panel-border bg-deep-space px-3 py-2 text-base text-link-muted focus:border-command-gold focus:outline-none"
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
                className="mt-1 w-full rounded border border-panel-border bg-deep-space px-3 py-2 text-base text-link-muted focus:border-command-gold focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <SaveButton />
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded border border-panel-border bg-navy-dark px-3 py-2 font-mono text-xs uppercase tracking-wider text-muted hover:border-command-gold hover:text-command-gold"
            >
              Done
            </button>
          </div>
        </form>
      ) : null}

      {deleteState.message ? (
        <div className="px-3 pb-3">
          <InlineBanner variant="error">{deleteState.message}</InlineBanner>
        </div>
      ) : null}
    </li>
  );
}

function AddItemButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-md border border-command-gold bg-navy-dark px-4 py-2.5 font-mono text-sm uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space disabled:opacity-50"
    >
      <PlusIcon className="h-4 w-4" />
      {pending ? "WORKING…" : "Add item"}
    </button>
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
        <ul className="divide-y divide-white/[0.06]">
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
                rowIndex={idx}
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
              className="mt-1 w-full rounded border border-panel-border bg-deep-space px-3 py-2 text-base text-link-muted focus:border-command-gold focus:outline-none"
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
              className="mt-1 w-full rounded border border-panel-border bg-deep-space px-3 py-2 text-base text-link-muted focus:border-command-gold focus:outline-none"
            />
          </div>
          <AddItemButton />
        </form>
      ) : null}
    </div>
  );
}
