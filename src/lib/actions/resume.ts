"use server";

// Cross-device resume sync (guide-pacing plan, Task 7). The guide's IslandRail
// calls saveResume() — debounced, at most once / 30s — as the learner moves
// between islands; it upserts the per-stage record into the caller's
// Enrollment.resumeState. It is a SILENT no-op when signed out or not enrolled,
// because the client fires it opportunistically and must never surface an error.
// The guide page reads resumeState back in its enrollment query and merges it
// with the learner's localStorage via mergeResume().
//
// "use server" rule: this file exports ONLY async functions. The ResumeRecord
// TYPE is imported (never re-exported) from @/lib/resume-position.

import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import type { ResumeRecord } from "@/lib/resume-position";

export async function saveResume(projectId: string, stage: string, record: ResumeRecord): Promise<void> {
  const email = (await auth())?.user?.email;
  if (!email) return; // signed out — no-op

  const enrollment = await db.enrollment.findFirst({
    where: { projectId, user: { email } },
    select: { id: true, resumeState: true },
  });
  if (!enrollment) return; // not enrolled — no-op

  const prev =
    enrollment.resumeState && typeof enrollment.resumeState === "object" && !Array.isArray(enrollment.resumeState)
      ? (enrollment.resumeState as unknown as Record<string, ResumeRecord>)
      : {};

  await db.enrollment.update({
    where: { id: enrollment.id },
    data: { resumeState: { ...prev, [stage]: record } as unknown as Prisma.InputJsonValue },
  });
}
