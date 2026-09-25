// The upload allow-list for scripts/upload-printables.ts (launch plan item 5.4).
//
// WHAT IT IS. The list of source files the uploader is permitted to publish, each
// carrying the licence it ships under. The uploader publishes nothing that is not
// on it, and refuses to run at all if any row is not `cc-by`.
//
// WHO WRITES IT. Today, a human. Its intended source is the hex-cluster table
// generator (plan item 4.6), which reads `tools/parts-licence.json` + the release
// manifest; this file's type is the contract that generator emits. Keep the shape
// small and flat so a Python generator can write it with `json.dump`.
//
//   {
//     "format": "otd-printables-allowlist/1",
//     "release": "2026-10-01",
//     "files": [
//       { "path": "3mf/hex-main.3mf", "part": "hex-main", "licence": "cc-by" },
//       { "path": "stl/hex-main.stl", "part": "hex-main", "licence": "cc-by" }
//     ]
//   }
//
// `path` is the manifest's `files[<fmt>].path`, relative to PRINTABLES_DIR, with
// forward slashes. `release` must equal the release the uploader is cutting, so an
// allow-list generated for one release can never authorise another.
//
// WHY EVERY ROW MUST BE `cc-by`, NOT JUST THE ONES WE UPLOAD. A `third-party` row
// (a bought part's mesh) or a row with no licence means whatever generated the
// list did not apply the licence rule. The honest response to a generator that
// got one row wrong is to trust none of it, so a single bad row refuses the run.
// Only `cc-by` passes; any other value is the owner's call, not this script's.

import { readFileSync } from "node:fs";

export const ALLOWLIST_FORMAT = "otd-printables-allowlist/1";

/** The only licence the uploader will publish. */
export const PUBLISHABLE_LICENCE = "cc-by";

export type AllowListRow = {
  /** Manifest-relative source path, forward slashes. */
  path: string;
  /** The manifest part this file belongs to. */
  part: string;
  /** Must be `cc-by`. `third-party`, anything else, or absent refuses the run. */
  licence: string;
};

export type AllowList = {
  format: typeof ALLOWLIST_FORMAT;
  release: string;
  files: AllowListRow[];
};

/** The plan (1.3) says never upload the build manifest, whatever lists it. */
export function isManifestPath(path: string): boolean {
  const base = path.replace(/\\/g, "/").split("/").pop() ?? "";
  return base.toLowerCase() === "manifest.json";
}

/** Validates an already-parsed allow-list. Collects EVERY problem, then throws
 *  one error naming all of them, so a generator bug is fixed in one pass rather
 *  than one rerun per bad row. */
export function parseAllowList(raw: unknown, source = "allow-list"): AllowList {
  const errors: string[] = [];
  const obj = (raw ?? {}) as Record<string, unknown>;

  if (obj.format !== ALLOWLIST_FORMAT) {
    errors.push(
      `format must be "${ALLOWLIST_FORMAT}" (got ${JSON.stringify(obj.format)})`,
    );
  }
  if (typeof obj.release !== "string" || obj.release.trim() === "") {
    errors.push("release must be a non-empty string");
  }
  if (!Array.isArray(obj.files) || obj.files.length === 0) {
    errors.push("files must be a non-empty array");
  }

  const rows: AllowListRow[] = [];
  const seen = new Set<string>();
  for (const [i, r] of (Array.isArray(obj.files) ? obj.files : []).entries()) {
    const row = (r ?? {}) as Record<string, unknown>;
    const where = `files[${i}]${typeof row.path === "string" ? ` (${row.path})` : ""}`;
    const path = typeof row.path === "string" ? row.path.replace(/\\/g, "/") : "";
    const part = typeof row.part === "string" ? row.part : "";
    const licence = row.licence;

    if (path === "") errors.push(`${where}: path missing`);
    if (part === "") errors.push(`${where}: part missing`);
    if (path !== "" && isManifestPath(path)) {
      errors.push(`${where}: manifest.json is never uploaded`);
    }
    if (licence === undefined || licence === null || licence === "") {
      errors.push(`${where}: no licence`);
    } else if (licence === "third-party") {
      errors.push(`${where}: licence is third-party, which is never uploaded`);
    } else if (licence !== PUBLISHABLE_LICENCE) {
      errors.push(
        `${where}: licence ${JSON.stringify(licence)} is not ${PUBLISHABLE_LICENCE}`,
      );
    }
    if (path !== "" && seen.has(path)) errors.push(`${where}: duplicate path`);
    seen.add(path);

    rows.push({ path, part, licence: String(licence ?? "") });
  }

  if (errors.length > 0) {
    throw new Error(
      `Refusing ${source}: ${errors.length} problem(s):\n` +
        errors.map((e) => `  - ${e}`).join("\n"),
    );
  }
  return {
    format: ALLOWLIST_FORMAT,
    release: obj.release as string,
    files: rows,
  };
}

export function loadAllowList(path: string): AllowList {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Cannot read allow-list ${path}: ${msg}`);
  }
  return parseAllowList(raw, path);
}

/** Compares what the uploader is about to publish against the allow-list, both
 *  ways. A file with no row is refused (the list is the permission); a row with no
 *  file is refused too, because it means the set would ship short, which is exactly
 *  the failure nobody notices. Returns the problems; empty means clean. */
export function checkAgainstAllowList(
  candidates: { path: string; part: string }[],
  allow: AllowList,
): string[] {
  const errors: string[] = [];
  const byPath = new Map(allow.files.map((r) => [r.path, r]));
  const candidatePaths = new Set<string>();

  for (const c of candidates) {
    const path = c.path.replace(/\\/g, "/");
    candidatePaths.add(path);
    if (isManifestPath(path)) {
      errors.push(`${path}: manifest.json is never uploaded`);
      continue;
    }
    const row = byPath.get(path);
    if (!row) {
      errors.push(`${path} (${c.part}): not on the allow-list`);
    } else if (row.part !== c.part) {
      errors.push(
        `${path}: allow-list says part "${row.part}", manifest says "${c.part}"`,
      );
    }
  }
  for (const row of allow.files) {
    if (!candidatePaths.has(row.path)) {
      errors.push(
        `${row.path} (${row.part}): on the allow-list but not in this upload`,
      );
    }
  }
  return errors;
}
