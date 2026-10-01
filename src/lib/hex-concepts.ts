// The molded line's CONCEPT parts: designs that are displayed and never
// printed, shown on /hex/molded so interest can be measured before a tool is
// cut (hex-v2 next plan §1.1, owner R3-3: academy page only).
//
// `hex-concepts.json` is a COPY of the configurator's `tools/concept-models.json`,
// whose SOLE writer is hex-cluster's `export_concept_meshes.py`; it writes only
// after `check_dfm.py` comes back clean. The glTF beside each stem under
// `public/hex/concept/` is the configurator's `public/models/hardware/<stem>`
// pair, copied in the same sitting. `hex-concepts.test.ts` pins the copy to
// its assets: every stem has both files, the glTF names its own .bin, and the
// .bin is exactly the byte length the glTF declares, so a manifest row with a
// stale or missing model cannot ship as a blank viewer.
//
// Nothing here is a printable. A concept has no row in the release tables, no
// licence beyond `concept`, and no place in the configurator.
import manifest from "./hex-concepts.json";

export const HEX_CONCEPT_FORMAT = "otd-concept-models/1";

export type HexConcept = {
  stem: string;
  /** The display name, from the CAD table. */
  name: string;
  /** One line, from the CAD table: what it is for. */
  use: string;
  /** Overall size in CAD millimetres (x across corners, y across flats, z tall). */
  bboxMm: { x: number; y: number; z: number };
  volumeMm3: number;
  /** Where the viewer loads it from, on this origin. */
  modelSrc: string;
};

type Row = {
  name: string;
  use: string;
  volumeMm3: number;
  bboxMm: { x: number; y: number; z: number };
};

const rows = manifest.parts as Record<string, Row>;

export const HEX_CONCEPTS: readonly HexConcept[] = Object.keys(rows)
  .sort()
  .map((stem) => ({
    stem,
    name: rows[stem].name,
    use: rows[stem].use,
    bboxMm: rows[stem].bboxMm,
    volumeMm3: rows[stem].volumeMm3,
    modelSrc: `/hex/concept/${stem}.gltf`,
  }));

export const HEX_CONCEPT_STEMS: ReadonlySet<string> = new Set(
  HEX_CONCEPTS.map((c) => c.stem),
);

/** The manifest's own format string; the test pins it. */
export const HEX_CONCEPT_MANIFEST_FORMAT: string = manifest.format;

/** The multiplier that turns the configurator's metre glTF into millimetres. */
export const HEX_CONCEPT_UNIT_SCALE = 1000;

/**
 * Bounding sphere for ModelViewer, in millimetres, from the CAD box. The glTF
 * is y-up (CAD z), centred on x and on the viewer's z (CAD y), and stands on
 * y = 0, so the centre is half the height up and the radius is the half
 * diagonal. hex-concepts.test.ts checks the box against the glTF itself.
 */
export function hexConceptBounds(c: HexConcept): {
  center: [number, number, number];
  radius: number;
} {
  const { x, y, z } = c.bboxMm;
  return {
    center: [0, z / 2, 0],
    radius: Math.sqrt(x * x + y * y + z * z) / 2,
  };
}
