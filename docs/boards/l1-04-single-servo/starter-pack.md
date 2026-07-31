# KiCad starter pack — l1-04-single-servo

What the learner downloads at the top of the lesson: a KiCad 10 project with
every BOM part placed, fielded and footprint-assigned, and the schematic
deliberately **unwired**. Drawing the nets is the lesson.

Generated from `l1-04-single-servo@v1` by the BOM-to-KiCad export (#13):

```powershell
pnpm exec tsx scripts/assign-l104-kicad.ts          # once, before the export
pnpm exec tsx scripts/gen-kicad-starter.ts l1-04-single-servo v1 --out l1-04.zip
pnpm exec tsx scripts/verify-kicad-starter.ts l1-04.zip --layers 4 --power-nets VSERVO
```

The generator and verifier are read-only and land in
`author/starter-l1-02-espnow-link` (#395). Publishing the starter to the lesson
is a production write and belongs to the owner.

## The three parts that had no CAD

D2, D3 and F2 are this board's new parts and had no `kicadSymbol` /
`kicadFootprint` and no uploaded assets, so the export auto-stubbed them. A stub
is a placeholder, and the stub generator only draws pads for a two-terminal
part; anything else gets an outline with no pads at all. `assign-l104-kicad.ts`
points each at the KiCad-10 standard library:

| Ref | Part | Symbol | Footprint | Pads |
| --- | --- | --- | --- | ---: |
| D2 | Vishay SS34-E3/57T | `Device:D_Schottky` | `Diode_SMD:D_SMC` | 2 |
| D3 | Littelfuse SMAJ6.0A | `Device:D_TVS` | `Diode_SMD:D_SMA` | 2 |
| F2 | Littelfuse miniSMDC150F-2 | `Device:Polyfuse` | `Fuse:Fuse_1812_4532Metric` | 2 |

D2 is the one worth watching, and design.md risk **RK10** already names it: the
SS34 is **DO-214AB (SMC)**, not SMA. Assign the SMC footprint; do not reuse the
SMA pads. Datasheet-confirmed 40 V / 3 A, 2-pin DO-214AB. D3 gets the same
symbol and footprint pair l1-03's pass 17 `[S]`-verified for its SMAJ5.0A, which
is the same body in the same family. F2 is F1's pattern one size up: the
miniSMDC's concave terminals land on the IPC-7351 rectangular 1812 pads.

The script refuses to run if any lib-id is missing from the indexed library, or
if a footprint's pad count is not 2.

## What the export produced

| | |
| --- | --- |
| BOM parts | 22 lines, 33 placed designators |
| Bundled footprints | 18 (`libs/l1-04-single-servo.pretty/`) |
| Bundled 3D models | 18 (`libs/3dmodels/`) |
| Stubbed parts | **0** (3 before the assignment) |
| Stackup | 4-layer (sig / GND / GND / sig), ENIG |
| Zip | 7,596,504 bytes |

Asset coverage, from the in-zip `EXPORT_REPORT.md`:

| Asset | Verified | Unverified | Referenced | Stubbed | Missing |
| --- | ---: | ---: | ---: | ---: | ---: |
| Symbol | 18 | 0 | 4 | 0 | 0 |
| Footprint | 17 | 1 | 4 | 0 | 0 |
| 3D model | 17 | 1 | 0 | 0 | 4 |

The four `referenced` lines are D2, D3, F2 and J2/J3/J5 (Sullins breakaway
header). All resolve from the learner's stock KiCad libraries, 3D models
included, which is why their bundled-model column reads `missing`: a referenced
footprint brings its own 3D from KiCad rather than carrying a copy here. The one
`unverified` footprint is U1, the corrected ESP32-S3-WROOM-1 land pattern, the
same asset the L1.01 board was built from.

## Corrections carried

| Correction | Result |
| --- | --- |
| 3D model paths under `libs/3dmodels/`, not `3dmodels/` | PASS |
| Every claimed 3D model actually bundled | PASS |
| refdes silkscreen normalised to 1 / 1 / 0.15 mm (all 18 bundled footprints) | PASS |
| Via dropdown leads with the 0.6 mm / 0.3 mm fab-floor preset | PASS |
| VBUS, +3V3, +5V, GND **and VSERVO** assigned to the Power net class | PASS |
| No keepout zone on any two-terminal footprint | PASS |
| Solder-mask bridges allowed on the J1 USB-C footprint | PASS |
| Every symbol pin on the 1.27 mm connection grid | PASS |
| Board finish ENIG, 4-layer stackup, unwired schematic, zero stubs | PASS |

The U1 footprint's keepout is the antenna keep-out and is meant to be there.

## The servo rail was going to route at 0.25 mm

The Power net class names four rails: `VBUS`, `+3V3`, `+5V`, `GND`. This board
has a fifth. **VSERVO** is the servo supply, it is the highest-current net on
the board (0.9 A worst-case stall, design.md K4), and it matched no pattern, so
it would have routed at the 0.25 mm **Default** track width while every other
supply got 0.5 mm.

That is the same failure VBUS itself had in #360, one board later, and it lands
on the worst possible net. `BOARD_CONFIG_OVERRIDES` now declares it:

```ts
"l1-04-single-servo": { copperLayers: 4, netClasses: withPowerNets("VSERVO") },
```

and the verifier takes `--power-nets VSERVO` so it is checked rather than
assumed. Confirmed in the generated `.kicad_pro`:

```json
{ "netclass": "Power", "pattern": "VSERVO" }
```

L1.03 has the same shape of problem with its `5V_EXT` injection rail; that is
fixed in its own packet.

**The learner still has to use the name.** The net class matches on net name,
and the schematic is unwired, so the rail only picks up the Power class if the
schematic labels it `VSERVO`. The LAYOUT card should say so.

## ERC / DRC

Run with KiCad 10.0.3 (`kicad-cli`) on the unzipped project.

**ERC — 171 violations, all expected:** 169 `pin_not_connected` + 2
`power_pin_not_driven`. That is the signature of an unwired schematic. No
library, symbol-resolution or off-grid violations: all 22 parts resolved, and
every pin lands on the connection grid.

**DRC — 1 violation, expected:** `invalid_outline` ("no edges found on Edge.Cuts
layer"). The learner draws the outline. **0 unconnected pads, 0 footprint
errors.**

Stock-WROOM DRC noise fires against a routed board, not the starter, so it does
not appear here. Expect it at LAYOUT and teach the same Exclude.

## What is NOT verified here, and by whom

- **Audit 6 (footprint ↔ symbol ↔ pinout), `[S]`.** Still owed per
  `validation-log.md`, and RK10 is still open. What this packet did is choose
  the lib-ids and check pad count against pin count. What it did not do is put a
  real SS34, SMAJ and miniSMDC on a printout and confirm the lands. That is the
  `[S]` tick and it stays the owner's.
- **D2's polarity on the board.** KiCad's `Device:` diodes put pin 1 = cathode
  and `D_SMC`'s pad 1 is the cathode, so the convention is consistent, but which
  way the band actually faces is a schematic-wiring decision the learner makes.
- **Does it open in the KiCad GUI.** `kicad-cli` parses and ERC/DRCs the files;
  it does not prove the canvas renders as intended.
- **Anything needing the physical board.** The SMC body against the D_SMC
  courtyard, the 1812 PTC's concave terminals on rectangular pads, and the servo
  connector's fit can only be confirmed on a fabricated board with the parts in
  hand.
