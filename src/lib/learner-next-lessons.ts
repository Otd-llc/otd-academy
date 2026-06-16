// Pure: pick the lesson(s) to recommend next from a finished lesson's DAG
// dependents — critical-path first, capped. The page supplies the dependents
// (ProjectDependency reverse edge → published Projects); availability filtering
// is left to the destination page's own gate (MVP).
export type NextLesson = { slug: string; name: string; criticalPath: boolean };

export function pickNextLessons(dependents: NextLesson[], limit = 2): NextLesson[] {
  return [...dependents]
    .sort((a, b) => Number(b.criticalPath) - Number(a.criticalPath))
    .slice(0, limit);
}
