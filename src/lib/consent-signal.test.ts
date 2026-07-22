// The consent bridge between c15t (React) and getPosthog (plain module). The
// default MUST be denied so a pre-consent (EU) visitor is never tracked, and a
// cold load must read the last decision from the localStorage mirror.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Fresh module per test so the module-level flag/hydrated reset.
async function freshModule() {
  vi.resetModules();
  return import("@/lib/consent-signal");
}

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("analytics consent signal", () => {
  it("defaults to DENIED with no prior decision", async () => {
    const m = await freshModule();
    expect(m.analyticsConsentGranted()).toBe(false);
  });

  it("a cold read hydrates GRANTED from the localStorage mirror", async () => {
    store.set("otd:analytics-consent", "1");
    const m = await freshModule();
    expect(m.analyticsConsentGranted()).toBe(true);
  });

  it("setAnalyticsConsent(true) grants + mirrors; (false) revokes + clears", async () => {
    const m = await freshModule();
    m.setAnalyticsConsent(true);
    expect(m.analyticsConsentGranted()).toBe(true);
    expect(store.get("otd:analytics-consent")).toBe("1");
    m.setAnalyticsConsent(false);
    expect(m.analyticsConsentGranted()).toBe(false);
    expect(store.has("otd:analytics-consent")).toBe(false);
  });
});
