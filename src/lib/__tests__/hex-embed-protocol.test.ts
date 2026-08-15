// The embed channel's validation, which is a security boundary rather than a
// convenience. A four-lens review of the first draft found the original version
// cast instead of validating, and that `share` flows into a Prisma `where`
// clause with no runtime check — so a non-string here is a filter-object
// injection, not a type error.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  CAP_CLOSE,
  CHANNEL,
  PROTOCOL_VERSION,
  isPlausibleOtdOrigin,
  parseMessage,
  readVersion,
  type Ready,
} from "@/lib/hex-embed-protocol";
import { BED_MAX, BED_MIN } from "@/lib/hex-pack";
import { normalizeBed } from "@/lib/print-bed";

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

// The bed rides this channel because the picker belongs beside Download, in the
// configurator, while the value has to live on the ACCOUNT to survive a new
// browser — and `bed-changed` is the ONE message on this channel that reaches a
// write. So these are the numbers a cross-origin message can put in a column.
describe("parseMessage — the bed is two integers or nothing", () => {
  const ready = {
    ...base,
    type: "ready",
    parentOrigin: "https://academy.onethousanddrones.com",
    theme: "dark",
  };
  const setBed = (bed: unknown) => ({ ...base, type: "set-bed", bed });
  const bedChanged = (bed: unknown) => ({ ...base, type: "bed-changed", bed });

  /** Every shape that must NOT reach the column, and the reason each one is
   *  here rather than "some bad values". */
  const BAD: [unknown, string][] = [
    [{ x: "220", y: 220 }, "a numeric string, which Number() would have taken"],
    [{ x: 220, y: null }, "a null axis"],
    [{ x: 220, y: true }, "a boolean axis, which >= would coerce to 1"],
    [{ x: NaN, y: 220 }, "NaN, which sails straight through a bare range check"],
    [{ x: Infinity, y: 220 }, "an infinity"],
    [{ x: -Infinity, y: 220 }, "a negative infinity"],
    [{ x: 220.5, y: 220 }, "a fraction, which setPrintBed throws on"],
    [{ x: 220 }, "a missing y"],
    [{ y: 220 }, "a missing x"],
    [{ x: 220, y: 220, z: 100 }, "an extra axis nobody asked about"],
    [[220, 220], "an array"],
    ["220x220", "the URL spelling, which is not this spelling"],
    [null, "null"],
    [{ x: BED_MIN - 1, y: 220 }, "one below the floor"],
    [{ x: 220, y: BED_MAX + 1 }, "one above the ceiling"],
    [{ x: 0, y: 0 }, "zero, a bed nothing fits on"],
    [{ x: -220, y: -220 }, "a negative bed"],
  ];

  it("parses a ready with NO bed, which is what the optionality is FOR", () => {
    // The back-compat case, and the everyday one: a parent that predates the
    // field, a signed-out visitor, and an account read that has not landed yet
    // all send exactly this. Refusing it would drop the handshake, and the
    // handshake is where the child learns its reply target — no bed would cost
    // the visitor the save button, not just the plate count.
    const m = parseMessage(ready);
    expect(m?.type).toBe("ready");
    expect((m as Ready).bed).toBeUndefined();
  });

  it("carries a well-formed bed on all three of its carriers", () => {
    expect((parseMessage({ ...ready, bed: { x: 220, y: 220 } }) as Ready).bed).toEqual({
      x: 220,
      y: 220,
    });
    expect(parseMessage(setBed({ x: 350, y: 350 }))?.type).toBe("set-bed");
    // Non-square is a real bed, not a typo: plenty of machines are 300 x 250.
    expect(parseMessage(bedChanged({ x: 300, y: 250 }))?.type).toBe("bed-changed");
  });

  it("accepts BOTH edges of the range and refuses one step outside either", () => {
    // Edges, because an off-by-one on either side is exactly what a "roughly
    // right" range check ships with.
    expect(parseMessage(setBed({ x: BED_MIN, y: BED_MIN }))?.type).toBe("set-bed");
    expect(parseMessage(setBed({ x: BED_MAX, y: BED_MAX }))?.type).toBe("set-bed");
    expect(parseMessage(setBed({ x: BED_MIN - 1, y: BED_MIN }))).toBeNull();
    expect(parseMessage(setBed({ x: BED_MAX, y: BED_MAX + 1 }))).toBeNull();
  });

  it.each(BAD)("refuses %j on set-bed and on bed-changed (%s)", (bed, _why) => {
    expect(parseMessage(setBed(bed))).toBeNull();
    expect(parseMessage(bedChanged(bed))).toBeNull();
  });

  it.each(BAD)("refuses a handshake carrying %j (%s)", (bed, _why) => {
    // Optional does not mean lenient. `ready` is sent only by our own parent, so
    // a malformed bed there is our bug or a hostile parent; neither is worth
    // half-reading.
    expect(parseMessage({ ...ready, bed })).toBeNull();
  });

  it("refuses a bed message with no bed at all", () => {
    // Not a smaller instruction — a broken one. Waving it through would have
    // `message.bed` reach the write handler as undefined.
    expect(parseMessage({ ...base, type: "set-bed" })).toBeNull();
    expect(parseMessage({ ...base, type: "bed-changed" })).toBeNull();
    expect(parseMessage(bedChanged(undefined))).toBeNull();
  });

  it("does not honour a bed on a message that does not carry one", () => {
    // The TYPE decides what is read, never the presence of a field: a bed riding
    // on a close-request is still just a close, because the parent's switch is
    // keyed on the type and only `bed-changed` reaches the account write.
    expect(
      parseMessage({ ...base, type: "close-request", bed: { x: 350, y: 350 } })?.type,
    ).toBe("close-request");
    // And the other half, which is the one a "tighten it up" edit breaks: a
    // MALFORMED bed on a message that does not carry one must not make that
    // message unreadable. A blanket "reject any envelope with a bad bed" would
    // refuse every older peer that puts an unrelated field there — the exact
    // property that lets a new message type ship without a version bump.
    expect(
      parseMessage({ ...base, type: "set-theme", theme: "dark", bed: "nonsense" })?.type,
    ).toBe("set-theme");
  });

  it("accepts nothing the account store would then refuse", () => {
    // The defect this catches is invisible from either side alone: a bed that
    // parses here and throws in `setPrintBed` is a pick the configurator reports
    // as made and the account silently never stores. This file validates
    // INDEPENDENTLY of `normalizeBed` — it must, since it is transcribed into a
    // repo with no print-bed module — so this is what holds the two rules to the
    // same answer.
    //
    // ONE direction only, deliberately. The protocol is the stricter of the two
    // (it sees the whole object, so it can refuse `{ x, y, z }`, which
    // `normalizeBed` never even sees a `z` of), and that asymmetry is fine. The
    // direction that would hurt is this one.
    for (const bed of [
      { x: BED_MIN, y: BED_MIN },
      { x: BED_MAX, y: BED_MAX },
      { x: 220, y: 220 },
      { x: 300, y: 250 },
    ]) {
      expect(parseMessage(bedChanged(bed))).not.toBeNull();
      expect(normalizeBed(bed.x, bed.y)).toEqual(bed);
    }
  });

  it("takes the bounds from the pack module rather than restating them", () => {
    // Source-level, because a value check cannot see a copy that currently
    // happens to agree. A third copy of BED_MIN/BED_MAX would go on agreeing
    // with itself while the endpoint's moved, and the symptom is a bed the
    // configurator sends, this file accepts, and the download then 400s on with
    // no stated cause.
    const src = readFileSync(
      join(__dirname, "..", "hex-embed-protocol.ts"),
      "utf8",
    );
    expect(src).toMatch(
      /import\s*\{[^}]*BED_MIN[^}]*\}\s*from\s*"@\/lib\/hex-pack"/,
    );
    expect(src).not.toMatch(/(?:const|let|var)\s+BED_(?:MIN|MAX)\s*=/);
  });
});
