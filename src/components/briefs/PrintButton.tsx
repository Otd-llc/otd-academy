"use client";

// "Download PDF" for a brief: prints the live page. The print stylesheet
// (globals.css @media print) isolates the .brief-doc and keeps the dark theme,
// so the saved PDF is the page itself. One source, always in sync, nothing to
// regenerate.
export function PrintButton({ className }: { className?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={className}>
      Download PDF
      <span aria-hidden="true"> ↓</span>
    </button>
  );
}
