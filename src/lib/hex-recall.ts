// The six parameters a recalled build needs, and nothing else.
//
// A PLAIN module, not the "use server" file next to it: that file may export
// only async functions, so this type could not live there without crashing at
// runtime when something imported it.
//
// WHY A TYPE AT ALL, for what is "just six query params". The configurator
// re-derives a saved build's identity from these, and it requires ALL of them:
// `adoptReturnLink` rejects the whole recall if any one is missing, and `h` in
// particular is what ties the identity to the payload. Drop `h` and the check
// becomes vacuous -- the build loads, the sheet prints, and it prints
// UNCONTROLLED with no error anywhere. That is a silent failure, so the fix is
// to make it a COMPILE failure: every field is required, so a caller that
// forgets one does not build.
export interface HexRecall {
  /** `d` -- e.g. OTD-HEX-1001. */
  drawingLabel: string;
  /** `r` -- e.g. A. */
  revLabel: string;
  /** `s` -- the revision's share code. */
  shareCode: string;
  /** `h` -- "h1:" + the canon hash. The load-bearing one; see above. */
  payloadHash: string;
  /** `n` -- the name AT SAVE. May legitimately be empty. */
  name: string;
  /** `t` -- ISO 8601. */
  savedAt: string;
}

/** What `/hex?build=<code>` resolves to. */
export type HexRecallResult =
  | { ok: true; payload: string; recall: HexRecall }
  /** Unknown code, archived, or a deleted account. Deliberately ONE case: the
   *  page must not become an oracle for which saved builds exist. */
  | { ok: false };
