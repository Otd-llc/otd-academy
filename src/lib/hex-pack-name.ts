// The cluster's own name, on its way into a filename and an HTTP header.
//
// THIS IS USER-AUTHORED TEXT GOING INTO `Content-Disposition`, and it is treated
// as hostile from the first line to the last. It arrives as a query parameter
// from a SEPARATE ORIGIN (the configurator, `bs-cap-hex/src/hex/build-name.ts`),
// so nothing about it is guaranteed by the fact that our own UI usually sends
// it: anyone can type the URL.
//
// FOUR DIFFERENT THINGS want to be safe, and they are not the same thing:
//
//   the HTTP header   a CR or LF ends a header field. A name carrying one could
//                     append `Set-Cookie:` or a second body to the response.
//   the quoted-string `filename="..."` is a quoted-string: a `"` inside it ends
//                     the parameter early and the rest becomes syntax.
//   the filesystem    `\ / : * ? " < > |` are illegal or path-significant on at
//                     least one of Windows / macOS / Linux; `CON`, `NUL`,
//                     `COM1` and friends are DEVICES on Windows, with or without
//                     an extension; a leading dot hides a file on Unix; Windows
//                     silently DROPS trailing dots and spaces, so a name that
//                     ends in one is a name that does not survive the save.
//   the reader        U+202E (right-to-left override) makes `fmt.3mf` display as
//                     `fm3.tmf` -- the classic extension spoof -- and zero-width
//                     characters pad a name invisibly.
//
// REFUSE OR REPAIR, and the split is deliberate rather than uniform:
//
//   REFUSED (a flat 400, like every other malformed field on this route)
//     - any control character, DEL, C1, or a lone surrogate. No name a person
//       typed contains one -- the configurator replaces them with spaces before
//       the field is ever stored -- so a request carrying one is not a mistake to
//       be tidied up, and "repairing" it would hand an attacker a 200 and tell
//       them nothing was noticed.
//     - a name longer than the column that could ever store it. Also a cache
//       key: the response is cached per URL for a day, so an unbounded name is
//       an unbounded number of cache entries.
//
//   REPAIRED (folded, deterministically)
//     - everything else. Somebody who types `TB-1 / POWER` means a slash in
//       their title, not a directory. Refusing their download over it would be
//       refusing to answer a question we can answer perfectly well, and a build
//       name is not a field they can see the rules for.
//
//   FALLBACK
//     - and when the repair leaves nothing usable -- an empty string, or a
//       Windows device name -- the name is `OTD-Hex-Cluster`, which is also what
//       a request with no name at all gets.
//
// DETERMINISTIC throughout: same input, same stem, on every host. The pack
// response is cached per URL and promises identical bytes for identical input,
// and this string reaches the zip entry names and the plate's `Title` metadata,
// so it is inside that promise rather than beside it.

/** What a pack is called when it has no name of its own, or when the name it
 *  had does not survive contact with a filesystem. Deliberately NOT the old
 *  `hex-cluster` prefix: this is a name, and it should read as one. */
export const PACK_NAME_FALLBACK = "OTD-Hex-Cluster";

/** Matches `hexcluster_name_len` (1..120) and the configurator's own
 *  `MAX_BUILD_NAME_CHARS`, in CODE POINTS. A longer name is refused rather than
 *  truncated: it cannot have come from a field that caps itself at 120, and the
 *  refusal is what bounds the number of URLs -- and therefore cache entries --
 *  one build can be spelled as. */
export const MAX_PACK_NAME_CHARS = 120;

/** The longest stem, in UTF-8 BYTES, that may reach a filename.
 *
 *  BYTES, not characters, because that is what the limit is made of: ext4 and
 *  APFS cap one path component at 255 bytes, and a 120-code-point name of
 *  astral characters is 480 of them. Set well under the cap because the stem is
 *  never the whole filename -- `-plate-20-of-20.3mf` adds 19 more inside a
 *  multi-plate zip, and an unzipper writes that into a directory the person
 *  chose. 120 + 19 + a directory leaves room everywhere. */
export const MAX_STEM_BYTES = 120;

/** Invisible characters that change what a filename LOOKS like without changing
 *  what it is.
 *
 *  U+202E and its family reorder the display of the text after them, which is
 *  how `invoice[RLO]fmt.exe` shows up as `invoiceexe.tmf`. The zero-width set
 *  pads a name with characters nobody can see or delete.
 *
 *  Written as an EXPLICIT range list and not as `\p{Cf}`, so the rule does not
 *  move when a Node upgrade brings a newer Unicode table with it -- this string
 *  reaches the bytes of a response we promise are reproducible.
 *
 *  Spelled as `\u` ESCAPES, never as the characters themselves. The same list
 *  written literally is a run of bytes that is invisible in an editor and
 *  invisible in a diff -- so a character silently added to or dropped from it
 *  could not be reviewed. The configurator's own `normaliseBuildName` carries
 *  the same note for the same reason, after exactly that went wrong once. */
const INVISIBLE =
  /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;

/** Characters that are reserved, path-significant, or header-significant.
 *
 *  `\` and `/` are path separators on the two families of filesystem. `:` is a
 *  separator on Windows and an NTFS alternate-data-stream marker
 *  (`name.3mf:evil`), and a legacy separator on classic macOS. `*` and `?` are
 *  glob wildcards Windows refuses outright. `<`, `>` and `|` are shell
 *  redirection and are illegal on Windows. `"` is the one that ends the
 *  `filename="..."` quoted-string early.
 *
 *  `%` is here for a different reason: it is the character that invites a SECOND
 *  decoding pass. `..%2F..` reaches us as literal text, and both output forms
 *  carry it harmlessly (`filename*` re-encodes the `%` itself), but a name is
 *  not prose -- it is a filename -- and a percent sign in one is worth less than
 *  the class of "somebody downstream decoded it once more than we did" bug it
 *  keeps open. */
const RESERVED = /[\\/:*?"<>|%]/g;

/** Leading or trailing characters that make a filename lie about itself.
 *
 *  A leading dot HIDES the file on every Unix, and `.`/`..` are the directory
 *  entries themselves. Windows silently STRIPS trailing dots and spaces, so
 *  `report .` is saved as `report` -- the name we declared and the name on disk
 *  disagree, which is the whole defect class this endpoint has shipped twice.
 *  Hyphens are trimmed with them purely so a name that folded down to
 *  punctuation reads as empty rather than as `---`. */
const EDGE = /^[\s.\-]+|[\s.\-]+$/g;

/** Windows device names. Reserved with OR WITHOUT an extension: `CON`, `CON.3mf`
 *  and `CON.tar.gz` all resolve to the console device, and opening one is not an
 *  error the person gets an explanation for.
 *
 *  `COM0`/`LPT0` are included even though only 1-9 are documented, and the
 *  SUPERSCRIPT digits with them (U+00B9, U+00B2, U+00B3): Windows resolves
 *  `COM` followed by a superscript one to `COM1`. Both are free to cover and
 *  neither is a name anybody loses. */
const DEVICE = /^(?:CON|PRN|AUX|NUL|CONIN\$|CONOUT\$|COM[0-9\u00B9\u00B2\u00B3]|LPT[0-9\u00B9\u00B2\u00B3])$/i;

/** Truncate to a byte budget WITHOUT cutting a character in half.
 *
 *  Iterated over code points (`for...of`), so an astral character -- an emoji,
 *  which build names really do carry -- is either wholly in or wholly out. A
 *  `slice` on UTF-16 units would leave a lone surrogate, which is not
 *  representable in UTF-8 and turns into U+FFFD somewhere downstream. */
function truncateBytes(s: string, max: number): string {
  let out = "";
  let used = 0;
  for (const ch of s) {
    const n = Buffer.byteLength(ch, "utf8");
    if (used + n > max) break;
    out += ch;
    used += n;
  }
  return out;
}

/** Everything that is a repair rather than a refusal, in the one order that
 *  makes it total.
 *
 *  THE ORDER IS LOAD-BEARING. Reserved characters are folded BEFORE the edges
 *  are trimmed, because `../..` only becomes trimmable once the slash is a
 *  hyphen; and the device check runs AFTER the truncation, because truncation
 *  can only ever shorten a stem toward a prefix and `CONTROLLER` cut short is
 *  exactly how a name becomes `CON`. */
function scrub(raw: string): string {
  const stem = truncateBytes(
    raw
      .replace(INVISIBLE, "")
      .replace(RESERVED, "-")
      // Collapsed, not merely trimmed: a name is displayed in one line, and a
      // run of spaces in a filename is a run nobody can see the length of.
      .replace(/\s+/g, " ")
      .trim(),
    MAX_STEM_BYTES,
  ).replace(EDGE, "");

  if (stem === "") return PACK_NAME_FALLBACK;
  // The whole stem, and its first dot-segment: `CON` and `CON.3mf` are the same
  // device, and the second is the spelling somebody reaches by accident.
  if (DEVICE.test(stem) || DEVICE.test(stem.split(".")[0])) {
    return PACK_NAME_FALLBACK;
  }
  return stem;
}

export type PackNameResolution = { ok: true; stem: string } | { ok: false };

/**
 * Validate and fold a build name into a filename stem.
 *
 * `{ ok: false }` is a REFUSAL the route turns into the same flat 400 every
 * other malformed field gets -- no problem code echoed, for the same reason:
 * telling a prober which of its guesses was rejected for which reason is the
 * only thing this endpoint could leak.
 */
export function resolvePackName(raw: string | null | undefined): PackNameResolution {
  // ABSENT IS NOT AN ERROR. Every link written before this parameter existed has
  // no name in it, and those links still have to work.
  if (raw == null || raw === "") return { ok: true, stem: PACK_NAME_FALLBACK };

  // CODE POINTS, so the bound is the one the configurator and the database both
  // state, rather than a UTF-16 unit count that halves for emoji.
  const points = [...raw];
  if (points.length > MAX_PACK_NAME_CHARS) return { ok: false };

  for (const ch of points) {
    const c = ch.codePointAt(0) ?? 0;
    // C0 (which is where CR and LF live -- the header injection), DEL, C1, and
    // any lone surrogate. A surrogate cannot be encoded as UTF-8 at all, so it
    // would become U+FFFD in one output form and a percent-escape hazard in the
    // other; refusing is the only answer that means the same thing everywhere.
    if (c < 0x20 || (c >= 0x7f && c <= 0x9f) || (c >= 0xd800 && c <= 0xdfff)) {
      return { ok: false };
    }
  }

  return { ok: true, stem: scrub(raw) };
}

/** Fold a STEM to printable ASCII, for the `filename=` fallback.
 *
 *  THE STEM, not a whole filename, and the difference is not pedantry. Applied
 *  to `<name>-3-parts.3mf` the fold would eat a non-Latin name and leave
 *  `3-parts.3mf` -- a non-empty string, so no fallback fires, and the download
 *  is called after a count with no subject. Folding the NAME and rebuilding the
 *  filename around it keeps the two halves separable, so an unrepresentable name
 *  becomes `OTD-Hex-Cluster-3-parts.3mf` and still reads as a name.
 *
 *  NFKD FIRST, so an accented letter decomposes to its base plus a combining
 *  mark and the base SURVIVES: `Café` folds to `Cafe`, not to `Caf`. Anything
 *  still outside printable ASCII after that -- the combining marks themselves,
 *  and every script that has no ASCII spelling -- is dropped, which is exactly
 *  the loss `filename*` exists to cover.
 *
 *  THEN SCRUBBED AGAIN, and that second pass is not belt and braces. NFKD
 *  CREATES reserved characters: U+FF0F FULLWIDTH SOLIDUS decomposes to a real
 *  `/`, and U+2026 HORIZONTAL ELLIPSIS decomposes to `...`. A fold that ran
 *  after the sanitiser and not through it would put a path separator into the
 *  header on input the sanitiser had already passed. */
export function asciiStem(stem: string): string {
  return scrub(stem.normalize("NFKD").replace(/[^\x20-\x7e]/g, ""));
}

/** Percent-encode for an RFC 8187 `ext-value`.
 *
 *  `encodeURIComponent` is close but not correct here: it leaves `'`, `(`, `)`
 *  and `*` unescaped, and none of those are in RFC 8187's `attr-char` set, so a
 *  name containing one produces a parameter a strict parser rejects. It also
 *  escapes several characters that ARE attr-char, which is merely verbose and
 *  entirely safe. */
function extValue(s: string): string {
  return encodeURIComponent(s).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/**
 * The whole `Content-Disposition` value, both spellings of the name.
 *
 * TWO PARAMETERS, NOT ONE, and not an either/or. `filename*=UTF-8''...`
 * (RFC 8187, which obsoleted RFC 5987) carries the real name including every
 * non-ASCII character; `filename="..."` carries an ASCII fold for anything that
 * does not implement it. RFC 6266: "When both 'filename' and 'filename*' are
 * present ... recipients SHOULD pick 'filename*' and ignore 'filename'", and
 * `filename` "should occur first, due to parsing problems in some existing
 * implementations" -- which is the order written below.
 *
 * The ASCII half is also what keeps the header EMITTABLE. Node's HTTP writer
 * refuses a header value with a character above U+00FF, so a header carrying the
 * raw name would not be a mangled download -- it would be a 500 on every build
 * whose name is not Latin. `filename*` is pure ASCII by construction.
 *
 * BOTH ARE PASSED IN, as a named pair rather than two positional strings. The
 * caller builds each from the same filename template with a different stem, so
 * `RIG-3-parts.3mf` and `OTD-Hex-Cluster-3-parts.3mf` describe the same box; two
 * bare string arguments would be silently swappable, and the swap would put the
 * Unicode name in the parameter that cannot carry it.
 */
export function contentDisposition(names: {
  filename: string;
  ascii: string;
}): string {
  return `attachment; filename="${names.ascii}"; filename*=UTF-8''${extValue(names.filename)}`;
}
