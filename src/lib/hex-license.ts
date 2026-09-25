// The Hex Cluster licence, in ONE module that says nothing else.
//
// It used to live inside `hex-spec.ts`, beside the print band and the cell
// pitch of the published release. The /hex page now states the v2 standard and
// must not import a module whose other exports describe different geometry, so
// the licence moved here and `hex-spec.ts` re-exports it for every existing
// caller. One object, two import paths, no second copy that can drift.

/** CC BY 4.0. One-way: files already published under it stay under it, and only
 *  a future release could carry different terms. Mirrors the LICENSE.txt built
 *  in `scripts/upload-printables.ts`. */
export const HEX_LICENSE = {
  name: "CC BY 4.0",
  fullName: "Creative Commons Attribution 4.0 International",
  deed: "https://creativecommons.org/licenses/by/4.0/",
  legalCode: "https://creativecommons.org/licenses/by/4.0/legalcode",
  holder: "One Thousand Drones, LLC",
  /** The canonical attribution line a remixer can copy verbatim. */
  credit:
    "Hex Cluster by One Thousand Drones, LLC, licensed CC BY 4.0. " +
    "Source: https://academy.onethousanddrones.com/hex",
} as const;
