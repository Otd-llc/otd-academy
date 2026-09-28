import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `vi.mock` factories are hoisted above the module body, so the shared spies +
// env stub must be created via `vi.hoisted` to be available inside them.
const { captureSpy, captureImmediateSpy, ctorSpy, envMock, cookieJar } = vi.hoisted(() => ({
  // The request's cookies, as `next/headers` would see them. `null` = no
  // request context at all (cron, a script): cookies() throws.
  cookieJar: { value: {} as Record<string, string> | null },
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

vi.mock("next/headers", () => ({
  cookies: async () => {
    const jar = cookieJar.value;
    if (jar === null) throw new Error("cookies() called outside a request scope");
    return { get: (name: string) => (name in jar ? { value: jar[name]! } : undefined) };
  },
}));

/** c15t 2.2.1's own cookie format, as it writes it after "Accept All". */
const GRANTED = "c.necessary:1,c.measurement:1,i.time:1759000000000,i.type:all";
/** ...and after "Reject All": a refused category is simply absent. */
const REFUSED = "c.necessary:1,i.time:1759000000000,i.type:necessary";

import {
  __lastCaptureForTests,
  OPERATIONAL_EVENTS,
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
  cookieJar.value = { c15t: GRANTED };
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
  it("constructs a singleton client and forwards the event when the key is set", async () => {
    envMock.NEXT_PUBLIC_POSTHOG_KEY = "phc_test_key";
    capture("purchase_completed", { projectSlug: "l1-01-wroom" }, "user_42");
    await __lastCaptureForTests();
    capture("certificate_shared", undefined, "user_42");
    await __lastCaptureForTests();
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

  it("mints a UNIQUE anonymous distinctId per call when none is provided", async () => {
    // The old constant "anonymous-server" collapsed every anonymous event into
    // ONE PostHog person forever — "people who joined the waitlist" counted as
    // a single person, however many there were.
    envMock.NEXT_PUBLIC_POSTHOG_KEY = "phc_test_key";
    capture("email_captured", { source: "waitlist" });
    await __lastCaptureForTests();
    capture("email_captured", { source: "waitlist" });
    await __lastCaptureForTests();
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

// THE CONSENT RULE (decision 1.14). Class (b) = anything about a person: sent
// only with a c15t `measurement` grant. Class (a) = OPERATIONAL_EVENTS: sent
// without consent, under a fixed server id, allow-listed properties only.
describe("the consent rule", () => {
  beforeEach(() => {
    envMock.NEXT_PUBLIC_POSTHOG_KEY = "phc_test_key";
  });

  async function send(event: string, props?: Record<string, unknown>, id?: string) {
    capture(event, props, id);
    await __lastCaptureForTests();
  }

  it.each([
    ["no c15t cookie", {}],
    ["Reject All", { c15t: REFUSED }],
    ["measurement explicitly 0", { c15t: "c.necessary:1,c.measurement:0" }],
    ["a JSON-shaped cookie", { c15t: JSON.stringify({ consents: { measurement: true } }) }],
    ["no request at all (cron / webhook)", null],
  ] as const)("drops an identified event with %s", async (_label, jar) => {
    cookieJar.value = jar as Record<string, string> | null;
    await send("purchase_completed", { projectId: "p1" }, "user_42");
    await send("lesson_started", { projectSlug: "l1" }, "user_42");
    await send("printable_downloaded", { referrer: "https://x" }, "ph-browser-id");
    await send("email_captured", { source: "waitlist" });
    await captureNow("signed_up", undefined, "user_42");
    // Dropped WHOLE: not sent without the id, not counted as a refusal.
    expect(captureSpy).not.toHaveBeenCalled();
    expect(captureImmediateSpy).not.toHaveBeenCalled();
  });

  it("sends an identified event as before once measurement is granted", async () => {
    cookieJar.value = { c15t: GRANTED };
    await send("purchase_completed", { projectId: "p1" }, "user_42");
    expect(captureSpy).toHaveBeenCalledWith({
      distinctId: "user_42",
      event: "purchase_completed",
      properties: { projectId: "p1" },
    });
  });

  it("reads a percent-encoded c15t cookie", async () => {
    cookieJar.value = { c15t: encodeURIComponent(GRANTED) };
    await send("checkout_started", { projectId: "p1" }, "user_42");
    expect(captureSpy).toHaveBeenCalledTimes(1);
  });

  it("sends class (a) events WITHOUT consent, under a fixed id, with no person", async () => {
    cookieJar.value = null; // no request, no consent
    for (const [event, op] of Object.entries(OPERATIONAL_EVENTS)) {
      captureSpy.mockClear();
      const props: Record<string, unknown> = {
        email: "a@b.c",
        userId: "user_42",
        detail: "Resend error: a@b.c",
        invoiceId: "in_1",
        sessionId: "cs_1",
      };
      for (const k of op.keys) props[k] = `v-${k}`;
      await send(event, props, "user_42");
      expect(captureSpy, event).toHaveBeenCalledTimes(1);
      const sent = captureSpy.mock.calls[0]![0] as {
        distinctId: string;
        properties: Record<string, unknown>;
      };
      expect(sent.distinctId, event).toBe(op.id);
      expect(sent.distinctId, event).toMatch(/^server:/);
      // Exactly the allow-list plus the no-profile flag: nothing personal
      // survives, whatever the caller passed.
      expect(Object.keys(sent.properties).sort(), event).toEqual(
        [...op.keys, "$process_person_profile"].sort(),
      );
      expect(sent.properties.$process_person_profile, event).toBe(false);
    }
  });

  it("no class (a) allow-list names a personal or free-text field", () => {
    const personal = /email|user|detail|message|invoice|session|^ip$|referrer|distinct/i;
    for (const [event, op] of Object.entries(OPERATIONAL_EVENTS)) {
      for (const k of op.keys) expect(k, `${event}.${k}`).not.toMatch(personal);
    }
  });

  it("captureNow sends a class (a) event without consent, ignoring the caller's id", async () => {
    cookieJar.value = {};
    await captureNow("magic_link_send_failed", { status: 500, to: "a@b.c" }, "user_42");
    expect(captureImmediateSpy).toHaveBeenCalledWith({
      distinctId: "server:auth",
      event: "magic_link_send_failed",
      properties: { status: 500, $process_person_profile: false },
    });
  });

  it("an unlisted event is class (b) by default", async () => {
    cookieJar.value = {};
    await send("some_new_event", { a: 1 });
    expect(captureSpy).not.toHaveBeenCalled();
  });
});
