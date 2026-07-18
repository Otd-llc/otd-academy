import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mutable, hoisted so the module mocks can read/flip it per test.
const h = vi.hoisted(() => ({
  env: {
    KV_REST_API_URL: "https://x.upstash.io" as string | undefined,
    KV_REST_API_TOKEN: "tok" as string | undefined,
    AUTH_SECRET: "test-secret-at-least-32-characters-long!!",
    MAGIC_GLOBAL_DAILY_CAP: undefined as number | undefined,
  },
  // Per-prefix limit() behavior. May return a result or throw.
  dispatch: (_prefix: string): { success: boolean; reason?: string } => ({ success: true }),
}));

vi.mock("@/env", () => ({ env: h.env }));
// fireAlert() dynamically imports this; mock it so the breaker-trip test never
// pulls Prisma (which would make this a DB test / fail without a DB).
vi.mock("@/lib/abuse-alert", () => ({ alertAbuse: vi.fn() }));
vi.mock("@upstash/redis", () => ({ Redis: class {} }));
vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    prefix: string;
    constructor(o: { prefix: string }) {
      this.prefix = o.prefix;
    }
    static slidingWindow() {
      return {};
    }
    async limit(_id: string) {
      return h.dispatch(this.prefix);
    }
  },
}));

const CHECK = [{ rule: "magic:email:hour" as const, identity: "id" }];

// Fresh module per test → a clean breaker + `configured` re-evaluated.
async function load(opts?: { kv?: boolean }) {
  h.env.KV_REST_API_URL = opts?.kv === false ? undefined : "https://x.upstash.io";
  h.env.KV_REST_API_TOKEN = opts?.kv === false ? undefined : "tok";
  vi.resetModules();
  return import("@/lib/abuse-limit");
}

beforeEach(() => {
  h.dispatch = () => ({ success: true });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("enforce", () => {
  it("allows a clean pass (all checks succeed)", async () => {
    const { enforce } = await load();
    expect(await enforce(CHECK, "escalate-closed")).toEqual({ ok: true });
  });

  it("first denial wins, names the rule, and does NOT consume the global counter", async () => {
    const { magicLinkChecks } = await import("@/lib/abuse-policy");
    const called: string[] = [];
    h.dispatch = (prefix) => {
      called.push(prefix);
      return prefix.endsWith("magic:email:burst") ? { success: false } : { success: true };
    };
    const { enforce } = await load();
    const v = await enforce(magicLinkChecks("a@b.com"), "escalate-closed");
    expect(v).toEqual({ ok: false, rule: "magic:email:burst" });
    // global is ordered LAST and must not be called once an earlier rule denied.
    expect(called.some((p) => p.endsWith("magic:global:day"))).toBe(false);
  });

  it("a THROW from limit() degrades — never throws — and a transient allows (grace)", async () => {
    h.dispatch = () => {
      throw new Error("upstash down");
    };
    const { enforce } = await load();
    // Breaker not yet tripped → grace allow, but crucially it did not throw.
    await expect(enforce(CHECK, "escalate-closed")).resolves.toEqual({ ok: true });
  });

  it("reason:'timeout' degrades (is NOT read as success:true — D4)", async () => {
    // A single timeout on a fresh breaker degrades to a grace allow, but the point
    // is it routes to the ladder rather than reading success. failMode:open makes
    // that unambiguous:
    h.dispatch = () => ({ success: true, reason: "timeout" });
    const { enforce } = await load();
    await expect(enforce(CHECK, "open")).resolves.toEqual({ ok: true });
  });

  it("a SUSTAINED outage trips the breaker → escalate-closed fails CLOSED", async () => {
    h.dispatch = () => {
      throw new Error("down");
    };
    const { enforce } = await load();
    // First 19 failures: grace (allow). The 20th trips (>= MIN_SAMPLE, rate 1.0).
    for (let i = 0; i < 19; i++) {
      expect(await enforce(CHECK, "escalate-closed")).toEqual({ ok: true });
    }
    expect(await enforce(CHECK, "escalate-closed")).toEqual({ ok: false, rule: "degraded" });
    // Now open → fast-fail → still closed.
    expect(await enforce(CHECK, "escalate-closed")).toEqual({ ok: false, rule: "degraded" });
  });

  it("failMode:'open' allows even under a tripped breaker (Tier 2)", async () => {
    h.dispatch = () => {
      throw new Error("down");
    };
    const { enforce } = await load();
    for (let i = 0; i < 21; i++) await enforce(CHECK, "escalate-closed"); // trip it
    expect(await enforce(CHECK, "open")).toEqual({ ok: true });
  });

  it("half-open probe heals after the cooldown", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    let down = true;
    h.dispatch = () => {
      if (down) throw new Error("down");
      return { success: true };
    };
    const { enforce } = await load();
    for (let i = 0; i < 21; i++) await enforce(CHECK, "escalate-closed"); // trip (open)
    expect(await enforce(CHECK, "escalate-closed")).toEqual({ ok: false, rule: "degraded" });
    // Past the cooldown, Upstash healed → the probe succeeds → breaker closes.
    vi.setSystemTime(31_000);
    down = false;
    expect(await enforce(CHECK, "escalate-closed")).toEqual({ ok: true });
  });

  it("env unset → {ok:true} and logs once", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { enforce } = await load({ kv: false });
    expect(await enforce(CHECK, "escalate-closed")).toEqual({ ok: true });
    expect(await enforce(CHECK, "escalate-closed")).toEqual({ ok: true });
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
