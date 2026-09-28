// The public printable download path: the URL helper's two modes, and the proxy
// route's key resolution.
//
// The resolver is the security boundary. It never accepts an R2 key — it
// validates tokens and REBUILDS the key with the uploader's own helpers — so the
// tests below are mostly about proving that nothing outside `printables/` is
// reachable, however the path is bent.
import { afterEach, describe, expect, it, vi } from "vitest";

import { HEX_PUBLISHED_RECORD_RELEASES } from "@/lib/hex-published-record";
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
    const r = resolvePrintable([RELEASE, fmt, `hex-main.${fmt}`]);
    expect(r?.key).toBe(`printables/2026-07-31/${fmt}/hex-main.${fmt}`);
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
    [[RELEASE, "stl", "hex-main.3mf"], "an extension that fights its folder"],
    [[RELEASE, "exe", "payload.exe"], "a format we never wrote"],
    [[RELEASE, "license.txt"], "the licence in the wrong case"],
    [["2026-7-31", "LICENSE.txt"], "an unpadded release"],
    [["latest", "LICENSE.txt"], "a non-date release"],
    [[RELEASE, "3mf", "Hex-Main.3mf"], "an unslugged part name"],
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
      [RELEASE, "stl", "hex-main.stl"],
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

// The handler itself, with R2 and analytics mocked. What a downloader depends
// on is the ORDER of the refusals (nothing unpublished ever reaches R2) and the
// shape of the redirect (signed from the validated key, never cached).
const r2 = vi.hoisted(() => ({
  headR2Object: vi.fn(),
  presignGet: vi.fn(),
}));
const captureMock = vi.hoisted(() => vi.fn());
// `@/lib/r2-errors` (the 404-vs-503 classifier) is NOT mocked: that split is
// part of what is under test.
vi.mock("@/lib/part-r2", () => ({
  headR2Object: r2.headR2Object,
  presignGet: r2.presignGet,
}));
vi.mock("@/lib/analytics", () => ({ capture: captureMock }));

const SIGNED = "https://r2.example.test/signed?X-Amz-Signature=abc";

function sdkError(name: string, status: number): Error {
  const e = new Error(name) as Error & { $metadata: { httpStatusCode: number } };
  e.name = name;
  e.$metadata = { httpStatusCode: status };
  return e;
}

describe("the download route", () => {
  afterEach(() => {
    r2.headR2Object.mockReset();
    r2.presignGet.mockReset();
    captureMock.mockReset();
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  // R2 config must be STUBBED, not inherited. CI has no `.env.local`, so
  // R2_ENABLED/R2_BUCKET are unset there and the route 404s before it resolves
  // anything — which passed locally and went red in CI on the first run. A test
  // that only holds on a developer's machine is not a test.
  async function load() {
    vi.stubEnv("R2_ENABLED", "true");
    vi.stubEnv("R2_BUCKET", "test-bucket");
    vi.resetModules();
    const { NextRequest } = await import("next/server");
    const mod = await import("@/app/api/printable/[...path]/route");
    return (method: "GET" | "HEAD", path: string[], query = "") => {
      const req = new NextRequest(
        `https://academy.example.test/api/printable/${path.join("/")}${query}`,
        { method },
      );
      return mod[method](req, { params: Promise.resolve({ path }) });
    };
  }

  function stubFound() {
    r2.headR2Object.mockResolvedValue({ contentLength: 1234 });
    r2.presignGet.mockResolvedValue(SIGNED);
  }

  it("an unpublished release 404s and never reaches R2", async () => {
    // 2026-08-20 passes the date grammar; only the allow-list refuses it.
    const call = await load();
    stubFound();
    for (const method of ["GET", "HEAD"] as const) {
      const res = await call(method, ["2026-08-20", "LICENSE.txt"]);
      expect(res.status).toBe(404);
    }
    expect(r2.headR2Object).not.toHaveBeenCalled();
    expect(r2.presignGet).not.toHaveBeenCalled();
    expect(captureMock).not.toHaveBeenCalled();
  });

  it("a listed release 302s to a URL signed from the validated key, uncached", async () => {
    const call = await load();
    stubFound();
    const res = await call("GET", [RELEASE, "sets", "hex-cluster.zip"]);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(SIGNED);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(r2.headR2Object).toHaveBeenCalledWith(
      "printables/2026-07-31/sets/hex-cluster.zip",
    );
    // Attachment filename + an hour's expiry.
    expect(r2.presignGet).toHaveBeenCalledWith(
      "printables/2026-07-31/sets/hex-cluster.zip",
      "hex-cluster.zip",
      3600,
    );
  });

  it.each([...HEX_PUBLISHED_RECORD_RELEASES])(
    "serves published release %s",
    async (release) => {
      const call = await load();
      stubFound();
      const res = await call("GET", [release, "3mf", "hex-main.3mf"]);
      expect(res.status).toBe(302);
    },
  );

  it("two GETs record two downloads", async () => {
    const call = await load();
    stubFound();
    await call("GET", [RELEASE, "stl", "hex-main.stl"]);
    await call("GET", [RELEASE, "stl", "hex-main.stl"]);
    const downloads = captureMock.mock.calls.filter(
      (c) => c[0] === "printable_downloaded",
    );
    expect(downloads).toHaveLength(2);
    expect(downloads[0]![1]).toMatchObject({
      key: "printables/2026-07-31/stl/hex-main.stl",
      release: RELEASE,
      kind: "stl",
      bytes: 1234,
    });
  });

  it("HEAD answers with headers, reads nothing from R2 and records nothing", async () => {
    const call = await load();
    stubFound();
    const res = await call("HEAD", [RELEASE, "sets", "hex-cluster.zip"]);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/zip");
    expect(res.headers.get("content-disposition")).toBe(
      'attachment; filename="hex-cluster.zip"',
    );
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(r2.headR2Object).not.toHaveBeenCalled();
    expect(r2.presignGet).not.toHaveBeenCalled();
    expect(captureMock).not.toHaveBeenCalled();
  });

  it.each([
    ["NoSuchKey", 404],
    ["NotFound", 404],
  ])("an absent object (%s) is a 404, not counted", async (name, status) => {
    const call = await load();
    r2.headR2Object.mockRejectedValue(sdkError(name, status));
    const res = await call("GET", [RELEASE, "LICENSE.txt"]);
    expect(res.status).toBe(404);
    expect(r2.presignGet).not.toHaveBeenCalled();
    expect(captureMock).not.toHaveBeenCalled();
  });

  it("any other R2 error is a 503 no-store, recorded as r2_error and not as a download", async () => {
    const call = await load();
    r2.headR2Object.mockRejectedValue(sdkError("AccessDenied", 403));
    const res = await call("GET", [RELEASE, "LICENSE.txt"]);
    expect(res.status).toBe(503);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(captureMock).toHaveBeenCalledTimes(1);
    expect(captureMock.mock.calls[0]![0]).toBe("r2_error");
  });

  it("a network-level R2 failure (no status) is a 503 too", async () => {
    const call = await load();
    r2.headR2Object.mockRejectedValue(new Error("socket hang up"));
    const res = await call("GET", [RELEASE, "LICENSE.txt"]);
    expect(res.status).toBe(503);
  });

  it("a presign failure is a 503, not a download", async () => {
    const call = await load();
    r2.headR2Object.mockResolvedValue({ contentLength: 1 });
    r2.presignGet.mockRejectedValue(new Error("no credentials"));
    const res = await call("GET", [RELEASE, "LICENSE.txt"]);
    expect(res.status).toBe(503);
    expect(captureMock.mock.calls.map((c) => c[0])).toEqual(["r2_error"]);
  });

  it.each(["GET", "HEAD"] as const)(
    "%s with any query string 307s to the bare path, before R2",
    async (method) => {
      const call = await load();
      stubFound();
      const res = await call(method, [RELEASE, "LICENSE.txt"], "?utm_source=x");
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe(
        "/api/printable/2026-07-31/LICENSE.txt",
      );
      expect(r2.headR2Object).not.toHaveBeenCalled();
      expect(captureMock).not.toHaveBeenCalled();
    },
  );

  it("never reaches R2 for a rejected path", async () => {
    const call = await load();
    const res = await call("GET", ["..", "avatars", "x.webp"]);
    expect(res.status).toBe(404);
    expect(r2.headR2Object).not.toHaveBeenCalled();
  });

  it("404s with R2 switched off, without touching the bucket", async () => {
    // The CI-shaped environment, asserted deliberately rather than encountered
    // by accident: no R2 config means no download, and no attempt at one.
    vi.stubEnv("R2_ENABLED", "false");
    vi.stubEnv("R2_BUCKET", undefined);
    vi.resetModules();
    const { NextRequest } = await import("next/server");
    const { GET } = await import("@/app/api/printable/[...path]/route");
    const res = await GET(
      new NextRequest(
        `https://academy.example.test/api/printable/${RELEASE}/LICENSE.txt`,
      ),
      { params: Promise.resolve({ path: [RELEASE, "LICENSE.txt"] }) },
    );
    expect(res.status).toBe(404);
    expect(r2.headR2Object).not.toHaveBeenCalled();
  });
});

// Attribution (6.6, 1.14), carried over from the v2 branch onto the 302 route.
// `src` is the ONE query the route accepts, and only a listed value of it; the
// rest canonicalise before R2 is touched, exactly like any other query did.
describe("attribution on printable_downloaded (6.6, 1.14)", () => {
  afterEach(() => {
    r2.headR2Object.mockReset();
    r2.presignGet.mockReset();
    captureMock.mockReset();
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  const GRANTED = "c.measurement:1,c.necessary:1";
  const PATH = [RELEASE, "sets", "hex-cluster.zip"];

  async function request(
    method: "GET" | "HEAD",
    query: string,
    cookies: Record<string, string> = {},
  ) {
    vi.stubEnv("R2_ENABLED", "true");
    vi.stubEnv("R2_BUCKET", "test-bucket");
    vi.resetModules();
    r2.headR2Object.mockResolvedValue({ contentLength: 1234 });
    r2.presignGet.mockResolvedValue(SIGNED);
    const { NextRequest } = await import("next/server");
    const mod = await import("@/app/api/printable/[...path]/route");
    const cookie = Object.entries(cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
    const req = new NextRequest(
      `https://academy.onethousanddrones.com/api/printable/${PATH.join("/")}${query}`,
      {
        method,
        headers: {
          referer: "https://example.test/",
          ...(cookie ? { cookie } : {}),
        },
      },
    );
    return mod[method](req, { params: Promise.resolve({ path: PATH }) });
  }

  async function download(query: string, cookies: Record<string, string>) {
    const res = await request("GET", query, cookies);
    expect(res.status).toBe(302);
    const downloads = captureMock.mock.calls.filter(
      (c) => c[0] === "printable_downloaded",
    );
    expect(downloads).toHaveLength(1);
    return downloads[0]![1] as Record<string, unknown>;
  }

  it("carries src and otd_src with consent", async () => {
    const p = await download("?src=hex_page", { c15t: GRANTED, otd_src: "hackaday" });
    expect(p).toMatchObject({ src: "hex_page", otd_src: "hackaday" });
    expect(p).toHaveProperty("referrer", "https://example.test/");
  });

  it("a bare download with consent is src unknown, and a hostile otd_src is unknown", async () => {
    const p = await download("", { c15t: GRANTED, otd_src: "x".repeat(2000) });
    expect(p).toMatchObject({ src: "unknown", otd_src: "unknown" });
    expect(JSON.stringify(p)).not.toMatch(/xxxx/);
  });

  it("hands attribution to capture() unconditionally: the consent gate is capture's, not the route's", async () => {
    // `capture` is mocked in this file, so this proves only that the route
    // builds no second gate. That the whole event is DROPPED without consent is
    // proven through the real choke point in hex-download-consent-gate.test.ts.
    const p = await download("?src=hex_page", { otd_src: "hackaday" });
    expect(p).toMatchObject({ src: "hex_page", otd_src: "hackaday" });
    expect(p).toHaveProperty("referrer", "https://example.test/");
  });

  it.each([
    ["?src=etsy", ""],
    [`?src=${encodeURIComponent("<b>x</b>")}`, ""],
    ["?src=", ""],
    ["?src=hex_page&utm_source=x", "?src=hex_page"],
    ["?utm_source=x&src=configurator", "?src=configurator"],
    ["?src=hex_page&src=hn", "?src=hex_page"],
  ])(
    "%s 307s to the canonical %j before R2, and counts nothing",
    async (query, canon) => {
      for (const method of ["GET", "HEAD"] as const) {
        const res = await request(method, query, { c15t: GRANTED });
        expect(res.status).toBe(307);
        expect(res.headers.get("location")).toBe(
          `/api/printable/${PATH.join("/")}${canon}`,
        );
      }
      expect(r2.headR2Object).not.toHaveBeenCalled();
      expect(captureMock).not.toHaveBeenCalled();
    },
  );

  it("HEAD with a listed src answers 200 and counts nothing", async () => {
    const res = await request("HEAD", "?src=hex_page", { c15t: GRANTED });
    expect(res.status).toBe(200);
    expect(captureMock).not.toHaveBeenCalled();
  });

  it("HEAD types a mesh by its format", async () => {
    vi.stubEnv("R2_ENABLED", "true");
    vi.stubEnv("R2_BUCKET", "test-bucket");
    vi.resetModules();
    const { NextRequest } = await import("next/server");
    const { HEAD } = await import("@/app/api/printable/[...path]/route");
    const path = [RELEASE, "stl", "hex-main.stl"];
    const res = await HEAD(
      new NextRequest(
        `https://academy.example.test/api/printable/${path.join("/")}`,
        { method: "HEAD" },
      ),
      { params: Promise.resolve({ path }) },
    );
    expect(res.headers.get("content-type")).toBe("model/stl");
  });
});

describe("PUBLISHED_RELEASES", () => {
  it("is the published record plus the v2 release, and nothing else", async () => {
    // The v1 ids are pinned, as literals, by the published record's own test
    // (`hex-release-tables.test.ts`); the v2 release joined at launch (10.4).
    const { PUBLISHED_RELEASES } = await import("@/lib/printable-releases");
    expect([...PUBLISHED_RELEASES].sort()).toEqual(
      [...HEX_PUBLISHED_RECORD_RELEASES, "2026-10-01"].sort(),
    );
    expect(PUBLISHED_RELEASES.size).toBe(4);
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
