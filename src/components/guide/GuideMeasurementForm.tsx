"use client";

// Guide-only wrapper around the shared <AddMeasurementForm> (M9 — code-review
// Important #1).
//
// `createMeasurement` `revalidatePath`s the board pane route, not this guide
// card route, so a measurement captured in the StageGate footer wouldn't
// reflect on the guide RSC (the captured/remaining step tally + completion
// state) until a hard reload.
//
// This wrapper feeds the shared form's optional `onMutated` hook a
// `router.refresh()`. `onMutated` fires from AddMeasurementForm's
// `useActionState` flow gated on `state.ok` — after the create action has
// committed — so the refresh is race-free. Non-guide call sites
// (MeasurementsLog) omit `onMutated`, leaving their behavior unchanged.

import { useRouter } from "next/navigation";
import type { Stage } from "@prisma/client";
import { AddMeasurementForm } from "@/components/AddMeasurementForm";

export function GuideMeasurementForm({
  boardId,
  defaultStage,
  disabled,
  disabledReason,
}: {
  boardId: string;
  defaultStage: Stage;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const router = useRouter();
  return (
    <AddMeasurementForm
      boardId={boardId}
      defaultStage={defaultStage}
      disabled={disabled}
      disabledReason={disabledReason}
      onMutated={() => router.refresh()}
    />
  );
}
