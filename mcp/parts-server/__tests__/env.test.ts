import { describe, expect, test } from "vitest";
import { resolvePartsDbUrl } from "../env";

describe("resolvePartsDbUrl", () => {
  test("throws when PARTS_MCP_DATABASE_URL is unset", () => {
    expect(() => resolvePartsDbUrl({} as NodeJS.ProcessEnv)).toThrow(/not set/i);
  });

  test("throws when it equals DATABASE_URL (the owner client)", () => {
    const env = {
      PARTS_MCP_DATABASE_URL: "postgresql://x/db",
      DATABASE_URL: "postgresql://x/db",
    } as unknown as NodeJS.ProcessEnv;
    expect(() => resolvePartsDbUrl(env)).toThrow(/must not equal DATABASE_URL/i);
  });

  test("returns the url when set and distinct", () => {
    const env = {
      PARTS_MCP_DATABASE_URL: "postgresql://ro@h/db",
      DATABASE_URL: "postgresql://owner@h/db",
    } as unknown as NodeJS.ProcessEnv;
    expect(resolvePartsDbUrl(env)).toBe("postgresql://ro@h/db");
  });
});
