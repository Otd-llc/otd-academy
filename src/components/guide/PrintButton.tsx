"use client";

// Tiny client affordance for the printable BOM: triggers the browser's print
// dialog. Hidden in the printout itself (`print:hidden`).
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="glass-button inline-flex items-center gap-2 px-4 py-2 font-mono text-xs uppercase tracking-[0.14em] print:hidden"
    >
      Print / Save PDF
    </button>
  );
}
