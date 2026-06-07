// Completion-gated board availability over the ProjectDependency DAG.
// A board is available to a learner iff EVERY prerequisite project (an edge's
// dependsOnProject) has an enrollment by that learner at status COMPLETED or
// MASTERED. The optional exam never gates progression — only completion does.
import { db } from "@/lib/db";

export interface BoardAvailability {
  projectId: string;
  available: boolean;
  missingPrereqs: { id: string; slug: string; name: string }[];
}

export async function learnerBoardAvailability(
  userId: string,
): Promise<BoardAvailability[]> {
  const [projects, edges, enrollments] = await Promise.all([
    db.project.findMany({
      where: { archivedAt: null },
      select: { id: true, slug: true, name: true },
    }),
    db.projectDependency.findMany({
      select: { dependentProjectId: true, dependsOnProjectId: true },
    }),
    db.enrollment.findMany({
      where: { userId },
      select: { projectId: true, status: true },
    }),
  ]);

  const completed = new Set(
    enrollments
      .filter((e) => e.status === "COMPLETED" || e.status === "MASTERED")
      .map((e) => e.projectId),
  );
  const byId = new Map(projects.map((p) => [p.id, p]));

  // dependentProjectId -> set of its prerequisite (dependsOn) project ids.
  const prereqs = new Map<string, Set<string>>();
  for (const e of edges) {
    if (!prereqs.has(e.dependentProjectId)) prereqs.set(e.dependentProjectId, new Set());
    prereqs.get(e.dependentProjectId)!.add(e.dependsOnProjectId);
  }

  return projects.map((p) => {
    const reqs = prereqs.get(p.id) ?? new Set<string>();
    const missingPrereqs = [...reqs]
      .filter((id) => !completed.has(id))
      .map((id) => byId.get(id))
      .filter((x): x is { id: string; slug: string; name: string } => Boolean(x));
    return {
      projectId: p.id,
      available: missingPrereqs.length === 0,
      missingPrereqs,
    };
  });
}
