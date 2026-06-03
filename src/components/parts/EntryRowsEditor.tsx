"use client";

// Shared editable list of label/value/unit entries with per-element provenance
// anchors (`sourcePage?`, `sourceNote?`) — the common core of the PARAMETRICS
// and MECHANICAL editors (both store a `parametricEntry[]`; design §3.3).
//
// Controlled + stateless: the parent owns the array and receives the next array
// on every add/remove/edit via `onChange`. Element-level page anchors are what
// the verify gate counts toward the DATASHEET page-anchor precondition, so they
// live right next to the value they cite.

import type { ParametricEntry } from "@/lib/schemas/part-fact";
import {
  inputClass as fieldInputClass,
  labelClass,
} from "@/components/guide/field-styles";
import { IconButton } from "@/components/IconButton";
import { PlusIcon, TrashIcon } from "@/components/icons";

const inputClass = `mt-1 w-full ${fieldInputClass}`;

export type EntryDraft = {
  label: string;
  value: string;
  unit?: string;
  sourcePage?: number;
  sourceNote?: string;
};

// The schema's ParametricEntry is the persisted shape; the editor draft mirrors
// it (all strings present, optionals as undefined). A no-op type alias keeps the
// intent legible at call sites.
export type { ParametricEntry };

export function EntryRowsEditor({
  entries,
  onChange,
  addLabel = "Add entry",
  emptyHint = "No entries yet — add one below.",
}: {
  entries: EntryDraft[];
  onChange: (next: EntryDraft[]) => void;
  addLabel?: string;
  emptyHint?: string;
}) {
  function patchAt(i: number, p: Partial<EntryDraft>) {
    onChange(entries.map((e, ei) => (ei === i ? { ...e, ...p } : e)));
  }
  function removeAt(i: number) {
    onChange(entries.filter((_, ei) => ei !== i));
  }
  function add() {
    onChange([...entries, { label: "", value: "" }]);
  }

  return (
    <div className="space-y-3">
      {entries.length === 0 ? (
        <p className="font-mono text-xs text-muted">{emptyHint}</p>
      ) : (
        <div className="space-y-3">
          {entries.map((entry, i) => (
            <div
              key={i}
              className="rounded-r border-l-2 border-command-gold bg-navy-dark/30 p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-mono text-xs uppercase tracking-wider text-command-gold">
                  Entry {i + 1}
                </span>
                <IconButton
                  type="button"
                  tone="danger"
                  hint="Delete entry"
                  ariaLabel={`Delete entry ${i + 1}`}
                  onClick={() => removeAt(i)}
                >
                  <TrashIcon className="h-4 w-4" />
                </IconButton>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div>
                  <label className={labelClass}>Label</label>
                  <input
                    value={entry.label}
                    onChange={(e) => patchAt(i, { label: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Value</label>
                  <input
                    value={entry.value}
                    onChange={(e) => patchAt(i, { value: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Unit (optional)</label>
                  <input
                    value={entry.unit ?? ""}
                    onChange={(e) =>
                      patchAt(i, { unit: e.target.value || undefined })
                    }
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div>
                  <label className={labelClass}>Source page</label>
                  <input
                    type="number"
                    min={1}
                    value={entry.sourcePage ?? ""}
                    onChange={(e) =>
                      patchAt(i, {
                        sourcePage:
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value),
                      })
                    }
                    className={inputClass}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>Source note (optional)</label>
                  <input
                    value={entry.sourceNote ?? ""}
                    onChange={(e) =>
                      patchAt(i, { sourceNote: e.target.value || undefined })
                    }
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1.5 rounded border border-command-gold px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space"
      >
        <PlusIcon className="h-4 w-4" />
        {addLabel}
      </button>
    </div>
  );
}
