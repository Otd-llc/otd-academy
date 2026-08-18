// The same print intent, in PrusaSlicer's dialect.
//
// ===========================================================================
// BUILT AND UNIT-TESTED. NOT WIRED IN, AND NOT PROVEN ON A REAL SLICER.
// ===========================================================================
// Nothing calls `prusaModelConfig` yet. That is deliberate and it is the whole
// disposition of this file: every byte below was derived from PrusaSlicer's own
// source rather than from documentation, which makes it *specified* rather than
// *verified*, and this project has been wrong about slicer behaviour twice
// while feeling equally certain. See `hex-spike-support-facts` for both.
//
// WHAT SHIPPING IT BLIND WOULD COST. Today a PrusaSlicer user opens one of our
// plates and gets geometry with no settings -- the Orca payload lives in
// `Metadata/`, which PrusaSlicer never reads for us. That is a mild loss. If the
// file below is malformed, they instead get a REFUSED IMPORT, because the reader
// fails closed on exactly the two mistakes easiest to make here (see the traps).
// So the downside of getting it wrong is worse than the upside of getting it
// right, until someone opens one in PrusaSlicer and looks.
//
// Adding the file is already known safe for the CURRENT audience: a plate
// carrying `model_settings.config` AND `Slic3r_PE_model.config` was MEASURED to
// load in Creality Print 7.2.1 with the Orca settings applied. What is unproven
// is only whether PrusaSlicer accepts OUR spelling of its own format.
//
// TO SHIP IT: build one plate, open it in PrusaSlicer, confirm the object's
// per-object overrides show the values, then call this from `buildPlate3mf`
// beside `modelSettingsConfig` and add the entry to the archive.
//
// ---------------------------------------------------------------------------
// VERIFIED AGAINST SOURCE, 2026-08-18 (prusa3d/PrusaSlicer, master)
// ---------------------------------------------------------------------------
//   src/libslic3r/PrintConfig.cpp   the eight keys and their enum literals
//   src/libslic3r/PrintConfig.hpp   which config class each key belongs to
//   src/libslic3r/Format/3mf.cpp    the exact file shape, and the two failures
//
// All eight keys are per-object settable, split the same way Orca splits them:
// `fill_density` / `fill_pattern` / `perimeters` are `PrintRegionConfig` (per
// object and per part), and `brim_type` / `brim_width` / `support_material` /
// `support_material_auto` / `support_material_threshold` are
// `PrintObjectConfig` (per object).
//
// The enum literals are IDENTICAL to Orca's -- `gyroid`, `outer_only` -- which
// is a fork artefact rather than a standard, and worth stating so nobody
// "fixes" one to match the other later.
//
// ===========================================================================
// THE TWO TRAPS, both of which fail the WHOLE import rather than one setting
// ===========================================================================
//
// 1. `type` IS MANDATORY ON EVERY `<metadata>`, and Orca's dialect has no such
//    attribute. `_handle_start_config_metadata` accepts exactly `object` or
//    `volume` and otherwise calls `add_error("Found invalid metadata type")` and
//    returns false. So the one thing you would naturally try -- reuse the Orca
//    block and rename the keys -- produces a file PrusaSlicer refuses. This is
//    the same shape of failure as Creality's duplicate `<object id>`: total, not
//    partial, and therefore worth a test rather than a comment.
//
// 2. AN `<object id>` THAT MATCHES NO MODEL OBJECT IS ALSO FATAL --
//    `add_error("Cannot assign metadata to valid object id")`. The ids here are
//    the ones written into `3D/3dmodel.model` by `hex-3mf.ts`, passed in rather
//    than recomputed, so the two cannot drift; a second derivation of "what id
//    did that object get" is exactly how they would.
//
// WHAT IS NOT NEEDED: a `<volume>` block. PrusaSlicer's own exporter writes one
// per volume carrying `firstid`/`lastid` triangle ranges, and reading the
// importer, object-level metadata is stored with no reference to it. We set
// everything at object level, so no triangle indices have to be counted -- which
// is the difference between this file being small and it needing to parse every
// mesh it describes.
import { PRINT_INTENT_TABLE, type PrintIntentRow } from "@/lib/hex-print-intent";
import { escapeXml } from "@/lib/hex-3mf";

/** One object's line in the config: the id it carries in `3dmodel.model`, its
 *  name, and which of the two independent remedies it was measured to need. */
export type PrusaObject = {
  id: number;
  name: string;
  support: boolean;
  brim: boolean;
};

export const PRUSA_CONFIG_PATH = "Metadata/Slic3r_PE_model.config";

/** The Prusa halves of the rows in one scope, in table order.
 *
 *  A row whose `prusa` is null is skipped rather than guessed at. There are none
 *  today; the branch exists because the first setting with no Prusa equivalent
 *  must be *absent*, never approximated -- an approximation here prints
 *  differently from what the card beside it promises. */
function prusaRows(scope: PrintIntentRow["scope"]) {
  return PRINT_INTENT_TABLE.filter(
    (r) => r.scope === scope && r.prusa !== null,
  ).map((r) => r.prusa!);
}

/**
 * `Metadata/Slic3r_PE_model.config` for one plate.
 *
 * Takes the ids from the caller for the reason in trap 2 above. `instancescount`
 * is written because PrusaSlicer's own exporter writes it; the importer ignores
 * it (its own comment says so), and it is here so a file of ours diffs cleanly
 * against a file of theirs rather than to satisfy the reader.
 */
export function prusaModelConfig(objects: readonly PrusaObject[]): string {
  const seen = new Set<number>();
  const blocks: string[] = [];

  for (const obj of objects) {
    // The same guard `modelSettingsConfig` carries, for the same reason: a
    // duplicate id is a defect whose consequence is the whole file, so it stops
    // the build rather than shipping.
    if (seen.has(obj.id)) {
      throw new Error(
        `two objects share id ${obj.id}; a duplicate id makes the slicer refuse the whole file`,
      );
    }
    seen.add(obj.id);

    const rows = [
      { key: "name", value: obj.name },
      ...prusaRows("every"),
      ...(obj.support ? prusaRows("support") : []),
      ...(obj.brim ? prusaRows("brim") : []),
    ];

    blocks.push(
      ` <object id="${obj.id}" instancescount="1">\n` +
        rows
          .map(
            (r) =>
              `  <metadata type="object" key="${escapeXml(r.key)}" value="${escapeXml(r.value)}"/>\n`,
          )
          .join("") +
        ` </object>`,
    );
  }

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n<config>\n` +
    blocks.join("\n") +
    `\n</config>\n`
  );
}
