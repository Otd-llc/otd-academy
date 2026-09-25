// The academy's v2 decoder (plan 6.3): it must open every link the configurator
// has ever frozen, and for ANY other input it must neither throw nor return
// something outside the grammar.
//
// THE GRAMMAR CHECK BELOW IS WRITTEN SEPARATELY FROM THE DECODER, on purpose. A
// fuzz property that reused the decoder's own validators would share its
// assumptions and pass whatever they got wrong.
//
// No fast-check in this repo, so the fuzz runs on a seeded PRNG: a failure
// reproduces from the printed seed and iteration.
import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import {
  MAX_V2_INFLATED_BYTES,
  decodeV2State,
  inflateV2Body,
} from "@/lib/hex-v2-state";
import { MAX_PAYLOAD_CHARS } from "@/lib/hex-cluster";
import { FROZEN_V2_PAYLOADS } from "./hex-v2-share-corpus.fixture";
import {
  ONE_PIECE_STATE,
  v2sFromEnvelope,
  v2sFromJson,
} from "./hex-v2-payload.fixture";

// ── The grammar, independently ──────────────────────────────────────────────

const VARIANTS = new Set([
  "full",
  "half-n",
  "half-s",
  "half-e",
  "half-w",
  "quarter-nw",
  "quarter-ne",
  "quarter-sw",
  "quarter-se",
]);
const ALWAYS = [
  "pieces",
  "snaps",
  "spikes",
  "covers",
  "caps",
  "inserts",
  "handles",
  "connectors",
  "runs",
  "risers",
];
const SOMETIMES = ["coverHubs", "accessories", "bins", "ports", "binBolts"];

function inGrammar(v: unknown): boolean {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  for (const k of Object.keys(o)) {
    if (!ALWAYS.includes(k) && !SOMETIMES.includes(k)) return false;
  }
  for (const k of ALWAYS) if (!Array.isArray(o[k])) return false;
  for (const k of SOMETIMES) {
    if (k in o && (!Array.isArray(o[k]) || (o[k] as unknown[]).length === 0))
      return false;
  }
  for (const k of ["pieces", "snaps"]) {
    for (const p of o[k] as unknown[]) {
      if (typeof p !== "object" || p === null) return false;
      const keys = Object.keys(p).sort().join(",");
      if (keys !== "level,q,r,variant") return false;
      const { q, r, level, variant } = p as Record<string, unknown>;
      for (const n of [q, r, level]) {
        if (typeof n !== "number" || !Number.isInteger(n)) return false;
        if (Math.abs(n) > 1_000_000) return false;
      }
      if (typeof variant !== "string" || !VARIANTS.has(variant)) return false;
    }
  }
  for (const k of [...ALWAYS.slice(2), ...SOMETIMES]) {
    if (!(k in o)) continue;
    for (const s of o[k] as unknown[]) {
      if (typeof s !== "string" || s.length === 0 || s.length > 16_384)
        return false;
      for (const ch of s) {
        const c = ch.codePointAt(0)!;
        if (c < 0x21 || c > 0x7e) return false;
      }
    }
  }
  return true;
}

// ── Seeded PRNG ─────────────────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED = 0x6e3;
const B64URL =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const NASTY = `${B64URL}=+/ #%&?\u0000\n"'\\{}[]:,é😀\u202e`;

function pick<T>(rnd: () => number, xs: readonly T[] | string): T {
  return xs[Math.floor(rnd() * xs.length)] as T;
}
function randString(rnd: () => number, alphabet: string, max: number): string {
  const n = Math.floor(rnd() * max);
  let s = "";
  for (let i = 0; i < n; i++) s += pick<string>(rnd, alphabet);
  return s;
}

/** Decode, and fail the test on a throw or an out-of-grammar result. */
function assertSafe(input: unknown, where: string): ReturnType<typeof decodeV2State> {
  let out: ReturnType<typeof decodeV2State>;
  try {
    out = decodeV2State(input);
  } catch (e) {
    throw new Error(`${where}: decodeV2State threw: ${String(e)}`);
  }
  if (out !== null && !inGrammar(out)) {
    throw new Error(`${where}: out-of-grammar result ${JSON.stringify(out).slice(0, 200)}`);
  }
  return out;
}

// ── The configurator's own links ────────────────────────────────────────────

describe("decodeV2State opens every frozen configurator link", () => {
  it("has the whole corpus (20 builds)", () => {
    expect(FROZEN_V2_PAYLOADS.length).toBe(20);
  });
  for (const b of FROZEN_V2_PAYLOADS) {
    it(b.name, () => {
      expect(b.v2s.length).toBeLessThanOrEqual(MAX_PAYLOAD_CHARS);
      const out = assertSafe(b.v2s, b.name);
      expect(out).toEqual(b.state);
    });
  }

  it("refuses the uncompressed twin of every one (v2u is not a save)", () => {
    for (const b of FROZEN_V2_PAYLOADS) expect(decodeV2State(b.v2u)).toBeNull();
  });
});

// ── Specific refusals ───────────────────────────────────────────────────────

describe("decodeV2State refuses", () => {
  const env = (s: unknown, v: unknown = 1) => v2sFromEnvelope({ v, s });

  it("v1 in every form, and non-strings", () => {
    expect(decodeV2State("s=q1YqU7Iy1FEqVrKqVirITE1OLVay")).toBeNull();
    expect(decodeV2State("u=%7B%7D")).toBeNull();
    // A REAL v2 body under a v1 prefix is still refused: the prefix routes.
    const body = FROZEN_V2_PAYLOADS[1].v2s.slice("v2s=".length);
    expect(decodeV2State(`s=${body}`)).toBeNull();
    expect(decodeV2State(`v2u=${body}`)).toBeNull();
    expect(decodeV2State(`V2S=${body}`)).toBeNull();
    // Four characters of v1 prefix + padding: a decoder that let `s=` through
    // and sliced a fixed four would land exactly on the v2 body here.
    expect(decodeV2State(`s=xx${body}`)).toBeNull();
    for (const x of [null, undefined, 42, {}, [], true]) {
      expect(decodeV2State(x)).toBeNull();
    }
  });

  it("an unknown version, a missing or wrong-typed state", () => {
    expect(decodeV2State(env(ONE_PIECE_STATE, 2))).toBeNull();
    expect(decodeV2State(env(ONE_PIECE_STATE, "1"))).toBeNull();
    expect(decodeV2State(v2sFromEnvelope({ s: ONE_PIECE_STATE }))).toBeNull();
    expect(decodeV2State(env(null))).toBeNull();
    expect(decodeV2State(env([ONE_PIECE_STATE]))).toBeNull();
    expect(decodeV2State(env({ ...ONE_PIECE_STATE, pieces: undefined }))).toBeNull();
    expect(decodeV2State(v2sFromJson("[1,2,3]"))).toBeNull();
    expect(decodeV2State(v2sFromJson("not json"))).toBeNull();
  });

  it("a piece out of grammar", () => {
    const bad = [
      { q: 0.5, r: 0, level: 0, variant: "full" },
      { q: "0", r: 0, level: 0, variant: "full" },
      { q: 0, r: 0, level: 0, variant: "carrier" },
      { q: 0, r: 0, variant: "full" },
      { q: 1e7, r: 0, level: 0, variant: "full" },
      [0, 0, 0, "full"],
      "0,0,0",
    ];
    for (const p of bad) {
      expect(decodeV2State(env({ ...ONE_PIECE_STATE, pieces: [p] }))).toBeNull();
      expect(decodeV2State(env({ ...ONE_PIECE_STATE, snaps: [p] }))).toBeNull();
    }
  });

  it("a family present with the wrong type, or a bad string in it", () => {
    for (const bad of [
      "0,0,0;top",
      { a: 1 },
      [1],
      [""],
      ["has space"],
      ["é"],
      ["a\nb"],
      ["x".repeat(16_385)],
    ]) {
      expect(decodeV2State(env({ ...ONE_PIECE_STATE, covers: bad }))).toBeNull();
      expect(decodeV2State(env({ ...ONE_PIECE_STATE, bins: bad }))).toBeNull();
    }
  });

  it("a payload past 16,384 characters, even a valid one", () => {
    const pad = { ...ONE_PIECE_STATE, runs: [] as string[] };
    // Incompressible-ish strings so the payload itself grows past the cap.
    const rnd = mulberry32(7);
    while (env(pad).length <= MAX_PAYLOAD_CHARS) {
      pad.runs.push(randString(rnd, B64URL, 200) || "x");
    }
    expect(decodeV2State(env(pad))).toBeNull();
  });

  it("a deflate bomb: small on the wire, past 2 MiB inflated", () => {
    const bomb = v2sFromEnvelope({
      v: 1,
      s: { ...ONE_PIECE_STATE, junk: "a".repeat(MAX_V2_INFLATED_BYTES + 10) },
    });
    expect(bomb.length).toBeLessThan(MAX_PAYLOAD_CHARS);
    expect(decodeV2State(bomb)).toBeNull();
    expect(inflateV2Body(bomb.slice(4))).toBeNull();
  });

  it("an impossible base64 length and a non-deflate body", () => {
    expect(decodeV2State("v2s=A")).toBeNull();
    expect(decodeV2State("v2s=AAAAA")).toBeNull();
    expect(decodeV2State(`v2s=${Buffer.from("{}").toString("base64url")}`)).toBeNull();
  });
});

describe("decodeV2State keeps the configurator's defaults", () => {
  it("defaults the ten core families and drops empty optional ones", () => {
    const out = decodeV2State(
      v2sFromEnvelope({
        v: 1,
        s: { pieces: [{ q: 0, r: 0, level: 0, variant: "full" }], bins: [], spikes: null },
      }),
    );
    expect(out).toEqual(ONE_PIECE_STATE);
  });

  it("ignores unknown families and unknown keys on a piece, as the configurator does", () => {
    const out = decodeV2State(
      v2sFromEnvelope({
        v: 1,
        s: {
          ...ONE_PIECE_STATE,
          pieces: [{ q: 0, r: 0, level: 0, variant: "full", colour: "red" }],
          futureFamily: [{ anything: true }],
        },
      }),
    );
    expect(out).toEqual(ONE_PIECE_STATE);
  });
});

// ── The fuzz ────────────────────────────────────────────────────────────────

describe("fuzz: decodeV2State never throws and never leaves the grammar", () => {
  it("garbage strings, with and without the prefix", () => {
    const rnd = mulberry32(SEED);
    for (let i = 0; i < 3000; i++) {
      const body = randString(rnd, rnd() < 0.5 ? B64URL : NASTY, 300);
      const input = rnd() < 0.7 ? `v2s=${body}` : body;
      expect(assertSafe(input, `garbage seed=${SEED} i=${i}`)).toBeNull();
    }
  });

  it("random bytes and random JSON, properly deflated", () => {
    const rnd = mulberry32(SEED + 1);
    for (let i = 0; i < 1500; i++) {
      const bytes = Buffer.from(
        Array.from({ length: Math.floor(rnd() * 400) }, () => Math.floor(rnd() * 256)),
      );
      assertSafe(
        `v2s=${deflateRawSync(bytes).toString("base64url")}`,
        `bytes seed=${SEED + 1} i=${i}`,
      );
      assertSafe(v2sFromEnvelope(randomJson(rnd, 4)), `json seed=${SEED + 1} i=${i}`);
      assertSafe(
        v2sFromEnvelope({ v: 1, s: randomState(rnd) }),
        `state seed=${SEED + 1} i=${i}`,
      );
    }
  });

  it("every frozen link, truncated at random points", () => {
    const rnd = mulberry32(SEED + 2);
    for (const b of FROZEN_V2_PAYLOADS) {
      for (let i = 0; i < 60; i++) {
        const cut = Math.floor(rnd() * b.v2s.length);
        const out = assertSafe(b.v2s.slice(0, cut), `truncate ${b.name} @${cut}`);
        // A cut inside the prefix or the body can never be the whole build.
        if (out !== null) expect(out).not.toEqual(b.state);
      }
    }
  });

  it("every frozen link, mutated character by character", () => {
    const rnd = mulberry32(SEED + 3);
    for (const b of FROZEN_V2_PAYLOADS) {
      for (let i = 0; i < 80; i++) {
        const chars = [...b.v2s];
        const at = 4 + Math.floor(rnd() * (chars.length - 4));
        const op = rnd();
        if (op < 0.4) chars[at] = pick<string>(rnd, B64URL);
        else if (op < 0.7) chars.splice(at, 1);
        else chars.splice(at, 0, pick<string>(rnd, rnd() < 0.8 ? B64URL : NASTY));
        assertSafe(chars.join(""), `mutate ${b.name} seed=${SEED + 3} i=${i}`);
      }
    }
  });

  it("every frozen build, mutated STRUCTURALLY and re-encoded", () => {
    const rnd = mulberry32(SEED + 4);
    for (const b of FROZEN_V2_PAYLOADS) {
      for (let i = 0; i < 40; i++) {
        const s = structuredClone(b.state) as Record<string, unknown>;
        mutateState(rnd, s);
        assertSafe(v2sFromEnvelope({ v: 1, s }), `struct ${b.name} i=${i}`);
      }
    }
  });

  it("oversized inputs, each refused", () => {
    const rnd = mulberry32(SEED + 5);
    for (let i = 0; i < 20; i++) {
      const long = `v2s=${randString(rnd, B64URL, 10) + "A".repeat(MAX_PAYLOAD_CHARS)}`;
      expect(assertSafe(long, `oversized i=${i}`)).toBeNull();
    }
    // Deeply nested arrays: tiny on the wire, a stack hazard to a naive walk.
    const deep = `{"v":1,"s":{"pieces":${"[".repeat(200_000)}${"]".repeat(200_000)}}}`;
    expect(assertSafe(v2sFromJson(deep), "deep nesting")).toBeNull();
  });
});

// ── Generators ──────────────────────────────────────────────────────────────

function randomJson(rnd: () => number, depth: number): unknown {
  const r = rnd();
  if (depth <= 0 || r < 0.3) {
    return pick(rnd, [
      null,
      true,
      0,
      1,
      -1,
      0.5,
      1e308,
      "",
      "full",
      "0,0,0",
      randString(rnd, NASTY, 12),
    ]);
  }
  if (r < 0.6) {
    return Array.from({ length: Math.floor(rnd() * 4) }, () => randomJson(rnd, depth - 1));
  }
  const keys = ["v", "s", "pieces", "snaps", "q", "r", "level", "variant", "covers", "bins", "x"];
  const o: Record<string, unknown> = {};
  for (let i = Math.floor(rnd() * 5); i > 0; i--) o[pick(rnd, keys)] = randomJson(rnd, depth - 1);
  if (rnd() < 0.5) o.v = 1;
  return o;
}

function randomState(rnd: () => number): Record<string, unknown> {
  const s: Record<string, unknown> = {};
  for (const k of [...ALWAYS, ...SOMETIMES, "extra"]) {
    if (rnd() < 0.3) continue;
    s[k] = rnd() < 0.8 ? Array.from({ length: Math.floor(rnd() * 3) }, () => randomJson(rnd, 2)) : randomJson(rnd, 2);
  }
  return s;
}

function mutateState(rnd: () => number, s: Record<string, unknown>): void {
  const k = pick(rnd, [...ALWAYS, ...SOMETIMES]);
  const list = s[k];
  const op = rnd();
  if (op < 0.2) {
    s[k] = randomJson(rnd, 2);
  } else if (op < 0.35) {
    delete s[k];
  } else if (Array.isArray(list) && list.length) {
    const i = Math.floor(rnd() * list.length);
    const el = list[i];
    if (typeof el === "object" && el !== null) {
      const f = pick(rnd, ["q", "r", "level", "variant"]);
      (el as Record<string, unknown>)[f] = randomJson(rnd, 1);
    } else {
      list[i] = rnd() < 0.5 ? randomJson(rnd, 1) : `${String(el)}${pick<string>(rnd, NASTY)}`;
    }
  } else {
    s[k] = [randomJson(rnd, 1)];
  }
}
