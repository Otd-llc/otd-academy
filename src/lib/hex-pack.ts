// Deciding what goes in a custom pack, and what the request is allowed to ask
// for. Separated from the route so it can be unit-tested directly: a Next route
// module may only export the handler names, and this is the part with rules.

import { HEX_PART_SLUGS, isHexPartSlug } from "@/lib/hex-parts";

/** Immutable release segment, e.g. `2026-07-31`. Same grammar as the proxy. */
const RELEASE = /^\d{4}-\d{2}-\d{2}$/;

/** Mesh formats a pack may contain. STEP is deliberately absent: it is the
 *  archival solid for remixing, it is kept in the CAD orientation rather than
 *  the print one, and shipping it inside a "here are your parts to print" zip
 *  would hand someone a file that slices wrong. The full set still carries it. */
export const PACK_FORMATS = ["3mf", "stl"] as const;
export type PackFormat = (typeof PACK_FORMATS)[number];

/** A pack of every part would be the published set, which already exists as one
 *  immutable object. Capping at the real part count is not a limit anyone can
 *  reach by choosing parts; it exists so a malformed or hostile request cannot
 *  fan out into unbounded R2 reads. */
export const MAX_PACK_PARTS = HEX_PART_SLUGS.length;

export type PackRequest = {
  release: string;
  format: PackFormat;
  parts: string[];
};

export type PackProblem =
  "bad-release" | "bad-format" | "empty" | "too-many" | "unknown-part";

export type PackResolution =
  { ok: true; request: PackRequest } | { ok: false; problem: PackProblem };

/**
 * Validate a pack request.
 *
 * Every part name is checked for MEMBERSHIP of the published list, not merely
 * for a well-formed shape. The single-file proxy can afford a grammar because a
 * miss there is one 404; this endpoint fans a list out into one R2 read each, so
 * a grammar alone would let a caller spray plausible slugs and read existence
 * off the response. Membership bounds the work and answers the real question.
 *
 * Duplicates are collapsed rather than rejected: asking for the same part twice
 * is a UI slip, not an attack, and the zip can only hold one copy anyway.
 */
export function resolvePack(input: {
  release?: string | null;
  format?: string | null;
  parts?: string | null;
}): PackResolution {
  const release = input.release ?? "";
  if (!RELEASE.test(release)) return { ok: false, problem: "bad-release" };

  const format = (input.format ?? "3mf") as PackFormat;
  if (!(PACK_FORMATS as readonly string[]).includes(format)) {
    return { ok: false, problem: "bad-format" };
  }

  const raw = (input.parts ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const parts = [...new Set(raw)];

  if (parts.length === 0) return { ok: false, problem: "empty" };
  if (parts.length > MAX_PACK_PARTS) return { ok: false, problem: "too-many" };
  // Checked BEFORE any R2 work, so an unknown name costs a string lookup rather
  // than a network round trip.
  if (!parts.every(isHexPartSlug))
    return { ok: false, problem: "unknown-part" };

  return { ok: true, request: { release, format, parts } };
}

/** A stable, human-readable filename for the download. */
export function packFilename(parts: string[]): string {
  return parts.length === 1
    ? `hex-cluster-${parts[0]}.zip`
    : `hex-cluster-${parts.length}-parts.zip`;
}

/** The README that travels inside a custom pack.
 *
 *  A pack is a REDISTRIBUTION of a CC BY work, and the licence's one condition
 *  is that the credit travels with it. Shipping a subset without the notice
 *  would be us breaking the terms we ask every downstream remixer to keep, on
 *  our own files. So every pack carries LICENSE.txt and this, which also says
 *  plainly that it is a subset and where the whole set lives. */
export function packReadme(opts: {
  release: string;
  format: PackFormat;
  parts: string[];
  credit: string;
  specUrl: string;
  printLines: string[];
  supportNote: string[];
}): string {
  return [
    "Hex Cluster -- selected parts",
    "",
    "Hex Cluster modular tile system -- One Thousand Drones, LLC",
    opts.specUrl,
    "",
    `This is a SUBSET: ${opts.parts.length} of the published parts, as ${opts.format.toUpperCase()},`,
    `chosen in the configurator. Release ${opts.release}. The complete set,`,
    "every format, and the full specification are at the address above.",
    "",
    "Print settings:",
    ...opts.printLines.map((l) => `  ${l}`),
    "",
    ...opts.supportNote,
    "",
    `Parts (${opts.parts.length}):`,
    ...opts.parts.map((p) => `  - ${p}`),
    "",
    "Licensed CC BY 4.0 -- see LICENSE.txt.",
    opts.credit,
    "",
  ].join("\n");
}
