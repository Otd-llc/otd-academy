import { describe, it, expect } from "vitest";
import {
  academyDay,
  academyDate,
  quizXp,
  lessonXp,
  levelFor,
  LEVELS,
  dedupe,
} from "@/lib/logbook/economy";

describe("academyDay", () => {
  it("keys to America/Chicago, not UTC", () => {
    // 2026-07-11T03:00Z = 2026-07-10 22:00 in Chicago (CDT)
    expect(academyDay(new Date("2026-07-11T03:00:00Z"))).toBe("2026-07-10");
    expect(academyDay(new Date("2026-07-11T06:00:00Z"))).toBe("2026-07-11");
  });
  it("academyDate mirrors academyDay as a 00:00Z Date", () => {
    expect(academyDate(new Date("2026-07-11T03:00:00Z")).toISOString()).toBe(
      "2026-07-10T00:00:00.000Z",
    );
  });
});

describe("amounts", () => {
  it("quiz: full first-ever, reduced on repop", () => {
    expect(quizXp({ firstEver: true })).toBe(5);
    expect(quizXp({ firstEver: false })).toBe(2);
  });
  it("lesson: readMin-scaled, full then reduced", () => {
    expect(lessonXp(4, { firstEver: true })).toBe(12);
    expect(lessonXp(4, { firstEver: false })).toBe(4);
  });
});

describe("levelFor", () => {
  it("walks the FL ladder", () => {
    expect(levelFor(0)).toMatchObject({ level: 1 });
    expect(levelFor(LEVELS[1].minXp)).toMatchObject({ level: 2 });
    expect(levelFor(999999).level).toBe(LEVELS.length);
  });
});

describe("dedupe keys", () => {
  it("daily sources embed the day; once sources don't", () => {
    const d = new Date("2026-07-11T12:00:00Z");
    expect(dedupe.quizCorrect("u1", "s#q1", d)).toBe(
      "QUIZ_CORRECT:u1:s#q1:2026-07-11",
    );
    expect(dedupe.clusterComplete("u1", "fundamentals")).toBe(
      "CLUSTER_COMPLETE:u1:fundamentals",
    );
  });
});
