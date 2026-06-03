// Pure KiCad metadata extractor (Stage C enhancement).
//
// Given the TEXT of a KiCad symbol (.kicad_sym) or footprint (.kicad_mod) file,
// pull two best-effort, human-reviewable SUGGESTIONS to pre-seed onto a new
// UNVERIFIED PartAsset row so the curator doesn't hand-type them:
//   - `ref`    — the first symbol/footprint NAME (deterministic + reliable).
//   - `source` — the generator (SnapEDA / SamacSys / Ultra Librarian), set ONLY
//                when EXACTLY ONE distinct generator is detected; if zero match,
//                or two+ different ones match (ambiguous), `source` is left out.
//
// This module is PURE: NO `"use server"`, NO DB/env/I/O, NO server-only imports.
// It is imported by the CLIENT `AssetUpload` island, so it MUST stay browser-safe.
// It must NEVER throw — empty/garbage/non-KiCad input returns `{}`.
//
// IMPORTANT: extracted values are only a STARTING SUGGESTION on an UNVERIFIED row.
// Nothing here auto-verifies or weakens the gate; a human reviews before Verify.

/**
 * First symbol/footprint name in a KiCad 6/7 S-expression:
 *   - `(symbol "NAME"`     — .kicad_sym
 *   - `(footprint "NAME"`  — .kicad_mod
 *   - `(module NAME`       — legacy .kicad_mod (NAME may be quoted OR unquoted)
 * The NAME group is captured either quoted (group 1) or bare (group 2, module).
 */
const REF_RE =
  /\((?:symbol|footprint|module)\s+(?:"([^"]+)"|([^\s")]+))/i;

/** Distinct generator signatures — each maps a regex to its canonical label. */
const SOURCE_SIGNATURES: ReadonlyArray<{ re: RegExp; label: string }> = [
  { re: /snapeda/i, label: "SnapEDA" },
  { re: /samacsys|component search engine/i, label: "SamacSys" },
  { re: /ultra ?librarian/i, label: "Ultra Librarian" },
];

export function extractKicadMeta(text: string): { ref?: string; source?: string } {
  const out: { ref?: string; source?: string } = {};
  if (typeof text !== "string" || text.length === 0) return out;

  // ── ref: first symbol/footprint/module name (quoted or, for module, bare) ──
  const m = REF_RE.exec(text);
  if (m) {
    const name = (m[1] ?? m[2] ?? "").trim();
    if (name.length > 0) out.ref = name;
  }

  // ── source: set ONLY if EXACTLY ONE distinct generator matches ──
  // Zero matches → undefined; two+ different generators → ambiguous → undefined.
  const hits = SOURCE_SIGNATURES.filter((s) => s.re.test(text));
  if (hits.length === 1) out.source = hits[0]!.label;

  return out;
}
