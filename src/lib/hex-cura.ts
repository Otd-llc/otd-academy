// The same print intent, in Cura's dialect — and the ONE payload that lives
// inside `3D/3dmodel.model` rather than in a side-car under `Metadata/`.
//
// ===========================================================================
// WHY THAT DISTINCTION IS THE WHOLE RISK
// ===========================================================================
// The Orca and Prusa payloads are separate parts under `Metadata/`. A foreign
// reader never opens them, so a mistake there can only cost the slicer it was
// written for. Cura ignores `Metadata/` entirely; its per-object settings must go
// into the core model file that Orca, Creality Print and PrusaSlicer all parse.
// A mistake HERE can break loading for the majority audience.
//
// So this was verified before a byte was written, and in the direction that
// matters — not "does Cura read it" but "can the others survive it".
//
// ---------------------------------------------------------------------------
// VERIFIED AGAINST SOURCE, 2026-08-18
// ---------------------------------------------------------------------------
// THE SHAPE — Ultimaker/libSavitar `src/Scene.cpp`, Cura's own writer:
//
//     pugi::xml_node settings = object.append_child("metadatagroup");
//     pugi::xml_node setting = settings.append_child("metadata");
//     setting.append_attribute("name") = setting_pair.first.c_str();
//     setting.text().set(setting_pair.second.value.c_str());
//
// So the key is the `name` ATTRIBUTE and the value is ELEMENT TEXT — the exact
// inverse of the Orca dialect's `key=` / `value=` attributes. Getting this
// backwards produces a file Cura silently ignores. `SceneNode.cpp`'s reader
// matches: `xml_node.child("metadatagroup")`, then each `metadata` child, with
// the `cura:` prefix stripped against the namespace map.
//
// THE OTHERS TOLERATE IT. Orca's and Creality Print's
// `_handle_start_model_xml_element` is an if/else-if over fifteen tag names with
// NO `else`, so an unknown `<metadatagroup>` leaves `res == true` and
// `_stop_xml_parser()` is never reached. Its `<metadata>` children DO get routed
// to `_handle_start_metadata` (the dispatch keys on element name with no parent
// context), and that handler and `_handle_end_metadata` contain ZERO
// `return false` paths in either fork. PrusaSlicer's is the same shape. There is
// no code path from this block to a failed load.
//
// KEYS AND TYPES — Cura's own `resources/definitions/fdmprinter.def.json`, not
// documentation. Only settings flagged `settable_per_mesh` can apply per object:
//
//     infill_pattern         enum   per_mesh TRUE    `gyroid` is a valid option
//     infill_sparse_density  float  per_mesh TRUE    percent, NO `%` sign
//     wall_line_count        int    per_mesh TRUE
//     support_enable         bool   per_mesh TRUE    `True`, Python-cased
//     support_angle          float  per_mesh TRUE    omitted — see the table
//     support_type           enum   per_mesh FALSE   and means something else
//     adhesion_type          enum   per_mesh FALSE
//     brim_width             float  per_mesh FALSE
//     brim_line_count        int    per_mesh FALSE
//
// AN UNKNOWN KEY IS NOT AN ERROR, and that is why the `settable_per_mesh` check
// had to be done by hand. `ThreeMFReader.py` parks anything outside the object's
// stack in `um_node.metadata` and never applies it — no warning, no failure. A
// wrong key here is silence, which is precisely the failure this project keeps
// having to dig out.
//
// ---------------------------------------------------------------------------
// NOT YET OPENED IN CURA
// ---------------------------------------------------------------------------
// Cura is not installed on this machine, so "Cura applies these" is a source
// reading. The asymmetry is what makes shipping it defensible anyway: a Cura user
// today gets geometry with NO settings, so the downside of a wrong key is that
// they keep getting nothing, while the downside of a wrong VALUE would be a wrong
// print — which is why `support_angle`, the one key whose number does not
// transfer, is omitted rather than translated. See its row in
// `PRINT_INTENT_TABLE`.
//
// What DOES still need a human is the regression: `prusa-A-plate.3mf` opened in
// Creality Print 7.2.1 proved the Prusa side-car costs the majority audience
// nothing, and this block needs the same one open, because it is in a different
// file.
import { PRINT_INTENT_TABLE, type PrintIntentRow } from "@/lib/hex-print-intent";
import { escapeXml } from "@/lib/hex-xml";

/** Cura's namespace, from `libSavitar::xml_namespace::getCuraUri()`. Declared on
 *  `<model>` by `hex-3mf.ts`, which is where the core spec requires it. */
export const CURA_XMLNS =
  'xmlns:cura="http://software.ultimaker.com/xml/cura/3mf/2015/10"';

/** The Cura halves of the rows that apply to one part.
 *
 *  Rows whose `cura` is null are skipped, and there are more of those than in
 *  either other dialect: Cura has no per-object brim, so the whole `brim` scope
 *  drops out regardless of what the part needs. */
export function curaRowsFor(need: {
  support: boolean;
  brim: boolean;
}): { key: string; value: string }[] {
  const wanted = (scope: PrintIntentRow["scope"]) =>
    scope === "every" ||
    (scope === "support" && need.support) ||
    (scope === "brim" && need.brim);
  return PRINT_INTENT_TABLE.filter((r) => wanted(r.scope) && r.cura !== null).map(
    (r) => r.cura!,
  );
}

/**
 * One object's `<metadatagroup>`, or the empty string when there is nothing to
 * say.
 *
 * PLACED BEFORE THE MESH by the caller, and that ordering is mandatory rather
 * than cosmetic: the core spec's `CT_Object` is an `xs:sequence` of
 * `metadatagroup` (minOccurs 0) THEN a choice of `mesh | components`. After the
 * mesh it is schema-invalid.
 *
 * Emits nothing at all for an empty row set rather than an empty
 * `<metadatagroup/>`, so a plate of parts Cura cannot be told anything about is
 * byte-identical to one written before this existed.
 */
export function curaMetadataGroup(
  rows: readonly { key: string; value: string }[],
): string {
  if (rows.length === 0) return "";
  return (
    `\n  <metadatagroup>\n` +
    rows
      .map(
        (r) =>
          `   <metadata name="cura:${escapeXml(r.key)}">${escapeXml(r.value)}</metadata>\n`,
      )
      .join("") +
    `  </metadatagroup>`
  );
}
