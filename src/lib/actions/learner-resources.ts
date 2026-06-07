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
  await requireUser();
  const projectId = projectIdSchema.parse(input);

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { publishedRevisionId: true },
  });
  if (!project?.publishedRevisionId) return null;

  const starter = await db.artifact.findFirst({
    where: {
      revisionId: project.publishedRevisionId,
      subkind: "BOM_EXPORT",
      fileKey: { not: null },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!starter) return null;

  try {
    return await getDownloadUrl(starter.id);
  } catch {
    // R2 disabled or transient — surface "not available" rather than throw.
    return null;
  }
}
