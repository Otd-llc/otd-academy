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
  const body = "q1YqU7Iy1FEqVrKqVirITE1OLVayio7VUSrOSyyAMQsys2HCyfllqUUwNlxFZl5xalEJlJORmJeSg1Cfl5eaXJIP01NUmgdjZRZDTaqtBQA";

  it("accepts a real v2 compressed payload", () => {
    expect(checkPayload(`v2s=${body}`)).toBeNull();
  });

  it("splits on the FIRST equals, because the prefix contains one", () => {
    // Applying the character class to the whole string rejects every real
    // payload — the bug the design caught in review.
    expect(checkPayload(`v2s=${body}`)).toBeNull();
    expect(checkPayload("v2s=")).toBe("malformed");
    expect(checkPayload("=abc")).toBe("malformed");
    expect(checkPayload(body)).toBe("malformed");
  });

  it("refuses the uncompressed v2 transport outright", () => {
    // Not a larger byte cap: on the uncompressed path the QR is over capacity
    // entirely by nineteen cells, so any cap still admits an unscannable sheet.
    expect(checkPayload(`v2u=${body}`)).toBe("uncompressed");
  });

  it("refuses v1 in every form: there is no v1 path at all", () => {
    expect(checkPayload(`s=${body}`)).toBe("malformed");
    expect(checkPayload(`u=${body}`)).toBe("malformed");
  });

  it("rejects an unknown prefix and non-base64url bodies", () => {
    expect(checkPayload(`z=${body}`)).toBe("malformed");
    expect(checkPayload(`v3s=${body}`)).toBe("malformed");
    expect(checkPayload("v2s=has spaces")).toBe("malformed");
    expect(checkPayload("v2s=has/slash+plus")).toBe("malformed");
  });

  it("bounds the length", () => {
    expect(checkPayload(`v2s=${"a".repeat(MAX_PAYLOAD_CHARS)}`)).toBe(
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
        dims: "190.8 × 169.2 × 80.0",
        sourceFile: "hex-main.FCStd",
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

  // Decision 9 (2026-09-28): the rest of the build beside the ballooned bill.
  describe("the rest of the build: hub halves, hardware, pipe", () => {
    const everything = {
      ...good,
      hubHalves: [
        { item: 2, qty: 2, label: "PVC hub · bottom half", sourceFile: "pvc-hub-bottom.FCStd" },
        { item: 3, qty: 2, label: "PVC hub · top half", sourceFile: "pvc-hub-top.FCStd" },
      ],
      hardware: [
        { item: 4, qty: 12, label: "M6 x 35 socket head cap screw, ISO 4762 (DIN 912)" },
        { item: 5, qty: 12, label: "M6 hex nut, ISO 4032 (DIN 934)" },
        { item: 6, qty: 1, label: "heatset-m6-short" },
      ],
      pipe: {
        buy: ["buy 1 x 10 ft 3/4 in Sch 40 PVC pipe, OD 26.67 mm (US)."],
        sticks: [{ cuts: [400, 701], offcutMm: 1946, flex: false }],
        warnings: [],
        notes: ["1 run STRUCTURAL -- DRY, NOT PRESSURE RATED."],
      },
    };

    it("keeps every section, byte for byte", () => {
      expect(validateSummaryWire(JSON.parse(JSON.stringify(everything)))).toEqual(everything);
    });

    it("reads a summary saved before them exactly as before: absent stays absent", () => {
      const out = validateSummaryWire(good) as unknown as Record<string, unknown>;
      expect(out).not.toHaveProperty("hubHalves");
      expect(out).not.toHaveProperty("hardware");
      expect(out).not.toHaveProperty("pipe");
      expect(JSON.stringify(out)).toBe(JSON.stringify(good));
    });

    it("keeps empty sections and a null pipe", () => {
      const empty = { ...good, hubHalves: [], hardware: [], pipe: null };
      expect(validateSummaryWire(empty)).toEqual(empty);
    });

    it("refuses a bad section rather than dropping it", () => {
      const bad: Array<[string, unknown]> = [
        ["hubHalves not an array", { ...everything, hubHalves: "x" }],
        ["hub half with no source file", { ...everything, hubHalves: [{ item: 2, qty: 2, label: "x" }] }],
        ["hardware qty negative", { ...everything, hardware: [{ item: 4, qty: -1, label: "x" }] }],
        ["hardware label an object", { ...everything, hardware: [{ item: 4, qty: 1, label: { $gt: "" } }] }],
        ["pipe an array", { ...everything, pipe: [] }],
        ["pipe buy not strings", { ...everything, pipe: { ...everything.pipe, buy: [1] } }],
        ["pipe cut NaN", { ...everything, pipe: { ...everything.pipe, sticks: [{ cuts: [Number.NaN], offcutMm: 0, flex: false }] } }],
        ["pipe cut negative", { ...everything, pipe: { ...everything.pipe, sticks: [{ cuts: [-5], offcutMm: 0, flex: false }] } }],
        ["pipe flex not boolean", { ...everything, pipe: { ...everything.pipe, sticks: [{ cuts: [1], offcutMm: 0, flex: "no" }] } }],
        ["pipe missing notes", { ...everything, pipe: { buy: [], sticks: [], warnings: [] } }],
        ["too many hardware lines", { ...everything, hardware: Array.from({ length: 201 }, (_, i) => ({ item: i, qty: 1, label: "b" })) }],
        ["too many cuts on a stick", { ...everything, pipe: { ...everything.pipe, sticks: [{ cuts: Array(65).fill(1), offcutMm: 0, flex: false }] } }],
      ];
      for (const [label, v] of bad) expect(validateSummaryWire(v), label).toBeNull();
    });

    it("drops unknown keys inside a section, as it does on a bom line", () => {
      const out = validateSummaryWire({
        ...everything,
        hardware: [{ ...everything.hardware[0], href: "https://evil.example" }],
      });
      expect(out!.hardware![0]).toEqual(everything.hardware[0]);
    });

    it("counts the sections against the 8,192 cap", () => {
      const huge = {
        ...everything,
        hardware: Array.from({ length: 150 }, (_, i) => ({ item: i, qty: 1, label: "x".repeat(60) })),
      };
      expect(validateSummaryWire(huge)).toBeNull();
    });
  });
});
