// The Hex Cluster kill switches (plan 5.7): the flags endpoint, its fail-open
// reader, and the two server-side refusals the flags exist to drive.
//
// The endpoint is advisory: the configurator hides a button on it. The real
// switch is the refusal in the pack route and in the save action, so those are
// asserted here directly -- a flag the configurator honours and the server does
// not is a switch anyone with curl can ignore.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

// ── The Edge Config store, faked at the one seam the module uses ─────────────
const store = vi.hoisted(() => ({
  values: {} as Record<string, unknown>,
  throws: false,
  conns: [] as string[],
  gets: [] as string[],
}));
vi.mock("@vercel/edge-config", () => ({
  createClient: (conn: string) => {
    store.conns.push(conn);
    return {
      get: async (key: string) => {
        store.gets.push(key);
        if (store.throws) throw new Error("edge config unreachable");
        return store.values[key];
      },
    };
  },
  // The DEFAULT-store reader must never be used for these flags: it reads
  // EDGE_CONFIG, the abuse-defense store.
  get: async () => {
    throw new Error("hex flags must not read the default Edge Config store");
  },
}));

// `connection()` needs a request scope; the route only calls it to opt out of
// prerendering.
vi.mock("next/server", async (orig) => ({
  ...(await orig<typeof import("next/server")>()),
  connection: async () => {},
}));

const CONN = "https://edge-config.vercel.com/ecfg_hexflags?token=t";

beforeEach(() => {
  store.values = {};
  store.throws = false;
  store.conns = [];
  store.gets = [];
  vi.stubEnv("HEX_FLAGS_EDGE_CONFIG", CONN);
  vi.stubEnv("HEX_FLAGS_ALLOW_ORIGIN", undefined);
  vi.stubEnv("EDGE_CONFIG", "https://edge-config.vercel.com/ecfg_abuse?token=t");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("readHexFlags (fail-OPEN)", () => {
  it("reads its OWN store, one explicit get() per flag", async () => {
    const { readHexFlags } = await import("@/lib/hex-flags");
    store.values = { hexPackEnabled: true, hexSaveEnabled: true };
    await readHexFlags();
    expect(store.conns.every((c) => c === CONN)).toBe(true);
    expect(store.gets.sort()).toEqual(["hexPackEnabled", "hexSaveEnabled"]);
  });

  it("only an explicit false disables", async () => {
    const { readHexFlags } = await import("@/lib/hex-flags");
    store.values = { hexPackEnabled: false, hexSaveEnabled: "false" };
    expect(await readHexFlags()).toEqual({
      hexPackEnabled: false,
      hexSaveEnabled: true,
    });
  });

  it("no store configured -> both enabled", async () => {
    vi.stubEnv("HEX_FLAGS_EDGE_CONFIG", undefined);
    const { readHexFlags } = await import("@/lib/hex-flags");
    store.values = { hexPackEnabled: false, hexSaveEnabled: false };
    expect(await readHexFlags()).toEqual({
      hexPackEnabled: true,
      hexSaveEnabled: true,
    });
  });

  it("a read failure -> both enabled", async () => {
    const { readHexFlags } = await import("@/lib/hex-flags");
    store.throws = true;
    expect(await readHexFlags()).toEqual({
      hexPackEnabled: true,
      hexSaveEnabled: true,
    });
  });
});

describe("GET /api/hex-flags", () => {
  it("the body is EXACTLY the two flag keys", async () => {
    store.values = {
      hexPackEnabled: false,
      hexSaveEnabled: true,
      somethingElse: "must not leak",
    };
    const { GET } = await import("@/app/api/hex-flags/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual([
      "hexPackEnabled",
      "hexSaveEnabled",
    ]);
    expect(body).toEqual({ hexPackEnabled: false, hexSaveEnabled: true });
    expect(res.headers.get("Cache-Control")).toBe("public, s-maxage=30");
  });

  it("CORS is STATIC: the prod configurator by default, never credentials", async () => {
    const { GET, OPTIONS } = await import("@/app/api/hex-flags/route");
    // GET takes no request at all, so it has nothing to reflect.
    expect(GET.length).toBe(0);
    for (const res of [await GET(), OPTIONS()]) {
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
        "https://hex.onethousanddrones.com",
      );
      expect(res.headers.get("Access-Control-Allow-Credentials")).toBeNull();
    }
  });

  it("staging sets its origin by env; a malformed one falls back to prod", async () => {
    const { hexFlagsAllowOrigin } = await import("@/lib/hex-flags");
    vi.stubEnv("HEX_FLAGS_ALLOW_ORIGIN", "https://staging.example.test");
    expect(hexFlagsAllowOrigin()).toBe("https://staging.example.test");
    vi.stubEnv("HEX_FLAGS_ALLOW_ORIGIN", "*");
    expect(hexFlagsAllowOrigin()).toBe("https://hex.onethousanddrones.com");
    vi.stubEnv("HEX_FLAGS_ALLOW_ORIGIN", "https://a.test/path");
    expect(hexFlagsAllowOrigin()).toBe("https://hex.onethousanddrones.com");
  });

  it("is public: signed-out reads are not sent to /sign-in", async () => {
    const { resolveRouteGate } = await import("@/lib/route-gate");
    expect(resolveRouteGate(null, "/api/hex-flags")).toBeNull();
    // Exactly the one path, not a prefix.
    expect(resolveRouteGate(null, "/api/hex-flags/x")).toBe("/sign-in");
    expect(resolveRouteGate(null, "/api/other")).toBe("/sign-in");
  });
});

// ── Enforcement: the pack route ─────────────────────────────────────────────

const getBytes = vi.hoisted(() => vi.fn());
vi.mock("@/lib/part-r2", () => ({ getR2ObjectBytes: getBytes }));
vi.mock("@/lib/analytics", () => ({ capture: () => {} }));

describe("the pack route honours hexPackEnabled", () => {
  function request(query: string): NextRequest {
    return {
      nextUrl: new URL(
        `https://academy.onethousanddrones.com/api/printable-pack?${query}`,
      ),
      headers: new Headers(),
      cookies: { get: () => undefined },
    } as unknown as NextRequest;
  }

  it("refuses with 503 and reads nothing when the flag is off", async () => {
    vi.stubEnv("R2_ENABLED", "true");
    vi.stubEnv("R2_BUCKET", "test-bucket");
    vi.resetModules();
    store.values = { hexPackEnabled: false };
    getBytes.mockReset();
    const { GET } = await import("@/app/api/printable-pack/route");
    const { HEX_GEOMETRY_RELEASE } = await import("@/lib/hex-geometry");
    const res = await GET(
      request(`release=${HEX_GEOMETRY_RELEASE}&parts=hex-tb-main`),
    );
    expect(res.status).toBe(503);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(getBytes).not.toHaveBeenCalled();
  });

  it("does not refuse when the flag is on", async () => {
    vi.stubEnv("R2_ENABLED", "true");
    vi.stubEnv("R2_BUCKET", "test-bucket");
    vi.resetModules();
    store.values = { hexPackEnabled: true };
    const { GET } = await import("@/app/api/printable-pack/route");
    // A malformed query: reaching the 400 proves the switch let it through.
    const res = await GET(request("release=nope"));
    expect(res.status).toBe(400);
  });
});

// ── Enforcement: the save action ────────────────────────────────────────────

const dbTouched = vi.hoisted(() => ({ count: 0 }));
vi.mock("@/lib/db", () => ({
  db: new Proxy(
    {},
    {
      get() {
        dbTouched.count++;
        throw new Error("a paused save must not reach the database");
      },
    },
  ),
}));
vi.mock("@/lib/auth-helpers", () => ({
  requireUser: async () => ({ id: "u1", email: "u1@example.invalid" }),
  currentUserId: async () => "u1",
}));
vi.mock("@/lib/abuse-defense-flag", () => ({ defenseEnabled: async () => false }));
vi.mock("@/lib/abuse-limit", () => ({ enforce: async () => ({ ok: true }) }));
vi.mock("@/lib/cache-invalidate", () => ({ invalidateHexCluster: () => {} }));

describe("the save action honours hexSaveEnabled", () => {
  const input = {
    mode: "new" as const,
    name: "Bench cluster",
    payload: "s=eJyrVkrKz1WyUkotLs1RqgUAJ8QEjA",
    payloadHash: `h1:${"a".repeat(64)}`,
    schemaVersion: 1,
    summary: {},
  };

  it("refuses before touching the database when the flag is off", async () => {
    store.values = { hexSaveEnabled: false };
    dbTouched.count = 0;
    const { saveHexCluster } = await import("@/lib/actions/hex-clusters");
    const res = await saveHexCluster(input);
    expect(res).toEqual({
      ok: false,
      code: "saves-paused",
      message: "Saving is paused for now. Try again later.",
    });
    expect(dbTouched.count).toBe(0);
  });

  it("proceeds past the switch when the flag is on", async () => {
    store.values = { hexSaveEnabled: true };
    const { saveHexCluster } = await import("@/lib/actions/hex-clusters");
    // `summary: {}` is refused by validation, which runs after the switch and
    // before any query -- so reaching it proves the switch let the save through.
    const res = await saveHexCluster(input);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("summary-invalid");
  });
});
