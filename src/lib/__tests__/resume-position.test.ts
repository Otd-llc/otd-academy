import { describe, it, expect } from "vitest";
import { mergeResume, type ResumeRecord } from "@/lib/resume-position";

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
