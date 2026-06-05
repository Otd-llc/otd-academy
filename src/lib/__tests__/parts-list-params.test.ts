// src/lib/__tests__/parts-list-params.test.ts
import { describe, test, expect } from "vitest";
import { partsListParamsSchema } from "@/lib/schemas/part";

describe("partsListParamsSchema", () => {
  test("defaults: empty input → sort=manufacturer, page=1, mains=false", () => {
    const p = partsListParamsSchema.parse({});
    expect(p).toEqual({ q: undefined, lifecycle: undefined, mains: false, sort: "manufacturer", page: 1 });
  });

  test("parses q, lifecycle, sort, page and mains='1'", () => {
    const p = partsListParamsSchema.parse({ q: "  10k  ", lifecycle: "EOL", sort: "recent", page: "3", mains: "1" });
    expect(p).toEqual({ q: "10k", lifecycle: "EOL", mains: true, sort: "recent", page: 3 });
  });

  test("invalid values fall back instead of throwing", () => {
    const p = partsListParamsSchema.parse({ lifecycle: "NOPE", sort: "sideways", page: "-4", mains: "0" });
    expect(p.lifecycle).toBeUndefined();
    expect(p.sort).toBe("manufacturer");
    expect(p.page).toBe(1);
    expect(p.mains).toBe(false); // only "1" enables mains
  });
});
