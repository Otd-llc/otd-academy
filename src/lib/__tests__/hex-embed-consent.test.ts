// The academy side of the embed consent handshake (owner decision 1.14).
//
// Three layers, because this suite runs in `node` with no DOM and a
// cross-origin postMessage between two frames cannot be exercised here:
//   1. the wire format -- `analyticsConsent` on `ready` and `set-consent`, parsed
//      exactly as the configurator's twin parses them;
//   2. the relay logic in `hex-embed-consent.ts`, driven directly;
//   3. a static guard on `HexConfiguratorFrame` that pins the source to that
//      logic, so the component cannot drift away from what (2) proves.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  consentChange,
  createConsentTold,
  measurementGranted,
  readyConsent,
} from "@/lib/hex-embed-consent";
import {
  CHANNEL,
  PROTOCOL_VERSION,
  parseMessage,
  type Ready,
  type SetConsent,
} from "@/lib/hex-embed-protocol";

const base = { channel: CHANNEL, protocolVersion: PROTOCOL_VERSION };
const ready = {
  ...base,
  type: "ready",
  parentOrigin: "https://academy.onethousanddrones.com",
  theme: "dark",
};

describe("parseMessage — analyticsConsent on ready", () => {
  it("round-trips both values", () => {
    for (const v of [true, false]) {
      const m = parseMessage({ ...ready, analyticsConsent: v }) as Ready;
      expect(m?.type).toBe("ready");
      expect(m.analyticsConsent).toBe(v);
    }
  });

  it("still parses a ready with no consent field (absent = not granted)", () => {
    const m = parseMessage(ready) as Ready;
    expect(m?.type).toBe("ready");
    expect(m.analyticsConsent).toBeUndefined();
  });

  it("refuses the handshake when the field is present and not a boolean", () => {
    for (const bad of ["true", 1, 0, null, {}, []]) {
      expect(parseMessage({ ...ready, analyticsConsent: bad })).toBeNull();
    }
  });
});

describe("parseMessage — set-consent", () => {
  it("round-trips both values", () => {
    for (const v of [true, false]) {
      const m = parseMessage({ ...base, type: "set-consent", analyticsConsent: v });
      expect(m?.type).toBe("set-consent");
      expect((m as SetConsent).analyticsConsent).toBe(v);
    }
  });

  it("requires a boolean: missing or anything else is dropped", () => {
    expect(parseMessage({ ...base, type: "set-consent" })).toBeNull();
    for (const bad of ["true", 1, null, undefined]) {
      expect(parseMessage({ ...base, type: "set-consent", analyticsConsent: bad })).toBeNull();
    }
  });

  it("parses what the relay actually posts", () => {
    const told = createConsentTold();
    readyConsent(told, false);
    const body = consentChange(told, true);
    expect(parseMessage({ ...base, ...body })?.type).toBe("set-consent");
  });
});

describe("measurementGranted — only an explicit grant counts", () => {
  it("is true for c15t's measurement: true", () => {
    expect(measurementGranted({ necessary: true, measurement: true })).toBe(true);
  });

  it("is false for denied, undecided and anything malformed", () => {
    for (const c of [
      { necessary: true, measurement: false },
      { necessary: true },
      {},
      null,
      undefined,
      { measurement: "true" },
      { measurement: 1 },
      true,
    ]) {
      expect(measurementGranted(c)).toBe(false);
    }
  });
});

describe("the ready envelope carries the consent state", () => {
  it("carries true when granted", () => {
    expect(readyConsent(createConsentTold(), true)).toEqual({ analyticsConsent: true });
  });

  it("carries an explicit false when denied or undecided, never true", () => {
    for (const consents of [{ measurement: false }, {}, undefined]) {
      const field = readyConsent(createConsentTold(), measurementGranted(consents));
      expect(field).toEqual({ analyticsConsent: false });
      expect(parseMessage({ ...ready, ...field }) as Ready).toMatchObject({
        analyticsConsent: false,
      });
    }
  });
});

describe("a consent change posts set-consent", () => {
  it("posts nothing before the handshake: the next ready carries it", () => {
    const told = createConsentTold();
    expect(consentChange(told, true)).toBeNull();
    expect(readyConsent(told, true)).toEqual({ analyticsConsent: true });
  });

  it("posts the new value once, after the handshake", () => {
    const told = createConsentTold();
    readyConsent(told, false);
    expect(consentChange(told, true)).toEqual({ type: "set-consent", analyticsConsent: true });
    // Unchanged: nothing more to say.
    expect(consentChange(told, true)).toBeNull();
  });

  it("posts a revocation as false", () => {
    const told = createConsentTold();
    readyConsent(told, true);
    expect(consentChange(told, false)).toEqual({
      type: "set-consent",
      analyticsConsent: false,
    });
  });

  it("posts nothing when the value did not change", () => {
    const told = createConsentTold();
    readyConsent(told, false);
    expect(consentChange(told, false)).toBeNull();
  });
});

// -- the frame is wired to the logic above ----------------------------------

const FRAME = readFileSync(
  join(__dirname, "..", "..", "components", "hex", "HexConfiguratorFrame.tsx"),
  "utf8",
);
/** Source with line comments stripped, so a commented-out call does not pass. */
const CODE = FRAME.replace(/^\s*\/\/.*$/gm, "");

function slice(src: string, from: string, to: string): string {
  const a = src.indexOf(from);
  expect(a, `missing: ${from}`).toBeGreaterThan(-1);
  const b = src.indexOf(to, a);
  expect(b, `missing after ${from}: ${to}`).toBeGreaterThan(a);
  return src.slice(a, b);
}

describe("HexConfiguratorFrame — consent wiring", () => {
  it("reads c15t's measurement decision through measurementGranted", () => {
    expect(CODE).toMatch(/const \{ consents \} = useConsentManager\(\);/);
    expect(CODE).toMatch(/measurementGranted\(consents\)/);
  });

  it("sends the consent on ready, read at send time", () => {
    const hs = slice(CODE, "const handshake = useCallback(", "}, [post]);");
    expect(hs).toMatch(/type: "ready"/);
    expect(hs).toMatch(/\.\.\.readyConsent\(consentToldRef\.current, consentRef\.current\)/);
    // Never a hardcoded grant.
    expect(hs).not.toMatch(/analyticsConsent:\s*true/);
  });

  it("relays a change as set-consent through post (exact origin), keyed on the decision", () => {
    const effect = slice(
      CODE,
      "consentRef.current = analyticsConsent;",
      "}, [analyticsConsent, post]);",
    );
    expect(effect).toMatch(/consentChange\(consentToldRef\.current, analyticsConsent\)/);
    expect(effect).toMatch(/if \(message\) post\(message\);/);
  });

  it("posts only to the exact configurator origin, never '*'", () => {
    const p = slice(CODE, "const post = useCallback(", "[origin],");
    expect(p).toMatch(/win\.postMessage\([\s\S]*,\s*origin,\s*\)/);
    expect(CODE).not.toMatch(/postMessage\([^)]*["']\*["']/);
  });

  it("never acts on an inbound set-consent (it is ours to send)", () => {
    const handler = slice(
      CODE,
      "function onMessage(event: MessageEvent)",
      'window.addEventListener("message", onMessage)',
    );
    expect(handler).not.toMatch(/case "set-consent":/);
  });
});
