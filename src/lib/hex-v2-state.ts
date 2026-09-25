// The academy's reader for a Hex Cluster v2 build: `v2s=` + url-safe base64 of
// deflate-raw JSON, `{ v: 1, s: ClusterState }`.
//
// SERVER ONLY. It imports node:zlib, so it must never be reached from a client
// component. `@/lib/hex-cluster` is in the client graph and deliberately does
// NOT import this; the save action, the /c/ view and the recall action do.
//
// A PORT OF THE CONFIGURATOR'S `decodeV2State` (bioscale-viz
// `src/hex/v2/share.ts`, with the codec in `src/hex/url-codec.ts`), with the
// same envelope, the same version rule (an unknown `v` refuses) and the same
// field defaults (`?? []` for the ten core families; the five later families
// are kept only when they are a non-empty array). It is STRICTER in three
// places, each on the configurator's own stated principle that "a
// half-understood build is worse than no build":
//
//   1. Every element is checked. The configurator hands `pieces` and every
//      string list through unread and lets the model refuse what it cannot
//      place; the academy has no model, so it checks the shape here: a piece is
//      `{ q, r, level }` bounded safe integers plus a known `variant`, and every
//      other family is a list of non-empty printable-ASCII strings.
//   2. A family that is present but the wrong type REFUSES rather than being
//      defaulted or dropped. `snapshot()` never writes one, so only a hand-made
//      or corrupted payload can, and that is not a build to put in a register.
//   3. Hard caps, before any work: the payload length, the inflated size (a
//      deflate bomb is refused by zlib's own `maxOutputLength`, before the bytes
//      exist), and the element count.
//
// UNKNOWN KEYS in `s` are IGNORED, exactly as the configurator ignores them. The
// configurator adds families without bumping the version (rotation, ports, bins
// all arrived that way), so refusing unknown keys here would make every save
// containing the next family fail on the academy, silently, on launch day. The
// stored payload is the opaque string either way; nothing ignored here is ever
// rendered.
//
// NO v1. The academy accepts `v2s=` only (owner, 2026-09-25: "No need to support
// v1 at all in any capacity"). `v2u=` is the configurator's uncompressed branch
// and is refused at the save action with an actionable message, for the same
// QR-capacity reason v1's `u=` was.
//
// NEVER THROWS. Every failure is `null`.
import { inflateRawSync } from "node:zlib";

import { MAX_PAYLOAD_CHARS } from "@/lib/hex-cluster";

/** The only transport prefix the academy accepts. */
export const V2_PREFIX = "v2s=";
/** The configurator's `V2_SHARE_VERSION`. */
export const V2_SHARE_VERSION = 1;

/**
 * The most a payload may inflate to. The configurator allows 8 MB for a LINK;
 * a SAVE is at most 16,384 characters (~12 KB of deflate), and a real build
 * compresses well under 50:1 (3,000 furnished cells is ~859 KB of JSON, and
 * nowhere near fits the payload cap). 2 MiB is headroom, not a target.
 */
export const MAX_V2_INFLATED_BYTES = 2 * 1024 * 1024;
/** Total elements across every family. Bounded again by the inflate cap; this
 *  bounds the walk. */
export const MAX_V2_ITEMS = 100_000;
/** One element string. A long PVC run is the longest (a `q,r,level,dir|` per
 *  segment); this is far past any run a bed can hold. */
export const MAX_V2_ITEM_CHARS = 16_384;
/** |q|, |r| and |level| bound. The configurator has no bound of its own; this
 *  exists so a coordinate is never a float, NaN or 1e308. */
export const MAX_V2_COORD = 1_000_000;

export const V2_VARIANTS = [
  "full",
  "half-n",
  "half-s",
  "half-e",
  "half-w",
  "quarter-nw",
  "quarter-ne",
  "quarter-sw",
  "quarter-se",
] as const;
export type V2Variant = (typeof V2_VARIANTS)[number];

export interface V2Piece {
  q: number;
  r: number;
  level: number;
  variant: V2Variant;
}

/** Always present on a decoded state (the configurator's `?? []` families). */
export const V2_CORE_STRING_FAMILIES = [
  "spikes",
  "covers",
  "caps",
  "inserts",
  "handles",
  "connectors",
  "runs",
  "risers",
] as const;
/** Present ONLY when non-empty (the configurator keeps their absence). */
export const V2_OPTIONAL_STRING_FAMILIES = [
  "coverHubs",
  "accessories",
  "bins",
  "ports",
  "binBolts",
] as const;

type CoreFamily = (typeof V2_CORE_STRING_FAMILIES)[number];
type OptionalFamily = (typeof V2_OPTIONAL_STRING_FAMILIES)[number];

export type V2ClusterState = {
  pieces: V2Piece[];
  snaps: V2Piece[];
} & { [K in CoreFamily]: string[] } & { [K in OptionalFamily]?: string[] };

const VARIANT_SET: ReadonlySet<string> = new Set(V2_VARIANTS);
const BODY_RE = /^[A-Za-z0-9_-]+$/;
/** Printable ASCII, no space. Every separator the configurator spends
 *  (`, ; # | ~ @ = > ! *`) is in here; whitespace, quotes-as-content from a
 *  hand edit, control characters and anything non-ASCII are not. */
const ITEM_RE = /^[\x21-\x7e]+$/;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isCoord(v: unknown): v is number {
  return (
    typeof v === "number" &&
    Number.isSafeInteger(v) &&
    Math.abs(v) <= MAX_V2_COORD
  );
}

class Refuse extends Error {}

function readPieces(raw: unknown, budget: { left: number }): V2Piece[] {
  if (!Array.isArray(raw)) throw new Refuse();
  const out: V2Piece[] = [];
  for (const p of raw) {
    if (--budget.left < 0) throw new Refuse();
    if (!isPlainObject(p)) throw new Refuse();
    const { q, r, level, variant } = p;
    if (!isCoord(q) || !isCoord(r) || !isCoord(level)) throw new Refuse();
    if (typeof variant !== "string" || !VARIANT_SET.has(variant))
      throw new Refuse();
    // Rebuilt, so an extra key on a piece never reaches a caller.
    out.push({ q, r, level, variant: variant as V2Variant });
  }
  return out;
}

function readStrings(raw: unknown, budget: { left: number }): string[] {
  if (!Array.isArray(raw)) throw new Refuse();
  const out: string[] = [];
  for (const s of raw) {
    if (--budget.left < 0) throw new Refuse();
    if (typeof s !== "string") throw new Refuse();
    if (s.length > MAX_V2_ITEM_CHARS || !ITEM_RE.test(s)) throw new Refuse();
    out.push(s);
  }
  return out;
}

/** The inflated JSON text, or null. Split out so the tests can reach the codec
 *  on its own. */
export function inflateV2Body(body: string): string | null {
  // len % 4 === 1 is not base64 at all (six bits cannot finish a byte). atob
  // throws on it in the configurator; Buffer would quietly drop the tail.
  if (body.length < 2 || body.length % 4 === 1 || !BODY_RE.test(body))
    return null;
  try {
    const bytes = Buffer.from(body, "base64url");
    // `maxOutputLength` makes zlib refuse past the cap as it inflates, so a
    // 12 KB bomb never becomes the 12 MB it describes.
    return inflateRawSync(bytes, {
      maxOutputLength: MAX_V2_INFLATED_BYTES,
    }).toString("utf8");
  } catch {
    return null;
  }
}

/**
 * The build a v2 save payload describes, or null for anything else.
 *
 * `payload` is the whole stored token, prefix included: `v2s=<base64url>`.
 * Never throws.
 */
export function decodeV2State(payload: unknown): V2ClusterState | null {
  try {
    if (typeof payload !== "string") return null;
    if (payload.length > MAX_PAYLOAD_CHARS) return null;
    if (!payload.startsWith(V2_PREFIX)) return null;
    const json = inflateV2Body(payload.slice(V2_PREFIX.length));
    if (json === null) return null;

    const env: unknown = JSON.parse(json);
    if (!isPlainObject(env)) return null;
    // An unknown version REFUSES, as in the configurator.
    if (env.v !== V2_SHARE_VERSION) return null;
    const s = env.s;
    if (!isPlainObject(s)) return null;

    const budget = { left: MAX_V2_ITEMS };
    // `pieces` is the one family the configurator REQUIRES.
    const pieces = readPieces(s.pieces, budget);
    const snaps = s.snaps == null ? [] : readPieces(s.snaps, budget);

    const out = { pieces, snaps } as V2ClusterState;
    for (const k of V2_CORE_STRING_FAMILIES) {
      out[k] = s[k] == null ? [] : readStrings(s[k], budget);
    }
    for (const k of V2_OPTIONAL_STRING_FAMILIES) {
      if (s[k] == null) continue;
      const list = readStrings(s[k], budget);
      if (list.length) out[k] = list;
    }
    return out;
  } catch {
    // Refuse, a JSON syntax error, a stack overflow on a deeply nested array:
    // all the same answer.
    return null;
  }
}
