import { describe, expect, test } from "vitest";
import { parseBomCsv } from "@/lib/bom-csv";

describe("parseBomCsv", () => {
  test("maps header columns and converts dollars → cents", () => {
    const csv =
      "refDes,manufacturer,mpn,quantity,unitPrice\n" +
      "R1,Yageo,RC0805,1,0.02";
    const { rows, errors } = parseBomCsv(csv);
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({
      refDes: "R1",
      manufacturer: "Yageo",
      mpn: "RC0805",
      quantity: 1,
      unitPriceCents: 2,
    });
  });

  test("blank unitPrice → null", () => {
    const { rows } = parseBomCsv("refDes,manufacturer,mpn,quantity,unitPrice\nC1,KEMET,C0805,1,");
    expect(rows[0]!.unitPriceCents).toBeNull();
  });

  test("multi-refDes normalizes to comma-joined and must match quantity", () => {
    const ok = parseBomCsv("refDes,manufacturer,mpn,quantity\n\"R1, R2\",Yageo,RC0805,2");
    expect(ok.errors).toEqual([]);
    expect(ok.rows[0]!.refDes).toBe("R1,R2");

    const bad = parseBomCsv("refDes,manufacturer,mpn,quantity\n\"R1, R2\",Yageo,RC0805,3");
    expect(bad.rows).toEqual([]);
    expect(bad.errors[0]).toMatchObject({ row: 2 });
  });

  test("trailing comma in refDes is rejected (blank segment)", () => {
    const { rows, errors } = parseBomCsv(
      "refDes,manufacturer,mpn,quantity\n\"R1,\",Yageo,RC0805,1",
    );
    expect(rows).toEqual([]);
    expect(errors.some((e) => e.row === 2)).toBe(true);
    expect(errors.some((e) => /empty designator segment/.test(e.message))).toBe(true);
  });

  test("blank segment from spaced double comma \"R1, , R2\" is rejected", () => {
    const { rows, errors } = parseBomCsv(
      "refDes,manufacturer,mpn,quantity\n\"R1, , R2\",Yageo,RC0805,3",
    );
    expect(rows).toEqual([]);
    expect(errors.some((e) => e.row === 2)).toBe(true);
  });

  test("blank segment from bare double comma \"R1,,R2\" is rejected", () => {
    const { rows, errors } = parseBomCsv(
      "refDes,manufacturer,mpn,quantity\n\"R1,,R2\",Yageo,RC0805,3",
    );
    expect(rows).toEqual([]);
    expect(errors.some((e) => e.row === 2)).toBe(true);
  });

  test("missing required column → top-level error, no rows", () => {
    const { rows, errors } = parseBomCsv("manufacturer,mpn,quantity\nYageo,RC0805,1");
    expect(rows).toEqual([]);
    expect(errors[0]!.message).toMatch(/refDes/i);
  });

  test("unitPrice that exceeds the cents cap is rejected", () => {
    // 100_000_000 cents = $1,000,000. One dollar over → 100_000_100 cents.
    const { rows, errors } = parseBomCsv(
      "refDes,manufacturer,mpn,quantity,unitPrice\nR1,Yageo,RC0805,1,1000001",
    );
    expect(rows).toEqual([]);
    expect(errors.some((e) => e.row === 2)).toBe(true);
    expect(errors.some((e) => /maximum/i.test(e.message))).toBe(true);
  });

  test("notes longer than 1000 chars is rejected", () => {
    const longNotes = "x".repeat(1001);
    const { rows, errors } = parseBomCsv(
      `refDes,manufacturer,mpn,quantity,notes\nR1,Yageo,RC0805,1,${longNotes}`,
    );
    expect(rows).toEqual([]);
    expect(errors.some((e) => e.row === 2)).toBe(true);
    expect(errors.some((e) => /notes/i.test(e.message))).toBe(true);
  });

  test("altMpn longer than 200 chars is rejected", () => {
    const longAlt = "y".repeat(201);
    const { rows, errors } = parseBomCsv(
      `refDes,manufacturer,mpn,quantity,altMpn\nR1,Yageo,RC0805,1,${longAlt}`,
    );
    expect(rows).toEqual([]);
    expect(errors.some((e) => e.row === 2)).toBe(true);
    expect(errors.some((e) => /altMpn/i.test(e.message))).toBe(true);
  });

  test("accepted row carries its true source line number", () => {
    // Row 2 is a parse error (bad quantity); row 3 is the first accepted row,
    // so its sourceRow must be 3, not 2.
    const { rows, errors } = parseBomCsv(
      "refDes,manufacturer,mpn,quantity\n" +
        "R1,Yageo,RC0805,bad\n" +
        "R2,Yageo,RC0805,1",
    );
    expect(errors.some((e) => e.row === 2)).toBe(true);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.sourceRow).toBe(3);
  });

  test("intra-file duplicate (manufacturer, mpn) keeps only the first row", () => {
    // Both rows resolve to the SAME part (manufacturer+mpn). The importer
    // upserts on the composite key, so the second would silently overwrite the
    // first (last-row-wins data loss). The parser must keep only the first and
    // error the second.
    const { rows, errors } = parseBomCsv(
      "refDes,manufacturer,mpn,quantity\n" +
        "R1,Yageo,RC0805,1\n" +
        "R2,Yageo,RC0805,1",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ refDes: "R1", quantity: 1, sourceRow: 2 });
    const dupErrors = errors.filter((e) => /duplicate/i.test(e.message));
    expect(dupErrors).toHaveLength(1);
    expect(dupErrors[0]!.row).toBe(3);
    // Error must reference the first row's source line number (2).
    expect(dupErrors[0]!.message).toMatch(/\b2\b/);
  });

  test("three rows with the same key keep the first, error rows 2 and 3", () => {
    const { rows, errors } = parseBomCsv(
      "refDes,manufacturer,mpn,quantity\n" +
        "R1,Yageo,RC0805,1\n" +
        "R2,Yageo,RC0805,1\n" +
        "R3,Yageo,RC0805,1",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.refDes).toBe("R1");
    const dupErrors = errors.filter((e) => /duplicate/i.test(e.message));
    expect(dupErrors.map((e) => e.row).sort()).toEqual([3, 4]);
  });

  test("same mpn with manufacturer differing only by case is NOT a duplicate", () => {
    // The importer's Prisma composite-unique match is case-sensitive, so
    // "Yageo" and "yageo" are distinct parts and both must be kept.
    const { rows, errors } = parseBomCsv(
      "refDes,manufacturer,mpn,quantity\n" +
        "R1,Yageo,RC0805,1\n" +
        "R2,yageo,RC0805,1",
    );
    expect(rows).toHaveLength(2);
    expect(errors.some((e) => /duplicate/i.test(e.message))).toBe(false);
  });

  test("an invalid second occurrence is excluded by the validation gate before the dup guard", () => {
    // Row 3 has a bad quantity, so it's excluded by the rowErrors gate and
    // never reaches the dup guard at all — confirming the guard sits AFTER
    // validation (an invalid row produces a quantity error, not a duplicate
    // error, and still can't reach `rows`). No data loss either way.
    const { rows, errors } = parseBomCsv(
      "refDes,manufacturer,mpn,quantity\n" +
        "R1,Yageo,RC0805,1\n" +
        "R2,Yageo,RC0805,bad",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.refDes).toBe("R1");
    expect(errors.some((e) => e.row === 3)).toBe(true);
    // It's a validation error, NOT a spurious duplicate error.
    expect(errors.some((e) => /duplicate/i.test(e.message))).toBe(false);
  });

  test("an invalid FIRST occurrence does not block a later valid row with the same key", () => {
    // The tricky ordering case: the first row with a key is invalid (errors and
    // continues BEFORE the key is recorded), so a later valid row with the same
    // key legitimately becomes the sole/first occurrence and is kept with no
    // duplicate error. This pins the guard's position after the rowErrors gate;
    // moving it earlier would regress this.
    const { rows, errors } = parseBomCsv(
      "refDes,manufacturer,mpn,quantity\n" +
        "R1,Yageo,RC0805,bad\n" +
        "R2,Yageo,RC0805,1",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ refDes: "R2", sourceRow: 3 });
    expect(errors.some((e) => e.row === 2)).toBe(true);
    expect(errors.some((e) => /duplicate/i.test(e.message))).toBe(false);
  });

  test("valid CSV with no duplicates parses unchanged (regression)", () => {
    const { rows, errors } = parseBomCsv(
      "refDes,manufacturer,mpn,quantity,unitPrice\n" +
        "R1,Yageo,RC0805,1,0.02\n" +
        "C1,KEMET,C0805,1,0.05\n" +
        "U1,TI,SN74,1,1.50",
    );
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.refDes)).toEqual(["R1", "C1", "U1"]);
  });
});
