// Pure presentational helper for the checklist item label cell (m16 / Task 16.10).
//
// Lives in its own file (rather than co-located with ChecklistEditor) so the
// render-walk tests can import it without dragging the editor's client-side
// useActionState chain — and the next-auth server graph behind it — into
// vitest. The editor re-exports this component for its own use.

import type { ReactNode } from "react";

export function ChecklistItemLabelCell({
  ordinal,
  label,
  checked,
  notApplicable,
}: {
  ordinal: number;
  label: string;
  checked: boolean;
  notApplicable: boolean;
}): ReactNode {
  const struck = checked || notApplicable;
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      {/* Ordinal badge — high-contrast mono numeral so the step is callable
          out loud ("number five") at a glance on a bench display. */}
      <span
        className={`shrink-0 font-mono text-sm font-bold tabular-nums tracking-wider ${
          struck ? "text-muted" : "text-command-gold"
        }`}
      >
        #{ordinal + 1}
      </span>
      {/* Label — larger + bolder than the prior `text-base` so it stays
          readable from arm's length; wraps freely (no truncation). A checked
          or N/A row dims + strikes the label so "done" reads instantly. */}
      <p
        className={`min-w-0 text-lg font-semibold leading-snug ${
          struck ? "text-muted line-through" : "text-white"
        }`}
      >
        {label}
      </p>
      {notApplicable ? (
        <span className="inline-block rounded border border-command-gold bg-navy-dark px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-command-gold">
          N/A
        </span>
      ) : null}
    </div>
  );
}
