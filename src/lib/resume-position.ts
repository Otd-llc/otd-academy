// Resume-position store (guide-pacing plan, Task 6). The record written by the
// IslandRail — { anchorId, visited, ts } — lives at
// localStorage["otd:resume:<userId>:<projectId>:<cardId>"]. This module owns the
// shared read/write plus the pure hybrid-merge used by the Task 7 enrollment sync.
//
// The key is SCOPED BY USER (the leading <userId>, "anon" when signed out) so a
// resume record can never leak across accounts sharing a browser: a brand-new
// account gets a fresh key, and an anon record never carries into an account.
// (Before this, the device-global key made a fresh account "resume" a lesson it
// had never seen.)

export interface ResumeRecord {
  anchorId: string;
  visited: string[];
  ts: number;
}

export function resumeKey(
  userId: string | undefined,
  projectId: string | undefined,
  cardId: string | undefined,
): string {
  return `otd:resume:${userId ?? "anon"}:${projectId ?? "anon"}:${cardId ?? "card"}`;
}

// Invalidate a record against the CURRENT island set: if its anchor no longer
// exists (the card was re-authored), the record is stale → null. Otherwise keep
// it, dropping any `visited` anchors that are no longer present. Prevents a
// resume from pointing at content that has moved or been removed.
export function pruneResume(
  rec: ResumeRecord | null,
  validAnchorIds: readonly string[],
): ResumeRecord | null {
  if (!rec) return null;
  const valid = new Set(validAnchorIds);
  if (!valid.has(rec.anchorId)) return null;
  const visited = rec.visited.filter((v) => valid.has(v));
  return visited.length === rec.visited.length
    ? rec
    : { ...rec, visited };
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
