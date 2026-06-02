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
      {/* Ordinal badge — small, light mono numeral so the step is callable
          out loud ("number five") at a glance without shouting over the
          label. Gold normally, muted when the row is resolved. */}
      <span
        className={`shrink-0 font-mono text-xs font-bold tabular-nums ${
          struck ? "text-muted" : "text-command-gold"
        }`}
      >
        #{ordinal + 1}
      </span>
      {/* Label — readable serif body (Lora) so full sentences scan easily,
          not the prior heavy mono. Wraps freely (no truncation). A checked
          or N/A row dims + strikes the label so "done" reads instantly. */}
      <p
        className={`min-w-0 font-serif text-[15px] leading-relaxed ${
          struck ? "text-muted line-through" : "text-gray-1"
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
