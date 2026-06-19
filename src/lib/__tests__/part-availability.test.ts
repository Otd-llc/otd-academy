import { describe, expect, test } from "vitest";
import { assessPartAvailability, countUnbuildable } from "@/lib/part-availability";

const base = {
  dkInStock: true,
  dkLifecycle: "Active",
  dkCheckedAt: new Date(),
  curatedLifecycle: "ACTIVE",
};
const NOW = new Date("2026-06-18T00:00:00Z");

describe("assessPartAvailability", () => {
  test("in stock + active → OK", () => {
    expect(assessPartAvailability({ ...base, dkCheckedAt: NOW }, NOW).status).toBe("OK");
  });
  test("zero stock → OUT_OF_STOCK", () => {
    expect(
      assessPartAvailability({ ...base, dkInStock: false, dkCheckedAt: NOW }, NOW).status,
    ).toBe("OUT_OF_STOCK");
  });
  test("obsolete DK status → OBSOLETE, not buildable", () => {
    const r = assessPartAvailability({ ...base, dkLifecycle: "Obsolete", dkCheckedAt: NOW }, NOW);
    expect(r.status).toBe("OBSOLETE");
    expect(r.buildable).toBe(false);
  });
  test("discontinued → EOL, not buildable", () => {
    expect(
      assessPartAvailability(
        { ...base, dkLifecycle: "Discontinued at Digi-Key", dkCheckedAt: NOW },
        NOW,
      ).buildable,
    ).toBe(false);
  });
  test("V2: NRND is still buyable → status NRND, BUILDABLE true", () => {
    const r = assessPartAvailability(
      { ...base, dkLifecycle: "Not Recommended for New Designs", dkCheckedAt: NOW },
      NOW,
    );
    expect(r.status).toBe("NRND");
    expect(r.buildable).toBe(true);
  });
  test("never checked → UNKNOWN, not buildable-blocking", () => {
    expect(assessPartAvailability({ ...base, dkCheckedAt: null }, NOW).status).toBe("UNKNOWN");
  });
  test("countUnbuildable counts OOS/EOL/Obsolete", () => {
    const lines = [
      { dkInStock: true, dkLifecycle: "Active", dkCheckedAt: NOW, curatedLifecycle: "ACTIVE" },
      { dkInStock: false, dkLifecycle: "Active", dkCheckedAt: NOW, curatedLifecycle: "ACTIVE" },
    ];
    expect(countUnbuildable(lines, NOW)).toBe(1);
  });
});
