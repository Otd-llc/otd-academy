"use client";

// Client form for /.../builds/[buildLabel]/boards/new. Mirrors the
// NewBuildForm pattern: useActionState + useFormStatus + a Zod-validated
// silkscreenHash input.
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  createBoardFormAction,
  type CreateBoardFormState,
} from "@/lib/actions/boards-form";
import { SILKSCREEN_HASH_RE } from "@/lib/constants";

const initialState: CreateBoardFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded border border-command-gold bg-navy-dark px-6 py-2 font-mono text-sm uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space disabled:opacity-50"
    >
      {pending ? "WORKING…" : "Register board"}
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

export function NewBoardForm({ buildId }: { buildId: string }) {
  const [state, action] = useActionState(createBoardFormAction, initialState);

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="buildId" value={buildId} />

      {state.message && (
        <p className="border-l-4 border-alert-red bg-navy-dark px-4 py-3 font-mono text-sm font-bold text-alert-red">
          {state.message}
        </p>
      )}

      <div>
        <label
          htmlFor="serial"
          className="block font-mono text-xs uppercase tracking-wider text-muted"
        >
          Serial
        </label>
        <input
          id="serial"
          name="serial"
          required
          maxLength={32}
          placeholder="B01"
          className="mt-1 w-full rounded border border-panel-border bg-deep-space px-3 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
        />
        <p className="mt-1 font-mono text-xs text-muted">
          case-preserving; must be unique per build (case-insensitive)
        </p>
        <FieldError messages={state.errors?.serial} />
      </div>

      <div>
        <label
          htmlFor="silkscreenHash"
          className="block font-mono text-xs uppercase tracking-wider text-muted"
        >
          Silkscreen hash (optional)
        </label>
        <input
          id="silkscreenHash"
          name="silkscreenHash"
          maxLength={64}
          // Mirrors SILKSCREEN_HASH_RE for client-side validation. The Zod
          // refinement on the server is the authoritative check; this is the
          // UX hint that catches typos before submit.
          pattern={SILKSCREEN_HASH_RE.source}
          placeholder="g1ebc1cc"
          className="mt-1 w-full rounded border border-panel-border bg-deep-space px-3 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
        />
        <p className="mt-1 font-mono text-xs text-muted">
          git short or long hash (7-40 hex, optional &lsquo;g&rsquo; prefix)
        </p>
        <FieldError messages={state.errors?.silkscreenHash} />
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton />
      </div>
    </form>
  );
}
