"use server";

// Learner-facing read actions for in-guide resources. getKicadStarterUrl returns
// a presigned download for the board's KiCad starter — the BOM_EXPORT artifact an
// admin pre-generated on the published revision — so the SCHEMATIC card's
// "Download KiCad starter" button works for any signed-in learner without
// letting them write to the shared (frozen) reference revision.
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { getDownloadUrl } from "@/lib/actions/uploads";

const projectIdSchema = z.cuid();

export async function getKicadStarterUrl(
  input: unknown,
): Promise<string | null> {
  return getPublishedRevisionArtifactUrl(input, "BOM_EXPORT");
}

// getReferenceFilesUrl returns a presigned download for the board's REFERENCE
// gerber set — the GERBER_ZIP artifact an admin attached to the published
// (frozen reference) revision. It's the "order the proven board instead of
// betting on your own layout" hedge at ORDERING and the "diff your export
// against the reference" answer-key at DRC_GERBER. Returns null (→ "not
// available yet") until that verified set is uploaded, so the feature never
// promises a board that hasn't actually been built. Same public-resource rule
// as the starter: anyone can SEE the button; downloading needs an account.
export async function getReferenceFilesUrl(
  input: unknown,
): Promise<string | null> {
  return getPublishedRevisionArtifactUrl(input, "GERBER_ZIP");
}

// getBringupMeasurementsUrl returns a presigned download for the board's verified
// BRING-UP MEASUREMENTS — the BRINGUP_MEASUREMENTS_CSV artifact an admin attached to
// the published (frozen reference) revision: the proven expected/actual readings at
// each bring-up step, so a learner can check their own board against the golden one.
// Returns null until that set is uploaded. Same public-resource rule as the starter.
export async function getBringupMeasurementsUrl(
  input: unknown,
): Promise<string | null> {
  return getPublishedRevisionArtifactUrl(input, "BRINGUP_MEASUREMENTS_CSV");
}

// Shared resolver: presign the latest file-backed artifact of `subkind` on the
// project's published revision, or null if there's no published revision, no
// such artifact, or R2 is unavailable.
async function getPublishedRevisionArtifactUrl(
  input: unknown,
  subkind: "BOM_EXPORT" | "GERBER_ZIP" | "BRINGUP_MEASUREMENTS_CSV",
): Promise<string | null> {
  await requireUser();
  const projectId = projectIdSchema.parse(input);

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      slug: true,
      publishedRevisionId: true,
      publishedRevision: { select: { label: true } },
    },
  });
  if (!project?.publishedRevisionId) return null;

  const artifact = await db.artifact.findFirst({
    where: {
      revisionId: project.publishedRevisionId,
      subkind,
      fileKey: { not: null },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!artifact) return null;

  try {
    // Give the learner a human filename (e.g. `l1-01-wroom-breakout-v1-starter.zip`)
    // instead of the opaque R2 key (`kicad-<cuid>.zip`).
    const filename = downloadNameFor(
      subkind,
      project.slug,
      project.publishedRevision?.label ?? null,
    );
    return await getDownloadUrl(artifact.id, filename);
  } catch {
    // R2 disabled or transient — surface "not available" rather than throw.
    return null;
  }
}

// Friendly, board-derived download names per resource kind. The suffix names the
// resource; the prefix is the board slug + published-revision label.
const DOWNLOAD_SUFFIX: Record<
  "BOM_EXPORT" | "GERBER_ZIP" | "BRINGUP_MEASUREMENTS_CSV",
  string
> = {
  BOM_EXPORT: "starter.zip",
  GERBER_ZIP: "reference-gerbers.zip",
  BRINGUP_MEASUREMENTS_CSV: "bringup-measurements.csv",
};

function downloadNameFor(
  subkind: "BOM_EXPORT" | "GERBER_ZIP" | "BRINGUP_MEASUREMENTS_CSV",
  slug: string,
  revLabel: string | null,
): string {
  const rev = revLabel
    ? `-${revLabel.replace(/[^A-Za-z0-9._-]+/g, "-")}`
    : "";
  return `${slug}${rev}-${DOWNLOAD_SUFFIX[subkind]}`;
}
