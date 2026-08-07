// The embed channel's validation, which is a security boundary rather than a
// convenience. A four-lens review of the first draft found the original version
// cast instead of validating, and that `share` flows into a Prisma `where`
// clause with no runtime check — so a non-string here is a filter-object
// injection, not a type error.
import { describe, expect, it } from "vitest";

import {
  CAP_CLOSE,
  CHANNEL,
  PROTOCOL_VERSION,
  isPlausibleOtdOrigin,
  parseMessage,
  readVersion,
} from "@/lib/hex-embed-protocol";

const base = { channel: CHANNEL, protocolVersion: PROTOCOL_VERSION };
const envelope = { p: "PAYLOAD", h: "h1:abc", v: 1, s: {}, n: "Bench" };
const saveRequest = {
  ...base,
  type: "save-request",
  requestId: "r1",
  mode: "new",
  share: null,
  envelope,
};

describe("isPlausibleOtdOrigin", () => {
  it.each([
    "https://academy.onethousanddrones.com",
    "https://demo.onethousanddrones.com",
    "https://onethousanddrones.com",
  ])("accepts %s", (o) => expect(isPlausibleOtdOrigin(o)).toBe(true));

  it.each([
    // Both anchors matter; each of these passes an unanchored regex.
    "https://onethousanddrones.com.evil.test",
    "https://evil-onethousanddrones.com",
    "https://academy.onethousanddrones.com.attacker.io",
    // Scheme matters.
    "http://academy.onethousanddrones.com",
    "null",
    "",
  ])("rejects %s", (o) => expect(isPlausibleOtdOrigin(o)).toBe(false));

  it("rejects localhost unless dev is explicitly allowed", () => {
    // A localhost hole in a shipped bundle outlives the reason for it.
    expect(isPlausibleOtdOrigin("http://localhost:3000")).toBe(false);
    expect(isPlausibleOtdOrigin("http://localhost:3000", { allowDev: true })).toBe(true);
  });

  it("allows a LAN address only in dev, for handset testing", () => {
    expect(isPlausibleOtdOrigin("http://192.168.0.5:5180")).toBe(false);
    expect(isPlausibleOtdOrigin("http://192.168.0.5:5180", { allowDev: true })).toBe(true);
  });
});

describe("parseMessage — envelope integrity", () => {
  it.each([
    [null, "null"],
    ["save-request", "a bare string"],
    [{}, "an empty object"],
    [{ ...base, type: "nope" }, "an unknown type"],
    [{ channel: "other", protocolVersion: PROTOCOL_VERSION, type: "ready" }, "a foreign channel"],
  ])("returns null for %j (%s)", (data: unknown, _why: string) => {
    expect(parseMessage(data)).toBeNull();
  });

  it("rejects a different protocol version rather than guessing", () => {
    expect(parseMessage({ ...saveRequest, protocolVersion: 99 })).toBeNull();
    // ...but the version is still readable, so a peer can be told from noise.
    expect(readVersion({ ...saveRequest, protocolVersion: 99 })).toBe(99);
    expect(readVersion({ type: "save-request" })).toBeNull();
  });
});

describe("parseMessage — save-request is validated, not cast", () => {
  it("accepts a well-formed request", () => {
    expect(parseMessage(saveRequest)?.type).toBe("save-request");
  });

  it("REJECTS a non-string share, which would be a Prisma filter object", () => {
    // `{ not: "" }` is a legal StringFilter. Reaching `where` with it turns
    // "the drawing whose share code I hold" into "any of my drawings".
    expect(parseMessage({ ...saveRequest, mode: "rev", share: { not: "" } })).toBeNull();
    expect(parseMessage({ ...saveRequest, mode: "rev", share: { startsWith: "" } })).toBeNull();
    expect(parseMessage({ ...saveRequest, share: 42 })).toBeNull();
  });

  it("accepts share as a string or explicit null, and nothing else", () => {
    expect(parseMessage({ ...saveRequest, share: "zK3pQ7wR2fL9xN4vB8tCmA" })).not.toBeNull();
    expect(parseMessage({ ...saveRequest, share: null })).not.toBeNull();
    expect(parseMessage({ ...saveRequest, share: undefined })).toBeNull();
  });

  it("rejects a mode outside the two the register understands", () => {
    expect(parseMessage({ ...saveRequest, mode: "delete" })).toBeNull();
    expect(parseMessage({ ...saveRequest, mode: 1 })).toBeNull();
  });

  it("rejects a malformed envelope field by field", () => {
    expect(parseMessage({ ...saveRequest, envelope: null })).toBeNull();
    expect(parseMessage({ ...saveRequest, envelope: { ...envelope, p: 1 } })).toBeNull();
    expect(parseMessage({ ...saveRequest, envelope: { ...envelope, h: "" } })).toBeNull();
    expect(parseMessage({ ...saveRequest, envelope: { ...envelope, v: "1" } })).toBeNull();
    expect(parseMessage({ ...saveRequest, envelope: { ...envelope, n: 0 } })).toBeNull();
  });

  it("requires a requestId, or a stale reply cannot be told from a live one", () => {
    expect(parseMessage({ ...saveRequest, requestId: "" })).toBeNull();
    expect(parseMessage({ ...saveRequest, requestId: undefined })).toBeNull();
  });
});

describe("parseMessage — hello, the capability announcement", () => {
  const hello = (capabilities: unknown) => ({
    ...base,
    type: "hello",
    capabilities,
  });

  it("accepts a list of strings, and nothing else", () => {
    expect(parseMessage(hello([CAP_CLOSE]))?.type).toBe("hello");
    // An empty list is meaningful: a child that announces itself but claims
    // nothing. The parent keeps drawing its own close, which is correct.
    expect(parseMessage(hello([]))?.type).toBe("hello");
    expect(parseMessage(hello(CAP_CLOSE))).toBeNull();
    expect(parseMessage(hello([1]))).toBeNull();
    expect(parseMessage(hello(undefined))).toBeNull();
  });

  it("leaves an unknown type unparsed rather than fatal", () => {
    // Why adding `hello` did NOT bump PROTOCOL_VERSION: a peer that predates a
    // message type already ignores it here. Bumping instead would make every
    // message unreadable to the older peer, including the ones that still work.
    expect(parseMessage({ ...base, type: "a-type-from-the-future" })).toBeNull();
    expect(readVersion({ ...base, type: "a-type-from-the-future" })).toBe(
      PROTOCOL_VERSION,
    );
  });
});

describe("parseMessage — the reply half", () => {
  const saved = {
    ...base,
    type: "saved",
    requestId: "r1",
    drawingLabel: "OTD-HEX-1001",
    revLabel: "A",
    shareCode: "zK3pQ7wR2fL9xN4vB8tCmA",
    name: "Bench cluster",
    savedAt: "2026-08-03T00:00:00.000Z",
  };

  it("accepts a complete saved", () => {
    expect(parseMessage(saved)?.type).toBe("saved");
  });

  it.each(["drawingLabel", "revLabel", "shareCode", "name", "savedAt", "requestId"])(
    "rejects saved with a missing %s",
    (field) => {
      expect(parseMessage({ ...saved, [field]: undefined })).toBeNull();
    },
  );

  it("carries a failure code, so a dead save is distinguishable from a lost one", () => {
    expect(
      parseMessage({ ...base, type: "save-failed", requestId: "r1", code: "quota-revisions", message: "x" }),
    ).not.toBeNull();
    expect(parseMessage({ ...base, type: "save-failed", requestId: "r1" })).toBeNull();
  });

  it("accepts the frame-control messages", () => {
    expect(parseMessage({ ...base, type: "close-request" })?.type).toBe("close-request");
    expect(parseMessage({ ...base, type: "context-lost" })?.type).toBe("context-lost");
    expect(parseMessage({ ...base, type: "save-cancelled", requestId: "r1" })?.type).toBe(
      "save-cancelled",
    );
  });

  it("validates the handshake, which is where the child learns its reply target", () => {
    const ready = { ...base, type: "ready", parentOrigin: "https://academy.onethousanddrones.com", theme: "dark" };
    expect(parseMessage(ready)?.type).toBe("ready");
    expect(parseMessage({ ...ready, parentOrigin: "" })).toBeNull();
    expect(parseMessage({ ...ready, theme: "sepia" })).toBeNull();
  });
});
