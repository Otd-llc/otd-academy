import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `vi.mock` factories are hoisted above the module body, so the shared spies +
// env stub must be created via `vi.hoisted` to be available inside them.
const { captureSpy, captureImmediateSpy, ctorSpy, envMock } = vi.hoisted(() => ({
  captureSpy: vi.fn(),
  captureImmediateSpy: vi.fn(async (..._args: unknown[]) => {}),
  ctorSpy: vi.fn(),
  envMock: {
    NEXT_PUBLIC_POSTHOG_KEY: undefined as string | undefined,
    NEXT_PUBLIC_POSTHOG_HOST: "https://us.i.posthog.com",
  },
}));

// Mock posthog-node so no real client is ever constructed and no network call
// is made. The mock records constructions + capture calls so we can assert the
// no-op path never touches the SDK.
vi.mock("posthog-node", () => ({
  PostHog: class {
    constructor(...args: unknown[]) {
      ctorSpy(...args);
    }
    capture(...args: unknown[]) {
      captureSpy(...args);
    }
    captureImmediate(...args: unknown[]) {
      return captureImmediateSpy(...args);
    }
  },
}));

// `@/env` is validated at import; mock it so we can flip the key per test
// without tripping @t3-oss runtime validation.
vi.mock("@/env", () => ({ env: envMock }));

import {
  capture,
  captureNow,
  CAPTURE_NOW_TIMEOUT_MS,
  getClient,
  __resetAnalyticsClientForTests,
} from "@/lib/analytics";

beforeEach(() => {
  captureSpy.mockClear();
  captureImmediateSpy.mockReset();
  captureImmediateSpy.mockImplementation(async () => {});
  ctorSpy.mockClear();
  __resetAnalyticsClientForTests();
});

afterEach(() => {
  envMock.NEXT_PUBLIC_POSTHOG_KEY = undefined;
});

describe("analytics capture — no-op when disabled", () => {
  it("getClient returns null when NEXT_PUBLIC_POSTHOG_KEY is unset", () => {
    envMock.NEXT_PUBLIC_POSTHOG_KEY = undefined;
    expect(getClient()).toBeNull();
    expect(ctorSpy).not.toHaveBeenCalled();
  });

  it("capture is a no-op (no client constructed, no SDK call) when the key is unset", () => {
    envMock.NEXT_PUBLIC_POSTHOG_KEY = undefined;
    capture("board_activated", { projectSlug: "l1-01-wroom" }, "user_123");
    expect(ctorSpy).not.toHaveBeenCalled();
    expect(captureSpy).not.toHaveBeenCalled();
  });

  it("capture never throws even when invoked repeatedly while disabled", () => {
    envMock.NEXT_PUBLIC_POSTHOG_KEY = undefined;
    expect(() => {
      capture("signed_up");
      capture("lesson_started", { foo: "bar" });
    }).not.toThrow();
  });
});

describe("analytics capture — enabled path", () => {
  it("constructs a singleton client and forwards the event when the key is set", () => {
    envMock.NEXT_PUBLIC_POSTHOG_KEY = "phc_test_key";
    capture("purchase_completed", { projectSlug: "l1-01-wroom" }, "user_42");
    capture("certificate_shared", undefined, "user_42");
    // One construction (singleton), two forwarded captures.
    expect(ctorSpy).toHaveBeenCalledTimes(1);
    expect(captureSpy).toHaveBeenCalledTimes(2);
    expect(captureSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        distinctId: "user_42",
        event: "purchase_completed",
        properties: { projectSlug: "l1-01-wroom" },
      }),
    );
  });

  it("mints a UNIQUE anonymous distinctId per call when none is provided", () => {
    // The old constant "anonymous-server" collapsed every anonymous event into
    // ONE PostHog person forever — "people who joined the waitlist" counted as
    // a single person, however many there were.
    envMock.NEXT_PUBLIC_POSTHOG_KEY = "phc_test_key";
    capture("email_captured", { source: "waitlist" });
    capture("email_captured", { source: "waitlist" });
    expect(captureSpy).toHaveBeenCalledTimes(2);
    const idA = (captureSpy.mock.calls[0]![0] as { distinctId: string }).distinctId;
    const idB = (captureSpy.mock.calls[1]![0] as { distinctId: string }).distinctId;
    expect(idA).not.toBe("anonymous-server");
    expect(idA).not.toBe(idB);
    expect(idA.length).toBeGreaterThanOrEqual(16);
  });
});

describe("captureNow — the awaited, bounded capture", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("is a no-op when the key is unset", async () => {
    envMock.NEXT_PUBLIC_POSTHOG_KEY = undefined;
    await captureNow("server_error", { path: "/x" });
    expect(ctorSpy).not.toHaveBeenCalled();
    expect(captureImmediateSpy).not.toHaveBeenCalled();
  });

  it("sends immediately, under the given server identity, with no person profile", async () => {
    envMock.NEXT_PUBLIC_POSTHOG_KEY = "phc_test_key";
    await captureNow("magic_link_send_failed", { status: 429 }, "server:auth");
    expect(captureImmediateSpy).toHaveBeenCalledTimes(1);
    expect(captureImmediateSpy).toHaveBeenCalledWith({
      distinctId: "server:auth",
      event: "magic_link_send_failed",
      properties: { status: 429, $process_person_profile: false },
    });
    expect(captureSpy).not.toHaveBeenCalled();
  });

  it("never waits longer than the timeout on a hung PostHog", async () => {
    vi.useFakeTimers();
    envMock.NEXT_PUBLIC_POSTHOG_KEY = "phc_test_key";
    captureImmediateSpy.mockImplementation(() => new Promise(() => {}));
    let settled = false;
    const p = captureNow("server_error").then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(CAPTURE_NOW_TIMEOUT_MS - 1);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect(settled).toBe(true);
    expect(CAPTURE_NOW_TIMEOUT_MS).toBeLessThanOrEqual(2000);
  });

  it("swallows a rejected send", async () => {
    envMock.NEXT_PUBLIC_POSTHOG_KEY = "phc_test_key";
    captureImmediateSpy.mockImplementation(async () => {
      throw new Error("posthog down");
    });
    await expect(captureNow("server_error")).resolves.toBeUndefined();
  });

  it("swallows a synchronous throw from the SDK", async () => {
    envMock.NEXT_PUBLIC_POSTHOG_KEY = "phc_test_key";
    captureImmediateSpy.mockImplementation(() => {
      throw new Error("sdk bug");
    });
    await expect(captureNow("server_error")).resolves.toBeUndefined();
  });
});
