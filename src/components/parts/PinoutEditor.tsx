"use client";

// PINOUT data editor — STUB (Task 7a). A full pin-table editor (number / name /
// function string-or-list / type / per-pin anchors) lands in the next pass; for
// now this renders a clearly-marked placeholder + a read-only JSON view of the
// current `data` so FactGroupCard's per-group dispatch compiles for all six
// groups and existing PINOUT facts remain visible (and un-corruptible — there is
// no edit affordance, so the parent re-saves the unchanged `data`).

import type { Pinout } from "@/lib/schemas/part-fact";
import { StubEditorNotice } from "@/components/parts/StubEditorNotice";

export function PinoutEditor({
  data,
}: {
  data: Pinout;
  onChange?: (next: Pinout) => void;
}) {
  return <StubEditorNotice group="Pinout" data={data} />;
}
