"use client";

// Shared placeholder body for the not-yet-implemented per-type editors
// (PINOUT, DERATING — Task 7a). Renders a "coming in the next pass" note plus a
// read-only JSON view of the current `data` so a curator can still SEE an
// existing fact's content (and the parent can re-save it unchanged) while the
// real structured editor is pending.

import { labelClass } from "@/components/guide/field-styles";

export function StubEditorNotice({
  group,
  data,
}: {
  group: string;
  data: unknown;
}) {
  return (
    <div className="space-y-3">
      <p className="rounded border border-signal-blue bg-navy-dark px-4 py-3 font-mono text-xs uppercase tracking-wider text-signal-blue">
        {group} editor — coming in the next pass. Read-only view below.
      </p>
      <div>
        <span className={labelClass}>Stored data (read-only)</span>
        <pre className="mt-1 max-h-80 overflow-auto rounded border border-panel-border bg-deep-space p-3 font-mono text-xs text-link-muted">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    </div>
  );
}
