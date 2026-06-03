"use client";

// Shared ROW-level provenance controls for a PartFact (design §3.2 / §4).
// Rendered inside FactGroupCard's edit mode beneath the per-type data editor.
//
// These are the group-level fallback anchors (element-level anchors live INSIDE
// `data`, edited per-row in the type editors). The verify gate reads these:
//   • sourceKind   — DATASHEET | MANUAL | API (NOTES is forced MANUAL upstream)
//   • partDatasheetId — the cached PDF (only offered when a datasheet exists)
//   • sourcePage   — group-default datasheet page
//   • sourceUrl    — = datasheetUrl when R2 off, or an API source
//   • sourceNote   — descriptive basis (the MANUAL "reviewed" sign-off); the
//                    ONLY field whose edit does NOT auto-demote a VERIFIED row.
//
// Controlled: the parent owns the `value` and receives every change via
// `onChange`, so it can clear stale field errors and dispatch on Save.

import type { FactSourceKind } from "@prisma/client";
import {
  inputClass as fieldInputClass,
  labelClass,
  selectClass as fieldSelectClass,
} from "@/components/guide/field-styles";

const inputClass = `mt-1 w-full ${fieldInputClass}`;
const selectClass = `mt-1 w-full ${fieldSelectClass}`;

export type ProvenanceValue = {
  sourceKind: FactSourceKind;
  partDatasheetId?: string;
  sourcePage?: number;
  sourceUrl?: string;
  sourceNote?: string;
};

export type DatasheetOption = {
  id: string;
  filename: string;
};

const SOURCE_KINDS: FactSourceKind[] = ["DATASHEET", "MANUAL", "API"];

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) return null;
  return (
    <p className="mt-1 font-mono text-xs font-bold text-alert-red">
      {messages.join("; ")}
    </p>
  );
}

export function ProvenanceFields({
  value,
  onChange,
  datasheet,
  /** Force sourceKind to MANUAL and hide the kind select (NOTES group). */
  lockManual = false,
  errors,
}: {
  value: ProvenanceValue;
  onChange: (next: ProvenanceValue) => void;
  /** The part's cached datasheet, when one exists (enables partDatasheetId). */
  datasheet?: DatasheetOption | null;
  lockManual?: boolean;
  errors?: Record<string, string[]>;
}) {
  function patch(p: Partial<ProvenanceValue>) {
    onChange({ ...value, ...p });
  }

  return (
    <fieldset className="space-y-3 border-t border-panel-border pt-4">
      <legend className={labelClass}>Provenance</legend>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {!lockManual ? (
          <div>
            <label className={labelClass}>Source kind</label>
            <select
              value={value.sourceKind}
              onChange={(e) =>
                patch({ sourceKind: e.target.value as FactSourceKind })
              }
              className={selectClass}
            >
              {SOURCE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <FieldError messages={errors?.sourceKind} />
          </div>
        ) : (
          <div>
            <label className={labelClass}>Source kind</label>
            <p className="mt-1 font-mono text-xs uppercase tracking-wider text-muted">
              MANUAL (editorial)
            </p>
          </div>
        )}

        {datasheet ? (
          <div>
            <label className={labelClass}>Cached datasheet</label>
            <select
              value={value.partDatasheetId ?? ""}
              onChange={(e) =>
                patch({ partDatasheetId: e.target.value || undefined })
              }
              className={selectClass}
            >
              <option value="">— none —</option>
              <option value={datasheet.id}>{datasheet.filename}</option>
            </select>
            <FieldError messages={errors?.partDatasheetId} />
          </div>
        ) : null}

        <div>
          <label className={labelClass}>Source page</label>
          <input
            type="number"
            min={1}
            value={value.sourcePage ?? ""}
            onChange={(e) => {
              const n = e.target.value === "" ? undefined : Number(e.target.value);
              patch({ sourcePage: n });
            }}
            className={inputClass}
          />
          <FieldError messages={errors?.sourcePage} />
        </div>

        <div>
          <label className={labelClass}>Source URL</label>
          <input
            type="url"
            value={value.sourceUrl ?? ""}
            onChange={(e) =>
              patch({ sourceUrl: e.target.value || undefined })
            }
            placeholder="https://…"
            className={inputClass}
          />
          <FieldError messages={errors?.sourceUrl} />
        </div>
      </div>

      <div>
        <label className={labelClass}>
          Source note{lockManual ? " (required basis)" : " (optional)"}
        </label>
        <textarea
          rows={2}
          value={value.sourceNote ?? ""}
          onChange={(e) =>
            patch({ sourceNote: e.target.value || undefined })
          }
          className={inputClass}
        />
        <FieldError messages={errors?.sourceNote} />
      </div>
    </fieldset>
  );
}
