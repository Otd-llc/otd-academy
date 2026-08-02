// The public printable download path: the URL helper's two modes, and the proxy
// route's key resolution.
//
// The resolver is the security boundary. It never accepts an R2 key — it
// validates tokens and REBUILDS the key with the uploader's own helpers — so the
// tests below are mostly about proving that nothing outside `printables/` is
// reachable, however the path is bent.
import { afterEach, describe, expect, it, vi } from "vitest";

import { resolvePrintable } from "@/lib/printable-key";

const RELEASE = "2026-07-31";

describe("resolvePrintable — what it serves", () => {
  it("serves the set archive", () => {
    expect(resolvePrintable([RELEASE, "sets", "hex-cluster.zip"])).toEqual({
      key: "printables/2026-07-31/sets/hex-cluster.zip",
      filename: "hex-cluster.zip",
      ext: "zip",
    });
  });

  it("serves the standalone licence", () => {
    expect(resolvePrintable([RELEASE, "LICENSE.txt"])).toEqual({
      key: "printables/2026-07-31/LICENSE.txt",
      filename: "LICENSE.txt",
      ext: "txt",
    });
  });

  it.each(["3mf", "stl", "step"])("serves a %s mesh", (fmt) => {
    const r = resolvePrintable([RELEASE, fmt, `hex-tb-main.${fmt}`]);
    expect(r?.key).toBe(`printables/2026-07-31/${fmt}/hex-tb-main.${fmt}`);
    expect(r?.ext).toBe(fmt);
  });

  it("keys match what the uploader writes", () => {
    // Cross-check against the observed dry-run output, so a change to either
    // side of the contract shows up here rather than as a 404 in the wild.
    expect(resolvePrintable([RELEASE, "3mf", "dovetail-cap-double-f-1h.3mf"])?.key).toBe(
      "printables/2026-07-31/3mf/dovetail-cap-double-f-1h.3mf",
    );
  });
});

describe("resolvePrintable — what it refuses", () => {
  it.each([
    [["../avatars/x.webp"], "parent traversal in the release slot"],
    [[RELEASE, "..", "secret.zip"], "parent traversal in the format slot"],
    [[RELEASE, "sets", "../../avatars/x.zip"], "traversal inside a name"],
    [["avatars", "x.webp"], "a different bucket prefix"],
    [["guide-shots", "abc.webp"], "another bucket prefix"],
    [[RELEASE], "a release with no file"],
    [[RELEASE, "3mf"], "a format with no file"],
    [[RELEASE, "3mf", "a.3mf", "b.3mf"], "an over-long path"],
    [[RELEASE, "sets", "hex-cluster"], "a set with no .zip"],
    [[RELEASE, "stl", "hex-tb-main.3mf"], "an extension that fights its folder"],
    [[RELEASE, "exe", "payload.exe"], "a format we never wrote"],
    [[RELEASE, "license.txt"], "the licence in the wrong case"],
    [["2026-7-31", "LICENSE.txt"], "an unpadded release"],
    [["latest", "LICENSE.txt"], "a non-date release"],
    [[RELEASE, "3mf", "Hex-TB-Main.3mf"], "an unslugged part name"],
    [[RELEASE, "3mf", "hex_tb_main.3mf"], "underscores in a part name"],
    [[], "an empty path"],
  ])("refuses %j (%s)", (path) => {
    expect(resolvePrintable(path as string[])).toBeNull();
  });

  it("never returns a key outside printables/", () => {
    // A blunt backstop over the table above: whatever comes back, it is under
    // the one prefix, because it was rebuilt rather than echoed.
    const probes = [
      [RELEASE, "sets", "hex-cluster.zip"],
      [RELEASE, "LICENSE.txt"],
      [RELEASE, "stl", "hex-tb-main.stl"],
      ["..", "..", "etc.zip"],
      [RELEASE, "sets", "..zip"],
    ];
    for (const p of probes) {
      const r = resolvePrintable(p);
      if (r) expect(r.key.startsWith("printables/")).toBe(true);
    }
  });
});

describe("printable URL helper", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("uses the proxy when no public R2 base is configured", async () => {
    // `undefined`, not "": the schema is `z.url().optional()` and t3-env does
    // not fold empty strings, so an empty value would fail validation instead
    // of exercising the unset path.
    vi.stubEnv("NEXT_PUBLIC_R2_PUBLIC_BASE_URL", undefined);
    const { printableSetUrl, printableLicenseUrl } = await import(
      "@/lib/printable-url"
    );
    expect(printableSetUrl(RELEASE, "hex-cluster")).toBe(
      "/api/printable/2026-07-31/sets/hex-cluster.zip",
    );
    expect(printableLicenseUrl(RELEASE)).toBe(
      "/api/printable/2026-07-31/LICENSE.txt",
    );
  });

  it("switches to direct R2 the moment the base is set, with no code change", async () => {
    vi.stubEnv(
      "NEXT_PUBLIC_R2_PUBLIC_BASE_URL",
      "https://media.onethousanddrones.com",
    );
    const { printableSetUrl, printableLicenseUrl } = await import(
      "@/lib/printable-url"
    );
    expect(printableSetUrl(RELEASE, "hex-cluster")).toBe(
      "https://media.onethousanddrones.com/printables/2026-07-31/sets/hex-cluster.zip",
    );
    expect(printableLicenseUrl(RELEASE)).toBe(
      "https://media.onethousanddrones.com/printables/2026-07-31/LICENSE.txt",
    );
  });

  it("does not double the slash when the base carries a trailing one", async () => {
    vi.stubEnv(
      "NEXT_PUBLIC_R2_PUBLIC_BASE_URL",
      "https://media.onethousanddrones.com/",
    );
    const { printableSetUrl } = await import("@/lib/printable-url");
    expect(printableSetUrl(RELEASE, "hex-cluster")).toBe(
      "https://media.onethousanddrones.com/printables/2026-07-31/sets/hex-cluster.zip",
    );
  });
});

// The handler itself, with R2 mocked. The bucket is empty until the owner runs
// the uploader with --write, so a live probe can only ever show 404 and cannot
// tell "valid path, absent object" from "rejected path". This is what proves the
// serving half: the headers a downloader actually depends on.
const getBytes = vi.hoisted(() => vi.fn());
vi.mock("@/lib/part-r2", () => ({ getR2ObjectBytes: getBytes }));

describe("the proxy route serves an object", () => {
  afterEach(() => {
    getBytes.mockReset();
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  // R2 config must be STUBBED, not inherited. CI has no `.env.local`, so
  // R2_ENABLED/R2_BUCKET are unset there and the route 404s before it resolves
  // anything — which passed locally and went red in CI on the first run. A test
  // that only holds on a developer's machine is not a test.
  async function call(path: string[]) {
    vi.stubEnv("R2_ENABLED", "true");
    vi.stubEnv("R2_BUCKET", "test-bucket");
    vi.resetModules();
    const { GET } = await import("@/app/api/printable/[...path]/route");
    return GET({} as never, { params: Promise.resolve({ path }) });
  }

  it("returns the bytes as an attachment with an immutable cache", async () => {
    getBytes.mockResolvedValue(Buffer.from("PKzip"));
    const res = await call([RELEASE, "sets", "hex-cluster.zip"]);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/zip");
    // Attachment, or the browser renders a .txt and "downloads" nothing.
    expect(res.headers.get("content-disposition")).toBe(
      'attachment; filename="hex-cluster.zip"',
    );
    expect(res.headers.get("cache-control")).toContain("immutable");
    expect(getBytes).toHaveBeenCalledWith(
      "printables/2026-07-31/sets/hex-cluster.zip",
    );
  });

  it("types a mesh by its format", async () => {
    getBytes.mockResolvedValue(Buffer.from("solid"));
    const res = await call([RELEASE, "stl", "hex-tb-main.stl"]);
    expect(res.headers.get("content-type")).toBe("model/stl");
  });

  it("404s an absent object instead of surfacing the R2 error", async () => {
    getBytes.mockRejectedValue(new Error("NoSuchKey"));
    const res = await call([RELEASE, "LICENSE.txt"]);
    expect(res.status).toBe(404);
  });

  it("never reaches R2 for a rejected path", async () => {
    const res = await call(["..", "avatars", "x.webp"]);
    expect(res.status).toBe(404);
    expect(getBytes).not.toHaveBeenCalled();
  });

  it("404s with R2 switched off, without touching the bucket", async () => {
    // The CI-shaped environment, asserted deliberately rather than encountered
    // by accident: no R2 config means no download, and no attempt at one.
    vi.stubEnv("R2_ENABLED", "false");
    vi.stubEnv("R2_BUCKET", undefined);
    vi.resetModules();
    const { GET } = await import("@/app/api/printable/[...path]/route");
    const res = await GET({} as never, {
      params: Promise.resolve({ path: [RELEASE, "LICENSE.txt"] }),
    });
    expect(res.status).toBe(404);
    expect(getBytes).not.toHaveBeenCalled();
  });
});

describe("the proxy route is exempt from the auth middleware", () => {
  it("appears in the proxy matcher's negative lookahead", async () => {
    // Without this the route 307s to /sign-in for exactly the signed-out
    // visitor it exists to serve. It is one regex, so pin it.
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/proxy.ts", "utf8");
    expect(src).toContain("api/printable");
  });
});
