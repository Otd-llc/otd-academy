"use server";

// Client-facing form-state wrappers for the PartAsset gate actions (design §4,
// Stage C). Mirrors `part-facts-form.ts`: each wrapper dispatches the canonical
// `"use server"` action in `part-assets.ts` and maps its resolution onto a
// uniform `{ ok, errors?, message?, asset? }` shape —
//   • a ZodError (the strict edit envelope) → field-keyed `errors`,
//   • any other rejection (the verify precondition, the optimistic-lock "reload"
//     conflict, the non-VERIFIED/non-FLAGGED guards, etc.) → a `message`,
//   • success → `{ ok: true, asset }` (the freshly-written row).
//
// Lives alongside `part-assets.ts` (not inside it) so the AssetRow client island
// can import the AssetFormState type + these wrappers without dragging the whole
// action module's server-only imports into the client graph.

import { ZodError } from "zod";
import type { PartAsset } from "@prisma/client";

import {
  clearPartAssetFlag,
  deletePartAsset,
  editPartAsset,
  flagPartAsset,
  unverifyPartAsset,
  verifyPartAsset,
} from "@/lib/actions/part-assets";

export type AssetFormState = {
  ok?: boolean;
  errors?: Record<string, string[]>;
  message?: string;
  asset?: PartAsset;
};

function zodErrors(err: ZodError): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_root";
    (errors[key] ??= []).push(issue.message);
  }
  return errors;
}

// Single mapping shell shared by every wrapper: run the action, normalize its
// result/rejection onto AssetFormState. ZodError → field errors; any other
// Error → `message`.
async function dispatch(
  run: () => Promise<PartAsset>,
): Promise<AssetFormState> {
  try {
    const asset = await run();
    return { ok: true, asset };
  } catch (err) {
    if (err instanceof ZodError) return { errors: zodErrors(err) };
    return { message: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ─── edit (carries a structured payload) ────────────────────────────────────
export async function editPartAssetForm(input: unknown): Promise<AssetFormState> {
  return dispatch(() => editPartAsset(input));
}

// ─── verify / unverify / flag / clearFlag (carry { id, updatedAt }) ─────────
export async function verifyPartAssetForm(
  input: unknown,
): Promise<AssetFormState> {
  return dispatch(() => verifyPartAsset(input));
}

export async function unverifyPartAssetForm(
  input: unknown,
): Promise<AssetFormState> {
  return dispatch(() => unverifyPartAsset(input));
}

export async function flagPartAssetForm(input: unknown): Promise<AssetFormState> {
  return dispatch(() => flagPartAsset(input));
}

export async function clearPartAssetFlagForm(
  input: unknown,
): Promise<AssetFormState> {
  return dispatch(() => clearPartAssetFlag(input));
}

// ─── delete (carries { id, updatedAt }) ─────────────────────────────────────
// `deletePartAsset` resolves to `void` (the row is gone — there's no PartAsset
// to echo back), so the generic `dispatch` shell (which returns the written
// row in `asset`) doesn't fit. A small dedicated wrapper maps success → `{ ok:
// true }` and any rejection (the optimistic-lock "reload" conflict, a Zod
// envelope error, etc.) → a `message`.
export async function deletePartAssetForm(
  input: unknown,
): Promise<AssetFormState> {
  try {
    await deletePartAsset(input);
    return { ok: true };
  } catch (err) {
    return { message: err instanceof Error ? err.message : "Delete failed." };
  }
}
