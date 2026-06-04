// Pure, dependency-free helpers behind the NetEditor client island (Task 3).
//
// Kept in their OWN module (not inside NetEditor.tsx) so the unit test can
// import them without dragging the island's `nets-form` → `nets.ts` →
// next-auth server graph into the vitest `node` env — the same separation the
// `nets-form.ts` header documents for the client/server seam. NetEditor.tsx
// re-exports these for its render code.

/**
 * Canonical display key for a node — `refDes.pin` (e.g. `U1.12`, `C2.1`). Both
 * parts are trimmed; an empty side collapses (no stray dot) so a half-typed
 * draft never renders a bare separator. Both blank → empty string.
 */
export function nodeLabel(refDes: string, pin: string): string {
  const r = refDes.trim();
  const p = pin.trim();
  if (!r) return p;
  if (!p) return r;
  return `${r}.${p}`;
}

/**
 * Whether the add-node draft is submittable — both a refDes AND a pin present
 * after trimming. Pure so the button's disabled state is testable without a DOM.
 */
export function canAddNode(refDes: string, pin: string): boolean {
  return refDes.trim().length > 0 && pin.trim().length > 0;
}
