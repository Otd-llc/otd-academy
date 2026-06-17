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
});
