"use client";

// Inline edit-in-place for a part's canonical `datasheetUrl` on the detail page
// (feature/parts-knowledge). Mirrors the FactGroupCard affordance pattern:
// view → edit-pencil → <input> + Save/Cancel, with rejections (incl. the
// server's http(s) security validation) surfaced inline.
//
// `datasheetUrl` is the R2-off provenance fallback — set only at part creation
// until now. This island is the only way to add/change/clear it on an existing
// part. Save dispatches updatePartDatasheetUrl via useTransition; on success it
// closes the editor and router.refresh()es so the server re-reads the row.
//
// VIEW:
//   - url             → the existing-style signal-blue link + (canEdit) pencil
//   - no url & canEdit → a bench-styled "Add datasheet URL" button
//   - no url & !canEdit → renders null (the page shows "No datasheet on file.")
// EDIT: <input type="url"> prefilled with `url`; empty clears (allowed).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { updatePartDatasheetUrl } from "@/lib/actions/parts";
import { IconButton } from "@/components/IconButton";
import { LinkIcon, PencilIcon } from "@/components/icons";
import { inputClass } from "@/components/guide/field-styles";

export function DatasheetUrlEditor({
  partId,
  url,
  canEdit,
}: {
  partId: string;
  url: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(url ?? "");
  const [error, setError] = useState<string | null>(null);

  function enterEdit() {
    setValue(url ?? "");
    setError(null);
    setEditing(true);
  }

  function cancel() {
    setError(null);
    setEditing(false);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await updatePartDatasheetUrl({ partId, datasheetUrl: value.trim() });
        setEditing(false);
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Could not save — check your connection and try again.",
        );
      }
    });
  }

  // ─── EDIT mode ──────────────────────────────────────────────────────────
  if (editing) {
    return (
      <div className="flex w-full flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="url"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="https://…"
            aria-label="Datasheet URL"
            disabled={isPending}
            className={`${inputClass} w-full min-w-0 normal-case tracking-normal sm:w-96`}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                save();
              } else if (e.key === "Escape") {
                e.preventDefault();
                cancel();
              }
            }}
          />
          <button
            type="button"
            onClick={save}
            disabled={isPending}
            className="rounded border border-command-gold bg-command-gold px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-deep-space transition-colors hover:border-gold-light hover:bg-gold-light disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={cancel}
            disabled={isPending}
            className="rounded border border-panel-border bg-deep-space px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-muted transition-colors hover:border-command-gold hover:text-command-gold disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
        {error ? (
          <p
            role="alert"
            className="font-mono text-xs normal-case tracking-normal text-alert-red"
          >
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  // ─── VIEW mode (existing url) ───────────────────────────────────────────
  if (url) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-signal-blue underline"
        >
          <LinkIcon className="h-4 w-4" />
          Datasheet URL
        </a>
        {canEdit ? (
          <IconButton
            type="button"
            hint="Edit datasheet URL"
            ariaLabel="Edit datasheet URL"
            disabled={isPending}
            onClick={enterEdit}
          >
            <PencilIcon className="h-5 w-5" />
          </IconButton>
        ) : null}
      </span>
    );
  }

  // ─── VIEW mode (no url) ─────────────────────────────────────────────────
  if (!canEdit) return null;

  return (
    <button
      type="button"
      onClick={enterEdit}
      className="inline-flex items-center gap-1.5 rounded border border-command-gold px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space"
    >
      <LinkIcon className="h-4 w-4" />
      Add datasheet URL
    </button>
  );
}
