# Hex downloads: the cluster's name, a package thumbnail, and the core metadata

**Status:** implemented on `feat/hex-download-identity`, three commits, one per item.

Three additions to the pack endpoint (`src/app/api/printable-pack/route.ts`), which
already ships plated 3MF downloads (`docs/plans/2026-08-14-hex-download-plates-design.md`).
None of them changes what is in the box; all three change what the box says it is.

---

## 1. The download is named after the cluster

A pack was `hex-cluster-53-parts.zip` whoever asked for it and whatever they had built.
The configurator has held the build's name since round 13 — `readBuildName()` in
`bs-cap-hex/src/hex/build-name.ts`, ALL-CAPS by default, `UNTITLED BUILD` when nothing
is typed, capped at 120 code points to match the academy's `hexcluster_name_len`.

It now travels as `&name=…`, and becomes the stem of every filename the response
produces. Absent, or sanitised down to nothing: **`OTD-Hex-Cluster`**.

### Why a query parameter and not a header — the cache-key decision

**The name must be in the cache key, and it is, by being part of the URL.**

The response is `public, max-age=86400` keyed on the URL and nothing else. A name
carried in a header would be invisible to that cache, so the first person to download a
given build would decide what every later person's file was called for the next 24
hours.

And it is not merely a label. The stem reaches:

- both `Content-Disposition` parameters,
- the zip entry name of every plate,
- the plate manifest in `README.txt`,
- each plate's `<metadata name="Title">`.

So two people with the same parts and different names are two different **bodies**. They
must not share a cache entry, and with the name in the query they cannot. No `Vary` is
needed for the same reason: nothing in this response is read from a request header.

### The sanitiser, and what each rule stops

`src/lib/hex-pack-name.ts`. Validated inside `resolvePack` with every other field, so
the route never touches the raw string and a refusal costs no R2 read.

| Rule | Verdict | What it stops |
| --- | --- | --- |
| C0 (incl. CR, LF, NUL, TAB), DEL, C1 | **refuse** | **Header injection.** CR/LF terminate a header field; a name carrying one could append `Set-Cookie:` or a second body. |
| Lone surrogate | **refuse** | Not encodable as UTF-8: it would become U+FFFD in one output form and a percent-escape hazard in the other. Refusing is the only answer that means the same thing everywhere. |
| > 120 code points | **refuse** | Longer than the column and the configurator both cap at, so not from our UI. Also bounds the number of URLs — and therefore cache entries — one build can be spelled as. |
| `\ / :` | fold to `-` | Path separators on both filesystem families; `:` is also the NTFS alternate-data-stream marker (`name.3mf:evil`) and the classic-macOS separator. |
| `* ? < > \|` | fold to `-` | Illegal on Windows; glob wildcards and shell redirection. |
| `"` | fold to `-` | Would close the `filename="…"` quoted-string early and turn the rest of the name into header syntax. |
| `%` | fold to `-` | The character that invites a **second** decoding pass. Both output forms carry it harmlessly, but a filename is not prose and this closes the "somebody downstream decoded it once more than we did" class. |
| U+200B–200F, 202A–202E, 2060–2064, 2066–2069, FEFF | strip | **RLO extension spoofing** — `invoice‮fmt.exe` displays as `invoiceexe.tmf` — and invisible padding nobody can see or delete. Written as `\u` escapes, never as the characters, so the list is reviewable in a diff. |
| leading `.` | strip | Hides the file on every Unix; `.` and `..` are the directory entries themselves. |
| trailing `.` and space | strip | **Windows silently drops them**, so the name we declared and the name on disk disagree — the exact defect class this endpoint has shipped twice. |
| `CON PRN AUX NUL COM0-9 LPT0-9 CONIN$ CONOUT$`, case-insensitive, with or without an extension, superscript digits included | fall back | Windows device names. Opening one is not an error anybody gets an explanation for. `CONTROLLER` and `COMPACT` are **kept** — the check is on the whole stem and its first dot-segment, never a prefix match. |
| > 120 UTF-8 **bytes** after all of the above | truncate, on a code-point boundary | ext4 and APFS cap a path component at 255 **bytes**; 120 astral code points is 480. Cutting on UTF-16 units would leave a lone surrogate mid-filename. The device check re-runs afterwards, because `CONTROLLER` truncated is how a safe name becomes `CON`. |
| empty result | fall back | |

**Refuse or repair is a deliberate split, not a uniform policy.** A control character is
refused because no name a person typed contains one — the configurator replaces the whole
C0/C1 range with spaces before the field is stored — so "repairing" it would hand an
attacker a 200 and tell them nothing was noticed. A slash is repaired because somebody
who types `TB-1 / POWER` means a slash in their title, not a directory, and refusing
their download over it would be refusing a question we can answer.

A refusal is the same flat `400 Bad request` every other malformed field gets, with no
problem code echoed — the existing one-status rule, unchanged.

### Both spellings of the name

```
Content-Disposition: attachment; filename="OTD-Hex-Cluster-3-parts.3mf";
                     filename*=UTF-8''%E3%83%8F%E3%83%8B%E3%82%AB%E3%83%A0-3-parts.3mf
```

- `filename*=UTF-8''…` — **RFC 8187** (which obsoletes RFC 5987) carries the real name.
  `encodeURIComponent` is *not* sufficient: it leaves `'`, `(`, `)` and `*` unescaped and
  none of the four is in RFC 8187's `attr-char` set, so a strict parser would reject the
  whole parameter — silently, and only for names containing an apostrophe.
- `filename="…"` — an NFKD fold, for anything that does not implement `filename*`.
- **`filename` first**, per RFC 6266: recipients "SHOULD pick `filename*` and ignore
  `filename`", and `filename` "should occur first, due to parsing problems in some
  existing implementations".

Two subtleties the tests pin:

- **The fold runs on the STEM, then back through the sanitiser.** NFKD *creates* reserved
  characters: U+FF0F FULLWIDTH SOLIDUS decomposes to a real `/`, U+2026 HORIZONTAL
  ELLIPSIS to `...`, and fullwidth `ＣＯＮ` to the device name. A fold applied after the
  sanitiser rather than through it would inject a path separator into the header on input
  the sanitiser had already passed.
- **Folding the stem rather than the whole filename** is what keeps the count with its
  subject. `ハニカム-3-parts.3mf` folded whole leaves the non-empty `3-parts.3mf` — no
  fallback fires and the download is named after a number. Folded per stem it is
  `OTD-Hex-Cluster-3-parts.3mf`.

The ASCII half is also what keeps the header **emittable**: Node's HTTP writer throws on
a header value above U+00FF, so without it every build with a non-Latin name would 500.

### The inner plate names, and why

`plates/plate-1-of-3.3mf` → `plates/<stem>-plate-1-of-3.3mf`.

**The plate is the file that gets dragged out of the zip.** That is where it loses the
README, the folder and every other clue about which build it belonged to — the same
argument that already puts `LicenseTerms` and `Description` *inside* the plate rather
than only beside it. Two builds' `plate-1-of-3.3mf` in one Downloads folder is a
collision and a mystery.

The `-plate-N-of-M` ordinal stays **after** the stem, so a directory listing still sorts
one build's plates together and in order. Leading with the ordinal would interleave two
builds extracted into the same folder.

One rule, no branch: an unnamed build's plates are `OTD-Hex-Cluster-plate-1-of-3.3mf`,
which is exactly as informative as the old bare prefix was.

`README.txt`'s manifest is written through the same `platePath` helper as the zip entry,
which is what makes the two checkable rather than merely intended. **One exception to
that module's pure-ASCII rule**: those filenames are printed verbatim, non-ASCII
included, because a filename in a manifest is a citation of a zip entry sitting beside
it, and folding it would produce a README naming a file the archive does not contain.

### What is NOT changed

The **count** stays in the filename. Naming the file purely after the cluster would read
better and would throw away the one property this endpoint has broken twice: the number
on the box says what is in the box. The name goes in front of it, not instead of it.

---

## 2. A package thumbnail

3MF carries a package thumbnail through the OPC relationship type
`http://schemas.openxmlformats.org/package/2006/relationships/metadata/thumbnail`, with
the image at `/Metadata/thumbnail.png`. **Core spec, not vendor** — which is the whole
reason it is worth carrying where printer and process settings are not. Explorer, Finder,
a model browser and most slicers' open dialogs read it.

It is a **top-down plan of the actual plate**: the bed outline, and each part's footprint
at its packed position, drawn from the `Placement` data the packer already produces
(`x`, `y`, `box.dx`, `box.dy`). A file that shows what is on it, before anyone opens a
slicer.

### The measurement that chose the encoder

`@vercel/og` is not a direct dependency here; the equivalent is `next/og`, which this
repo already uses for every opengraph card and which resolves to
`next/dist/compiled/@vercel/og`. Both were built and measured on the same 14-placement
plate on a 220 mm bed, in this repo, on Node v24.5.0:

| | bytes | cold call | warm call | deterministic | runtime weight |
| --- | ---: | ---: | ---: | --- | --- |
| `next/og` (satori + resvg) | 2,721 | 1,142.8 ms | 11.87 ms | yes | `resvg.wasm` 1,378,357 B + `yoga.wasm` 71,736 B |
| hand-rolled, `node:zlib` | **496** | **3.2 ms** | **1.05 ms** | yes | none |

**5.5× smaller, 357× faster cold, 11× faster warm, and 1.45 MB of WASM not instantiated
in a serverless function.** The one axis a general-purpose vector rasteriser would win on
— anti-aliased curves — does not arise: this is a diagram of axis-aligned rectangles.

Both are deterministic, so that was not the deciding factor; but it is a materially
easier property to *keep* over ~200 lines of our own code than over a rasteriser we would
be trusting to stay bit-stable across versions, for a response that promises identical
bytes.

A second measurement chose the scanline filter, and reversed the obvious answer:

| filter | strategy | level | IDAT |
| --- | --- | ---: | ---: |
| **None** | default | **9** | **340 B** |
| None | default | 6 | 358 B |
| None | RLE | 9 | 1,430 B |
| Up | default | 9 | 374 B |
| Up | RLE | 9 | 487 B |

Filter 2 (Up) is the textbook choice for horizontal bands and is **worse** here: deflate's
32 KB window spans a hundred-odd 257-byte rows, so the match finder already encodes "this
row repeats the last" as one long back-reference, and the Up filter destroys the
byte-identity those matches are made of. The simpler code is also the smaller output.

### How determinism is held

- **No clock, no randomness.** PNG's optional `tIME` chunk is deliberately not written —
  a test asserts its absence.
- **Only `+ - * /`, `Math.round/floor/min/max`.** All exactly specified by IEEE 754 and
  ECMA-262. No transcendental (`sin`, `pow`, `exp`): those are explicitly *not* required
  to be correctly rounded and are where a "floating-point path that varies by platform"
  actually lives.
- **The deflate options are pinned, not defaulted** (`level`, `memLevel`, `windowBits`,
  `strategy`), so an upstream change to a default cannot silently change our bytes.

Verified by generating twice and comparing, at three levels: the PNG alone, the plate,
and the whole HTTP response.

### Package registration

All three or none — an unregistered `Metadata/thumbnail.png` is an orphan that makes the
file bigger and shows nobody anything:

1. the entry itself, stamped `ZIP_EPOCH` like every other entry, with an explicit
   `Metadata/` directory entry so its timestamp is fixed too;
2. `<Default Extension="png" ContentType="image/png" />` in `[Content_Types].xml` —
   without it, an entry with an undeclared extension makes the whole package
   non-conforming;
3. a second `<Relationship>` in `_rels/.rels`. **In `_rels/.rels`, not in
   `3D/_rels/3dmodel.model.rels`** — in OPC those are different things: the first is the
   *package* thumbnail, the second would be a thumbnail *of that part*.

The 3D-model relationship keeps its id and its place, so a reader that does not know the
thumbnail type sees exactly the package it saw before.

The structural test that pinned the package to the reference plate's three entries now
pins four, deliberately, and stays closed — the failure it exists to catch is a file
appearing without either declaration that makes it legal.

---

## 3. The core metadata

`hex-3mf.ts` already wrote `Application`, `Title` and `LicenseTerms`. The 3MF core
specification defines a **fixed set** of metadata names for `<model>` — Table 3-1 of
*3MF Core Specification* (3MFConsortium/spec_core), which also states: "Metadata in 3MF
Documents without a namespace name MUST be restricted to names and values defined by this
specification."

The permitted set, verbatim from that table:

`Title` · `Designer` · `Description` · `Copyright` · `LicenseTerms` · `Rating` ·
`CreationDate` · `ModificationDate` · `Application`

What we now write, and why it is truthful:

| Name | Value | Why |
| --- | --- | --- |
| `Application` | `One Thousand Drones -- Hex Cluster` | unchanged |
| `Title` | `<build name> -- plate N of M` | now carries the build's own name, from the same stem the filename uses |
| `Designer` | `One Thousand Drones, LLC` | who designed the parts |
| `Description` | the support + orientation notes | unchanged, still conditional |
| `Copyright` | `Copyright One Thousand Drones, LLC. Licensed CC BY 4.0.` | CC BY is a copyright licence, not a waiver; the holder is stated in `hex-spec.ts` |
| `LicenseTerms` | the canonical CC BY attribution line | unchanged |
| `CreationDate` | the **release date** (`2026-08-03`) | see below |
| `ModificationDate` | the same | the document is assembled and never modified afterwards |

`Rating` is omitted: there is nothing truthful to put in it, and an empty `<metadata>` is
a claim that the value is blank rather than absent.

**`CreationDate` is the release date, and that is the only honest deterministic answer.**
The document is a derivative assembled on demand from an immutable published release. A
wall clock would break the identical-bytes promise from inside the file; the DOS epoch the
zip entries carry would be a lie. The release date is a real date, it describes when the
geometry in this file was created, it is already in the URL (so already in the cache key),
and it is already validated as `^\d{4}-\d{2}-\d{2}$` — a well-formed `xs:date`.

No `type` attribute is written. The spec permits one, the default is `xs:string`, the
reference plate carries none on any metadata element, and the value is an unambiguous ISO
date either way.

---

## Verification

- `pnpm tsc --noEmit`, `pnpm test`, `pnpm lint` — see the branch's commits.
- The endpoint exercised live against the real R2 release for: an ASCII name, a non-ASCII
  name, an empty name, a hostile name, and no name at all.
- Determinism checked by fetching the same URL twice and comparing bytes, thumbnail
  included.
- Mutation-tested with control rows asserting the collected test count, so a harness that
  collects nothing cannot report a clean sweep.

**Not verified, and worth doing:** opening one of these files in Creality Print V7.2.1 to
confirm the thumbnail surfaces and the added metadata is ignored gracefully. The package
is structurally conformant and the model part is byte-unchanged apart from the metadata
block, so the risk is low; but the design's own rule is that a slicer is the acceptance
test, and no slicer was available in this session.
