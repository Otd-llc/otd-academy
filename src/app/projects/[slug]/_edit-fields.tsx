"use client";

// Inline edit-in-place fields for the project detail page. Each field is a
// tiny client form that submits the matching server action. Field errors
// come back via useActionState.
//
// Two patterns, picked per field type:
//   • Autosave (no Save button) for selects + checkboxes — picking a value
//     or toggling commits immediately via form.requestSubmit(). These
//     inputs have no intermediate "typing" state worth waiting for; the
//     visible field state IS the confirmation.
//   • Inline floppy icon Save button for text inputs / textareas /
//     numbers / URLs — these need an explicit commit because the user
//     may still be typing. The icon sits beside the field, not below,
//     so a column of stacked SAVE rectangles doesn't drown out the
//     fields themselves.
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  editProjectCriticalPathAction,
  editProjectDescriptionAction,
  editProjectDisciplineTaughtAction,
  editProjectHasMainsNetAction,
  editProjectLevelAction,
  editProjectNameAction,
  editProjectRepoUrlAction,
  editProjectRequiresStripboardAction,
  editProjectTargetCostAction,
  editProjectTrackAction,
  type ProjectFormState,
} from "@/lib/actions/projects";
import { InlineBanner } from "@/components/InlineBanner";

const initialState: ProjectFormState = {};

// Square glass icon button. While the action is running, the floppy
// flips to a rotating arc so the user knows it's in flight.
function SaveButton({ className = "" }: { className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      title={pending ? "Saving…" : "Save"}
      aria-label={pending ? "Saving" : "Save"}
      className={`glass-button inline-flex h-9 w-9 shrink-0 items-center justify-center rounded text-command-gold transition-colors hover:text-gold-light disabled:opacity-50 ${className}`}
    >
      {pending ? (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          aria-hidden
          className="h-4 w-4 animate-spin"
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      ) : (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className="h-4 w-4"
        >
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
          <polyline points="17 21 17 13 7 13 7 21" />
          <polyline points="7 3 7 8 15 8" />
        </svg>
      )}
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

function ActionMessage({ state }: { state: ProjectFormState }) {
  if (!state.message) return null;
  return (
    <div className="mt-1">
      <InlineBanner variant="error">{state.message}</InlineBanner>
    </div>
  );
}

export function EditNameForm({ id, value }: { id: string; value: string }) {
  const [state, action] = useActionState(editProjectNameAction, initialState);
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="id" value={id} />
      <div className="flex items-start gap-2">
        <input
          name="name"
          defaultValue={value}
          required
          maxLength={200}
          className="flex-1 rounded border border-panel-border bg-deep-space px-3 py-2 font-display text-2xl tracking-wider text-command-gold focus:border-command-gold focus:outline-none"
        />
        <SaveButton className="mt-1 h-10 w-10" />
      </div>
      <FieldError messages={state.errors?.name} />
      <ActionMessage state={state} />
    </form>
  );
}

export function EditDescriptionForm({
  id,
  value,
}: {
  id: string;
  value: string | null;
}) {
  const [state, action] = useActionState(
    editProjectDescriptionAction,
    initialState,
  );
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <label className="block font-mono text-xs uppercase tracking-wider text-muted">
        Description
      </label>
      <div className="flex items-start gap-2">
        <textarea
          name="description"
          defaultValue={value ?? ""}
          rows={3}
          maxLength={2000}
          className="flex-1 rounded border border-panel-border bg-deep-space px-3 py-2 font-serif text-base text-link-muted focus:border-command-gold focus:outline-none"
        />
        <SaveButton />
      </div>
      <FieldError messages={state.errors?.description} />
      <ActionMessage state={state} />
    </form>
  );
}

export function EditRepoUrlForm({
  id,
  value,
}: {
  id: string;
  value: string | null;
}) {
  const [state, action] = useActionState(
    editProjectRepoUrlAction,
    initialState,
  );
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <label className="block font-mono text-xs uppercase tracking-wider text-muted">
        Repo URL
      </label>
      <div className="flex items-start gap-2">
        <input
          name="repoUrl"
          type="url"
          defaultValue={value ?? ""}
          placeholder="https://github.com/you/your-project"
          className="flex-1 rounded border border-panel-border bg-deep-space px-3 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
        />
        <SaveButton />
      </div>
      <FieldError messages={state.errors?.repoUrl} />
      <ActionMessage state={state} />
    </form>
  );
}

export function EditTargetCostForm({
  id,
  value,
}: {
  id: string;
  value: string | null;
}) {
  const [state, action] = useActionState(
    editProjectTargetCostAction,
    initialState,
  );
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <label className="block font-mono text-xs uppercase tracking-wider text-muted">
        Target cost (USD)
      </label>
      <div className="flex items-start gap-2">
        <input
          name="targetCost"
          type="number"
          step="0.01"
          min="0"
          defaultValue={value ?? ""}
          className="flex-1 rounded border border-panel-border bg-deep-space px-3 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
        />
        <SaveButton />
      </div>
      <FieldError messages={state.errors?.targetCost} />
      <ActionMessage state={state} />
    </form>
  );
}

export function EditTrackForm({
  id,
  value,
}: {
  id: string;
  value: "SENSE" | "ACT" | "POWER" | "COMMS" | null;
}) {
  const [state, action] = useActionState(editProjectTrackAction, initialState);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <label className="block font-mono text-xs uppercase tracking-wider text-muted">
        Track
      </label>
      {/* Autosave: selects commit on change — no explicit Save needed. */}
      <select
        name="track"
        defaultValue={value ?? ""}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="block w-full rounded border border-panel-border bg-deep-space px-3 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
      >
        <option value="">— none —</option>
        <option value="SENSE">SENSE</option>
        <option value="ACT">ACT</option>
        <option value="POWER">POWER</option>
        <option value="COMMS">COMMS</option>
      </select>
      <FieldError messages={state.errors?.track} />
      <ActionMessage state={state} />
    </form>
  );
}

export function EditLevelForm({
  id,
  value,
}: {
  id: string;
  value: "L1" | "L2" | "L3" | null;
}) {
  const [state, action] = useActionState(editProjectLevelAction, initialState);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <label className="block font-mono text-xs uppercase tracking-wider text-muted">
        Level
      </label>
      <select
        name="level"
        defaultValue={value ?? ""}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="block w-full rounded border border-panel-border bg-deep-space px-3 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
      >
        <option value="">— none —</option>
        <option value="L1">L1</option>
        <option value="L2">L2</option>
        <option value="L3">L3</option>
      </select>
      <FieldError messages={state.errors?.level} />
      <ActionMessage state={state} />
    </form>
  );
}

export function EditDisciplineTaughtForm({
  id,
  value,
}: {
  id: string;
  value: string | null;
}) {
  const [state, action] = useActionState(
    editProjectDisciplineTaughtAction,
    initialState,
  );
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <label className="block font-mono text-xs uppercase tracking-wider text-muted">
        Discipline taught
      </label>
      <div className="flex items-start gap-2">
        <input
          name="disciplineTaught"
          type="text"
          maxLength={200}
          defaultValue={value ?? ""}
          className="flex-1 rounded border border-panel-border bg-deep-space px-3 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
        />
        <SaveButton />
      </div>
      <FieldError messages={state.errors?.disciplineTaught} />
      <ActionMessage state={state} />
    </form>
  );
}

export function EditCriticalPathForm({
  id,
  value,
}: {
  id: string;
  value: boolean;
}) {
  const [state, action] = useActionState(
    editProjectCriticalPathAction,
    initialState,
  );
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="id" value={id} />
      {/* Autosave: checkbox commits on toggle. No explicit Save button. */}
      <label className="inline-flex items-center gap-2">
        <input
          name="criticalPath"
          type="checkbox"
          defaultChecked={value}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
        />
        <span className="font-mono text-xs uppercase tracking-wider text-muted">
          Critical path (uncheck for bench tool)
        </span>
      </label>
      <FieldError messages={state.errors?.criticalPath} />
      <ActionMessage state={state} />
    </form>
  );
}

export function EditRequiresStripboardForm({
  id,
  value,
}: {
  id: string;
  value: boolean;
}) {
  const [state, action] = useActionState(
    editProjectRequiresStripboardAction,
    initialState,
  );
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="id" value={id} />
      <label className="inline-flex items-center gap-2">
        <input
          name="requiresStripboard"
          type="checkbox"
          defaultChecked={value}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
        />
        <span className="font-mono text-xs uppercase tracking-wider text-muted">
          Requires stripboard de-risk rung
        </span>
      </label>
      <FieldError messages={state.errors?.requiresStripboard} />
      <ActionMessage state={state} />
    </form>
  );
}

// m18: hasMainsNet edit-in-place. Drives the BOM_SOURCING certified-module
// gate (proposal §3 #5). Mirrors EditRequiresStripboardForm so the inline
// toggle ergonomics stay consistent across curriculum flags.
export function EditHasMainsNetForm({
  id,
  value,
}: {
  id: string;
  value: boolean;
}) {
  const [state, action] = useActionState(
    editProjectHasMainsNetAction,
    initialState,
  );
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="id" value={id} />
      <label
        className="inline-flex items-center gap-2"
        title="When checked, BOM_SOURCING gate requires at least one BomLine.part.isCertifiedModule === true"
      >
        <input
          name="hasMainsNet"
          type="checkbox"
          defaultChecked={value}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
        />
        <span className="font-mono text-xs uppercase tracking-wider text-muted">
          Has mains net (requires certified-module BOM line)
        </span>
      </label>
      <FieldError messages={state.errors?.hasMainsNet} />
      <ActionMessage state={state} />
    </form>
  );
}
