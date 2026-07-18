import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Control TURNSTILE_SECRET_KEY per test by mocking the env module.
vi.mock("@/env", () => ({ env: { TURNSTILE_SECRET_KEY: undefined as string | undefined } }));

import { env } from "@/env";
import { verifyTurnstile } from "@/lib/turnstile";

const mockEnv = env as unknown as { TURNSTILE_SECRET_KEY: string | undefined };

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status });
}

describe("verifyTurnstile", () => {
  beforeEach(() => {
    mockEnv.TURNSTILE_SECRET_KEY = "test-secret";
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("passes (true) with no secret — keyless build — and makes no network call", async () => {
    mockEnv.TURNSTILE_SECRET_KEY = undefined;
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(await verifyTurnstile("anything", null)).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fails closed (false) when configured but no token", async () => {
    expect(await verifyTurnstile(undefined, null)).toBe(false);
    expect(await verifyTurnstile("", null)).toBe(false);
  });

  it("returns true for a valid token (success:true)", async () => {
    const fetchSpy = vi.fn(async (_url: string, _init: RequestInit) =>
      jsonResponse({ success: true }),
    );
    vi.stubGlobal("fetch", fetchSpy);
    expect(await verifyTurnstile("good-token", "1.2.3.4")).toBe(true);
    // remoteip is forwarded when present
    const body = fetchSpy.mock.calls[0]?.[1]?.body as URLSearchParams;
    expect(body.get("remoteip")).toBe("1.2.3.4");
    expect(body.get("response")).toBe("good-token");
  });

  it("returns false for an invalid token (success:false)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ success: false })));
    expect(await verifyTurnstile("bad-token", null)).toBe(false);
  });

  it("fails closed on a non-200 response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    expect(await verifyTurnstile("token", null)).toBe(false);
  });

  it("fails closed on a network throw", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    expect(await verifyTurnstile("token", null)).toBe(false);
  });

  it("fails closed on timeout (a hang past the deadline aborts)", async () => {
    vi.useFakeTimers();
    // A fetch that only settles when its abort signal fires.
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, opts: { signal: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            opts.signal.addEventListener("abort", () =>
              reject(new DOMException("aborted", "AbortError")),
            );
          }),
      ),
    );
    const p = verifyTurnstile("token", null);
    await vi.advanceTimersByTimeAsync(2100);
    expect(await p).toBe(false);
  });
});
