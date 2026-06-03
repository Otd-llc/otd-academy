"use server";

// useActionState-compatible form-action wrappers for the learner-guide
// actions (M9). Mirrors `checklists-form.ts` / `measurements-form.ts`: pull
// strings out of FormData, dispatch to the canonical `"use server"` action,
// and surface a ZodError per-field or a single `message` for non-validation
// rejections (e.g. the "guide already exists" / freeze guards).
//
// Lives alongside `guides.ts` rather than inside it so client modules can
// import the FormState type + the form-action wrappers without dragging the
// whole action module into the bundle's server graph.
import { ZodError } from "zod";
import { editGuideCard, materializeGuide } from "@/lib/actions/guides";
import { saveGuideCardSchema } from "@/lib/schemas/guide";

export type GuideFormState = {
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

function zodErrors(err: ZodError): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_root";
    (errors[key] ??= []).push(issue.message);
  }
  return errors;
}

// ─── materializeGuide form action ──────────────────────
//
// Backs the "Generate build guide" button on the hub. The action rejects a
// double-materialize with a stable "already exists" message (and a frozen
// revision via assertNotFrozen) — both surface as `message`.
export async function materializeGuideFormAction(
  _prev: GuideFormState,
  formData: FormData,
): Promise<GuideFormState> {
  const revisionId = pickString(formData, "revisionId");
  if (!revisionId) return { message: "Missing revision id." };
  try {
    const g = await materializeGuide({ revisionId });
    return { createdId: g.id, ok: true };
  } catch (err) {
    if (err instanceof ZodError) return { errors: zodErrors(err) };
    return { message: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ─── saveGuideCard ─────────────────────────────────────
//
// Structured wrapper (NOT FormData — the nested contentBlocks array is awkward
// to serialize through FormData). The inline editor dispatches this via
// useTransition. editGuideCard Zod-validates + freeze-guards + revalidates;
// here we map its resolution onto GuideFormState (ZodError → field `errors`,
// any other rejection → a single `message`, success → `{ ok, createdId }`).
//
// SECURITY BOUNDARY: this is the first network-reachable "use server" door into
// `editGuideCard`. We parse the raw `input` with the STRICT
// `saveGuideCardSchema` (teaching content only) and forward ONLY the parsed
// result — never the raw `input`. The strict schema REJECTS any injected
// gate-wiring keys (`isGate` / `completionRef`) with an `unrecognized_keys`
// ZodError, so a hand-crafted POST can never mutate the locked authoritative-
// done fields through this path.
export async function saveGuideCard(input: unknown): Promise<GuideFormState> {
  try {
    const data = saveGuideCardSchema.parse(input);
    const card = await editGuideCard(data);
    return { ok: true, createdId: card.id };
  } catch (err) {
    if (err instanceof ZodError) return { errors: zodErrors(err) };
    return { message: err instanceof Error ? err.message : "Unknown error" };
  }
}
