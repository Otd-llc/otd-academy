"use client";

// DERATING data editor — STUB (Task 7a). The full curve editor (kind / units /
// yKind / conditions list / monotonic-x points + per-curve anchor) lands in the
// next pass. For now a clearly-marked placeholder + a read-only JSON view of the
// current `data`, so FactGroupCard compiles for all six groups and an existing
// DERATING fact (e.g. the MLCC dc-bias headline demo) stays visible.

import type { Derating } from "@/lib/schemas/part-fact";
import { StubEditorNotice } from "@/components/parts/StubEditorNotice";

export function DeratingEditor({
  data,
}: {
  data: Derating;
  onChange?: (next: Derating) => void;
}) {
  return <StubEditorNotice group="Derating" data={data} />;
}
