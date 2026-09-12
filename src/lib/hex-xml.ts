// XML escaping for the 3MF payloads, in a LEAF module.
//
// WHY IT IS NOT IN `hex-3mf.ts` ANY MORE. Two modules now write per-object
// config into the same archive -- `hex-3mf.ts` (the Orca dialect) and
// `hex-prusa-config.ts` (PrusaSlicer's) -- and both need identical escaping,
// including the double quote, because both carry their values in XML
// ATTRIBUTES.
//
// It lived in `hex-3mf.ts` and was exported from there, which worked only
// because nothing pointed back. The moment `buildPlate3mf` calls
// `prusaModelConfig` -- which the Prusa module's header instructs as the wiring
// step -- that becomes a CYCLE: `hex-3mf` imports `hex-prusa-config` imports
// `hex-3mf`. It would have resolved by luck, because `escapeXml` was a hoisted
// `function` declaration; rewriting it as a `const` arrow, or having the Prusa
// module touch `ZIP_EPOCH` at module scope, would have broken initialisation
// with an error pointing nowhere near the change that caused it.
//
// A leaf that imports nothing cannot participate in a cycle. Moving it now, at
// zero cost, is cheaper than finding it later at wiring time.

/** Escape a string for use in XML text or a double-quoted attribute value.
 *
 *  THE AMPERSAND GOES FIRST. Escape `<` first and the `&` in the `&lt;` you just
 *  wrote gets escaped in turn, so the name reads back as the literal text
 *  `&lt;`. That ordering is the entire correctness argument for three lines.
 *
 *  No published name needs any of this -- today they are all `[A-Za-z0-9-]` --
 *  but they are FILENAMES from an exporter rather than a constrained slug, so
 *  the next re-cut is free to produce one that does. The title, the credit and a
 *  user-supplied build name are prose and need it already. */
export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
