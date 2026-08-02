// Path → R2 key resolution for the public printable download proxy.
//
// THIS IS THE SECURITY BOUNDARY, and it lives in `lib` rather than in the route
// file so it can be unit-tested directly (a Next route module may only export
// the handler names).
//
// It never accepts an R2 key. It validates each path segment against a narrow
// token grammar and then REBUILDS the key with the very helpers the uploader
// used, so the only keys it can possibly return are under `printables/`. A
// `..`, a leading slash, an `avatars/` prefix or any other shape fails the
// grammar and returns null before R2 is touched. Closed by default: every
// unrecognised shape falls through to null.
import {
  printableKey,
  printableLicenseKey,
  printableSetKey,
} from "@/lib/r2";

/** Immutable release segment, e.g. `2026-07-31`. */
const RELEASE = /^\d{4}-\d{2}-\d{2}$/;
/** A slugged basename. No dots, so no extension can hide inside it. */
const NAME = /^[a-z0-9][a-z0-9-]*$/;

export const MESH_FORMATS = ["3mf", "stl", "step"] as const;
export type MeshFormat = (typeof MESH_FORMATS)[number];

export const PRINTABLE_CONTENT_TYPE: Record<string, string> = {
  "3mf": "model/3mf",
  stl: "model/stl",
  step: "application/step",
  zip: "application/zip",
  txt: "text/plain; charset=utf-8",
};

export type ResolvedPrintable = {
  key: string;
  filename: string;
  ext: string;
};

export function resolvePrintable(path: string[]): ResolvedPrintable | null {
  const [release, second, third] = path;
  if (!release || !RELEASE.test(release)) return null;

  // /{release}/LICENSE.txt
  if (path.length === 2 && second === "LICENSE.txt") {
    return {
      key: printableLicenseKey(release),
      filename: "LICENSE.txt",
      ext: "txt",
    };
  }

  // /{release}/sets/{set}.zip
  if (path.length === 3 && second === "sets") {
    const name = third?.endsWith(".zip") ? third.slice(0, -4) : null;
    if (!name || !NAME.test(name)) return null;
    return {
      key: printableSetKey(release, name),
      filename: `${name}.zip`,
      ext: "zip",
    };
  }

  // /{release}/{3mf|stl|step}/{part}.{same ext}
  if (path.length === 3 && (MESH_FORMATS as readonly string[]).includes(second)) {
    const format = second as MeshFormat;
    const suffix = `.${format}`;
    // The extension must MATCH the format directory. `stl/foo.3mf` is not a
    // thing the uploader ever wrote, so it is not a thing this serves.
    const name = third?.endsWith(suffix) ? third.slice(0, -suffix.length) : null;
    if (!name || !NAME.test(name)) return null;
    return {
      key: printableKey(release, format, name, format),
      filename: `${name}${suffix}`,
      ext: format,
    };
  }

  return null;
}
