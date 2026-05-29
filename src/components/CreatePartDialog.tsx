"use client";

// Stub for the "Create new Part" modal. Phase 5.5 replaces the body of
// `<dialog>` with a working form wired to `createPart`. Keeping the
// component file stable means callers (BomEditor) don't need to update
// their imports between 5.4 and 5.5.
import { useEffect, useRef } from "react";

export type PartOption = {
  id: string;
  mpn: string;
  manufacturer: string;
};

export function CreatePartDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (p: PartOption) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="rounded border border-panel-border bg-navy-dark p-6 text-link-muted backdrop:bg-deep-space/80"
    >
      <p className="font-mono text-sm text-link-muted">
        Inline Part creation lands in Task 5.5.
      </p>
      <form method="dialog" className="mt-4">
        <button
          type="submit"
          className="rounded border border-panel-border bg-deep-space px-3 py-1 font-mono text-xs uppercase tracking-wider text-link-muted hover:border-command-gold"
        >
          Close
        </button>
      </form>
    </dialog>
  );
}
