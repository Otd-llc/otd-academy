import { describe, expect, test } from "vitest";
import { relativeAge } from "@/lib/relative-time";

const now = new Date("2026-06-19T12:00:00Z");
describe("relativeAge", () => {
  test("seconds → just now", () => {
    expect(relativeAge(new Date("2026-06-19T11:59:30Z"), now)).toBe("just now");
  });
  test("minutes / hours / days", () => {
    expect(relativeAge(new Date("2026-06-19T11:30:00Z"), now)).toBe("30m ago");
    expect(relativeAge(new Date("2026-06-19T09:00:00Z"), now)).toBe("3h ago");
    expect(relativeAge(new Date("2026-06-16T12:00:00Z"), now)).toBe("3d ago");
  });
});
