"use client";

// PINOUT data editor (design §3.3 / Task 7b). An editable pin table — one row
// per pin: number / name / function(s) / type? / element provenance anchor.
// Controlled `{ data, onChange }`; the parent (FactGroupCard) owns the `data`
// object and re-validates against `pinoutSchema` before dispatching the form
// wrapper.
//
// `function` round-trips the schema's `string | string[]`: each pin holds an
// ordered list of function strings in the UI (the primary plus any
// "alt-function" rows). On every change we SERIALIZE that list back to `data`
// as a bare string when exactly one non-empty entry remains, or a string[]
// when two or more do — matching `pinSchema.function`'s union. An empty list
// collapses to "" so the schema's `min(1)` surfaces a clear validation error
// rather than silently dropping the key.
//
// Reorder is the shared, unit-tested `moveWithin` helper (guide-table.ts). The
// last pin's delete is guarded (pinoutSchema requires ≥1 pin) — the button is
// disabled rather than letting an empty list reach Save.

import type { Pinout, Pin } from "@/lib/schemas/part-fact";
import { PIN_TYPES } from "@/lib/schemas/part-fact";
import { moveWithin } from "@/lib/guide-table";
import {
  inputClass as fieldInputClass,
  labelClass,
  selectClass as fieldSelectClass,
} from "@/components/guide/field-styles";
import { IconButton } from "@/components/IconButton";
import {
  PlusIcon,
  TrashIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from "@/components/icons";

const inputClass = `mt-1 w-full ${fieldInputClass}`;
const selectClass = `mt-1 w-full ${fieldSelectClass}`;

// `type` is optional in the schema; the select's "—" option maps to undefined.
type PinType = NonNullable<Pin["type"]>;

/**
 * Read a pin's `function` (which may be a bare string OR a string[]) into the
 * editor's working list. Always ≥1 entry so the first function input renders.
 */
function fnList(fn: Pin["function"] | undefined): string[] {
  if (Array.isArray(fn)) return fn.length > 0 ? fn : [""];
  if (typeof fn === "string") return [fn];
  return [""];
}

/**
 * Serialize the editor's function list back to the schema's `string | string[]`.
 * Drops empty trailing inputs first: one surviving entry → bare string; two or
 * more → string[]; none → "" (so `pinSchema`'s `min(1)` rejects it visibly).
 */
function fnSerialize(list: string[]): Pin["function"] {
  const kept = list.filter((s) => s.trim().length > 0);
  if (kept.length === 0) return "";
  if (kept.length === 1) return kept[0]!;
  return kept;
}

export function PinoutEditor({
  data,
  onChange,
}: {
  data: Pinout;
  onChange: (next: Pinout) => void;
}) {
  const pins: Pin[] = data.pins ?? [];

  function patchAt(i: number, p: Partial<Pin>) {
    onChange({ ...data, pins: pins.map((pin, pi) => (pi === i ? { ...pin, ...p } : pin)) });
  }
  function removeAt(i: number) {
    if (pins.length <= 1) return; // pinoutSchema requires ≥1 pin
    onChange({ ...data, pins: pins.filter((_, pi) => pi !== i) });
  }
  function move(i: number, dir: -1 | 1) {
    onChange({ ...data, pins: moveWithin(pins, i, dir) });
  }
  function add() {
    onChange({ ...data, pins: [...pins, { number: "", name: "", function: "" }] });
  }

  // --- function (string | string[]) ops, per pin ---------------------------
  function setFnAt(pinIdx: number, fnIdx: number, value: string) {
    const list = fnList(pins[pinIdx]!.function);
    const next = list.map((f, fi) => (fi === fnIdx ? value : f));
    patchAt(pinIdx, { function: fnSerialize(next) });
  }
  function addFnAt(pinIdx: number) {
    const list = fnList(pins[pinIdx]!.function);
    // Keep the empty entry in the live UI list; serialization still drops it,
    // so an unfilled alt-function never reaches `data`.
    patchAt(pinIdx, { function: fnSerialize([...list, ""]) });
  }
  function removeFnAt(pinIdx: number, fnIdx: number) {
    const list = fnList(pins[pinIdx]!.function);
    if (list.length <= 1) return;
    patchAt(pinIdx, { function: fnSerialize(list.filter((_, fi) => fi !== fnIdx)) });
  }

  return (
    <div className="space-y-3">
      {pins.length === 0 ? (
        <p className="font-mono text-xs text-muted">
          No pins yet — add at least one (a pinout needs ≥1 pin).
        </p>
      ) : (
        <div className="space-y-3">
          {pins.map((pin, i) => {
            const functions = fnList(pin.function);
            return (
              <div
                key={i}
                className="rounded-r border-l-2 border-command-gold bg-navy-dark/30 p-3"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="font-mono text-xs uppercase tracking-wider text-command-gold">
                    Pin {i + 1}
                  </span>
                  <div className="flex items-center gap-1">
                    <IconButton
                      type="button"
                      hint="Move up"
                      ariaLabel={`Move pin ${i + 1} up`}
                      disabled={i === 0}
                      onClick={() => move(i, -1)}
                    >
                      <ChevronUpIcon className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      type="button"
                      hint="Move down"
                      ariaLabel={`Move pin ${i + 1} down`}
                      disabled={i === pins.length - 1}
                      onClick={() => move(i, 1)}
                    >
                      <ChevronDownIcon className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      type="button"
                      tone="danger"
                      hint={pins.length <= 1 ? "A pinout needs ≥1 pin" : "Delete pin"}
                      ariaLabel={`Delete pin ${i + 1}`}
                      disabled={pins.length <= 1}
                      onClick={() => removeAt(i)}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </IconButton>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div>
                    <label className={labelClass}>Number</label>
                    <input
                      value={pin.number}
                      onChange={(e) => patchAt(i, { number: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Name</label>
                    <input
                      value={pin.name}
                      onChange={(e) => patchAt(i, { name: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Type (optional)</label>
                    <select
                      value={pin.type ?? ""}
                      onChange={(e) =>
                        patchAt(i, {
                          type: e.target.value
                            ? (e.target.value as PinType)
                            : undefined,
                        })
                      }
                      className={selectClass}
                    >
                      <option value="">—</option>
                      {PIN_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* function: one input per entry; multiple → string[] on save */}
                <div className="mt-2">
                  <label className={labelClass}>Function(s)</label>
                  <div className="mt-1 space-y-1.5">
                    {functions.map((fn, fi) => (
                      <div key={fi} className="flex items-center gap-1">
                        <input
                          value={fn}
                          onChange={(e) => setFnAt(i, fi, e.target.value)}
                          placeholder={fi === 0 ? "primary function" : "alt function"}
                          className={`w-full ${fieldInputClass}`}
                        />
                        <IconButton
                          type="button"
                          tone="danger"
                          hint="Remove function"
                          ariaLabel={`Remove function ${fi + 1} on pin ${i + 1}`}
                          disabled={functions.length <= 1}
                          onClick={() => removeFnAt(i, fi)}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </IconButton>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => addFnAt(i)}
                    className="mt-1.5 inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:text-gold-light"
                  >
                    <PlusIcon className="h-3.5 w-3.5" />
                    Add alt-function
                  </button>
                </div>

                {/* element-level provenance anchor */}
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div>
                    <label className={labelClass}>Source page</label>
                    <input
                      type="number"
                      min={1}
                      value={pin.sourcePage ?? ""}
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
                      value={pin.sourceNote ?? ""}
                      onChange={(e) =>
                        patchAt(i, { sourceNote: e.target.value || undefined })
                      }
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1.5 rounded border border-command-gold px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space"
      >
        <PlusIcon className="h-4 w-4" />
        Add pin
      </button>
    </div>
  );
}
