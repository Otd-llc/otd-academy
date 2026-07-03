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

// Validate an untrusted value (localStorage JSON, or a DB Json column) into a
// ResumeRecord, or null. Shared by the client read and the server-side read.
export function coerceResume(value: unknown): ResumeRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const r = value as Record<string, unknown>;
  if (typeof r.anchorId === "string" && Array.isArray(r.visited) && r.visited.every((v) => typeof v === "string") && typeof r.ts === "number") {
    return { anchorId: r.anchorId, visited: r.visited as string[], ts: r.ts };
  }
  return null;
}

export function readResume(key: string): ResumeRecord | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? coerceResume(JSON.parse(raw)) : null;
  } catch {
    return null; // private mode / bad JSON
  }
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
