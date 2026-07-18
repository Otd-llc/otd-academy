import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const h = vi.hoisted(() => ({ admins: [{ email: "admin@otd.com" }] as { email: string | null }[] }));

vi.mock("@/lib/db", () => ({
  db: { user: { findMany: vi.fn(async () => h.admins) } },
}));
vi.mock("@/env", () => ({
  env: { AUTH_RESEND_KEY: "re_test", AUTH_RESEND_FROM: "OTD <login@otd.com>" },
}));

// Fresh module per test → a clean throttle map (lastSent is module-scope).
async function loadAlert() {
  vi.resetModules();
  return (await import("@/lib/abuse-alert")).alertAbuse;
}

describe("alertAbuse", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    h.admins = [{ email: "admin@otd.com" }];
    fetchSpy = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("emails admins on the first alert of a kind", async () => {
    const alertAbuse = await loadAlert();
    await alertAbuse("breaker-tripped");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchSpy.mock.calls[0]?.[1]?.body as string);
    expect(body.to).toEqual(["admin@otd.com"]);
    expect(body.subject).toMatch(/circuit breaker/i);
  });

  it("throttles a repeat of the same kind within the window", async () => {
    const alertAbuse = await loadAlert();
    await alertAbuse("breaker-tripped");
    await alertAbuse("breaker-tripped");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("does NOT throttle a different kind", async () => {
    const alertAbuse = await loadAlert();
    await alertAbuse("breaker-tripped");
    await alertAbuse("global-cap");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("no-ops when there are no admins", async () => {
    const alertAbuse = await loadAlert();
    h.admins = [];
    await alertAbuse("global-cap");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("never throws on a Resend error", async () => {
    const alertAbuse = await loadAlert();
    fetchSpy.mockImplementation(async () => {
      throw new Error("resend down");
    });
    await expect(alertAbuse("global-cap")).resolves.toBeUndefined();
  });
});
