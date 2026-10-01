import { describe, expect, it } from "vitest";

import { classifyProdRoUrl, PROD_RO_PLACEHOLDER } from "@/lib/prod-ro";

const HOST = "ep-example-pooler.c-8.us-east-1.aws.neon.tech";
const RO = `postgresql://foundry_ro:s3cret@${HOST}/neondb?sslmode=require`;
const OWNER = `postgresql://neondb_owner:0wner@${HOST}/neondb?sslmode=require`;
const OWNER_DIRECT = `postgresql://neondb_owner:0wner@ep-example.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require`;
const LOCAL = "postgresql://postgres:x@localhost:5432/foundry_dev";

const good = {
  PROD_RO_DATABASE_URL: RO,
  PROD_DATABASE_URL: OWNER,
  PROD_DIRECT_URL: OWNER_DIRECT,
  DATABASE_URL: LOCAL,
};

describe("classifyProdRoUrl (the read-only report guard)", () => {
  it("admits the foundry_ro URL beside local DATABASE_URL and owner URLs on the owner role", () => {
    expect(classifyProdRoUrl(good)).toEqual({ ok: true, host: HOST });
  });

  it("refuses when the variable is missing or not a postgres URL", () => {
    expect(
      classifyProdRoUrl({ ...good, PROD_RO_DATABASE_URL: undefined }).ok,
    ).toBe(false);
    expect(
      classifyProdRoUrl({ ...good, PROD_RO_DATABASE_URL: "https://x" }).ok,
    ).toBe(false);
  });

  it("refuses any role but foundry_ro, naming the role it saw", () => {
    const v = classifyProdRoUrl({ ...good, PROD_RO_DATABASE_URL: OWNER });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toMatch(/connects as "neondb_owner"/);
  });

  it("refuses the placeholder password with the rotation instruction", () => {
    const v = classifyProdRoUrl({
      ...good,
      PROD_RO_DATABASE_URL: `postgresql://foundry_ro:${PROD_RO_PLACEHOLDER}@${HOST}/neondb`,
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toMatch(/placeholder/);
  });

  it("refuses both owner URLs, whether identical or merely on the read-only role", () => {
    expect(classifyProdRoUrl({ ...good, PROD_DATABASE_URL: RO }).ok).toBe(
      false,
    );
    expect(
      classifyProdRoUrl({
        ...good,
        PROD_DIRECT_URL: `postgresql://foundry_ro:other@ep-example.c-8.us-east-1.aws.neon.tech/neondb`,
      }).ok,
    ).toBe(false);
  });

  it("refuses to run under pnpm db:prod (DATABASE_URL swapped to a remote host)", () => {
    const v = classifyProdRoUrl({ ...good, DATABASE_URL: OWNER });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toMatch(/db:prod/);
  });

  it("does not need DATABASE_URL at all", () => {
    expect(classifyProdRoUrl({ ...good, DATABASE_URL: undefined }).ok).toBe(
      true,
    );
  });
});
