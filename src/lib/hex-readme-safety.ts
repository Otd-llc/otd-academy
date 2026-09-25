// The safety and warranty block in the Hex Cluster set-zip README, and the one
// test for owner placeholders the uploader applies to every file it publishes.
//
// WHY A PLACEHOLDER AND NOT TEXT. The safety and warranty wording is launch item
// 2.6, and it goes past a lawyer: magnet ingestion, the PETG heat limit, UV and
// freeze, printed parts never in a wetted path, no load ratings, potable use.
// None of that is an agent's to draft. Until it exists the README carries a
// marked slot, so the gap is visible in every dry run instead of being silence
// nobody notices.
//
// WHY IT MATTERS AT PUBLISH. The README is PUT under an immutable release key.
// A README published without its safety text cannot be corrected in place; it
// costs a new release segment. So `upload-printables.ts --write` refuses while
// ANY `[OWNER-WORDING: ...]` marker remains in ANY file it would upload
// (`ownerWordingIn`), not only the ones this module or the LICENSE module knows
// about. A new placeholder added anywhere is covered without touching the guard.
//
// Plain data, no env: the uploader imports it statically above its dotenv call.

/** Every string in the README that the owner must replace before a publish. */
export const HEX_README_OWNER_WORDING = {
  safety: "[OWNER-WORDING: safety and warranty text (launch readiness 2.6)]",
} as const;

/** The README's safety section, as lines. Today it is the placeholder alone. */
export function hexReadmeSafetyLines(): string[] {
  return ["Safety and warranty:", `  ${HEX_README_OWNER_WORDING.safety}`];
}

/** The marker every owner placeholder starts with, in any file. */
export const OWNER_WORDING_MARK = "[OWNER-WORDING:";

/** Every owner placeholder in `bytes`, each as written (`[OWNER-WORDING: ...]`).
 *  Empty when the file is publishable. Takes a Buffer so a binary file can be
 *  scanned without decoding it; a marker is plain ASCII either way. */
export function ownerWordingIn(bytes: Buffer | string): string[] {
  const buf = typeof bytes === "string" ? Buffer.from(bytes, "utf8") : bytes;
  const found: string[] = [];
  let at = buf.indexOf(OWNER_WORDING_MARK);
  while (at !== -1) {
    const close = buf.indexOf("]", at);
    const end = close === -1 || close - at > 400 ? at + 60 : close + 1;
    found.push(buf.subarray(at, end).toString("utf8"));
    at = buf.indexOf(OWNER_WORDING_MARK, at + 1);
  }
  return found;
}
