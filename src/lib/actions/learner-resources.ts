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

// Shared resolver: presign the latest file-backed artifact of `subkind` on the
// project's published revision, or null if there's no published revision, no
// such artifact, or R2 is unavailable.
async function getPublishedRevisionArtifactUrl(
  input: unknown,
  subkind: "BOM_EXPORT" | "GERBER_ZIP",
): Promise<string | null> {
  await requireUser();
  const projectId = projectIdSchema.parse(input);

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { publishedRevisionId: true },
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
    return await getDownloadUrl(artifact.id);
  } catch {
    // R2 disabled or transient — surface "not available" rather than throw.
    return null;
  }
}
