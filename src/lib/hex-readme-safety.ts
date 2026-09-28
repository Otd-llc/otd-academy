// The Hex Cluster safety text, in ONE place, and the one test for owner
// placeholders the uploader applies to every file it publishes.
//
// THE WORDS ARE THE OWNER'S. Launch item 2.6, approved verbatim 2026-09-28.
// They ride in two places, the set-zip README and the /hex page Safety
// section, and both read `HEX_SAFETY_LINES` so the two can never say different
// things. Do not reword them here; a change is the owner's call.
//
// The README keeps the degree sign in "70 °C" as the owner wrote it (the
// README is UTF-8), rather than the uploader's usual `ascii()` fold to "deg".
//
// WHY THE GUARD STAYS. The README is PUT under an immutable release key; a
// README published with a placeholder in it cannot be corrected in place, it
// costs a new release segment. So `upload-printables.ts --write` refuses while
// ANY `[OWNER-WORDING: ...]` marker remains in ANY file it would upload
// (`ownerWordingIn`). A new placeholder added anywhere is covered without
// touching the guard.
//
// Plain data, no env: the uploader imports it statically above its dotenv call,
// and the /hex page imports it too.

/** The approved safety text (launch item 2.6), one statement per entry. */
export const HEX_SAFETY_LINES = [
  "Designed and tested for PETG only; other materials are untested.",
  "PETG softens around 70 °C. Keep parts out of heat and direct sun.",
  "Not load-rated. Do not hang or support anything whose failure could hurt someone.",
  "Magnets: keep away from children; swallowed magnets are dangerous.",
  "Heat-set inserts are installed hot.",
  "Use PVC primer and cement with ventilation, per their labels.",
  "Printed parts are not for drinking water unless every wetted part is NSF/ANSI 61 certified and lead-free, with backflow prevention.",
] as const;

/** Greedy word wrap for the plain-text files. Words are never split or
 *  changed, so joining the lines with single spaces gives the input back. */
export function wrapWords(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line && line.length + 1 + word.length > width) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** The README's safety section, as lines: each statement a "- " bullet,
 *  wrapped at 76 columns with a hanging indent. */
export function hexReadmeSafetyLines(): string[] {
  return [
    "Safety:",
    ...HEX_SAFETY_LINES.flatMap((s) =>
      wrapWords(s, 72).map((l, i) => (i === 0 ? `  - ${l}` : `    ${l}`)),
    ),
  ];
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
