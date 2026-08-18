// The same print intent, in PrusaSlicer's dialect.
//
// ===========================================================================
// VERIFIED ON PRUSASLICER 2.9.6, 2026-08-18. STILL NOT WIRED IN -- one check left.
// ===========================================================================
// `prusa-slicer-console.exe` adjudicated this without a GUI, via
// `scripts/hex-prusa-probe.ts`. Three files, one job each:
//
//   CONTROL FIRST. `prusa-C-dupid-EXPECT-FAIL.3mf` was REFUSED:
//     [error] Found duplicated object id
//     [error] Error (parsing aborted) while parsing xml file at line 38
//     [error] Archive does not contain a valid model config
//     Loading of a model file failed.   (exit 1)
//   So PrusaSlicer reads, parses AND VALIDATES this file. Without that, a clean
//   load proves nothing -- it cannot be told from the file never being opened.
//
//   GEOMETRY SURVIVES A CONFIG BLOCK. `prusa-A-plate.3mf` loaded exit 0 with all
//   five objects. P1 (WITH a config block, range 0..419) reported 420 facets --
//   identical to P2, the same mesh with NO block. The trap in trap 0 is real but
//   is fully answered by writing the range.
//
//   THE RANGE IS EXACT, AND AN OFF-BY-ONE IS VISIBLE:
//     Q1 lastid 419 -> 420 facets, manifold yes
//     Q2 lastid 209 -> 210 facets, manifold NO   (half a cap)
//     Q3 lastid 418 -> 419 facets, manifold NO   (short by one, detectable)
//   `lastid` is INCLUSIVE and off-by-one errors do not hide.
//
//   PER-OBJECT SETTINGS APPLY. Read back from PrusaSlicer's OWN re-emitted file
//   (`--export-3mf`), which is stronger than any screenshot: brim on exactly
//   {P3, P5}, support on exactly {P4, P5}, the infill trio on all four
//   configured objects, none of it on P2. No global profile can produce that
//   pattern. All eight keys retained, names intact, and `fill_density = 30%`
//   round-tripped -- so the `%` really is required (a bare "30" becomes 3000%).
//
// WHAT IS STILL OPEN, and why this stays unwired: THE CREALITY REGRESSION.
// The evidence once cited here -- "a plate carrying both configs loaded fine in
// Creality Print 7.2.1" -- was `probe-6-dualconfig.3mf`, whose Prusa config has
// NO `<volume>` element. That is precisely the element this module now emits, so
// the measurement on record does not cover the file we would ship, and Creality
// Print is closed source with no CLI. Open `prusa-A-plate.3mf` in Creality Print
// 7.2.1: five objects, names intact, geometry intact, and the Orca settings
// (gyroid / 30% / 4) still applied. That one check is the whole remaining gate.
//
// TO WIRE IT: `placed` carries `triangleCount` (from `countTriangles` on the
// EMITTED block, not the source) plus the `PART_REMEDY` flags, then one line in
// the archive assembly beside `MODEL_SETTINGS_PATH`, with `{ date: ZIP_EPOCH }`
// or the response stops being byte-reproducible. Rollback is deleting that line,
// which returns the archive byte-identical.
//
// ---------------------------------------------------------------------------
// VERIFIED AGAINST SOURCE, 2026-08-18 (prusa3d/PrusaSlicer, master)
// ---------------------------------------------------------------------------
//   src/libslic3r/PrintConfig.cpp   the eight keys and their enum literals
//   src/libslic3r/PrintConfig.hpp   which config class each key belongs to
//   src/libslic3r/Format/3mf.cpp    the exact file shape, and the two failures
//
// `fill_density` MUST carry its `%`. `handle_legacy` treats a bare "30" as the
// pre-percent format and multiplies by 100, so it silently becomes "3000%".
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
// THE TRAPS. ONE OF THEM ALREADY CAUGHT ME, AND IT FAILS OPEN.
// ===========================================================================
//
// 0. **A CONFIG BLOCK WITHOUT `<volume>` DELETES THE OBJECT'S GEOMETRY.** This
//    file's first version asserted the opposite -- "no `<volume>` block needed,
//    object metadata is stored without reference to it" -- and used that to
//    justify not counting triangles. It is exactly backwards. The volume list is
//    not metadata ABOUT volumes; it is the instruction that CREATES them:
//
//      if (obj_metadata != m_objects_metadata.end()) {
//          ...apply object config...
//          volumes_ptr = &obj_metadata->second.volumes;   // <- our list
//      } else {
//          volumes.emplace_back(0, triangles.size() - 1); // <- full geometry
//      }
//
//    Writing a config block for an object is precisely what DISABLES the
//    full-geometry fallback. An empty list means `_generate_volumes` iterates
//    zero times, `add_volume` is never called, and the object ends with no mesh.
//    `FileReader.cpp` then removes it as zero-volume and tells the user "Object
//    size from file %s appears to be zero", blaming their model.
//
//    So the worst outcome here is NOT the refused import this header used to
//    treat as the floor. It is a silent, mis-attributed deletion -- on a path
//    where the Orca payload keeps working, so nobody would connect the two.
//    `firstid`/`lastid` are INCLUSIVE, and both must be written: omitting them
//    yields 0/0, i.e. a one-triangle object. An out-of-range id is fatal
//    ("Found invalid triangle id"). That is why `triangleCount` is a required
//    field below rather than an option -- the dangerous shape is unrepresentable.
//
// 1. `type` IS MANDATORY ON EVERY `<metadata>`, and Orca's dialect has no such
//    attribute. `_handle_start_config_metadata` accepts exactly `object` or
//    `volume` and otherwise calls `add_error("Found invalid metadata type")` and
//    returns false, which aborts the parse and fails the whole load. So the one
//    thing you would naturally try -- reuse the Orca block and rename the keys --
//    produces a file PrusaSlicer refuses.
//
// 2. A DUPLICATE `<object id>` IS FATAL: `add_error("Found duplicated object
//    id")`. An id matching NO model object is NOT fatal, contrary to this file's
//    first version -- `_handle_start_config_object` inserts any id it is given,
//    and the apply loop simply never visits an entry with no matching object. It
//    is a silent no-op: geometry intact, settings absent. The guard below is
//    still right; its old rationale was not.
//
// 3. AN UNKNOWN KEY IS FATAL, unlike Creality. `set_deserialize_raw` throws
//    `UnknownOptionException` for any key not in `PrintConfigDef`, and 3mf.cpp
//    does not catch it; the user gets "invalid configuration". A bad ENUM VALUE
//    on a good key is substituted with the default, as in Orca, but Prusa at
//    least surfaces the substitution.
import { PRINT_INTENT_TABLE, type PrintIntentRow } from "@/lib/hex-print-intent";
// FROM THE LEAF, not from `hex-3mf`. The wiring step described above has
// `buildPlate3mf` calling into this module; importing back out of it would
// close a cycle that resolves today only by the luck of a hoisted function
// declaration.
import { escapeXml } from "@/lib/hex-xml";

/** One object's line in the config: the id it carries in `3dmodel.model`, its
 *  name, how many triangles its mesh has, and which of the two independent
 *  remedies it was measured to need. */
export type PrusaObject = {
  id: number;
  name: string;
  /**
   * Triangles in THIS object's mesh in `3D/3dmodel.model`.
   *
   * REQUIRED, and that is the fix for trap 0. Writing an object's config block
   * without a `<volume firstid lastid>` covering its whole mesh does not lose
   * the settings -- it loses the GEOMETRY, because the volume list is what
   * creates volumes and a config block suppresses the full-geometry fallback.
   * Making this a required field means the caller cannot express the shape that
   * silently empties a plate.
   *
   * Use `countTriangles` on the object's mesh XML rather than deriving it some
   * other way: an off-by-one here is fatal at import ("Found invalid triangle
   * id"), and a missing attribute is worse -- it defaults to 0, giving a
   * one-triangle object that slices into nothing.
   */
  triangleCount: number;
  support: boolean;
  brim: boolean;
};

/** Count the triangles in one mesh's XML, the way the config file has to.
 *
 *  Counts `<triangle` opening tags. The 3MF core spec gives a triangle no
 *  children, so it is always written as a self-closing element with attributes,
 *  and a prefix match is both sufficient and robust to attribute order. */
export function countTriangles(meshXml: string): number {
  return (meshXml.match(/<triangle\b/g) ?? []).length;
}

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
 * Takes the ids from the caller so ours and `3dmodel.model`'s cannot drift.
 *
 * `instances_count` is written because PrusaSlicer's own exporter writes it. The
 * importer ignores it -- its own comment says "Added because of github #3435,
 * currently not used by PrusaSlicer". Note the attribute is `instances_count`,
 * with the underscore; this file first wrote `instancescount`, which is not the
 * constant in `3mf.cpp` and matched nothing.
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

    // TRAP 0. Refuse an object with no triangles rather than emit a block that
    // would delete its mesh. `lastid` is INCLUSIVE, so a count of n spans 0..n-1
    // and a count of 0 could only be written as 0..-1, which the importer
    // rejects as an invalid triangle id -- if it even got that far.
    if (!Number.isInteger(obj.triangleCount) || obj.triangleCount < 1) {
      throw new Error(
        `object ${obj.id} (${obj.name}) has no triangle count; a config block ` +
          `without a volume range deletes the object's geometry`,
      );
    }

    blocks.push(
      ` <object id="${obj.id}" instances_count="1">\n` +
        rows
          .map(
            (r) =>
              `  <metadata type="object" key="${escapeXml(r.key)}" value="${escapeXml(r.value)}"/>\n`,
          )
          .join("") +
        // THE WHOLE MESH AS ONE VOLUME. Without this the object arrives empty.
        `  <volume firstid="0" lastid="${obj.triangleCount - 1}">\n` +
        `   <metadata type="volume" key="name" value="${escapeXml(obj.name)}"/>\n` +
        `   <metadata type="volume" key="volume_type" value="ModelPart"/>\n` +
        `  </volume>\n` +
        ` </object>`,
    );
  }

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n<config>\n` +
    blocks.join("\n") +
    `\n</config>\n`
  );
}
