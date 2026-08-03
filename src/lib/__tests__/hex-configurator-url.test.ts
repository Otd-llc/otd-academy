// The frame's target origin, and the rules about what may appear where in it.
//
// The payload-in-fragment rule is the one worth pinning: `save-link.ts` in the
// configurator forbids scene data in a query string because it would reach
// access logs and the Referer of every asset the page loads, and /hex is
// PostHog-instrumented so it would also reach `$current_url`.
import { afterEach, describe, expect, it, vi } from "vitest";

const PROD = "https://demo.onethousanddrones.com";

async function load() {
  vi.resetModules();
  return import("@/lib/hex-configurator-url");
}

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe("hexConfiguratorOrigin", () => {
  it("defaults to the published configurator", async () => {
    vi.stubEnv("NEXT_PUBLIC_HEX_CONFIGURATOR_URL", undefined);
    const { hexConfiguratorOrigin } = await load();
    expect(hexConfiguratorOrigin()).toBe(PROD);
  });

  it("honours an override, so the frame can point at a local build", async () => {
    vi.stubEnv("NEXT_PUBLIC_HEX_CONFIGURATOR_URL", "http://localhost:5180");
    const { hexConfiguratorOrigin } = await load();
    expect(hexConfiguratorOrigin()).toBe("http://localhost:5180");
  });

  it("reduces an override with a path to its origin", async () => {
    vi.stubEnv("NEXT_PUBLIC_HEX_CONFIGURATOR_URL", "http://192.168.0.5:5180/hex");
    const { hexConfiguratorOrigin } = await load();
    expect(hexConfiguratorOrigin()).toBe("http://192.168.0.5:5180");
  });
});

describe("hexConfiguratorSrc", () => {
  it("always asks for the embedded presentation", async () => {
    vi.stubEnv("NEXT_PUBLIC_HEX_CONFIGURATOR_URL", undefined);
    const { hexConfiguratorSrc } = await load();
    expect(hexConfiguratorSrc()).toBe(`${PROD}/hex?embed=1`);
  });

  it("carries a person id when one was resolved", async () => {
    vi.stubEnv("NEXT_PUBLIC_HEX_CONFIGURATOR_URL", undefined);
    const { hexConfiguratorSrc } = await load();
    expect(hexConfiguratorSrc({ distinctId: "abc123" })).toContain("ph_did=abc123");
  });

  it("omits ph_did entirely when there is none, rather than sending an empty one", async () => {
    vi.stubEnv("NEXT_PUBLIC_HEX_CONFIGURATOR_URL", undefined);
    const { hexConfiguratorSrc } = await load();
    expect(hexConfiguratorSrc({ distinctId: null })).not.toContain("ph_did");
  });

  it("puts the payload in the FRAGMENT, never the query", async () => {
    vi.stubEnv("NEXT_PUBLIC_HEX_CONFIGURATOR_URL", undefined);
    const { hexConfiguratorSrc } = await load();
    const src = hexConfiguratorSrc({ payload: "ENCODEDBUILD" });
    expect(src).toContain("#ENCODEDBUILD");
    expect(src.split("#")[0]).not.toContain("ENCODEDBUILD");
    expect(new URL(src).searchParams.get("build")).toBeNull();
  });
});
