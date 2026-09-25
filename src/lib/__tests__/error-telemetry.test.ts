// Error telemetry (plan 5.9, academy half): the server `onRequestError` hook, the
// client beacon route, the sanitizers both share, and the gate exemption that
// lets a signed-out fault reach the beacon at all.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const captureNow = vi.hoisted(() => vi.fn(async () => {}));
const enforce = vi.hoisted(() => vi.fn(async () => ({ ok: true }) as { ok: boolean }));
vi.mock("@/lib/analytics", () => ({ captureNow }));
vi.mock("@/lib/abuse-limit", () => ({ enforce }));

import {
  parseClientBeacon,
  safePath,
  serverErrorProperties,
} from "@/lib/error-telemetry";
import { onRequestError } from "@/instrumentation";
import { POST } from "@/app/api/beacon/error/route";
import { isPublicPath } from "@/lib/admin-routes";
import { RULES } from "@/lib/abuse-policy";

beforeEach(() => {
  captureNow.mockClear();
  enforce.mockReset();
  enforce.mockResolvedValue({ ok: true });
});
afterEach(() => {
  vi.unstubAllEnvs();
});

const CONTEXT = {
  routerKind: "App Router",
  routePath: "/projects/[slug]/guide",
  routeType: "render",
  renderSource: "react-server-components",
  revalidateReason: undefined,
} as const;

describe("sanitizers", () => {
  it("safePath keeps the pathname and drops the query and fragment", () => {
    expect(safePath("/api/auth/callback/resend?token=SECRET&email=a%40b.c")).toBe(
      "/api/auth/callback/resend",
    );
    expect(safePath("/x#frag")).toBe("/x");
    expect(safePath("https://evil.test/x")).toBeNull();
    expect(safePath(42)).toBeNull();
    expect(safePath("/" + "a".repeat(500))!.length).toBe(200);
  });

  it("server properties carry no message, header or query", () => {
    const err = Object.assign(new Error("user learner@example.test not found"), {
      digest: "123456789",
    });
    const props = serverErrorProperties(
      err,
      { path: "/account?email=learner@example.test", method: "GET" },
      CONTEXT,
    );
    expect(props).toEqual({
      path: "/account",
      method: "GET",
      routePath: "/projects/[slug]/guide",
      routeType: "render",
      routerKind: "app",
      renderSource: "react-server-components",
      name: "Error",
      digest: "123456789",
    });
    expect(JSON.stringify(props)).not.toContain("example.test");
  });

  it("a beacon keeps only the known, sanitized fields", () => {
    expect(
      parseClientBeacon(
        JSON.stringify({
          boundary: "chrome",
          path: "/learn?x=1",
          name: "TypeError",
          digest: "abc",
          message: "secret learner@example.test",
          stack: "at ...",
        }),
      ),
    ).toEqual({ boundary: "chrome", path: "/learn", name: "TypeError", digest: "abc" });
  });

  it.each([
    ["not json", "{"],
    ["an array", "[]"],
    ["an unknown boundary", JSON.stringify({ boundary: "other" })],
    ["no boundary", JSON.stringify({ path: "/" })],
  ])("a beacon that is %s is refused", (_label, raw) => {
    expect(parseClientBeacon(raw)).toBeNull();
  });
});

describe("onRequestError (src/instrumentation.ts)", () => {
  it("captures one server_error in the node runtime, with no PII", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    const err = Object.assign(new Error("boom for learner@example.test"), { digest: "d1" });
    await onRequestError(
      err,
      { path: "/account?token=SECRET", method: "POST", headers: { cookie: "session=SECRET" } },
      CONTEXT,
    );
    expect(captureNow).toHaveBeenCalledTimes(1);
    const [event, props, distinctId] = captureNow.mock.calls[0] as unknown as [
      string,
      Record<string, unknown>,
      string,
    ];
    expect(event).toBe("server_error");
    expect(distinctId).toBe("server:error");
    expect(props).toMatchObject({ path: "/account", method: "POST", digest: "d1", name: "Error" });
    expect(JSON.stringify(captureNow.mock.calls)).not.toMatch(/SECRET|example\.test/);
  });

  it("does nothing outside the node runtime", async () => {
    vi.stubEnv("NEXT_RUNTIME", "edge");
    await onRequestError(new Error("x"), { path: "/", method: "GET", headers: {} }, CONTEXT);
    expect(captureNow).not.toHaveBeenCalled();
  });

  it("never throws, even when the capture does", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    captureNow.mockRejectedValueOnce(new Error("posthog down"));
    await expect(
      onRequestError(new Error("x"), { path: "/", method: "GET", headers: {} }, CONTEXT),
    ).resolves.toBeUndefined();
  });
});

function beacon(
  body: string,
  headers: Record<string, string> = { "sec-fetch-site": "same-origin" },
) {
  return new NextRequest("https://academy.example.test/api/beacon/error", {
    method: "POST",
    body,
    headers: { "x-forwarded-for": "203.0.113.7", ...headers },
  });
}

const GOOD = JSON.stringify({ boundary: "global", path: "/hex", name: "Error", digest: "d2" });

describe("POST /api/beacon/error", () => {
  it("captures a same-origin beacon server-side and answers 204", async () => {
    const res = await POST(beacon(GOOD));
    expect(res.status).toBe(204);
    expect(captureNow).toHaveBeenCalledTimes(1);
    expect(captureNow).toHaveBeenCalledWith(
      "client_error",
      { boundary: "global", path: "/hex", name: "Error", digest: "d2" },
      "server:beacon",
    );
  });

  it("is rate-limited per IP through the shared limiter, fail-open", async () => {
    await POST(beacon(GOOD));
    expect(enforce).toHaveBeenCalledTimes(1);
    const [checks, mode] = enforce.mock.calls[0] as unknown as [
      { rule: string; identity: string }[],
      string,
    ];
    expect(checks).toHaveLength(1);
    expect(checks[0]!.rule).toBe("beacon:ip:hour");
    // HMAC'd, never the raw address.
    expect(checks[0]!.identity).not.toContain("203.0.113");
    expect(mode).toBe("open");
  });

  it("a limited IP gets 429 and records nothing", async () => {
    enforce.mockResolvedValueOnce({ ok: false });
    const res = await POST(beacon(GOOD));
    expect(res.status).toBe(429);
    expect(captureNow).not.toHaveBeenCalled();
  });

  it("refuses a cross-site POST before reading it", async () => {
    const res = await POST(beacon(GOOD, { "sec-fetch-site": "cross-site" }));
    expect(res.status).toBe(403);
    expect(enforce).not.toHaveBeenCalled();
    expect(captureNow).not.toHaveBeenCalled();
  });

  it("refuses a body over 2 KB, even without a Content-Length", async () => {
    const big = JSON.stringify({ boundary: "global", pad: "x".repeat(4000) });
    const res = await POST(beacon(big));
    expect(res.status).toBe(413);
    expect(captureNow).not.toHaveBeenCalled();
  });

  it("refuses a body that is not a beacon", async () => {
    const res = await POST(beacon("hello"));
    expect(res.status).toBe(400);
    expect(captureNow).not.toHaveBeenCalled();
  });

  it("has its own limiter rule", () => {
    expect(RULES["beacon:ip:hour"]).toEqual({ limit: 20, window: "1 h" });
  });
});

describe("the beacon is reachable signed-out, without narrowing the proxy", () => {
  it("isPublicPath admits exactly /api/beacon/error", () => {
    expect(isPublicPath("/api/beacon/error")).toBe(true);
    expect(isPublicPath("/api/beacon")).toBe(false);
    expect(isPublicPath("/api/beacon/other")).toBe(false);
    expect(isPublicPath("/api/beacon/error/extra")).toBe(false);
    expect(isPublicPath("/api/hex-clusters")).toBe(false);
  });

  it("the proxy matcher still covers the beacon (it is not excluded)", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/proxy.ts", "utf8");
    expect(src).not.toContain("api/beacon");
  });
});
