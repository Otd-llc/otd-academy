"use client";

// Inline-edit fields for the Build detail header strip (design §9.2).
//
// Mirrors the EditProject* / EditCommit* pattern from Phase 4/5:
// useActionState + useFormStatus + a tiny per-field form. Each field calls a
// dedicated server action so freeze policy fires per write (a freeze that
// lands mid-edit takes effect on the next field's submit, not via a
// page-level toggle).
//
// Empty string clears the field (the action coerces "" → null per the
// edit semantics defined in src/lib/actions/builds.ts).
import { useActionState } from "react";
import {
  editBuildAssemblyStartedAtAction,
  editBuildNotesAction,
  editBuildOrderedAtAction,
  editBuildPartsOrderRefAction,
  editBuildPcbOrderRefAction,
  editBuildReceivedAtAction,
  type BuildFormState,
} from "@/lib/actions/builds";
import { InlineBanner } from "@/components/InlineBanner";
import { SaveButton } from "@/components/SaveButton";

const initialState: BuildFormState = {};

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) return null;
  return (
    <p className="mt-1 font-mono text-xs font-bold text-alert-red">
      {messages.join("; ")}
    </p>
  );
}

function ActionMessage({ state }: { state: BuildFormState }) {
  if (!state.message) return null;
  return (
    <div className="mt-1">
      <InlineBanner variant="error">{state.message}</InlineBanner>
    </div>
  );
}

function DisabledNote({ reason }: { reason?: string }) {
  if (!reason) return null;
  return (
    <p className="mt-1 font-mono text-xs font-bold text-alert-red">{reason}</p>
  );
}

function toDateInput(value: Date | null): string {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

// ─── Text fields (order refs, notes) ───────────────────────────────────

type TextFieldProps = {
  id: string;
  value: string | null;
  disabled?: boolean;
  disabledReason?: string;
};

export function BuildPcbOrderRefField({
  id,
  value,
  disabled,
  disabledReason,
}: TextFieldProps) {
  const [state, action] = useActionState(
    editBuildPcbOrderRefAction,
    initialState,
  );
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <label className="block font-mono text-xs uppercase tracking-wider text-muted">
        PCB order ref
      </label>
      <div className="flex items-start gap-2">
        <input
          name="pcbOrderRef"
          defaultValue={value ?? ""}
          disabled={disabled}
          maxLength={120}
          placeholder="OSH-1234"
          className="flex-1 rounded border border-panel-border bg-deep-space px-3 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none disabled:opacity-50"
        />
        <SaveButton />
      </div>
      <DisabledNote reason={disabled ? disabledReason : undefined} />
      <FieldError messages={state.errors?.pcbOrderRef} />
      <ActionMessage state={state} />
    </form>
  );
}

export function BuildPartsOrderRefField({
  id,
  value,
  disabled,
  disabledReason,
}: TextFieldProps) {
  const [state, action] = useActionState(
    editBuildPartsOrderRefAction,
    initialState,
  );
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <label className="block font-mono text-xs uppercase tracking-wider text-muted">
        Parts order ref
      </label>
      <div className="flex items-start gap-2">
        <input
          name="partsOrderRef"
          defaultValue={value ?? ""}
          disabled={disabled}
          maxLength={120}
          placeholder="DK-5678"
          className="flex-1 rounded border border-panel-border bg-deep-space px-3 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none disabled:opacity-50"
        />
        <SaveButton />
      </div>
      <DisabledNote reason={disabled ? disabledReason : undefined} />
      <FieldError messages={state.errors?.partsOrderRef} />
      <ActionMessage state={state} />
    </form>
  );
}

export function BuildNotesField({
  id,
  value,
  disabled,
  disabledReason,
}: TextFieldProps) {
  const [state, action] = useActionState(
    editBuildNotesAction,
    initialState,
  );
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <label className="block font-mono text-xs uppercase tracking-wider text-muted">
        Notes
      </label>
      <div className="flex items-start gap-2">
        <textarea
          name="notes"
          defaultValue={value ?? ""}
          disabled={disabled}
          rows={3}
          maxLength={4000}
          className="flex-1 rounded border border-panel-border bg-deep-space px-3 py-2 font-serif text-base text-link-muted focus:border-command-gold focus:outline-none disabled:opacity-50"
        />
        <SaveButton />
      </div>
      <DisabledNote reason={disabled ? disabledReason : undefined} />
      <FieldError messages={state.errors?.notes} />
      <ActionMessage state={state} />
    </form>
  );
}

// ─── Date fields ───────────────────────────────────────────────────────

type DateFieldProps = {
  id: string;
  value: Date | null;
  disabled?: boolean;
  disabledReason?: string;
};

export function BuildOrderedAtField({
  id,
  value,
  disabled,
  disabledReason,
}: DateFieldProps) {
  const [state, action] = useActionState(
    editBuildOrderedAtAction,
    initialState,
  );
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <label className="block font-mono text-xs uppercase tracking-wider text-muted">
        Ordered at
      </label>
      <div className="flex items-start gap-2">
        <input
          type="date"
          name="orderedAt"
          defaultValue={toDateInput(value)}
          disabled={disabled}
          className="flex-1 rounded border border-panel-border bg-deep-space px-3 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none disabled:opacity-50"
        />
        <SaveButton />
      </div>
      <DisabledNote reason={disabled ? disabledReason : undefined} />
      <FieldError messages={state.errors?.orderedAt} />
      <ActionMessage state={state} />
    </form>
  );
}

export function BuildReceivedAtField({
  id,
  value,
  disabled,
  disabledReason,
}: DateFieldProps) {
  const [state, action] = useActionState(
    editBuildReceivedAtAction,
    initialState,
  );
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <label className="block font-mono text-xs uppercase tracking-wider text-muted">
        Received at
      </label>
      <div className="flex items-start gap-2">
        <input
          type="date"
          name="receivedAt"
          defaultValue={toDateInput(value)}
          disabled={disabled}
          className="flex-1 rounded border border-panel-border bg-deep-space px-3 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none disabled:opacity-50"
        />
        <SaveButton />
      </div>
      <DisabledNote reason={disabled ? disabledReason : undefined} />
      <FieldError messages={state.errors?.receivedAt} />
      <ActionMessage state={state} />
    </form>
  );
}

export function BuildAssemblyStartedAtField({
  id,
  value,
  disabled,
  disabledReason,
}: DateFieldProps) {
  const [state, action] = useActionState(
    editBuildAssemblyStartedAtAction,
    initialState,
  );
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <label className="block font-mono text-xs uppercase tracking-wider text-muted">
        Assembly started at
      </label>
      <div className="flex items-start gap-2">
        <input
          type="date"
          name="assemblyStartedAt"
          defaultValue={toDateInput(value)}
          disabled={disabled}
          className="flex-1 rounded border border-panel-border bg-deep-space px-3 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none disabled:opacity-50"
        />
        <SaveButton />
      </div>
      <DisabledNote reason={disabled ? disabledReason : undefined} />
      <FieldError messages={state.errors?.assemblyStartedAt} />
      <ActionMessage state={state} />
    </form>
  );
}
