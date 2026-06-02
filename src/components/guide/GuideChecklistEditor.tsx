"use client";

// Guide-only wrapper around the shared <ChecklistEditor> (M9 — code-review
// Important #1).
//
// The checklist mutation actions (`addChecklistItem`, `toggleChecklistItem`,
// …) `revalidatePath` only their OWNER route (the revision / build / board
// detail pane), NOT this guide card route. So when a learner edits the
// embedded checklist in the StageGate footer, the guide RSC would stay stale
// until a hard reload.
//
// This wrapper passes the shared component's optional `onMutated` hook a
// `router.refresh()` call. `onMutated` fires from inside ChecklistEditor's
// existing `useActionState` flow, gated on `state.ok` — i.e. AFTER the server
// action has resolved and committed — so the refresh re-fetches fresh data
// with no stale-read race. Non-guide panes omit `onMutated`, so this wrapper
// is the ONLY thing that changes the shared component's runtime behavior, and
// only on the guide route.

import { useRouter } from "next/navigation";
import {
  ChecklistEditor,
  type ChecklistItemRow,
} from "@/components/ChecklistEditor";

export function GuideChecklistEditor({
  checklistId,
  items,
  disabled,
  disabledReason,
}: {
  checklistId: string;
  items: ChecklistItemRow[];
  disabled?: boolean;
  disabledReason?: string;
}) {
  const router = useRouter();
  return (
    <ChecklistEditor
      checklistId={checklistId}
      items={items}
      disabled={disabled}
      disabledReason={disabledReason}
      onMutated={() => router.refresh()}
    />
  );
}
