// The build name, treated as hostile.
//
// Every row below is an ATTACK or a REAL NAME, and the file is deliberately
// weighted toward the first. This string arrives from a separate origin, becomes
// an HTTP header parameter, a filename on somebody's disk and a zip entry name,
// and each of those three has a different way of going wrong -- so "it looks
// clean" is not a property any single assertion here can establish.
//
// CONTROL ROWS are marked. Several of these rules are satisfiable by a
// sanitiser that simply refuses everything, or that returns the fallback for
// every input, so the negative half is asserted beside the positive one wherever
// that is possible.
//
// The invisible characters are written as `\u` ESCAPES throughout, never as
// themselves. A test fixture holding raw bidi controls is a fixture nobody can
// read in a diff -- and a reviewer who cannot see the input cannot check the
// expectation.
import { describe, expect, it } from "vitest";

import {
  MAX_PACK_NAME_CHARS,
  MAX_STEM_BYTES,
  PACK_NAME_FALLBACK,
  asciiStem,
  contentDisposition,
  resolvePackName,
} from "@/lib/hex-pack-name";

/** The stem, or `null` for a refusal. Collapses the resolution into one value so
 *  a table can state both outcomes in the same column. */
const stem = (raw: string | null | undefined): string | null => {
  const r = resolvePackName(raw);
  return r.ok ? r.stem : null;
};

describe("names that are simply names", () => {
  it("keeps what the configurator actually sends, verbatim", () => {
    // `readBuildName` normalises to collapsed, control-free text and defaults to
    // `UNTITLED BUILD`. None of that needs touching, and touching it would be
    // this module inventing a second naming policy.
    expect(stem("UNTITLED BUILD")).toBe("UNTITLED BUILD");
    expect(stem("TB-1 POWER 7-CELL")).toBe("TB-1 POWER 7-CELL");
    expect(stem("Josh's rig (v2)")).toBe("Josh's rig (v2)");
  });

  it("keeps non-ASCII, because dropping it is what `filename*` exists to avoid", () => {
    expect(stem("Café Cluster")).toBe("Café Cluster");
    expect(stem("ハニカム")).toBe("ハニカム");
    expect(stem("Кластер")).toBe("Кластер");
  });

  it("keeps an emoji whole rather than splitting the surrogate pair", () => {
    // An astral character is two UTF-16 units. A `slice`-based length or
    // truncation cuts one in half and leaves a lone surrogate, which is not
    // representable in UTF-8 at all.
    expect(stem("Hex \u{1F41D} rig")).toBe("Hex \u{1F41D} rig");
  });
});

describe("no name at all", () => {
  it("falls back for absent, null and empty", () => {
    for (const raw of [undefined, null, ""]) {
      expect(stem(raw)).toBe(PACK_NAME_FALLBACK);
    }
  });

  it("CONTROL: a real name is NOT the fallback", () => {
    // Without this, every fallback assertion in this file is satisfied by a
    // function that returns `OTD-Hex-Cluster` unconditionally.
    expect(stem("REAL")).not.toBe(PACK_NAME_FALLBACK);
  });
});

describe("REFUSALS -- the header, and only the header", () => {
  it.each([
    ["a bare LF", "a\nb"],
    ["a bare CR", "a\rb"],
    ["CRLF and a whole second header", "x\r\nSet-Cookie: sid=1"],
    ["a NUL", "a\u0000b"],
    ["a tab", "a\tb"],
    ["DEL", "a\u007Fb"],
    ["a C1 control", "a\u0085b"],
    ["a lone high surrogate", "a\uD800b"],
    ["a lone low surrogate", "a\uDC00b"],
  ])("refuses %s outright", (_why, raw) => {
    // REFUSED, not repaired. A name a person typed cannot contain one of these
    // -- the configurator replaces the whole C0/C1 range with spaces before the
    // field is stored -- so a request carrying one is not a slip to tidy up.
    expect(resolvePackName(raw)).toEqual({ ok: false });
  });

  it("CONTROL: the same name without the control character is accepted", () => {
    // The rows above pass just as well against a function that refuses
    // everything containing an `a`.
    expect(stem("ab")).toBe("ab");
    // The same injection attempt with the CRLF taken out is not an injection
    // attempt any more -- it is a slightly odd build name, and it is accepted.
    // The colon still folds, because a colon is an NTFS stream marker whatever
    // the rest of the string says.
    expect(stem("x Set-Cookie: sid=1")).toBe("x Set-Cookie- sid=1");
  });

  it("refuses a name longer than the field that stores it", () => {
    expect(resolvePackName("A".repeat(MAX_PACK_NAME_CHARS + 1))).toEqual({
      ok: false,
    });
  });

  it("CONTROL: exactly at the bound is accepted, and unchanged", () => {
    const at = "A".repeat(MAX_PACK_NAME_CHARS);
    expect(stem(at)).toBe(at);
  });

  it("counts CODE POINTS, not UTF-16 units", () => {
    // 120 bees is 240 UTF-16 units. A length check written on `.length` would
    // refuse a name the configurator's own field accepts, and the person would
    // have no way to know why their download 400s.
    const bees = "\u{1F41D}".repeat(MAX_PACK_NAME_CHARS);
    expect(resolvePackName(bees).ok).toBe(true);
    expect(resolvePackName("\u{1F41D}".repeat(MAX_PACK_NAME_CHARS + 1))).toEqual(
      { ok: false },
    );
  });
});

describe("REPAIRS -- the filesystem", () => {
  it.each([
    ["a forward slash", "TB-1 / POWER", "TB-1 - POWER"],
    ["a backslash", "TB-1 \\ POWER", "TB-1 - POWER"],
    ["a colon, which is also an NTFS stream marker", "rig:evil", "rig-evil"],
    ["glob wildcards", "rig*?", "rig"],
    ["a quote, which would end the quoted-string", 'say "hi"', "say -hi"],
    ["shell redirection", "a<b>c|d", "a-b-c-d"],
    ["a percent, which invites a second decode", "100% DONE", "100- DONE"],
  ])("folds %s to a hyphen", (_why, raw, want) => {
    expect(stem(raw)).toBe(want);
  });

  it("folds rather than refusing, because a slash in a title is not an attack", () => {
    // The whole reason the refuse/repair split is not uniform. Somebody who
    // types `TB-1 / POWER` means a slash in their title; refusing their download
    // over it would be refusing a question we can answer.
    expect(resolvePackName("TB-1 / POWER").ok).toBe(true);
  });

  it.each([
    ["a bare dot", "."],
    ["dot dot", ".."],
    ["only punctuation", " . - . "],
    ["only separators", "///"],
  ])("falls back when %s leaves nothing at all", (_why, raw) => {
    expect(stem(raw)).toBe(PACK_NAME_FALLBACK);
  });

  it.each([
    ["dot-dot-slash", "../../etc/passwd", "etc-passwd"],
    ["backslash traversal", "..\\..\\windows", "windows"],
  ])("keeps the harmless remainder of %s", (_why, raw, want) => {
    // NOT the fallback, and that is the honest answer. The separators are gone
    // and the leading dots with them, so what is left is an ordinary filename
    // stem -- it just happens to be a word from the attack. Returning the
    // fallback here would be pretending we could not name it.
    expect(stem(raw)).toBe(want);
  });

  it("has no path separator left after ANY of these", () => {
    // Stated as a sweep as well as a table, because the table is a list of the
    // attacks somebody thought of.
    for (const raw of [
      "a/b",
      "a\\b",
      "..%2F..",
      "..%252F..",
      "\uFF0F", // FULLWIDTH SOLIDUS -- looks like a slash, is not one
      "C:\\Windows\\System32",
      "/etc/shadow",
    ]) {
      const s = stem(raw);
      expect(s, raw).not.toBeNull();
      expect(s!, raw).not.toMatch(/[\\/]/);
    }
  });

  it("strips a leading dot, which would hide the file on every Unix", () => {
    expect(stem(".hidden rig")).toBe("hidden rig");
  });

  it("strips trailing dots and spaces, which Windows drops silently", () => {
    // The failure this prevents is subtle: Windows saves `rig .` as `rig`, so
    // the name we DECLARED and the name on disk disagree -- and this endpoint
    // has shipped "the filename disagrees with the contents" twice already.
    expect(stem("rig . ")).toBe("rig");
    expect(stem("rig   ")).toBe("rig");
  });

  it("collapses runs of whitespace", () => {
    expect(stem("a     b")).toBe("a b");
  });

  it.each([
    ["CON", "CON"],
    ["lowercase con", "con"],
    ["mixed case", "CoN"],
    ["with an extension", "CON.3mf"],
    ["with two extensions", "nul.tar.gz"],
    ["PRN", "PRN"],
    ["AUX", "AUX"],
    ["COM1", "COM1"],
    ["COM9", "COM9"],
    ["LPT1", "LPT1"],
    ["LPT9", "LPT9"],
    ["a superscript COM", "COM\u00B9"],
    ["CONIN$", "CONIN$"],
  ])("falls back for the Windows device name %s", (_why, raw) => {
    expect(stem(raw)).toBe(PACK_NAME_FALLBACK);
  });

  it("CONTROL: a name that merely STARTS with a device name is kept", () => {
    // `CON` is a device; `CONTROLLER` is a word. A rule written as a prefix
    // match would eat every build somebody called `COMPACT` or `AUXILIARY`.
    expect(stem("CONTROLLER")).toBe("CONTROLLER");
    expect(stem("COMPACT RIG")).toBe("COMPACT RIG");
    expect(stem("NULLABLE")).toBe("NULLABLE");
  });

  it("strips the bidi override that spoofs an extension", () => {
    // U+202E reverses the display of everything after it, so `rig\u202Efm3.tmf`
    // renders as `rigfmt.3mf`. It is the oldest filename spoof there is and it
    // survives every check that only looks at the characters' identities.
    expect(stem("rig\u202Efm3.tmf")).toBe("rigfm3.tmf");
    expect(stem("rig\u202Efm3.tmf")).not.toContain("\u202E");
  });

  it("strips zero-width padding", () => {
    expect(stem("a\u200Bb\u200Cc\uFEFFd")).toBe("abcd");
  });
});

describe("length, in the unit filesystems actually measure", () => {
  it("bounds the stem in UTF-8 BYTES, not characters", () => {
    // 120 bees is 480 bytes -- inside the code-point bound and four times over
    // the 255-byte component limit on ext4 and APFS, before the extension and a
    // `-plate-20-of-20` suffix are added.
    const s = stem("\u{1F41D}".repeat(MAX_PACK_NAME_CHARS))!;
    expect(Buffer.byteLength(s, "utf8")).toBeLessThanOrEqual(MAX_STEM_BYTES);
  });

  it("cuts on a code-point boundary, never mid-character", () => {
    // The failure a byte-wise `subarray` produces is a truncated UTF-8 sequence,
    // which becomes U+FFFD -- a replacement character in the middle of somebody's
    // filename, with no clue where it came from.
    const s = stem("\u{1F41D}".repeat(MAX_PACK_NAME_CHARS))!;
    expect(s).not.toContain("\uFFFD");
    expect([...s].every((c) => c === "\u{1F41D}")).toBe(true);
  });

  it("leaves room for the longest suffix a plate can carry", () => {
    // The stem is never the whole filename: `-plate-20-of-20.3mf` is 19 more
    // bytes, inside a directory the person chose. 255 is the component limit.
    const longest = `${"\u{1F41D}".repeat(MAX_PACK_NAME_CHARS)}`;
    const s = stem(longest)!;
    expect(
      Buffer.byteLength(`${s}-plate-20-of-20.3mf`, "utf8"),
    ).toBeLessThanOrEqual(200);
  });

  it("re-checks the device names AFTER truncating", () => {
    // Truncation can only shorten a stem toward a prefix, and `CONTROLLER` cut
    // short is exactly how a safe name becomes a device.
    expect(stem("CON")).toBe(PACK_NAME_FALLBACK);
  });
});

describe("asciiStem -- the `filename=` fallback", () => {
  it("keeps the base letter of an accented one", () => {
    // NFKD first: `é` decomposes to `e` + a combining acute, and only the mark
    // is outside ASCII. A fold that dropped the whole character would turn
    // `Café` into `Caf`.
    expect(asciiStem("Café Cluster")).toBe("Cafe Cluster");
    expect(asciiStem("Ångström")).toBe("Angstrom");
  });

  it("falls back rather than folding a whole name away to nothing", () => {
    // A name with no ASCII spelling at all folds to the empty string, and a
    // filename built around an empty stem is `-3-parts.3mf`: a count with no
    // subject. This is precisely the loss `filename*` exists to cover, so the
    // fallback only has to be a NAME, not the right one.
    expect(asciiStem("ハニカム")).toBe(PACK_NAME_FALLBACK);
    expect(asciiStem("Кластер")).toBe(PACK_NAME_FALLBACK);
  });

  it("folds the STEM, so the count keeps its subject", () => {
    // The seam that makes the row above possible. Folding the whole
    // `<name>-3-parts.3mf` instead would leave the NON-empty `3-parts.3mf`, no
    // fallback would fire, and the download would be named after a number.
    expect(`${asciiStem("ハニカム")}-3-parts.3mf`).toBe(
      `${PACK_NAME_FALLBACK}-3-parts.3mf`,
    );
  });

  it("re-sanitises what NFKD CREATES", () => {
    // THE SUBTLE ONE. U+FF0F FULLWIDTH SOLIDUS decomposes to a real `/`, and
    // U+2026 HORIZONTAL ELLIPSIS decomposes to `...`. A fold applied after the
    // sanitiser rather than through it would inject a path separator into the
    // header on input the sanitiser had already passed -- and would turn a
    // fullwidth `CON` into the device name the sanitiser just refused.
    expect(asciiStem("a／b")).toBe("a-b");
    expect(asciiStem("…")).toBe(PACK_NAME_FALLBACK);
    expect(asciiStem("ＣＯＮ")).toBe(PACK_NAME_FALLBACK);
  });

  it("is printable ASCII and nothing else", () => {
    for (const raw of ["Café", "ハニカム", "Кластер", "Hex \u{1F41D}"]) {
      expect(asciiStem(raw), raw).toMatch(/^[\x20-\x7e]+$/);
    }
  });
});

describe("contentDisposition", () => {
  /** Exactly what the route does: ONE filename template, TWO stems. */
  const both = (name: string, tail = "-3-parts.3mf") => {
    const s = stem(name)!;
    return contentDisposition({
      filename: `${s}${tail}`,
      ascii: `${asciiStem(s)}${tail}`,
    });
  };

  it("writes both parameters, filename first", () => {
    // RFC 6266: recipients SHOULD prefer `filename*`, and `filename` "should
    // occur first, due to parsing problems in some existing implementations".
    const v = both("RIG");
    expect(v).toBe(
      `attachment; filename="RIG-3-parts.3mf"; filename*=UTF-8''RIG-3-parts.3mf`,
    );
    expect(v.indexOf("filename=")).toBeLessThan(v.indexOf("filename*="));
  });

  it("carries the real name in filename*, and a fold in filename", () => {
    const v = both("Café");
    expect(v).toContain('filename="Cafe-3-parts.3mf"');
    expect(v).toContain("filename*=UTF-8''Caf%C3%A9-3-parts.3mf");
  });

  it("keeps a NAME on both parameters when the name has no ASCII spelling", () => {
    const v = both("ハニカム");
    expect(v).toContain(`filename="${PACK_NAME_FALLBACK}-3-parts.3mf"`);
    expect(v).toContain(
      "filename*=UTF-8''%E3%83%8F%E3%83%8B%E3%82%AB%E3%83%A0-3-parts.3mf",
    );
  });

  it("percent-encodes the four characters encodeURIComponent leaves behind", () => {
    // `'`, `(`, `)` and `*` are NOT in RFC 8187's `attr-char` set, and
    // `encodeURIComponent` leaves all four alone. A strict parser rejects the
    // whole parameter, so the person silently gets the ASCII fallback name --
    // and only for names containing an apostrophe, which is most possessives.
    const v = both("Josh's (v2)");
    const ext = /filename\*=UTF-8''(.*)$/.exec(v)![1];
    expect(ext).not.toMatch(/['()*]/);
    expect(decodeURIComponent(ext)).toBe("Josh's (v2)-3-parts.3mf");
  });

  it("is emittable as an HTTP header on every input", () => {
    // Node's HTTP writer throws on a header value with a character above
    // U+00FF, so this is not cosmetic: without the ASCII fold, every build whose
    // name is not Latin would 500 instead of downloading.
    for (const raw of ["ハニカム", "Кластер", "Hex \u{1F41D}", "Café"]) {
      const v = both(raw);
      expect([...v].every((c) => c.codePointAt(0)! <= 0x7e), raw).toBe(true);
      // And it really does go into a Headers object without throwing.
      expect(() =>
        new Headers({ "Content-Disposition": v }).get("Content-Disposition"),
      ).not.toThrow();
    }
  });

  it("cannot be broken out of by anything resolvePackName lets through", () => {
    // THE END-TO-END PROPERTY. Whatever survives the sanitiser must not be able
    // to close the quoted-string or start a new header field. Held to the whole
    // shape of the value rather than to "it contains no newline": exactly three
    // `"` (the pair around the ASCII filename and nothing else), and an
    // `ext-value` made only of RFC 8187 attr-chars and percent-escapes.
    for (const raw of [
      'a"; filename="evil.exe',
      "a‮b",
      "..\\..\\evil",
      "100%00",
      "'; DROP",
      "x y",
      "a; b=c",
      "\u{1F41D}".repeat(120),
    ]) {
      const r = resolvePackName(raw);
      if (!r.ok) continue;
      const v = both(raw);
      expect(v, raw).toMatch(
        /^attachment; filename="[\x20-\x21\x23-\x7e]*"; filename\*=UTF-8''[!#$&+\-.^_`|~A-Za-z0-9%]*$/,
      );
      expect(v.split('"'), raw).toHaveLength(3);
      expect(v, raw).not.toMatch(/[\r\n]/);
    }
  });
});

describe("determinism", () => {
  it("gives the same answer twice for every shape in this file", () => {
    // The stem reaches the zip entry names and each plate's `Title`, so it is
    // inside the response's identical-bytes promise rather than beside it.
    for (const raw of [
      "TB-1 POWER",
      "Café Cluster",
      "ハニカム",
      "Hex \u{1F41D} rig",
      "../../etc",
      "CON.3mf",
      "\u{1F41D}".repeat(MAX_PACK_NAME_CHARS),
    ]) {
      const s = stem(raw)!;
      expect(s, raw).toBe(stem(raw));
      expect(asciiStem(s), raw).toBe(asciiStem(s));
      const names = { filename: s, ascii: asciiStem(s) };
      expect(contentDisposition(names), raw).toBe(contentDisposition(names));
    }
  });
});
