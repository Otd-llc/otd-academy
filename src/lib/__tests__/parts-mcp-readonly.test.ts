// Proves the read-only Neon role behind PARTS_MCP_DATABASE_URL: it can SELECT but
// CANNOT write. Two independent guarantees back this — no write GRANT (privilege
// error) AND default_transaction_read_only=on (read-only-transaction error) — so
// `.rejects.toThrow()` is satisfied either way. vitest.setup.ts loads .env.local.
//
// This is the Stage B "cannot-write assertion" (design §5/§9). It uses the SAME
// `makeReadOnlyClient` the MCP server uses, against the real foundry_ro role, so a
// regression in the role's grants or a misconfigured URL fails the suite loudly
// (required, not skipped — a silent skip could hide the read-only guarantee
// vanishing).
import { afterAll, describe, expect, test } from "vitest";

import { makeReadOnlyClient } from "../../../mcp/parts-server/client";

const url = process.env.PARTS_MCP_DATABASE_URL;
const client = url ? makeReadOnlyClient(url) : null;

afterAll(async () => {
  await client?.$disconnect();
});

describe("parts MCP read-only role", () => {
  test("PARTS_MCP_DATABASE_URL is set and distinct from DATABASE_URL", () => {
    expect(url, "provision foundry_ro + set PARTS_MCP_DATABASE_URL (Task 1)").toBeTruthy();
    expect(url).not.toBe(process.env.DATABASE_URL);
  });

  test("the read-only role CAN read", async () => {
    const rows = await client!.$queryRawUnsafe<{ one: number }[]>("SELECT 1 AS one");
    expect(rows[0]!.one).toBe(1);
  });

  test("the read-only role CANNOT write", async () => {
    await expect(
      client!.$executeRawUnsafe(`UPDATE "Part" SET description = description WHERE id = '__never__'`),
    ).rejects.toThrow();
  });
});
