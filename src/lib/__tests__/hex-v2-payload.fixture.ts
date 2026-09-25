// Test-only: write a `v2s=` payload the way the configurator does -- JSON of
// `{ v, s }`, deflate-raw, url-safe base64 without padding.
//
// NOT used to prove the decoder right (that is the frozen corpus's job, which
// is the configurator's own output); used to MAKE inputs: distinct valid saves,
// and the hostile ones the fuzz test needs (bombs, wrong types, bad versions).
import { deflateRawSync } from "node:zlib";

export function v2sFromJson(json: string): string {
  return `v2s=${deflateRawSync(Buffer.from(json, "utf8")).toString("base64url")}`;
}

export function v2sFromEnvelope(env: unknown): string {
  return v2sFromJson(JSON.stringify(env));
}

/** The smallest real build: one full base at the origin. */
export const ONE_PIECE_STATE = {
  pieces: [{ q: 0, r: 0, level: 0, variant: "full" }],
  snaps: [],
  spikes: [],
  covers: [],
  caps: [],
  inserts: [],
  handles: [],
  connectors: [],
  runs: [],
  risers: [],
};

/** A valid save payload, distinct per `n` (a piece at q = n). */
export function v2Payload(n = 0): string {
  return v2sFromEnvelope({
    v: 1,
    s: {
      ...ONE_PIECE_STATE,
      pieces: [{ q: n, r: 0, level: 0, variant: "full" }],
    },
  });
}
