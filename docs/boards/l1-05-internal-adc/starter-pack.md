# KiCad starter pack — l1-05-internal-adc

What the learner downloads at the top of the lesson: a KiCad 10 project with
every BOM part placed, fielded and footprint-assigned, and the schematic
deliberately **unwired**. Drawing the nets is the lesson.

Generated from `l1-05-internal-adc@v1` by the BOM-to-KiCad export (#13):

```powershell
pnpm exec tsx scripts/assign-l105-kicad.ts                       # once
pnpm exec tsx scripts/seed-l105-trimpot-footprint.ts --write     # once
pnpm exec tsx scripts/gen-kicad-starter.ts l1-05-internal-adc v1 --out l1-05.zip
pnpm exec tsx scripts/verify-kicad-starter.ts l1-05.zip --layers 4
```

The generator and verifier are read-only and land in
`author/starter-l1-02-espnow-link` (#395). Publishing the starter to the lesson
is a production write and belongs to the owner.

## RV1 needed a footprint that does not exist

The trimpot is this board's one new part, and it had no `kicadSymbol`, no
`kicadFootprint` and no uploaded asset, so the export auto-stubbed it. For a
three-terminal part that is not a near miss: `buildStubFootprint` only draws
pads for a **two**-terminal part, so RV1 shipped as an outline with **no pads at
all**.

The symbol was easy. `Device:R_Potentiometer_Trim` is a 3-pin trimmer whose
**pin 2 is the wiper**, which is exactly what design.md §7 captured for the
`[S]` audit ("RV1 3362P terminal 2 = wiper").

The footprint had no answer in the standard library. KiCad 10 ships no 3362 land
pattern at all, and every 3362-adjacent footprint in `Potentiometer_THT` is both
a different body and, decisively, the **triangular** 0.1 x 0.2 inch pin pattern:

| KiCad footprint | Body | Pin pattern |
| --- | --- | --- |
| `Potentiometer_Bourns_3386P_Vertical` | 9.53 mm | triangular, pads at (0,0) (2.54,-2.54) (0,-5.08) |
| `Potentiometer_Bourns_3266W_Vertical` | 4.83 mm | in-line 2.54 |
| `Potentiometer_Bourns_3296W_Vertical` | 9.53 mm multiturn | in-line 2.54 |
| `Potentiometer_Vishay_T7-YA_Single_Vertical` | 6 mm | triangular |

The 3362P is 6.60 x 6.99 mm with all three pins **in line on 2.54 mm centres**,
which the datasheet states outright ("ALL PINS IN-LINE ON 2.54 (.100) CENTER",
Bourns 3362 REV 06/20). Nothing in the table is that. Pointing RV1 at the
nearest one would ship a land pattern the part does not fit.

So the footprint is hand-authored and lives in the repo, reviewable in a diff,
at `docs/boards/l1-05-internal-adc/kicad/3362P-1-103LF.kicad_mod`.
`scripts/seed-l105-trimpot-footprint.ts` uploads it and points a FOOTPRINT
PartAsset at it, with structural guards (3 THT pads, all at y = 0, x = 0 / 2.54
/ 5.08, 0.8 mm drill) so a mangled file cannot silently become a part's
footprint.

**What is datasheet-exact:**

- 3 pads in line, 2.54 mm pitch.
- 0.8 mm drill / 1.44 mm pad, for the datasheet's 0.46 +/- 0.03 mm leads. These
  are the same numbers KiCad's own Bourns trimpot footprints use for the
  identical lead spec.
- Body 6.60 x 6.99 mm, on the F.Fab and courtyard rectangles.

**What is inferred, and is the one thing to check against a real part:** where
the body sits relative to the pin row. The 3362P drawing prints two offsets,
2.54 mm and 3.53 mm, which sum to 6.07 mm rather than the 6.99 mm body depth.
The footprint takes the conservative reading: pin row 2.54 mm from the near
edge, body running the full 6.99 mm, so the courtyard is never too small. Worst
case the silk is ~0.9 mm generous on one side. Nothing electrical depends on it.

The asset is created **UNVERIFIED** on purpose. Verifying it means holding a real
3362P against a 1:1 printout, which is the owner's `[S]` tick.

`kicad-cli fp upgrade` parses the file and reports "Footprint library was not
updated", so it is valid KiCad 10 as written, and `kicad-cli fp export svg`
plots it.

## What the export produced

| | |
| --- | --- |
| BOM parts | 19 lines, 31 placed designators |
| Bundled footprints | 18 (`libs/l1-05-internal-adc.pretty/`) |
| Bundled 3D models | 17 (`libs/3dmodels/`) |
| Stubbed parts | **0** (1 before the assignment, and it had no pads) |
| Stackup | 4-layer (sig / GND / GND / sig), ENIG |
| Zip | 7,342,577 bytes |

Asset coverage, from the in-zip `EXPORT_REPORT.md`:

| Asset | Verified | Unverified | Referenced | Stubbed | Missing |
| --- | ---: | ---: | ---: | ---: | ---: |
| Symbol | 17 | 0 | 2 | 0 | 0 |
| Footprint | 16 | 2 | 1 | 0 | 0 |
| 3D model | 16 | 1 | 0 | 0 | 2 |

The two `unverified` footprints are RV1's hand-authored trimpot and U1's
corrected ESP32-S3-WROOM-1 land pattern, the latter being the same asset the
L1.01 board was built from. RV1 has no 3D model, which is why the bundle carries
17 models for 18 footprints.

## Corrections carried

| Correction | Result |
| --- | --- |
| 3D model paths under `libs/3dmodels/`, not `3dmodels/` | PASS |
| Every claimed 3D model actually bundled | PASS |
| refdes silkscreen normalised to 1 / 1 / 0.15 mm (all 18 bundled footprints) | PASS |
| Via dropdown leads with the 0.6 mm / 0.3 mm fab-floor preset | PASS |
| VBUS (plus +3V3, +5V, GND) assigned to the Power net class | PASS |
| No keepout zone on any two-terminal footprint | PASS |
| Solder-mask bridges allowed on the J1 USB-C footprint | PASS |
| Every symbol pin on the 1.27 mm connection grid | PASS |
| Board finish ENIG, 4-layer stackup, unwired schematic, zero stubs | PASS |

The U1 footprint's keepout is the antenna keep-out and is meant to be there.

Unlike L1.03 and L1.04, this board carries **no supply rail beyond the default
four**: AIN is a signal, not a rail, so the Power class needs no board-specific
addition here.

## ERC / DRC

Run with KiCad 10.0.3 (`kicad-cli`) on the unzipped project.

**ERC — 170 violations, all expected:** 168 `pin_not_connected` + 2
`power_pin_not_driven`. That is the signature of an unwired schematic. No
library, symbol-resolution or off-grid violations: all 19 parts resolved,
including the new trimpot symbol.

**DRC — 1 violation, expected:** `invalid_outline` ("no edges found on Edge.Cuts
layer"). The learner draws the outline. **0 unconnected pads, 0 footprint
errors**, which includes the hand-authored footprint.

Stock-WROOM DRC noise fires against a routed board, not the starter, so it does
not appear here. Expect it at LAYOUT and teach the same Exclude.

## What is NOT verified here, and by whom

- **The trimpot land pattern against a real 3362P.** Datasheet-exact on pads and
  body size, conservative on the body-to-pin-row offset, and shipped
  `UNVERIFIED` for exactly that reason. Print it 1:1 and drop a part on it. This
  is the sharpest item on the list, because it is the one footprint in the four
  starters that nobody else has ever built.
- **Audit 6 (footprint ↔ symbol ↔ pinout), `[S]`**, and RK10 with it. Still owed
  per `validation-log.md`, still the owner's tick.
- **RV1's wiper orientation on the board.** The symbol's pin 2 is the wiper and
  the footprint's pad 2 is the centre pin, which is consistent, but which
  physical end is terminal 1 depends on how the learner orients the part. The
  footprint marks pin 1 with a silk tick and an F.Fab "1".
- **Does it open in the KiCad GUI.** `kicad-cli` parses, plots and ERC/DRCs the
  files; it does not prove the canvas renders as intended.
- **Anything needing the physical board**, including whether the trimpot screw
  is reachable once the board is populated. Design.md RK12 already asks for a
  screwdriver-access keep-out at layout.

## Replaying this on production

Both scripts are idempotent and the owner runs them against production:

```powershell
pnpm db:prod scripts/assign-l105-kicad.ts --yes
pnpm db:prod scripts/seed-l105-trimpot-footprint.ts --yes -- --write
```

The footprint file itself was uploaded to R2 under a **new** key, so nothing was
overwritten; the production run mints its own key and points the production
`PartAsset` row at it.
