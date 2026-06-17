// Maps loaded Prisma values → assessGoldenReference input. Kept OUT of the pure
// golden-reference.ts (DB-free, mirroring board-readiness-load.ts). `vetted` is
// precomputed by the caller (the complete page runs assessLessonReadiness);
// has* are derived from the file-backed artifact subkinds on the published rev.
import {
  assessGoldenReference,
  type GoldenReference,
} from "@/lib/golden-reference";

export interface GoldenReferenceRows {
  publishedRevisionId: string | null;
  vetted: boolean;
  /** subkinds of file-backed artifacts on the published revision */
  publishedArtifactSubkinds: string[];
}

export function goldenReferenceFromRows(
  rows: GoldenReferenceRows,
): GoldenReference {
  const has = (s: string) => rows.publishedArtifactSubkinds.includes(s);
  return assessGoldenReference({
    published: rows.publishedRevisionId != null,
    vetted: rows.vetted,
    hasKicadStarter: has("BOM_EXPORT"),
    hasReferenceGerbers: has("GERBER_ZIP"),
    hasMeasurementsCsv: has("BRINGUP_MEASUREMENTS_CSV"),
  });
}
