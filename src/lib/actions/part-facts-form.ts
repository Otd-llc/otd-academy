"use server";

// Client-facing form-state wrappers for the PartFact gate actions (Task 7a /
// design §4 + §6). Mirrors `guides-form.ts`: each wrapper dispatches the
// canonical `"use server"` action in `part-facts.ts` and maps its resolution
// onto a uniform `{ ok, errors?, message?, fact? }` shape —
//   • a ZodError (envelope or `data` validation) → field-keyed `errors`,
//   • any other rejection (the per-`sourceKind` verify precondition, the
//     optimistic-lock "reload" conflict, the duplicate-group guard, etc.)
//     → a single human-readable `message`,
//   • success → `{ ok: true, fact }` (the freshly-written row).
//
// Lives alongside `part-facts.ts` (not inside it) so the FactGroupCard client
// island can import the FactFormState type + these wrappers without dragging
// the whole action module's server-only imports into the client graph.

import { ZodError } from "zod";
import type { PartFact } from "@prisma/client";

import {
  clearFlag,
  createFact,
  editFact,
  flagFact,
  verifyFact,
} from "@/lib/actions/part-facts";

export type FactFormState = {
  ok?: boolean;
  errors?: Record<string, string[]>;
  message?: string;
  fact?: PartFact;
};

function zodErrors(err: ZodError): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_root";
    (errors[key] ??= []).push(issue.message);
  }
  return errors;
}

// Single mapping shell shared by all five wrappers: run the action, normalize
// its result/rejection onto FactFormState. ZodError → field errors; any other
// Error → `message`.
async function dispatch(
  run: () => Promise<PartFact>,
): Promise<FactFormState> {
  try {
    const fact = await run();
    return { ok: true, fact };
  } catch (err) {
    if (err instanceof ZodError) return { errors: zodErrors(err) };
    return { message: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ─── create / edit (carry a structured payload) ─────────────────────────────
export async function createFactForm(input: unknown): Promise<FactFormState> {
  return dispatch(() => createFact(input));
}

export async function editFactForm(input: unknown): Promise<FactFormState> {
  return dispatch(() => editFact(input));
}

// ─── verify / flag / clearFlag (carry { id, updatedAt }) ────────────────────
export async function verifyFactForm(input: unknown): Promise<FactFormState> {
  return dispatch(() => verifyFact(input));
}

export async function flagFactForm(input: unknown): Promise<FactFormState> {
  return dispatch(() => flagFact(input));
}

export async function clearFlagForm(input: unknown): Promise<FactFormState> {
  return dispatch(() => clearFlag(input));
}
