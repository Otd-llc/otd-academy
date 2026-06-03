"use client";

// DERATING data editor (design §3.3 / Task 7b). An editable list of derating
// curves; one card per curve: kind / xUnit / yUnit / yKind, a conditions
// sub-list (label/value/unit, ≥1), a points sub-list (x/y numeric, ≥2,
// strictly-increasing x), and an element provenance anchor. Controlled
// `{ data, onChange }`; the parent (FactGroupCard) re-validates against
// `deratingSchema` before dispatch.
//
// STRICTLY-INCREASING X (curveSchema.superRefine, design §5: interpolation must
// be well-defined). We do NOT silently re-sort on every keystroke — that fights
// the curator mid-edit. Instead each point whose x is ≤ its predecessor is
// flagged inline (so the validation error is legible at the point it occurs),
// and a one-click "Sort by x" affordance reorders the points ascending when the
// curator is done entering them. The schema is the authority; this UI just makes
// its rule visible and easy to satisfy.
//
// Each curve and its sub-lists honour the array minimums (conditions ≥1,
// points ≥2): the last condition / the count below two points can't be removed
// (the delete is disabled), and the parent's `deratingSchema` re-validate is the
// backstop.

import type { Derating, Curve } from "@/lib/schemas/part-fact";
import { CURVE_KINDS, CURVE_Y_KINDS } from "@/lib/schemas/part-fact";
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

type CurveKind = Curve["kind"];
type CurveYKind = Curve["yKind"];
type Condition = Curve["conditions"][number];
type Point = Curve["points"][number];

/** A fresh curve seeded to the schema minimums (1 condition, 2 points). */
function emptyCurve(): Curve {
  return {
    kind: CURVE_KINDS[0],
    xUnit: "",
    yUnit: "",
    yKind: CURVE_Y_KINDS[0],
    conditions: [{ label: "", value: "" }],
    points: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ],
  };
}

/** Parse a numeric input; empty → NaN so the schema's `z.number()` flags it. */
function parseNum(raw: string): number {
  if (raw.trim() === "") return NaN;
  return Number(raw);
}

/** Render a stored numeric back to the input (NaN → "" so the box clears). */
function numValue(n: number): string {
  return Number.isNaN(n) ? "" : String(n);
}

export function DeratingEditor({
  data,
  onChange,
}: {
  data: Derating;
  onChange: (next: Derating) => void;
}) {
  const curves: Curve[] = data.curves ?? [];

  function patchCurve(i: number, p: Partial<Curve>) {
    onChange({
      ...data,
      curves: curves.map((c, ci) => (ci === i ? { ...c, ...p } : c)),
    });
  }
  function removeCurve(i: number) {
    if (curves.length <= 1) return; // deratingSchema requires ≥1 curve
    onChange({ ...data, curves: curves.filter((_, ci) => ci !== i) });
  }
  function moveCurve(i: number, dir: -1 | 1) {
    onChange({ ...data, curves: moveWithin(curves, i, dir) });
  }
  function addCurve() {
    onChange({ ...data, curves: [...curves, emptyCurve()] });
  }

  // --- conditions (≥1) -----------------------------------------------------
  function patchCondition(ci: number, ki: number, p: Partial<Condition>) {
    const next = curves[ci]!.conditions.map((c, idx) =>
      idx === ki ? { ...c, ...p } : c,
    );
    patchCurve(ci, { conditions: next });
  }
  function addCondition(ci: number) {
    patchCurve(ci, {
      conditions: [...curves[ci]!.conditions, { label: "", value: "" }],
    });
  }
  function removeCondition(ci: number, ki: number) {
    const conditions = curves[ci]!.conditions;
    if (conditions.length <= 1) return; // schema: conditions ≥1
    patchCurve(ci, { conditions: conditions.filter((_, idx) => idx !== ki) });
  }

  // --- points (≥2, strictly-increasing x) ----------------------------------
  function patchPoint(ci: number, pi: number, p: Partial<Point>) {
    const next = curves[ci]!.points.map((pt, idx) =>
      idx === pi ? { ...pt, ...p } : pt,
    );
    patchCurve(ci, { points: next });
  }
  function addPoint(ci: number) {
    patchCurve(ci, { points: [...curves[ci]!.points, { x: NaN, y: NaN }] });
  }
  function removePoint(ci: number, pi: number) {
    const points = curves[ci]!.points;
    if (points.length <= 2) return; // schema: points ≥2
    patchCurve(ci, { points: points.filter((_, idx) => idx !== pi) });
  }
  function sortPoints(ci: number) {
    const sorted = [...curves[ci]!.points].sort((a, b) => {
      // NaN sorts last so empty rows don't jump ahead of real points.
      if (Number.isNaN(a.x)) return 1;
      if (Number.isNaN(b.x)) return -1;
      return a.x - b.x;
    });
    patchCurve(ci, { points: sorted });
  }

  return (
    <div className="space-y-4">
      {curves.length === 0 ? (
        <p className="font-mono text-xs text-muted">
          No curves yet — add at least one (a derating fact needs ≥1 curve).
        </p>
      ) : (
        <div className="space-y-4">
          {curves.map((curve, i) => (
            <div
              key={i}
              className="rounded-r border-l-2 border-command-gold bg-navy-dark/30 p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-mono text-xs uppercase tracking-wider text-command-gold">
                  Curve {i + 1}
                </span>
                <div className="flex items-center gap-1">
                  <IconButton
                    type="button"
                    hint="Move up"
                    ariaLabel={`Move curve ${i + 1} up`}
                    disabled={i === 0}
                    onClick={() => moveCurve(i, -1)}
                  >
                    <ChevronUpIcon className="h-4 w-4" />
                  </IconButton>
                  <IconButton
                    type="button"
                    hint="Move down"
                    ariaLabel={`Move curve ${i + 1} down`}
                    disabled={i === curves.length - 1}
                    onClick={() => moveCurve(i, 1)}
                  >
                    <ChevronDownIcon className="h-4 w-4" />
                  </IconButton>
                  <IconButton
                    type="button"
                    tone="danger"
                    hint={curves.length <= 1 ? "A derating fact needs ≥1 curve" : "Delete curve"}
                    ariaLabel={`Delete curve ${i + 1}`}
                    disabled={curves.length <= 1}
                    onClick={() => removeCurve(i)}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </IconButton>
                </div>
              </div>

              {/* curve head: kind / yKind / xUnit / yUnit */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Kind</label>
                  <select
                    value={curve.kind}
                    onChange={(e) =>
                      patchCurve(i, { kind: e.target.value as CurveKind })
                    }
                    className={selectClass}
                  >
                    {CURVE_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Y kind</label>
                  <select
                    value={curve.yKind}
                    onChange={(e) =>
                      patchCurve(i, { yKind: e.target.value as CurveYKind })
                    }
                    className={selectClass}
                  >
                    {CURVE_Y_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>X unit</label>
                  <input
                    value={curve.xUnit}
                    onChange={(e) => patchCurve(i, { xUnit: e.target.value })}
                    placeholder="e.g. V"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Y unit</label>
                  <input
                    value={curve.yUnit}
                    onChange={(e) => patchCurve(i, { yUnit: e.target.value })}
                    placeholder="e.g. %"
                    className={inputClass}
                  />
                </div>
              </div>

              {/* conditions (≥1) */}
              <div className="mt-3 border-t border-panel-border pt-3">
                <p className={labelClass}>Conditions (operating point)</p>
                <div className="mt-1.5 space-y-1.5">
                  {curve.conditions.map((cond, ki) => (
                    <div
                      key={ki}
                      className="grid grid-cols-1 items-end gap-1.5 sm:grid-cols-[1fr_1fr_1fr_auto]"
                    >
                      <input
                        value={cond.label}
                        onChange={(e) =>
                          patchCondition(i, ki, { label: e.target.value })
                        }
                        placeholder="label (e.g. temp)"
                        className={`w-full ${fieldInputClass}`}
                      />
                      <input
                        value={cond.value}
                        onChange={(e) =>
                          patchCondition(i, ki, { value: e.target.value })
                        }
                        placeholder="value (e.g. 25)"
                        className={`w-full ${fieldInputClass}`}
                      />
                      <input
                        value={cond.unit ?? ""}
                        onChange={(e) =>
                          patchCondition(i, ki, {
                            unit: e.target.value || undefined,
                          })
                        }
                        placeholder="unit (e.g. °C)"
                        className={`w-full ${fieldInputClass}`}
                      />
                      <IconButton
                        type="button"
                        tone="danger"
                        hint={
                          curve.conditions.length <= 1
                            ? "A curve needs ≥1 condition"
                            : "Remove condition"
                        }
                        ariaLabel={`Remove condition ${ki + 1} on curve ${i + 1}`}
                        disabled={curve.conditions.length <= 1}
                        onClick={() => removeCondition(i, ki)}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </IconButton>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => addCondition(i)}
                  className="mt-1.5 inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:text-gold-light"
                >
                  <PlusIcon className="h-3.5 w-3.5" />
                  Add condition
                </button>
              </div>

              {/* points (≥2, strictly-increasing x) */}
              <div className="mt-3 border-t border-panel-border pt-3">
                <div className="flex items-center justify-between gap-2">
                  <p className={labelClass}>Points (x ascending, ≥2)</p>
                  <button
                    type="button"
                    onClick={() => sortPoints(i)}
                    className="font-mono text-xs uppercase tracking-wider text-signal-blue transition-colors hover:text-command-gold"
                  >
                    Sort by x
                  </button>
                </div>
                <div className="mt-1.5 space-y-1.5">
                  {curve.points.map((pt, pi) => {
                    const prev = pi > 0 ? curve.points[pi - 1] : undefined;
                    const outOfOrder =
                      prev != null &&
                      !Number.isNaN(pt.x) &&
                      !Number.isNaN(prev.x) &&
                      pt.x <= prev.x;
                    return (
                      <div key={pi}>
                        <div className="grid grid-cols-1 items-end gap-1.5 sm:grid-cols-[1fr_1fr_auto]">
                          <input
                            type="number"
                            value={numValue(pt.x)}
                            onChange={(e) =>
                              patchPoint(i, pi, { x: parseNum(e.target.value) })
                            }
                            placeholder="x"
                            className={`w-full ${fieldInputClass} ${
                              outOfOrder ? "border-alert-red" : ""
                            }`}
                          />
                          <input
                            type="number"
                            value={numValue(pt.y)}
                            onChange={(e) =>
                              patchPoint(i, pi, { y: parseNum(e.target.value) })
                            }
                            placeholder="y"
                            className={`w-full ${fieldInputClass}`}
                          />
                          <IconButton
                            type="button"
                            tone="danger"
                            hint={
                              curve.points.length <= 2
                                ? "A curve needs ≥2 points"
                                : "Remove point"
                            }
                            ariaLabel={`Remove point ${pi + 1} on curve ${i + 1}`}
                            disabled={curve.points.length <= 2}
                            onClick={() => removePoint(i, pi)}
                          >
                            <TrashIcon className="h-4 w-4" />
                          </IconButton>
                        </div>
                        {outOfOrder ? (
                          <p className="mt-0.5 font-mono text-[11px] text-alert-red">
                            x must be greater than the previous point ({numValue(prev!.x)}) —
                            use “Sort by x” or adjust the value.
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => addPoint(i)}
                  className="mt-1.5 inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:text-gold-light"
                >
                  <PlusIcon className="h-3.5 w-3.5" />
                  Add point
                </button>
              </div>

              {/* element-level provenance anchor */}
              <div className="mt-3 grid grid-cols-1 gap-2 border-t border-panel-border pt-3 sm:grid-cols-3">
                <div>
                  <label className={labelClass}>Source page</label>
                  <input
                    type="number"
                    min={1}
                    value={curve.sourcePage ?? ""}
                    onChange={(e) =>
                      patchCurve(i, {
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
                    value={curve.sourceNote ?? ""}
                    onChange={(e) =>
                      patchCurve(i, { sourceNote: e.target.value || undefined })
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
        onClick={addCurve}
        className="inline-flex items-center gap-1.5 rounded border border-command-gold px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space"
      >
        <PlusIcon className="h-4 w-4" />
        Add curve
      </button>
    </div>
  );
}
