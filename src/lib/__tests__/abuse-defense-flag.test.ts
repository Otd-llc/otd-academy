import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const h = vi.hoisted(() => ({ value: undefined as unknown, throws: false }));

vi.mock("@vercel/edge-config", () => ({
  get: vi.fn(async () => {
    if (h.throws) throw new Error("edge config unreachable");
    return h.value;
  }),
}));

import { defenseEnabled, turnstileInteractive } from "@/lib/abuse-defense-flag";

describe("defenseEnabled (the kill switch — fail-safe ON)", () => {
  const prev = process.env.EDGE_CONFIG;
  beforeEach(() => {
    h.value = undefined;
    h.throws = false;
    process.env.EDGE_CONFIG = "https://edge-config.vercel.com/ecfg_test?token=t";
  });
  afterEach(() => {
    if (prev === undefined) delete process.env.EDGE_CONFIG;
    else process.env.EDGE_CONFIG = prev;
  });

  it("enabled when no store is connected (EDGE_CONFIG unset)", async () => {
    delete process.env.EDGE_CONFIG;
    expect(await defenseEnabled()).toBe(true);
  });

  it("enabled when the key is absent / undefined", async () => {
    h.value = undefined;
    expect(await defenseEnabled()).toBe(true);
  });

  it("enabled when the key is explicitly true", async () => {
    h.value = true;
    expect(await defenseEnabled()).toBe(true);
  });

  it("DISABLED only on an explicit false", async () => {
    h.value = false;
    expect(await defenseEnabled()).toBe(false);
  });

  it("fail-safe enabled on a read error", async () => {
    h.throws = true;
    expect(await defenseEnabled()).toBe(true);
  });
});

describe("turnstileInteractive (soft-cap escalation — default OFF)", () => {
  const prev = process.env.EDGE_CONFIG;
  beforeEach(() => {
    h.value = undefined;
    h.throws = false;
    process.env.EDGE_CONFIG = "https://edge-config.vercel.com/ecfg_test?token=t";
  });
  afterEach(() => {
    if (prev === undefined) delete process.env.EDGE_CONFIG;
    else process.env.EDGE_CONFIG = prev;
  });

  it("false when no store is connected", async () => {
    delete process.env.EDGE_CONFIG;
    expect(await turnstileInteractive()).toBe(false);
  });
  it("false when the key is absent", async () => {
    h.value = undefined;
    expect(await turnstileInteractive()).toBe(false);
  });
  it("true ONLY on an explicit true", async () => {
    h.value = true;
    expect(await turnstileInteractive()).toBe(true);
  });
  it("false on an explicit false", async () => {
    h.value = false;
    expect(await turnstileInteractive()).toBe(false);
  });
  it("false (never escalate on a blip) on a read error", async () => {
    h.throws = true;
    expect(await turnstileInteractive()).toBe(false);
  });
});
