import { describe, expect, it } from "vitest";
import {
  MAX_NAME_CHARS,
  MAX_PAYLOAD_CHARS,
  MAX_REVISIONS_PER_CLUSTER,
  SHARE_CODE_LENGTH,
  checkPayload,
  formatRevLabel,
  isPayloadHash,
  makeShareCode,
  normaliseName,
  validateSummaryWire,
} from "@/lib/hex-cluster";

describe("formatRevLabel", () => {
  it("skips the letters that misread on a photocopy", () => {
    // I O Q S X Z are excluded: they read as digits or as each other.
    const first20 = Array.from({ length: 20 }, (_, i) =>
      formatRevLabel(i + 1),
    ).join("");
    expect(first20).toBe("ABCDEFGHJKLMNPRTUVWY");
    expect(first20).not.toMatch(/[IOQSXZ]/);
  });

  it("pins the boundaries the design names", () => {
    expect(formatRevLabel(1)).toBe("A");
    expect(formatRevLabel(20)).toBe("Y");
    expect(formatRevLabel(21)).toBe("AA");
    // 100 revisions is the cap, and it has to fit the label space.
    // index 99 → 79 past the 20 single letters → D (79/20 = 3), Y (79%20 = 19).
    expect(formatRevLabel(MAX_REVISIONS_PER_CLUSTER)).toBe("DY");
    // 420 labels total, so the cap has room four times over.
    expect(formatRevLabel(420)).toBe("YY");
    expect(() => formatRevLabel(421)).toThrow();
  });

  it("covers the whole revision cap without collisions", () => {
    const labels = Array.from({ length: MAX_REVISIONS_PER_CLUSTER }, (_, i) =>
      formatRevLabel(i + 1),
    );
    expect(new Set(labels).size).toBe(MAX_REVISIONS_PER_CLUSTER);
  });

  it("refuses a revNo that is not a revision", () => {
    expect(() => formatRevLabel(0)).toThrow();
    expect(() => formatRevLabel(-1)).toThrow();
    expect(() => formatRevLabel(1.5)).toThrow();
  });
});

describe("makeShareCode", () => {
  it("is 22 base62 characters", () => {
    const code = makeShareCode((n) =>
      new Uint8Array(n).map((_, i) => i * 7 + 3),
    );
    expect(code).toHaveLength(SHARE_CODE_LENGTH);
    expect(code).toMatch(/^[0-9A-Za-z]{22}$/);
  });

  it("discards the bytes that would bias the alphabet", () => {
    // 248 = 4 * 62. A plain `% 62` over 0..255 makes 0-7 twice as likely as
    // the rest, which is quiet entropy loss in a token that still looks
    // random. Feed only high bytes: every one must be rejected, so the
    // generator has to keep asking for more.
    let calls = 0;
    const code = makeShareCode((n) => {
      calls++;
      return new Uint8Array(n).fill(calls < 3 ? 250 : 0);
    });
    expect(calls).toBeGreaterThan(2);
    expect(code).toBe("0".repeat(SHARE_CODE_LENGTH));
  });
});

describe("checkPayload", () => {
  const body = "eJyrVkrKz1WyUkotLs1RqgUAJ8QEjA";

  it("accepts a real compressed payload", () => {
    expect(checkPayload(`s=${body}`)).toBeNull();
  });

  it("splits on the FIRST equals, because the prefix contains one", () => {
    // Applying the character class to the whole string rejects every real
    // payload — the bug the design caught in review.
    expect(checkPayload(`s=${body}`)).toBeNull();
    expect(checkPayload("s=")).toBe("malformed");
    expect(checkPayload("=abc")).toBe("malformed");
    expect(checkPayload(body)).toBe("malformed");
  });

  it("refuses the uncompressed transport outright", () => {
    // Not a larger byte cap: on the u= path the QR is over capacity entirely
    // by nineteen cells, so any cap still admits an unscannable sheet.
    expect(checkPayload(`u=${body}`)).toBe("uncompressed");
  });

  it("rejects an unknown prefix and non-base64url bodies", () => {
    expect(checkPayload(`z=${body}`)).toBe("malformed");
    expect(checkPayload("s=has spaces")).toBe("malformed");
    expect(checkPayload("s=has/slash+plus")).toBe("malformed");
  });

  it("bounds the length", () => {
    expect(checkPayload(`s=${"a".repeat(MAX_PAYLOAD_CHARS)}`)).toBe(
      "too-large",
    );
  });
});

describe("isPayloadHash", () => {
  it("accepts the wire form and rejects near-misses", () => {
    expect(isPayloadHash(`h1:${"a".repeat(64)}`)).toBe(true);
    expect(isPayloadHash(`h2:${"a".repeat(64)}`)).toBe(true); // a future algo
    expect(isPayloadHash("a".repeat(64))).toBe(false); // no tag
    expect(isPayloadHash(`h1:${"a".repeat(63)}`)).toBe(false);
    expect(isPayloadHash(`h1:${"A".repeat(64)}`)).toBe(false); // lowercase only
  });
});

describe("normaliseName", () => {
  it("trims and accepts an ordinary name", () => {
    expect(normaliseName("  Bench cluster  ")).toBe("Bench cluster");
  });

  it("counts CODE POINTS, so an accent costs one", () => {
    const accented = "é".repeat(MAX_NAME_CHARS);
    expect(normaliseName(accented)).toHaveLength(MAX_NAME_CHARS);
    expect(normaliseName("é".repeat(MAX_NAME_CHARS + 1))).toBeNull();
  });

  it("normalises to NFC, so the same name is the same length either way", () => {
    // "e" + combining acute vs the precomposed character.
    const decomposed = "é".repeat(MAX_NAME_CHARS);
    expect(normaliseName(decomposed)).toBe("é".repeat(MAX_NAME_CHARS));
  });

  it("refuses control characters and newlines", () => {
    expect(normaliseName("two\nlines")).toBeNull();
    expect(normaliseName("bell")).toBeNull();
    expect(normaliseName("c1")).toBeNull();
  });

  it("refuses bidi overrides, which make stored text render as other text", () => {
    // A drawing must show the string that was stored.
    expect(normaliseName("safe‮reversed")).toBeNull();
    expect(normaliseName("safe⁦isolated")).toBeNull();
  });

  it("refuses empty and whitespace-only", () => {
    expect(normaliseName("")).toBeNull();
    expect(normaliseName("   ")).toBeNull();
  });
});

describe("validateSummaryWire", () => {
  const good = {
    cells: 7,
    caps: 12,
    spikes: 3,
    pieces: 22,
    envelope: { mm: [90.6, 48.8, 82.7], in: [3.57, 1.92, 3.26] },
    bom: [
      {
        item: 1,
        qty: 3,
        label: "Hex base · full",
        dims: "87.8 × 33.0 × 78.0",
        sourceFile: "Hex-TB-Main.FCStd",
      },
    ],
    details: [{ letter: "A", caption: "Detail A" }],
  };

  it("accepts the wire shape", () => {
    expect(validateSummaryWire(good)).not.toBeNull();
  });

  it("rejects the section 4.1 shape verbatim only if a field is missing, not for the extra one", () => {
    // The stored shape has nameAtSave; the WIRE shape does not. An unknown key
    // is dropped rather than rejected, because the academy stamps its own in.
    const withName = { ...good, nameAtSave: "Bench cluster" };
    const out = validateSummaryWire(withName);
    expect(out).not.toBeNull();
    expect(out as unknown as Record<string, unknown>).not.toHaveProperty(
      "nameAtSave",
    );
  });

  it("requires a non-empty BOM and at least one piece", () => {
    expect(validateSummaryWire({ ...good, bom: [] })).toBeNull();
    expect(validateSummaryWire({ ...good, pieces: 0 })).toBeNull();
  });

  it("accepts a null envelope but not a malformed one", () => {
    expect(validateSummaryWire({ ...good, envelope: null })).not.toBeNull();
    expect(
      validateSummaryWire({ ...good, envelope: { mm: [1, 2], in: [1, 2, 3] } }),
    ).toBeNull();
    expect(
      validateSummaryWire({ ...good, envelope: { mm: [1, 2, 3] } }),
    ).toBeNull();
  });

  it("stores a null dims rather than the print glyph", () => {
    const out = validateSummaryWire({
      ...good,
      bom: [{ ...good.bom[0], dims: null }],
    });
    expect(out!.bom[0].dims).toBeNull();
    expect(
      validateSummaryWire({ ...good, bom: [{ ...good.bom[0], dims: 5 }] }),
    ).toBeNull();
  });

  it("rejects a summary past the write bound", () => {
    const huge = {
      ...good,
      details: Array.from({ length: 500 }, (_, i) => ({
        letter: "A",
        caption: "x".repeat(50) + i,
      })),
    };
    expect(validateSummaryWire(huge)).toBeNull();
  });

  it("rejects non-objects", () => {
    expect(validateSummaryWire(null)).toBeNull();
    expect(validateSummaryWire([])).toBeNull();
    expect(validateSummaryWire("nope")).toBeNull();
  });
});
