# Hex v2 upload dry run (launch item 4.9), 2026-09-25

**Status: sizes recorded. NOT done:** the README does not carry the 2.6 safety
text, nor any placeholder for it (defect 2), and the uploader cannot run
against the real allow-list as it stands (defect 1).

## How it was run

- Branch `launch/hex-v2-academy`, after merging 5.4 (`5fec1854`).
- Inputs, read-only: the build manifest at `hex-cluster/build/printables/`
  (built 2026-09-21, 297 parts, 0 failures) and the 4.6 allow-list
  `hex-launch-tables/build/release-tables/2026-10-01/printables-allowlist.json`
  (870 rows = 290 parts x 3 formats, all `cc-by`).
- Default DRY-RUN mode with `PRINTABLES_EMIT` set to a scratch dir. No `.env.local` was present.
  Every `R2_*`, `PROD_*` and `NEXT_PUBLIC_R2_*` variable was removed. The dry run needs:
  - `R2_ENABLED=true` and `R2_BUCKET=<any name>`, because the uploader refuses without them even in a dry run.
  - Placeholder `DATABASE_URL`, `DIRECT_URL`, `AUTH_*` and `ALLOWED_EMAILS` values, because `src/env.ts` validates them on import.

  None of these is a credential. `R2_ENDPOINT=http://127.0.0.1:9` was also set,
  so any stray S3 call would hit a local discard port and never Cloudflare. The
  code confirms a dry run returns before any `r2.send`, and the 5.4 test proves
  the same with a throwing client.

## Defect 1: the uploader refuses the real 4.6 allow-list

Run as specified, it exits 1 before planning anything:
`Refusing: the upload does not match the allow-list (21 problem(s))`. The
problems are the 7 withheld parts x 3 formats. The build manifest still carries
the withheld parts. The generator leaves them off the allow-list, but it does not
*name* them there: `emit_allowlist` writes only `format/release/files`, and the
withheld list goes to `report.json` alone. The uploader's own withholding knows
only `TB-1-POWER`. The refusal is safe, since nothing withheld can ship, but it
blocks 10.3.

**Fix needed (not made here):** a contract change across two repos, and one of
them carries a hash-pinned `release-tables.lock.json`. The generator emits an
optional `withheld: [{part, reason}]` in the allow-list, and the uploader drops
exactly those parts. The uploader must refuse a withheld part that also has
file rows. An unlisted part that is not withheld must still refuse.

**Workaround for the measurement only:** `PRINTABLES_DIR` pointed at a scratch
dir holding a copy of the manifest filtered to the allow-list's 290 parts, plus
read-only junctions to the real `3mf/`, `stl/` and `step/` folders. The bytes
are the release's own. The "no withheld part" check below therefore tests that
filter plus the uploader, not the uploader's withholding.

## Numbers (release 2026-10-01, 290 parts)

| | files | bytes |
|---|---:|---:|
| 3MF | 290 | 19,200,212 |
| STL | 290 | 94,029,160 |
| STEP | 290 | 110,131,258 |
| LICENSE.txt | 1 | 903 |
| set zip `sets/hex-cluster.zip` | 1 | 18,542,887 |
| **total** | **872** | **241,904,420 (241.9 MB)** |

- **Set zip: 18,542,887 B = 18.5 MB (17.7 MiB).** It holds 292 entries: 290 `.3mf`, README.txt and LICENSE.txt, with no `.stl`, `.step` or `manifest.json`. Uncompressed it is 19,210,576 B. The `/hex` placeholder "~19.5 MB" is now "~18.5 MB" (`HEX_V2_SET` in `src/lib/hex-v2-page.ts`, still `sizeMeasured: false`, because the README inside the zip will change before publish).
- **Largest file:** the set zip. The largest single part file is `stl/hex-main-cover-cable.stl` at 2,751,584 B.
- **Withheld parts in the emit dir or the zip:** none. The 7 parts are pvc-wedge, hex-cover-handle, hex-acc-saddle, hex-acc-saddle-half, hex-acc-saddle-one, hex-acc-probe and hex-acc-trellis. None is named in the README either.
- **`manifest.json` anywhere in the output:** none.
- **Determinism:** two runs gave the same 872 paths, and every file was byte-identical. The zip's sha256 was `d70668ee55037de9131b649753e0ab8ea8a1904c595f370747b196bda8070878` both times.

## Defect 2: the README has no 2.6 safety text and no placeholder for it

The README (330 lines) has no safety section at all. It says nothing about magnets, heat, UV,
wetted paths, load ratings or potable use. It is silence, not a marked slot. The
`--write` placeholder refusal covers only LICENSE.txt, which does carry
`[OWNER-WORDING: disclaimer ...]`. So once the owner fills the LICENSE line, a
`--write` would publish an immutable README with no safety text. The README needs
its own OWNER-WORDING slot covered by the same refusal.

## Smaller findings in the README

- It points to the configurator at `https://demo.onethousanddrones.com/hex`. Decision 1.10 says `hex.onethousanddrones.com`.
- "with the two exceptions below" refers to a support section that no longer
  renders. No `NEEDS_SUPPORT_NAMES` part is in the v2 set, so the sentence
  dangles. This belongs to item 4.7.
