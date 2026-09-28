// The LICENSE.txt that travels inside every published Hex Cluster release.
//
// TWO TEXTS, chosen by release, and the split is the whole point of the module.
//
//   v1 (2026-07-31, 2026-08-03, 2026-08-17) -- PUBLISHED. Those bytes sit under
//   immutable R2 keys with a one-year `immutable` cache header, inside every set
//   zip and beside every mesh. The uploader skips a key already present at the
//   right size, so a re-run for one of these releases must reproduce them
//   exactly or it becomes a silent mismatch between the key and the text we
//   think it holds. The text below is the literal that `upload-printables.ts`
//   carried unchanged from its first commit (2bd48dc1) through 2026-08-17,
//   moved here verbatim; `hex-license-txt.test.ts` pins its sha256 and length
//   (836 B, the size HEAD'd off the published object in `HEX_RELEASE_FILES`).
//   NEVER EDIT IT.
//
//   v2 (any later release) -- carries the copyright year and a disclaimer
//   notice. The wording of that notice is the OWNER'S (launch item 6.8),
//   approved verbatim 2026-09-28; it is wrapped to the file's width, never
//   reworded. The v1 body lines are reused unchanged because they are already
//   published and approved.
//
// Plain data, no env: `scripts/upload-printables.ts` imports it statically above
// its dotenv call, like `hex-spec`.
import { HEX_LICENSE } from "@/lib/hex-license";
import { ownerWordingIn, wrapWords } from "@/lib/hex-readme-safety";

/** Releases whose LICENSE.txt is already published. Closed list: a new release
 *  is v2 by default, which is the safe direction (it can never overwrite a v1
 *  key, because a new release is a new key prefix). */
export const HEX_V1_LICENSE_RELEASES = [
  "2026-07-31",
  "2026-08-03",
  "2026-08-17",
] as const;

/** The v2 disclaimer notice (launch item 6.8). The OWNER'S words, approved
 *  verbatim 2026-09-28. Do not reword. */
export const HEX_LICENSE_DISCLAIMER =
  "These files are provided as is, without warranty of any kind, including " +
  "fitness for a particular purpose. You print, assemble and use them at your " +
  "own risk. One Thousand Drones LLC is not liable for damage or injury " +
  "arising from their use. Section 5 of the CC BY 4.0 licence also applies.";

/** Byte-for-byte the published v1 notice. DO NOT EDIT -- see the header. */
export const HEX_V1_LICENSE_TXT = [
  "Hex Cluster modular tile system",
  "Copyright (c) One Thousand Drones, LLC",
  "",
  "This work is licensed under the Creative Commons Attribution 4.0",
  "International License (CC BY 4.0).",
  "",
  "You are free to:",
  "  Share  -- copy and redistribute in any medium or format",
  "  Adapt  -- remix, transform, and build upon it, for any purpose,",
  "            including commercially.",
  "",
  "Under the following term:",
  "  Attribution -- You must give appropriate credit to One Thousand",
  "  Drones, LLC, provide a link to this license, and indicate if changes",
  "  were made. You may do so in any reasonable manner, but not in any way",
  "  that suggests One Thousand Drones endorses you or your use.",
  "",
  "Full licence text: https://creativecommons.org/licenses/by/4.0/legalcode",
  "Summary:           https://creativecommons.org/licenses/by/4.0/",
  "",
  "Source: https://academy.onethousanddrones.com/hex",
].join("\n");

const RELEASE = /^(\d{4})-\d{2}-\d{2}$/;

function isV1(release: string): boolean {
  return (HEX_V1_LICENSE_RELEASES as readonly string[]).includes(release);
}

/** The v2 notice. The year is the RELEASE's year, not the build machine's
 *  clock, so the same release always produces the same bytes. */
function v2LicenseTxt(year: string): string {
  return [
    "Hex Cluster modular tile system",
    `Copyright (c) ${year} ${HEX_LICENSE.holder}`,
    "",
    "This work is licensed under the Creative Commons Attribution 4.0",
    "International License (CC BY 4.0).",
    "",
    "You are free to:",
    "  Share  -- copy and redistribute in any medium or format",
    "  Adapt  -- remix, transform, and build upon it, for any purpose,",
    "            including commercially.",
    "",
    "Under the following term:",
    "  Attribution -- You must give appropriate credit to One Thousand",
    "  Drones, LLC, provide a link to this license, and indicate if changes",
    "  were made. You may do so in any reasonable manner, but not in any way",
    "  that suggests One Thousand Drones endorses you or your use.",
    "",
    ...wrapWords(HEX_LICENSE_DISCLAIMER, 72),
    "",
    `Full licence text: ${HEX_LICENSE.legalCode}`,
    `Summary:           ${HEX_LICENSE.deed}`,
    "",
    "Source: https://academy.onethousanddrones.com/hex",
  ].join("\n");
}

/**
 * The LICENSE.txt for `release`.
 *
 * A published v1 release gets its published bytes back, unchanged. Any other
 * release must be an ISO date (the release segment grammar), because its year
 * is stamped into the copyright line; a placeholder like `TODO-v2-release`
 * throws rather than minting a notice with a nonsense year.
 */
export function hexLicenseTxt(release: string): string {
  if (isV1(release)) return HEX_V1_LICENSE_TXT;
  const m = RELEASE.exec(release);
  if (!m) {
    throw new Error(
      `hexLicenseTxt: release "${release}" is not an ISO date (YYYY-MM-DD)`,
    );
  }
  return v2LicenseTxt(m[1]);
}

/** Owner placeholders (`[OWNER-WORDING: ...]`) still present in `text`. Empty
 *  when it is publishable. */
export function ownerWordingPending(text: string): string[] {
  return ownerWordingIn(text);
}
