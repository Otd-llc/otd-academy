// Resume-position store (guide-pacing plan, Task 6). The record written by the
// IslandRail — { anchorId, visited, ts } — lives at
// localStorage["otd:resume:<projectId>:<cardId>"]. This module owns the shared
// read/write plus the pure hybrid-merge used by the Task 7 enrollment sync.

export interface ResumeRecord {
  anchorId: string;
  visited: string[];
  ts: number;
}

export function resumeKey(projectId: string | undefined, cardId: string | undefined): string {
  return `otd:resume:${projectId ?? "anon"}:${cardId ?? "card"}`;
}

export function readResume(key: string): ResumeRecord | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const rec = JSON.parse(raw) as ResumeRecord;
    if (typeof rec?.anchorId === "string" && Array.isArray(rec.visited) && typeof rec.ts === "number") return rec;
  } catch {
    /* private mode / bad JSON */
  }
  return null;
}

export function writeResume(key: string, rec: ResumeRecord): void {
  try {
    localStorage.setItem(key, JSON.stringify(rec));
  } catch {
    /* quota / private mode */
  }
}

// Hybrid reconcile (Task 7): newer `ts` wins the position (anchorId + ts);
// `visited` is the union of both so a tick earned on any device sticks.
export function mergeResume(local: ResumeRecord | null, server: ResumeRecord | null): ResumeRecord | null {
  if (!local) return server;
  if (!server) return local;
  const newer = server.ts > local.ts ? server : local;
  const visited = [...new Set([...local.visited, ...server.visited])];
  return { anchorId: newer.anchorId, ts: newer.ts, visited };
}
