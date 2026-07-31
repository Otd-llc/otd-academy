# KiCad starter pack — l1-02-espnow-link

What the learner downloads at the top of the lesson: a KiCad 10 project with
every BOM part placed, fielded and footprint-assigned, and the schematic
deliberately **unwired**. Drawing the nets is the lesson.

Generated from `l1-02-espnow-link@v1` by the BOM-to-KiCad export (#13):

```powershell
pnpm exec tsx scripts/gen-kicad-starter.ts l1-02-espnow-link v1 --out l1-02.zip
pnpm exec tsx scripts/verify-kicad-starter.ts l1-02.zip --layers 4
```

The generator is read-only. It calls the same `buildKicadExportZip` the
`exportKicad` server action calls, so what is checked below is byte-for-byte
what the action would put in R2. **Publishing the starter to the learner is a
separate, production step and belongs to the owner** (see *Handing it to a
learner*).

## What the export produced

| | |
| --- | --- |
| BOM parts | 17 lines, 25 placed designators |
| Bundled footprints | 16 (`libs/l1-02-espnow-link.pretty/`) |
| Bundled 3D models | 16 (`libs/3dmodels/`) |
| Stubbed parts | **0** |
| Stackup | 4-layer (sig / GND / GND / sig), ENIG |
| Zip | 7,182,484 bytes |

Asset coverage, from the in-zip `EXPORT_REPORT.md`:

| Asset | Verified | Unverified | Referenced | Stubbed | Missing |
| --- | ---: | ---: | ---: | ---: | ---: |
| Symbol | 16 | 0 | 1 | 0 | 0 |
| Footprint | 15 | 1 | 1 | 0 | 0 |
| 3D model | 15 | 1 | 0 | 0 | 1 |

The one `referenced` line is **J2** (Sullins PRPC040SAAN-RC breakaway header):
no curated asset, so the project points at KiCad's stock
`Connector_Generic:Conn_01x22` / `PinHeader_1x22_P2.54mm_Vertical` and the
learner's own libraries resolve it, 3D model included. The one `unverified`
footprint is **U1**, the corrected ESP32-S3-WROOM-1 land pattern; it is the same
asset the L1.01 board was built from. This matches the L1.01 starter's coverage
exactly, because L1.02 reuses the L1.01 core verbatim.

## Corrections carried

Every fix the L1.01 starter had to be taught, re-checked on this zip by
`scripts/verify-kicad-starter.ts`:

| Correction | Result |
| --- | --- |
| 3D model paths under `libs/3dmodels/`, not `3dmodels/` | PASS |
| Every claimed 3D model actually bundled | PASS |
| refdes silkscreen normalised to 1 / 1 / 0.15 mm (all 16 bundled footprints) | PASS |
| Via dropdown leads with the 0.6 mm / 0.3 mm fab-floor preset | PASS |
| VBUS (plus +3V3, +5V, GND) assigned to the Power net class | PASS |
| No keepout zone on the C1 decoupling-cap footprint | PASS |
| Solder-mask bridges allowed on the J1 USB-C footprint | PASS |
| Board finish ENIG | PASS |
| 4-layer stackup present in the `.kicad_pcb` | PASS |
| Schematic unwired by design (no power ports, no wires) | PASS |
| No part fell back to an auto-generated stub | PASS |

## ERC / DRC

Run with KiCad 10.0.3 (`kicad-cli`) on the unzipped project.

**ERC — 115 violations, all expected:** 113 `pin_not_connected` plus 2
`power_pin_not_driven`. That is the signature of an unwired schematic, which is
what the starter is. Nothing structural: zero library, symbol or footprint-link
errors, so every symbol resolved and every footprint reference is valid.

**DRC — 1 violation, expected:** `invalid_outline` ("no edges found on Edge.Cuts
layer"). The learner draws the board outline. **0 unconnected pads, 0 footprint
errors.** Identical to the L1.01 starter's own result.

The stock-WROOM DRC noise the L1.01 lesson teaches the learner to *Exclude*
(KiCad's `RF_Module` library footprint disagreeing with our corrected U1 land
pattern) does not appear here, because it fires against a routed board, not
against the starter. Expect it at the LAYOUT stage on this board too, and teach
the same Exclude.

## What is NOT verified here, and by whom

- **Audit 6 (footprint ↔ symbol ↔ pinout), `[S]`.** Still owed, per
  `validation-log.md`. No new symbol or footprint was chosen for this board:
  every part is a curated L1.01 asset or the stock header. That narrows the
  audit, it does not close it. The tick stays the owner's.
- **Does it open in the KiCad GUI.** `kicad-cli` parses and ERC/DRCs the files;
  it does not prove the canvas renders as intended. Open the project once.
- **Anything needing the physical board.** Pad-to-part fit, silkscreen
  legibility at 1 mm, and the U1 land pattern against a real module can only be
  confirmed on a fabricated board.

## Handing it to a learner

The lesson's download resolves the **published revision's** `BOM_EXPORT`
artifact (`src/lib/actions/learner-resources.ts`). Creating that artifact is a
production write behind `requireAdmin()`, and the action cannot be driven from a
script, so it is the owner's step: **KiCad export** on
`/projects/l1-02-espnow-link/v1`, then publish the revision.

Nothing in this packet writes to production, and nothing here publishes the
board.
