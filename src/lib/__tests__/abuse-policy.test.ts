import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/env", () => ({
  env: {
    AUTH_SECRET: "test-secret-at-least-32-characters-long!!",
    MAGIC_GLOBAL_DAILY_CAP: undefined as number | undefined,
  },
}));

import {
  RULES,
  emailAlias,
  ipPrefix,
  hmacKey,
  clientIp,
  nsPrefix,
  magicLinkChecks,
  ipOnlyCheck,
} from "@/lib/abuse-policy";
import { env } from "@/env";

const mockEnv = env as unknown as { MAGIC_GLOBAL_DAILY_CAP: number | undefined };

describe("emailAlias", () => {
  it("lowercases and trims", () => {
    expect(emailAlias("  Josh@Example.COM ")).toBe("josh@example.com");
  });
  it("strips a +tag for any domain", () => {
    expect(emailAlias("victim+1@gmail.com")).toBe("victim@gmail.com");
    expect(emailAlias("a+anything@example.com")).toBe("a@example.com");
  });
  it("strips dots only for gmail/googlemail", () => {
    expect(emailAlias("v.i.c.t.i.m@gmail.com")).toBe("victim@gmail.com");
    expect(emailAlias("v.i.p@googlemail.com")).toBe("vip@googlemail.com");
    expect(emailAlias("v.i.p@example.com")).toBe("v.i.p@example.com"); // dots kept elsewhere
  });
  it("strips both dots and +tag for gmail", () => {
    expect(emailAlias("v.i.p+promo@gmail.com")).toBe("vip@gmail.com");
  });
  it("strips yahoo's -tag", () => {
    expect(emailAlias("user-shopping@yahoo.com")).toBe("user@yahoo.com");
  });
  it("collapses aliases of one inbox to the same key", () => {
    const a = emailAlias("v.i.c.t.i.m+1@gmail.com");
    const b = emailAlias("victim+9999@gmail.com");
    expect(a).toBe(b);
  });
  it("leaves a non-address input lowercased but intact", () => {
    expect(emailAlias("not-an-email")).toBe("not-an-email");
  });
});

describe("ipPrefix", () => {
  it("passes IPv4 through unchanged", () => {
    expect(ipPrefix("203.0.113.7")).toBe("203.0.113.7");
  });
  it("collapses IPv6 to its /64", () => {
    expect(ipPrefix("2001:db8:1:2:3:4:5:6")).toBe("2001:db8:1:2::/64");
  });
  it("collapses two addresses in one /64 to the same prefix", () => {
    const a = ipPrefix("2001:db8:abcd:1::1");
    const b = ipPrefix("2001:db8:abcd:1:ffff:ffff:ffff:ffff");
    expect(a).toBe(b);
    expect(a).toBe("2001:db8:abcd:1::/64");
  });
  it("strips brackets and a zone id", () => {
    expect(ipPrefix("[2001:db8:1:2::1]")).toBe("2001:db8:1:2::/64");
    expect(ipPrefix("fe80::1%eth0")).toBe("fe80:0:0:0::/64");
  });
  it("returns null for null", () => {
    expect(ipPrefix(null)).toBeNull();
  });
});

describe("hmacKey", () => {
  it("is deterministic for the same input", () => {
    expect(hmacKey("a@b.com")).toBe(hmacKey("a@b.com"));
  });
  it("differs across inputs and never returns the plaintext", () => {
    expect(hmacKey("a@b.com")).not.toBe(hmacKey("c@d.com"));
    expect(hmacKey("a@b.com")).not.toContain("a@b.com");
  });
});

describe("clientIp", () => {
  it("prefers x-vercel-forwarded-for", () => {
    const h = new Headers({ "x-vercel-forwarded-for": "1.1.1.1", "x-forwarded-for": "2.2.2.2" });
    expect(clientIp(h)).toBe("1.1.1.1");
  });
  it("falls back to x-forwarded-for and takes the first hop", () => {
    const h = new Headers({ "x-forwarded-for": "3.3.3.3, 4.4.4.4" });
    expect(clientIp(h)).toBe("3.3.3.3");
  });
  it("returns null when no header is present", () => {
    expect(clientIp(new Headers())).toBeNull();
  });
});

describe("nsPrefix", () => {
  it("namespaces by VERCEL_ENV", () => {
    const prev = process.env.VERCEL_ENV;
    process.env.VERCEL_ENV = "preview";
    expect(nsPrefix("magic:email:hour")).toBe("otd:preview:magic:email:hour");
    delete process.env.VERCEL_ENV;
    expect(nsPrefix("magic:email:hour")).toBe("otd:local:magic:email:hour");
    if (prev !== undefined) process.env.VERCEL_ENV = prev;
  });
});

describe("magicLinkChecks", () => {
  it("returns email burst/hour/day + global, and NOT the IP rule", () => {
    const checks = magicLinkChecks("user@example.com");
    expect(checks.map((c) => c.rule)).toEqual([
      "magic:email:burst",
      "magic:email:hour",
      "magic:email:day",
      "magic:global:day",
    ]);
    expect(checks.some((c) => c.rule === "magic:ip:hour")).toBe(false);
  });
  it("orders the global rule LAST", () => {
    const checks = magicLinkChecks("user@example.com");
    expect(checks[checks.length - 1].rule).toBe("magic:global:day");
  });
  it("gives aliases of one inbox the same HMAC'd email identity", () => {
    const a = magicLinkChecks("v.i.p+1@gmail.com");
    const b = magicLinkChecks("vip@gmail.com");
    expect(a[0].identity).toBe(b[0].identity);
    expect(a[0].identity).not.toContain("vip"); // HMAC'd, not plaintext
  });
  it("uses a shared 'global' identity for the global rule", () => {
    const g = magicLinkChecks("a@b.com").find((c) => c.rule === "magic:global:day");
    expect(g?.identity).toBe("global");
  });
});

describe("ipOnlyCheck", () => {
  it("returns null when the IP is unknown", () => {
    expect(ipOnlyCheck(null)).toBeNull();
  });
  it("returns the magic:ip:hour check keyed on the HMAC'd /64", () => {
    const c = ipOnlyCheck("2001:db8:1:2::9");
    expect(c?.rule).toBe("magic:ip:hour");
    expect(c?.identity).toBe(hmacKey("2001:db8:1:2::/64"));
  });
});

describe("RULES", () => {
  it("matches the sourced design numbers (guard against silent tidying)", () => {
    expect(RULES["magic:email:burst"]).toEqual({ limit: 1, window: "60 s" });
    expect(RULES["magic:email:hour"]).toEqual({ limit: 5, window: "1 h" });
    expect(RULES["magic:email:day"]).toEqual({ limit: 15, window: "24 h" });
    expect(RULES["magic:ip:hour"]).toEqual({ limit: 50, window: "1 h" });
    expect(RULES["waitlist:ip:hour"]).toEqual({ limit: 20, window: "1 h" });
    expect(RULES["tip:ip:hour"]).toEqual({ limit: 10, window: "1 h" });
  });
  it("resolves the global cap default (2000) when the env override is unset", () => {
    mockEnv.MAGIC_GLOBAL_DAILY_CAP = undefined;
    const g = RULES["magic:global:day"];
    expect(typeof g.limit).toBe("function");
    expect((g.limit as () => number)()).toBe(2000);
    expect(g.window).toBe("24 h");
  });
  it("resolves the env override for the global cap when set", () => {
    mockEnv.MAGIC_GLOBAL_DAILY_CAP = 500;
    expect((RULES["magic:global:day"].limit as () => number)()).toBe(500);
    mockEnv.MAGIC_GLOBAL_DAILY_CAP = undefined;
  });
});
