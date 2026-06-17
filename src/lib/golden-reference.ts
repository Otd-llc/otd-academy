// Golden "definition of done" — a board is GOLDEN when its lesson is published
// AND vetted (assessLessonReadiness.vetted: real media everywhere + ≥1 BROUGHT_UP
// board). The golden SET is the bundle of three proven-board deliverables (KiCad
// starter / reference gerbers / bring-up measurements CSV) on the published
// revision. isGolden is NEVER gated on the files — `complete` (all three attached)
// is the separate "kit fully assembled" notion that drives the operator worklist.
// Pure + testable, mirroring board-readiness.ts / lesson-readiness.ts.

export interface GoldenReferenceInput {
  /** project.publishedRevisionId != null */
  published: boolean;
  /** assessLessonReadiness(...).vetted */
  vetted: boolean;
  /** BOM_EXPORT artifact present on the published revision */
  hasKicadStarter: boolean;
  /** GERBER_ZIP artifact present on the published revision */
  hasReferenceGerbers: boolean;
  /** BRINGUP_MEASUREMENTS_CSV artifact present on the published revision */
  hasMeasurementsCsv: boolean;
}

export type GoldenDeliverableKey =
  | "kicadStarter"
  | "referenceGerbers"
  | "measurementsCsv";

export interface GoldenDeliverable {
  key: GoldenDeliverableKey;
  label: string;
  present: boolean;
}

export interface GoldenReference {
  /** published && vetted — the derived golden status. NEVER gated on the files. */
  isGolden: boolean;
  bundle: GoldenDeliverable[];
  /** All three deliverables attached — the downloadable kit is fully assembled. */
  complete: boolean;
}

// The derived golden predicate — a board is golden when its lesson is published
// AND vetted. Single source of truth, so callers that only need the verdict (e.g.
// the operator dashboard's per-project pill) don't re-encode `published && vetted`.
export function isGolden(published: boolean, vetted: boolean): boolean {
  return published && vetted;
}

export function assessGoldenReference(
  input: GoldenReferenceInput,
): GoldenReference {
  const bundle: GoldenDeliverable[] = [
    {
      key: "kicadStarter",
      label: "KiCad starter",
      present: input.hasKicadStarter,
    },
    {
      key: "referenceGerbers",
      label: "Verified reference gerbers",
      present: input.hasReferenceGerbers,
    },
    {
      key: "measurementsCsv",
      label: "Bring-up measurements (CSV)",
      present: input.hasMeasurementsCsv,
    },
  ];
  return {
    isGolden: isGolden(input.published, input.vetted),
    bundle,
    complete: bundle.every((d) => d.present),
  };
}
