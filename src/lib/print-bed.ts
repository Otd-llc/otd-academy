// The print bed a signed-in user has stored, and the rules for what counts as one.
//
// A PLAIN module, deliberately. `src/lib/actions/print-bed.ts` carries
// `"use server"`, and a "use server" file may export ONLY async functions -- a
// type or a constant re-exported from one compiles fine and then crashes at
// runtime, because the bundler turns every export into a callable server
// reference. So the shapes, the presets and the validator live here, where the
// action, the account page and the client picker can all import them.
//
// ONE validator, shared with the pack endpoint's own numbers. The failure this
// prevents is a bed the settings page happily saves and the endpoint then
// refuses: the account would hold a value that silently produces a 400 on every
// download, and nothing on either side would say why.
import { BED_MAX, BED_MIN, DEFAULT_BED, type Bed } from "@/lib/hex-pack";

export type { Bed };

/** What the account holds: a bed, or null for "no stored choice".
 *
 *  Null is a real, reachable state and not merely the initial one -- clearing
 *  the setting has to put it back, or a user who picked 350 once can never
 *  return to "let this browser decide" and their phone keeps laying out for a
 *  printer they no longer own. */
export type StoredBed = Bed | null;

/** The sizes the picker offers, in millimetres, square.
 *
 *  SIZES, not printer model names. Model names would mean maintaining a printer
 *  database, and being wrong about it the first time a vendor ships a revision
 *  with a different bed under the same name. A size is a fact the owner can read
 *  off their own machine.
 *
 *  Non-square beds are still reachable through Custom; the presets are square
 *  because every one of these machines is. */
export const BED_PRESETS = [180, 220, 235, 250, 300, 350] as const;

/** The bed used when nothing is stored anywhere. Re-exported so the UI can label
 *  the empty state with the size it will actually get, rather than a dash. */
export const FALLBACK_BED: Bed = { ...DEFAULT_BED };

export { BED_MAX, BED_MIN };

/**
 * Coerce an untrusted pair into a bed, or null if it is not one.
 *
 * Called on BOTH sides: the client picker uses it to decide whether to enable
 * Save, and the server action uses it to decide whether to write. The client
 * copy is a courtesy; the server copy is the check.
 *
 * `typeof === "number"` before anything else, because a server-action argument
 * is deserialized from the client and is not typed at runtime. A numeric string
 * is rejected rather than parsed: accepting one would mean this function decides
 * how to read "0220" and " 220 ", and those decisions belong in the input
 * handler that produced the string, not in the rule that guards the column.
 *
 * `Number.isInteger` also excludes NaN and both infinities, which is what makes
 * the range comparison below safe -- `NaN < BED_MIN` is false, so a bare range
 * check would wave NaN straight through into the column.
 */
export function normalizeBed(x: unknown, y: unknown): Bed | null {
  if (typeof x !== "number" || typeof y !== "number") return null;
  if (!Number.isInteger(x) || !Number.isInteger(y)) return null;
  if (x < BED_MIN || x > BED_MAX) return null;
  if (y < BED_MIN || y > BED_MAX) return null;
  return { x, y };
}

/** Turn a stored pair of columns into a bed. BOTH columns or neither: one set
 *  and one null is not a half-answer, it is a corrupt row, and treating it as
 *  "220 by nothing" would lay out against a bed nobody owns. */
export function bedFromColumns(
  x: number | null | undefined,
  y: number | null | undefined,
): StoredBed {
  if (x == null || y == null) return null;
  return normalizeBed(x, y);
}

/** How a bed is spelled for a person: `220 x 220`. ASCII `x`, not a multiplication
 *  sign and not an em-dash -- this string is read on the page, in the pack README
 *  and in a filename, and only one of those three is certain to be Unicode. */
export function formatBed(bed: Bed): string {
  return `${bed.x} x ${bed.y}`;
}
