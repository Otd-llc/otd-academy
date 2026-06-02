"use server";

// useActionState-compatible form-action wrappers for Checklist CRUD (Tasks
// 13.2 - 13.4). Mirrors the artifacts/errata form-action patterns: pull
// strings out of FormData, dispatch to the canonical action, and surface
// ZodError per-field or a single `message` for non-validation rejections
// (e.g., freeze guards).
//
// Live alongside `checklists.ts` rather than in it so client modules can
// import the FormState type without dragging the whole action module into
// the bundle's server graph.
import { ZodError } from "zod";
import { ChecklistSubkind, Stage } from "@prisma/client";
import {
  addChecklistItem,
  createChecklist,
  deleteChecklist,
  deleteChecklistItem,
  editChecklist,
  editChecklistItem,
  materializeCanonicalChecklist,
  reorderChecklistItems,
} from "@/lib/actions/checklists";

export type ChecklistFormState = {
  errors?: Record<string, string[]>;
  message?: string;
  createdId?: string;
  ok?: boolean;
};

function pickString(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  if (typeof v !== "string") return undefined;
  const trimmed = v.trim();
  return trimmed === "" ? undefined : trimmed;
}

function pickStringList(fd: FormData, key: string): string[] {
  return fd.getAll(key).filter((v): v is string => typeof v === "string");
}

function zodErrors(err: ZodError): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_root";
    (errors[key] ??= []).push(issue.message);
  }
  return errors;
}

// ─── createChecklist form action ───────────────────────

export async function createChecklistFormAction(
  _prev: ChecklistFormState,
  formData: FormData,
): Promise<ChecklistFormState> {
  const ownerKind = pickString(formData, "ownerKind");
  const ownerId = pickString(formData, "ownerId");
  const subkindRaw = pickString(formData, "subkind");
  const stageRaw = pickString(formData, "stage");
  const title = pickString(formData, "title") ?? "";

  if (
    ownerKind !== "revision" &&
    ownerKind !== "build" &&
    ownerKind !== "board"
  ) {
    return { message: "Invalid owner kind." };
  }
  if (!ownerId) return { message: "Missing owner id." };
  if (!subkindRaw || !(subkindRaw in ChecklistSubkind)) {
    return { message: "Invalid subkind." };
  }
  if (!stageRaw || !(stageRaw in Stage)) {
    return { message: "Invalid stage." };
  }

  const payload =
    ownerKind === "revision"
      ? {
          ownerKind: "revision" as const,
          revisionId: ownerId,
          subkind: subkindRaw as ChecklistSubkind,
          stage: stageRaw as Stage,
          title,
        }
      : ownerKind === "build"
        ? {
            ownerKind: "build" as const,
            buildId: ownerId,
            subkind: subkindRaw as ChecklistSubkind,
            stage: stageRaw as Stage,
            title,
          }
        : {
            ownerKind: "board" as const,
            boardId: ownerId,
            subkind: subkindRaw as ChecklistSubkind,
            stage: stageRaw as Stage,
            title,
          };

  try {
    const c = await createChecklist(payload);
    return { createdId: c.id, ok: true };
  } catch (err) {
    if (err instanceof ZodError) return { errors: zodErrors(err) };
    return { message: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ─── editChecklist form action ─────────────────────────

export async function editChecklistFormAction(
  _prev: ChecklistFormState,
  formData: FormData,
): Promise<ChecklistFormState> {
  const id = pickString(formData, "id");
  if (!id) return { message: "Missing checklist id." };
  const title = pickString(formData, "title");
  try {
    await editChecklist({ id, title });
    return { ok: true };
  } catch (err) {
    if (err instanceof ZodError) return { errors: zodErrors(err) };
    return { message: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ─── deleteChecklist form action ───────────────────────

export async function deleteChecklistFormAction(
  _prev: ChecklistFormState,
  formData: FormData,
): Promise<ChecklistFormState> {
  const id = pickString(formData, "id");
  if (!id) return { message: "Missing checklist id." };
  try {
    await deleteChecklist({ id });
    return { ok: true };
  } catch (err) {
    return { message: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ─── addChecklistItem form action ──────────────────────

export async function addChecklistItemFormAction(
  _prev: ChecklistFormState,
  formData: FormData,
): Promise<ChecklistFormState> {
  const checklistId = pickString(formData, "checklistId");
  const label = pickString(formData, "label");
  const expectedValue = pickString(formData, "expectedValue");
  if (!checklistId) return { message: "Missing checklist id." };
  try {
    const item = await addChecklistItem({
      checklistId,
      label,
      expectedValue,
    });
    return { createdId: item.id, ok: true };
  } catch (err) {
    if (err instanceof ZodError) return { errors: zodErrors(err) };
    return { message: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ─── editChecklistItem form action ─────────────────────

export async function editChecklistItemFormAction(
  _prev: ChecklistFormState,
  formData: FormData,
): Promise<ChecklistFormState> {
  const id = pickString(formData, "id");
  if (!id) return { message: "Missing item id." };
  const label = pickString(formData, "label");
  const expectedValueRaw = formData.get("expectedValue");
  const actualValueRaw = formData.get("actualValue");
  const checkedRaw = formData.get("checked");

  // Raw form fields: only set the payload key if the field was actually
  // submitted, so an "unspecified" field doesn't accidentally clear a
  // persisted value.
  const patch: {
    id: string;
    label?: string;
    expectedValue?: string | null;
    actualValue?: string | null;
    checked?: boolean;
  } = { id };
  if (label !== undefined) patch.label = label;
  if (typeof expectedValueRaw === "string") {
    const v = expectedValueRaw.trim();
    patch.expectedValue = v === "" ? null : v;
  }
  if (typeof actualValueRaw === "string") {
    const v = actualValueRaw.trim();
    patch.actualValue = v === "" ? null : v;
  }
  if (checkedRaw !== null) {
    patch.checked = checkedRaw === "true" || checkedRaw === "on";
  }

  try {
    await editChecklistItem(patch);
    return { ok: true };
  } catch (err) {
    if (err instanceof ZodError) return { errors: zodErrors(err) };
    return { message: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ─── toggleChecklistItem form action (single-purpose checkbox) ─────────
//
// Specialized version that only touches `checked`, computed from the
// hidden "nextChecked" field. Keeps the inline checkbox form small.
export async function toggleChecklistItemFormAction(
  _prev: ChecklistFormState,
  formData: FormData,
): Promise<ChecklistFormState> {
  const id = pickString(formData, "id");
  const nextCheckedRaw = pickString(formData, "nextChecked");
  if (!id) return { message: "Missing item id." };
  if (nextCheckedRaw !== "true" && nextCheckedRaw !== "false") {
    return { message: "Invalid checked value." };
  }
  try {
    await editChecklistItem({ id, checked: nextCheckedRaw === "true" });
    return { ok: true };
  } catch (err) {
    return { message: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ─── toggleChecklistItemNotApplicable form action (m16 / Task 16.10) ───
//
// Mirrors the checked-toggle, but flips `notApplicable`. The action layer
// (editChecklistItem) trusts the Zod refinement to reject the
// checked=true ∧ notApplicable=true conflict, so this wrapper only needs
// to pass the boolean through.
export async function toggleChecklistItemNotApplicableFormAction(
  _prev: ChecklistFormState,
  formData: FormData,
): Promise<ChecklistFormState> {
  const id = pickString(formData, "id");
  const nextNaRaw = pickString(formData, "nextNotApplicable");
  if (!id) return { message: "Missing item id." };
  if (nextNaRaw !== "true" && nextNaRaw !== "false") {
    return { message: "Invalid notApplicable value." };
  }
  try {
    await editChecklistItem({
      id,
      notApplicable: nextNaRaw === "true",
    });
    return { ok: true };
  } catch (err) {
    return { message: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ─── reorderChecklistItems form action ─────────────────

export async function reorderChecklistItemsFormAction(
  _prev: ChecklistFormState,
  formData: FormData,
): Promise<ChecklistFormState> {
  const checklistId = pickString(formData, "checklistId");
  const orderedIds = pickStringList(formData, "orderedIds");
  if (!checklistId) return { message: "Missing checklist id." };
  if (orderedIds.length === 0) {
    return { message: "Reorder list is empty." };
  }
  try {
    await reorderChecklistItems({ checklistId, orderedIds });
    return { ok: true };
  } catch (err) {
    if (err instanceof ZodError) return { errors: zodErrors(err) };
    return { message: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ─── deleteChecklistItem form action ───────────────────

export async function deleteChecklistItemFormAction(
  _prev: ChecklistFormState,
  formData: FormData,
): Promise<ChecklistFormState> {
  const id = pickString(formData, "id");
  if (!id) return { message: "Missing item id." };
  try {
    await deleteChecklistItem({ id });
    return { ok: true };
  } catch (err) {
    return { message: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ─── materializeCanonicalChecklist form action (m16 / Task 16.7) ───────
//
// Backs the "Materialize REQUIREMENTS_REVIEW / LAYOUT_REVIEW" one-click
// buttons on the revision detail page. Surface-level error handling — the
// action layer rejects double-materialize attempts with a stable error
// string consumed by the pane copy.
export async function materializeCanonicalChecklistFormAction(
  _prev: ChecklistFormState,
  formData: FormData,
): Promise<ChecklistFormState> {
  const revisionId = pickString(formData, "revisionId");
  const templateKey = pickString(formData, "templateKey");
  if (!revisionId) return { message: "Missing revision id." };
  if (
    templateKey !== "REQUIREMENTS_REVIEW" &&
    templateKey !== "LAYOUT_REVIEW" &&
    templateKey !== "STRIPBOARD_VALIDATION"
  ) {
    return { message: "Invalid template key." };
  }
  try {
    const c = await materializeCanonicalChecklist({ revisionId, templateKey });
    return { createdId: c.id, ok: true };
  } catch (err) {
    return { message: err instanceof Error ? err.message : "Unknown error" };
  }
}
