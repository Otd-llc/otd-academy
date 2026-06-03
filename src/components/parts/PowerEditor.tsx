"use client";

// POWER data editor (design §3.3): an optional rails list (name + voltage), a
// bypass list (value/qty/placement + element anchors), and free-text notes.
// Controlled `{ data, onChange }`; the parent validates against `powerSchema`
// before dispatch. Note `bypass` is required by the schema (may be empty array).

import type { Power } from "@/lib/schemas/part-fact";
import {
  inputClass as fieldInputClass,
  labelClass,
} from "@/components/guide/field-styles";
import { IconButton } from "@/components/IconButton";
import { PlusIcon, TrashIcon } from "@/components/icons";

const inputClass = `mt-1 w-full ${fieldInputClass}`;

type Rail = NonNullable<Power["rails"]>[number];
type Bypass = Power["bypass"][number];

export function PowerEditor({
  data,
  onChange,
}: {
  data: Power;
  onChange: (next: Power) => void;
}) {
  const rails: Rail[] = data.rails ?? [];
  const bypass: Bypass[] = data.bypass ?? [];

  function patchRail(i: number, p: Partial<Rail>) {
    const next = rails.map((r, ri) => (ri === i ? { ...r, ...p } : r));
    onChange({ ...data, rails: next });
  }
  function removeRail(i: number) {
    onChange({ ...data, rails: rails.filter((_, ri) => ri !== i) });
  }
  function addRail() {
    onChange({ ...data, rails: [...rails, { name: "" }] });
  }

  function patchBypass(i: number, p: Partial<Bypass>) {
    const next = bypass.map((b, bi) => (bi === i ? { ...b, ...p } : b));
    onChange({ ...data, bypass: next });
  }
  function removeBypass(i: number) {
    onChange({ ...data, bypass: bypass.filter((_, bi) => bi !== i) });
  }
  function addBypass() {
    onChange({ ...data, bypass: [...bypass, { value: "", placement: "" }] });
  }

  return (
    <div className="space-y-5">
      {/* ─── rails ─── */}
      <div className="space-y-3">
        <p className={labelClass}>Rails (optional)</p>
        {rails.length === 0 ? (
          <p className="font-mono text-xs text-muted">No rails.</p>
        ) : (
          rails.map((rail, i) => (
            <div
              key={i}
              className="rounded-r border-l-2 border-command-gold bg-navy-dark/30 p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-mono text-xs uppercase tracking-wider text-command-gold">
                  Rail {i + 1}
                </span>
                <IconButton
                  type="button"
                  tone="danger"
                  hint="Delete rail"
                  ariaLabel={`Delete rail ${i + 1}`}
                  onClick={() => removeRail(i)}
                >
                  <TrashIcon className="h-4 w-4" />
                </IconButton>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Name</label>
                  <input
                    value={rail.name}
                    onChange={(e) => patchRail(i, { name: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Voltage (optional)</label>
                  <input
                    value={rail.voltage ?? ""}
                    onChange={(e) =>
                      patchRail(i, { voltage: e.target.value || undefined })
                    }
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          ))
        )}
        <AddButton label="Add rail" onClick={addRail} />
      </div>

      {/* ─── bypass ─── */}
      <div className="space-y-3 border-t border-panel-border pt-4">
        <p className={labelClass}>Bypass caps</p>
        {bypass.length === 0 ? (
          <p className="font-mono text-xs text-muted">No bypass caps yet.</p>
        ) : (
          bypass.map((cap, i) => (
            <div
              key={i}
              className="rounded-r border-l-2 border-command-gold bg-navy-dark/30 p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-mono text-xs uppercase tracking-wider text-command-gold">
                  Bypass {i + 1}
                </span>
                <IconButton
                  type="button"
                  tone="danger"
                  hint="Delete bypass"
                  ariaLabel={`Delete bypass ${i + 1}`}
                  onClick={() => removeBypass(i)}
                >
                  <TrashIcon className="h-4 w-4" />
                </IconButton>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div>
                  <label className={labelClass}>Value</label>
                  <input
                    value={cap.value}
                    onChange={(e) => patchBypass(i, { value: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Qty (optional)</label>
                  <input
                    type="number"
                    min={1}
                    value={cap.qty ?? ""}
                    onChange={(e) =>
                      patchBypass(i, {
                        qty:
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value),
                      })
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Placement</label>
                  <input
                    value={cap.placement}
                    onChange={(e) =>
                      patchBypass(i, { placement: e.target.value })
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
                    value={cap.sourcePage ?? ""}
                    onChange={(e) =>
                      patchBypass(i, {
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
                    value={cap.sourceNote ?? ""}
                    onChange={(e) =>
                      patchBypass(i, {
                        sourceNote: e.target.value || undefined,
                      })
                    }
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          ))
        )}
        <AddButton label="Add bypass" onClick={addBypass} />
      </div>

      {/* ─── notes ─── */}
      <div className="border-t border-panel-border pt-4">
        <label className={labelClass}>Notes (optional)</label>
        <textarea
          rows={2}
          value={data.notes ?? ""}
          onChange={(e) =>
            onChange({ ...data, notes: e.target.value || undefined })
          }
          className={inputClass}
        />
      </div>
    </div>
  );
}

function AddButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded border border-command-gold px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space"
    >
      <PlusIcon className="h-4 w-4" />
      {label}
    </button>
  );
}
