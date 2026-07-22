// The pure identify/reset decision extracted from the IdentitySync island so it
// is node-testable (the island itself just awaits getPosthog() and delegates).
// Covers the four branches: identify when the person changes, skip identify when
// it already matches (but still mark), reset+clear on sign-out with a prior
// identify, and no-op on sign-out without one. A throwing PostHog must never
// escape — telemetry can't break the UI.
import { describe, expect, it, vi } from "vitest";
import { applyIdentity } from "@/lib/identity-sync";
import type { PostHog } from "posthog-js";

const MARKER = "otd:ph-identified";

function fakeStore(initial?: Record<string, string>) {
  const map = new Map<string, string>(Object.entries(initial ?? {}));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    _map: map,
  };
}

function fakePh(distinctId: string) {
  return {
    get_distinct_id: () => distinctId,
    identify: vi.fn(),
    reset: vi.fn(),
  };
}

describe("applyIdentity", () => {
  it("identifies + marks when signed in and the person differs", () => {
    const ph = fakePh("anon-device");
    const store = fakeStore();
    applyIdentity(ph as unknown as PostHog, "user-1", store);
    expect(ph.identify).toHaveBeenCalledWith("user-1");
    expect(ph.identify).toHaveBeenCalledTimes(1);
    expect(store._map.get(MARKER)).toBe("1");
  });

  it("marks but does NOT re-identify when already the same person", () => {
    const ph = fakePh("user-1");
    const store = fakeStore();
    applyIdentity(ph as unknown as PostHog, "user-1", store);
    expect(ph.identify).not.toHaveBeenCalled();
    expect(store._map.get(MARKER)).toBe("1");
  });

  it("resets + clears the marker on sign-out after a prior identify", () => {
    const ph = fakePh("user-1");
    const store = fakeStore({ [MARKER]: "1" });
    applyIdentity(ph as unknown as PostHog, null, store);
    expect(ph.reset).toHaveBeenCalledTimes(1);
    expect(store._map.has(MARKER)).toBe(false);
  });

  it("does nothing on sign-out when there was no prior identify", () => {
    const ph = fakePh("anon-device");
    const store = fakeStore();
    applyIdentity(ph as unknown as PostHog, null, store);
    expect(ph.reset).not.toHaveBeenCalled();
    expect(ph.identify).not.toHaveBeenCalled();
  });

  it("swallows a throwing PostHog (telemetry never breaks the UI)", () => {
    const ph = {
      get_distinct_id: () => "anon",
      identify: vi.fn(() => {
        throw new Error("boom");
      }),
      reset: vi.fn(),
    };
    const store = fakeStore();
    expect(() =>
      applyIdentity(ph as unknown as PostHog, "user-1", store),
    ).not.toThrow();
  });
});
