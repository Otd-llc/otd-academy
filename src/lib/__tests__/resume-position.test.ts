import { describe, it, expect } from "vitest";
import {
  mergeResume,
  pruneResume,
  resumeKey,
  type ResumeRecord,
} from "@/lib/resume-position";

const rec = (anchorId: string, visited: string[], ts: number): ResumeRecord => ({ anchorId, visited, ts });

describe("mergeResume", () => {
  it("returns local when there is no server record", () => {
    const local = rec("island-03", ["island-01", "island-02"], 100);
    expect(mergeResume(local, null)).toEqual(local);
  });
  it("returns server when there is no local record", () => {
    const server = rec("island-05", ["island-01"], 200);
    expect(mergeResume(null, server)).toEqual(server);
  });
  it("newer ts wins the position; visited is the union", () => {
    const local = rec("island-03", ["island-01", "island-02", "island-03"], 100);
    const server = rec("island-05", ["island-01", "island-04"], 200);
    expect(mergeResume(local, server)).toEqual({
      anchorId: "island-05",
      ts: 200,
      visited: ["island-01", "island-02", "island-03", "island-04"],
    });
  });
  it("keeps the local position when local is newer, still unions visited", () => {
    const local = rec("island-06", ["island-06"], 300);
    const server = rec("island-02", ["island-02"], 200);
    expect(mergeResume(local, server)).toEqual({ anchorId: "island-06", ts: 300, visited: ["island-06", "island-02"] });
  });
  it("returns null when both are absent", () => {
    expect(mergeResume(null, null)).toBeNull();
  });
});

describe("resumeKey", () => {
  it("scopes by user so two accounts on one browser never share a key", () => {
    expect(resumeKey("u1", "p1", "c1")).toBe("otd:resume:u1:p1:c1");
    expect(resumeKey("u2", "p1", "c1")).not.toBe(resumeKey("u1", "p1", "c1"));
  });
  it("uses 'anon' for a signed-out viewer (never carries into an account)", () => {
    expect(resumeKey(undefined, "p1", "c1")).toBe("otd:resume:anon:p1:c1");
    expect(resumeKey("u1", "p1", "c1")).not.toBe(
      resumeKey(undefined, "p1", "c1"),
    );
  });
});

describe("pruneResume", () => {
  const islands = ["island-01", "island-02", "island-03"];
  it("returns null when the anchor no longer exists (card re-authored)", () => {
    expect(pruneResume(rec("island-99", ["island-01"], 1), islands)).toBeNull();
  });
  it("drops visited anchors that are gone", () => {
    expect(
      pruneResume(rec("island-02", ["island-01", "island-99"], 1), islands),
    ).toEqual({ anchorId: "island-02", visited: ["island-01"], ts: 1 });
  });
  it("returns the record unchanged when everything is still valid", () => {
    const r = rec("island-02", ["island-01", "island-02"], 1);
    expect(pruneResume(r, islands)).toBe(r);
  });
  it("returns null for a null record", () => {
    expect(pruneResume(null, islands)).toBeNull();
  });
});
