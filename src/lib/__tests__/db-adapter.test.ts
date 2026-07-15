import { describe, it, expect } from "vitest";
import { isLocalDbUrl } from "@/lib/db-adapter";

describe("isLocalDbUrl", () => {
  it("recognises a local Postgres URL", () => {
    expect(isLocalDbUrl("postgresql://postgres:pw@localhost:5432/foundry_dev")).toBe(true);
    expect(isLocalDbUrl("postgresql://postgres:pw@127.0.0.1:5432/foundry_dev")).toBe(true);
  });

  it("recognises a Neon URL as NOT local", () => {
    expect(
      isLocalDbUrl(
        "postgresql://u:p@ep-lucky-dust-aqsl7sb8-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require",
      ),
    ).toBe(false);
    expect(
      isLocalDbUrl("postgresql://u:p@ep-lucky-dust-aqsl7sb8.c-8.us-east-1.aws.neon.tech/neondb"),
    ).toBe(false);
  });

  it("treats an unparseable URL as NOT local (fail safe: assume remote)", () => {
    expect(isLocalDbUrl("not a url")).toBe(false);
    expect(isLocalDbUrl("")).toBe(false);
  });

  it("does not mistake a hostname that merely CONTAINS 'localhost' for local", () => {
    // Substring matching here would be a real hazard: it would pick the
    // local-only driver for a remote host and fail confusingly at connect time.
    expect(isLocalDbUrl("postgresql://u:p@localhost.evil.example.com/db")).toBe(false);
    expect(isLocalDbUrl("postgresql://u:p@not-localhost.neon.tech/db")).toBe(false);
  });
});
