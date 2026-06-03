"use client";

// PARAMETRICS data editor (design §3.3). Wraps the shared EntryRowsEditor over
// `data.entries` (a `parametricEntry[]`). Controlled: the parent (FactGroupCard)
// owns the `data` object and re-validates against
// `parametricsFor(category)` — which enforces the per-category required labels —
// before dispatching the form wrapper.

import type { Parametrics } from "@/lib/schemas/part-fact";
import { EntryRowsEditor, type EntryDraft } from "@/components/parts/EntryRowsEditor";

export function ParametricsEditor({
  data,
  onChange,
}: {
  data: Parametrics;
  onChange: (next: Parametrics) => void;
}) {
  return (
    <EntryRowsEditor
      entries={data.entries as EntryDraft[]}
      onChange={(entries) => onChange({ ...data, entries })}
      addLabel="Add parametric"
      emptyHint="No parametrics yet — add one below."
    />
  );
}
