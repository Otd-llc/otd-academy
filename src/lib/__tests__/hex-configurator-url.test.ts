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
    vi.stubEnv(
      "NEXT_PUBLIC_HEX_CONFIGURATOR_URL",
      "http://192.168.0.5:5180/hex",
    );
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
    expect(hexConfiguratorSrc({ distinctId: "abc123" })).toContain(
      "ph_did=abc123",
    );
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

// The recall parameters, pinned one at a time.
//
// `adoptReturnLink` in the configurator requires ALL SIX and rejects the recall
// outright if one is missing. The consequence of a miss is not an error: the
// build loads, the sheet prints, and it prints UNCONTROLLED on a cluster that
// IS saved. That is invisible without paper in your hand, which is why each one
// gets its own assertion rather than a single deep-equal that a future edit
// could satisfy while dropping a field.
describe("hexConfiguratorSrc — recall", () => {
  const RECALL = {
    drawingLabel: "OTD-HEX-1001",
    revLabel: "B",
    shareCode: "zK3pQ7wR2fL9xN4vB8tCmA",
    payloadHash: `h1:${"a".repeat(64)}`,
    name: "Bench cluster",
    savedAt: "2026-08-03T00:00:00.000Z",
  };

  async function srcWith(recall = RECALL) {
    vi.stubEnv("NEXT_PUBLIC_HEX_CONFIGURATOR_URL", undefined);
    const { hexConfiguratorSrc } = await load();
    return new URL(hexConfiguratorSrc({ recall, payload: "ENCODEDBUILD" }));
  }

  it.each([
    ["d", "drawingLabel", "OTD-HEX-1001"],
    ["r", "revLabel", "B"],
    ["s", "shareCode", "zK3pQ7wR2fL9xN4vB8tCmA"],
    ["h", "payloadHash", `h1:${"a".repeat(64)}`],
    ["n", "name", "Bench cluster"],
    ["t", "savedAt", "2026-08-03T00:00:00.000Z"],
  ])("carries %s (%s)", async (key: string, _field: string, value: string) => {
    expect((await srcWith()).searchParams.get(key)).toBe(value);
  });

  it("carries h=, which is what ties the identity to the payload", async () => {
    // Called out separately from the table above on purpose. Dropping any of
    // the six breaks the recall loudly (the configurator refuses it); dropping
    // `h` is the one that would make the check VACUOUS instead, and a vacuous
    // check passes.
    const src = await srcWith();
    expect(src.searchParams.get("h")).toMatch(/^h1:[0-9a-f]{64}$/);
  });

  it("sends an EMPTY name as a present-but-empty parameter", async () => {
    // A build saved without a name is legitimate, and `adoptReturnLink`
    // distinguishes "" (fine) from absent (reject the whole recall). Writing it
    // conditionally would turn those two into the same thing.
    const src = await srcWith({ ...RECALL, name: "" });
    expect(src.searchParams.has("n")).toBe(true);
    expect(src.searchParams.get("n")).toBe("");
  });

  it("still asks for the embedded presentation alongside a recall", async () => {
    expect((await srcWith()).searchParams.get("embed")).toBe("1");
  });

  it("keeps the payload in the fragment even with a recall attached", async () => {
    vi.stubEnv("NEXT_PUBLIC_HEX_CONFIGURATOR_URL", undefined);
    const { hexConfiguratorSrc } = await load();
    const src = hexConfiguratorSrc({ recall: RECALL, payload: "ENCODEDBUILD" });
    // Query BEFORE fragment, or the recall parameters become part of the
    // fragment and the configurator never sees them.
    expect(src.indexOf("?")).toBeLessThan(src.indexOf("#"));
    expect(src.split("#")[1]).toBe("ENCODEDBUILD");
  });

  it("writes no recall parameters at all when there is no recall", async () => {
    vi.stubEnv("NEXT_PUBLIC_HEX_CONFIGURATOR_URL", undefined);
    const { hexConfiguratorSrc } = await load();
    const src = new URL(hexConfiguratorSrc({ recall: null }));
    for (const key of ["d", "r", "s", "h", "n", "t"]) {
      expect(src.searchParams.has(key)).toBe(false);
    }
  });
});
