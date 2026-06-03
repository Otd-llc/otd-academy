"use server";

// Quick-glance server action (Task 8 / design §6). Returns the VERIFIED-only
// projection of a part's facts for the parts-list quick-glance modal.
//
// This is a thin wrapper over the shared read layer `lookupPart(db, …)` — the
// SAME trust-filtering seam Stage B's MCP server uses. We do NOT re-implement
// the verified-only / FLAGGED-excluded / citation-required guards here: calling
// `lookupPart` without `includeUnverified` returns verified facts only, each
// carrying its required non-null `citation`. A miss returns the structured
// `{ found: false, reason: "not_in_library" }` envelope unchanged.
//
// Read-only + un-gated, mirroring the parts list page it opens from (that page
// is itself an un-authed server component): the glance shows only already-public
// verified facts and performs no mutation.

import { db } from "@/lib/db";
import { lookupPart, type LookupPartResult } from "@/lib/parts-knowledge/query";

export async function glancePart(partId: string): Promise<LookupPartResult> {
  // Verified-only by construction (no includeUnverified) — the query layer's
  // hard output guards do the trust filtering.
  return lookupPart(db, { partId });
}
