// The Hex Cluster licence, in ONE module that says nothing else.
//
// It used to live inside `hex-spec.ts`, beside the print band and the cell
// pitch of the published release. The /hex page now states the v2 standard and
// must not import a module whose other exports describe different geometry, so
// the licence moved here and `hex-spec.ts` re-exports it for every existing
// caller. One object, two import paths, no second copy that can drift.

const DEED = "https://creativecommons.org/licenses/by/4.0/";

/** The slot in the credit line where a remixer says whether they changed the
 *  work (CC BY 4.0 s3(a)(1)(B): "indicate if You modified the Licensed
 *  Material"). The WORDING IS THE OWNER'S (launch item 6.8): this is a marked
 *  placeholder, not drafted text, and it must be replaced before launch. */
export const HEX_CREDIT_MODIFICATIONS_SLOT =
  "[OWNER-WORDING: modifications notice]";

/** CC BY 4.0. One-way: files already published under it stay under it, and only
 *  a future release could carry different terms. The LICENSE.txt itself is
 *  built per release in `hex-license-txt.ts`. */
export const HEX_LICENSE = {
  name: "CC BY 4.0",
  fullName: "Creative Commons Attribution 4.0 International",
  deed: DEED,
  legalCode: "https://creativecommons.org/licenses/by/4.0/legalcode",
  holder: "One Thousand Drones, LLC",
  /** The canonical attribution line a remixer can copy verbatim. Carries the
   *  licence URI (s3(a)(1)(C)) and the modifications slot (s3(a)(1)(B)); the
   *  Source URL stays last so it is never read with a trailing period. */
  credit:
    `Hex Cluster by One Thousand Drones, LLC, licensed CC BY 4.0 (${DEED}). ` +
    `${HEX_CREDIT_MODIFICATIONS_SLOT} ` +
    "Source: https://academy.onethousanddrones.com/hex",
} as const;
