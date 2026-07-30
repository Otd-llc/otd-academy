# KiCad starter pack — l1-03-ws2812-node

What the learner downloads at the top of the lesson: a KiCad 10 project with
every BOM part placed, fielded and footprint-assigned, and the schematic
deliberately **unwired**. Drawing the nets is the lesson.

Generated from `l1-03-ws2812-node@v1` by the BOM-to-KiCad export (#13):

```powershell
pnpm exec tsx scripts/gen-kicad-starter.ts l1-03-ws2812-node v1 --out l1-03.zip
pnpm exec tsx scripts/verify-kicad-starter.ts l1-03.zip --layers 4 --power-nets 5V_EXT
```

Both scripts are read-only and land in `author/starter-l1-02-espnow-link` (#395).
Publishing the starter to the lesson is a production write and belongs to the
owner.

## What the export produced

| | |
| --- | --- |
| BOM parts | 25 lines, 37 placed designators |
| Bundled footprints | 23 (`libs/l1-03-ws2812-node.pretty/`) |
| Bundled 3D models | 23 (`libs/3dmodels/`) |
| Stubbed parts | **0** |
| Stackup | 4-layer (sig / GND / GND / sig), ENIG |
| Zip | 7,957,597 bytes |

Asset coverage, from the in-zip `EXPORT_REPORT.md`:

| Asset | Verified | Unverified | Referenced | Stubbed | Missing |
| --- | ---: | ---: | ---: | ---: | ---: |
| Symbol | 23 | 0 | 2 | 0 | 0 |
| Footprint | 22 | 1 | 2 | 0 | 0 |
| 3D model | 22 | 1 | 0 | 0 | 2 |

The two `referenced` lines are **J2/J3** (Sullins breakaway header) and **C1**
(Yageo CC0805KKX5R7BB106, the DigiKey re-sub from validation pass 19). Both
resolve from the learner's stock KiCad libraries, 3D models included. The one
`unverified` footprint is **U1**, the corrected ESP32-S3-WROOM-1 land pattern,
the same asset the L1.01 board was built from.

This is the first board to exercise the pass-17 `[S]` assignments
(`scripts/assign-l103-kicad.ts`): U3 74AHCT125, LED3 WS2812B, J4/J5 screw
terminals, C10 radial electrolytic, D2/D3 TVS. All nine resolved.

## Corrections carried

| Correction | Result |
| --- | --- |
| 3D model paths under `libs/3dmodels/`, not `3dmodels/` | PASS |
| Every claimed 3D model actually bundled | PASS |
| refdes silkscreen normalised to 1 / 1 / 0.15 mm (all 23 bundled footprints) | PASS |
| Via dropdown leads with the 0.6 mm / 0.3 mm fab-floor preset | PASS |
| VBUS, +3V3, +5V, GND **and 5V_EXT** assigned to the Power net class | PASS |
| No keepout zone on any two-terminal footprint | PASS |
| Solder-mask bridges allowed on the J1 USB-C footprint | PASS |
| Board finish ENIG, 4-layer stackup, unwired schematic, zero stubs | PASS |
| Every symbol pin on the 1.27 mm connection grid | **FAIL — see below** |

The U1 footprint does carry a keepout zone, and that one is meant to be there:
it is the 18 x 6 mm **antenna keep-out** the lesson teaches. The check fails only
on two-terminal parts, where a keepout has no legitimate reason to exist.

## The injection rail was going to route at 0.25 mm

The Power net class names four rails: `VBUS`, `+3V3`, `+5V`, `GND`. This board
has a fifth. **5V_EXT** is the external 5 V the learner injects at J5 to feed the
strip, it is the highest-current net on the board, and it matched no pattern, so
it would have routed at the 0.25 mm **Default** track width while every other
supply got 0.5 mm.

That is the same failure VBUS itself had in #360, one board later, on the net
that can least afford it. `BOARD_CONFIG_OVERRIDES` now declares it:

```ts
"l1-03-ws2812-node": { copperLayers: 4, netClasses: withPowerNets("5V_EXT") },
```

and the verifier takes `--power-nets 5V_EXT` so it is checked rather than
assumed. L1.04 has the same shape of problem with its `VSERVO` servo rail; that
is fixed in its own packet, and the two touch the same block, so whichever lands
second wants a one-line rebase.

**The learner still has to use the name.** Net classes match on net name and the
schematic is unwired, so the rail only picks up the Power class if the schematic
labels it `5V_EXT`. The LAYOUT card should say so.

## Open finding: the D2 symbol is off grid

`scripts/verify-kicad-starter.ts` and KiCad's own ERC both flag it:

```
off-grid pins: SMAJ5.0A_0_0@(-6.858,0), SMAJ5.0A_0_0@(5.842,0)
[endpoint_off_grid]: Symbol pin or wire end off connection grid
    ; warning
    @(94.742 mm, 50.80 mm): Symbol D2 Pin 1
```

The curated `SMAJ5.0A` **symbol** asset puts its pins at -6.858 and +5.842 mm:
off KiCad's 1.27 mm connection grid, and asymmetric. A learner who drops a wire
at D2 will find it does not snap to the pin, which reads as "the wire will not
connect" rather than "this symbol is off grid". Nothing else on the board does
this; the comparable `CDSOD323-T05C` symbol sits at a clean +/-7.62.

There is a second thing wrong here, and it is the more interesting one.
Validation **pass 17** `[S]`-verified D2 as `Device:D_TVS` + `Diode_SMD:D_SMA`,
pad-by-pad, and `assign-l103-kicad.ts` set exactly that. But the export resolves
**uploaded asset before standard-library reference**
(`src/lib/kicad/export.ts`), and this part has an uploaded SYMBOL asset. So the
starter ships a symbol that the `[S]` audit never looked at, while the audited
one sits unused. The precedence is right for the WROOM and the USB-C connector,
where the curated asset is the corrected one. It is wrong here.

Two remedies, both the owner's call because they touch the shared parts library
rather than this board:

1. **Drop the uploaded SMAJ5.0A SYMBOL asset**, so the part falls back to the
   `[S]`-verified `Device:D_TVS`. Smallest change, and it makes the shipped
   symbol the audited one. The uploaded FOOTPRINT and 3D model are unaffected.
2. **Fix the asset in place**: move the pins to a symmetric +/-7.62 and extend
   each pin's `length` by the same shift so it still meets the body. Mint a new
   `r2Key` rather than overwriting, per the `_l101-fp-resync-assets.ts` pattern.

Not done in this packet: it is a production parts-library change, it affects
every board that uses an SMAJ, and picking between the two is a library
decision. The verifier now fails on it, so it cannot ship unnoticed.

## ERC / DRC

Run with KiCad 10.0.3 (`kicad-cli`) on the unzipped project.

**ERC — 175 violations:** 172 `pin_not_connected` + 2 `power_pin_not_driven`,
which is the signature of an unwired schematic and expected, plus **1
`endpoint_off_grid` warning**, which is the D2 finding above. Zero library or
symbol-resolution errors: all 25 parts resolved.

**DRC — 1 violation, expected:** `invalid_outline` ("no edges found on Edge.Cuts
layer"). The learner draws the outline. **0 unconnected pads, 0 footprint
errors.**

The stock-WROOM DRC noise the L1.01 lesson teaches the learner to *Exclude*
fires against a routed board, not the starter, so it does not appear here.
Expect it at LAYOUT on this board too, and teach the same Exclude.

## What is NOT verified here, and by whom

- **The `[L]` residuals pass 17 recorded.** J4/J5 use a generic CUI 5.08 mm
  terminal footprint (pitch and pad count correct, TE body/courtyard to be
  confirmed at layout), and D3 uses the generic `Device:D_TVS` for a
  bidirectional part. Both still open, both still `[L]`.
- **Does it open in the KiCad GUI.** `kicad-cli` parses and ERC/DRCs the files;
  it does not prove the canvas renders as intended. Open the project once.
- **Anything needing the physical board.** The WS2812 land pattern against a real
  XINGLIGHT part, the radial electrolytic's 10 x 20 mm keep-out against a real
  capacitor, and silkscreen legibility at 1 mm can only be confirmed on a
  fabricated board.
