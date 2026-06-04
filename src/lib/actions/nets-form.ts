"use server";

// Client-facing form-state wrappers for the Net gate actions (design §4).
// Mirrors `part-facts-form.ts`: each wrapper dispatches the canonical
// `"use server"` action in `nets.ts` and maps its resolution onto a uniform
// `{ ok, errors?, message? , … }` shape —
//   • a ZodError (envelope validation) → field-keyed `errors`,
//   • any other rejection (the optimistic-lock "reload" conflict, the
//     duplicate-name guard, the flagged-verify guard, etc.) → a single
//     human-readable `message`,
//   • success → `{ ok: true, … }` (the freshly-written row / summary).
//
// Lives alongside `nets.ts` (not inside it) so the NetEditor client island can
// import the NetFormState type + these wrappers without dragging the whole
// action module's server-only imports into the client graph.

import { ZodError } from "zod";
import type { Net, NetNode } from "@prisma/client";

import {
  addNetNode,
  createNet,
  deleteNet,
  deriveRails,
  removeNetNode,
  setNetTrust,
} from "@/lib/actions/nets";

export type NetFormState = {
  ok?: boolean;
  errors?: Record<string, string[]>;
  message?: string;
  net?: Net;
  node?: NetNode;
  id?: string;
  summary?: {
    netsCreated: number;
    nodesCreated: number;
    proposedPowerNets: string[];
  };
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
// result/rejection onto NetFormState. ZodError → field errors; any other
// Error → `message`. The `assign` maps the action's resolved value onto the
// state's payload slot.
async function dispatch<T>(
  run: () => Promise<T>,
  assign: (value: T) => NetFormState,
): Promise<NetFormState> {
  try {
    const value = await run();
    return { ok: true, ...assign(value) };
  } catch (err) {
    if (err instanceof ZodError) return { errors: zodErrors(err) };
    return { message: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ─── create / delete net ────────────────────────────────────────────────────
export async function createNetForm(input: unknown): Promise<NetFormState> {
  return dispatch(() => createNet(input), (net) => ({ net }));
}

export async function deleteNetForm(input: unknown): Promise<NetFormState> {
  return dispatch(() => deleteNet(input), ({ id }) => ({ id }));
}

// ─── add / remove node ──────────────────────────────────────────────────────
export async function addNetNodeForm(input: unknown): Promise<NetFormState> {
  return dispatch(() => addNetNode(input), (node) => ({ node }));
}

export async function removeNetNodeForm(input: unknown): Promise<NetFormState> {
  return dispatch(() => removeNetNode(input), ({ id }) => ({ id }));
}

// ─── verify / unverify / flag (carry { id, updatedAt, action }) ─────────────
export async function setNetTrustForm(input: unknown): Promise<NetFormState> {
  return dispatch(() => setNetTrust(input), (net) => ({ net }));
}

// ─── derive rails ───────────────────────────────────────────────────────────
export async function deriveRailsForm(input: unknown): Promise<NetFormState> {
  return dispatch(() => deriveRails(input), (summary) => ({ summary }));
}
