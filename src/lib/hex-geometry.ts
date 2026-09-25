// The plating geometry of every released part, as the pack route reads it.
//
// NO LONGER GENERATED IN THIS REPO. Launch readiness 4.6 moved the source of
// truth to hex-cluster: its `tools/gen_release_tables.py` reads
// `tools/parts-licence.json` plus the release manifest and writes
// `hex-release-tables.ts`, which carries its own content hash
// (`__tests__/hex-release-tables.test.ts`). This module is the stable name the
// route, the probes and the tests already import, so a regenerated table lands
// without touching any of them.
//
// What changed with the move:
//
//   - The boxes come from the MANIFEST, not from parsing the published meshes,
//     which neither repo's CI has. The size is `printBboxMm`, measured off the
//     printed solid. The corner is the source box put through the print
//     rotations: exact for an axis-aligned pose, and for the few parts in
//     HEX_PART_CORNER_INEXACT an estimate whose worst error is listed there and
//     is smaller than the packer's gap.
//   - `z0` is 0 for every part, because the v2 exporter drops every part onto
//     the bed before it writes the mesh.
//   - The v1 per-part mesh-bottom text (`HEX_PART_MESH_BOTTOM`) went with the v1
//     meshes it transcribed.
export {
  HEX_PART_BOX,
  HEX_PART_CORNER_INEXACT,
  HEX_PART_NAME,
  HEX_TABLES_RELEASE as HEX_GEOMETRY_RELEASE,
} from "@/lib/hex-release-tables";
