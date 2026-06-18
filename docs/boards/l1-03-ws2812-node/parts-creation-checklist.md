# l1-03 — parts-creation pre-flight checklist

> Run aid for creating the **8 new parts** before the strict-match BOM import.
> Captured from the live `createPart` contract (`src/lib/actions/parts.ts`,
> `src/lib/schemas/part.ts`, `CreatePartDialog.tsx`) — **this file is also the seed
> for the future `adding-parts` skill** (we run first, then codify). Log any friction
> in the design.md Friction table as we go.

## The contract (what actually matters)

- **Admin-only**, and it writes to **PROD** (the parts library is global — correct; the
  curriculum BOM lives in prod). Sign in as admin first.
- **Required:** `Manufacturer`, `MPN`, `Description` (each ≥ 1 char). Everything else is
  optional.
- **Strict-match key = `(Manufacturer, MPN)`, EXACT + case-sensitive.** The BOM CSV import
  matches on this *same* pair. Type the Manufacturer/MPN **byte-for-byte** as the bom.csv
  rows below (mind `Würth` is core-only here; our 8 are plain-ASCII). A trailing space or a
  wrong case = a silent BOM-import miss later.
- **Duplicate** (manufacturer, mpn) → clean error "already exists" (no overwrite).
- `Lifecycle` defaults **ACTIVE** — leave it (WS3/WS4 EOL checks key off this).
- `Category`, `KiCad symbol`, `KiCad footprint`, `Footprint`, `Datasheet URL` — **optional.**
  Picking a Category auto-suggests the KiCad symbol/footprint. **The footprint↔pinout
  pad-cross-check is the Pass-6 `[S]` audit — defer KiCad to the schematic stage** unless the
  auto-suggest is obviously right. Do NOT block part creation on it.
- One CSV row per part; `refDes` count = quantity (already satisfied in bom.csv).

## The 8 new parts (create each — Manufacturer / MPN / Description)

Type Manufacturer + MPN EXACTLY as shown. Description is free text (suggestion given).
Lifecycle = ACTIVE for all. Datasheet URL optional (links provided where confident).

| # | Manufacturer | MPN | Description (suggested) | Datasheet | Category (pick closest leaf) |
| --- | --- | --- | --- | --- | --- |
| 1 | `Texas Instruments` | `SN74AHCT125D` | Quad bus buffer, 3-state, HCT/TTL inputs — 3.3→5 V level shifter, SOIC-14 | ti.com/lit/ds/symlink/sn74ahct125.pdf | Logic / buffer-line-driver |
| 2 | `XINGLIGHT` | `XL-5050RGBC-WS2812B` | Addressable RGB LED, WS2812B-compatible, integrated IC, 5050 | LCSC C2843785 (see validation-log) | LED / addressable RGB |
| 3 | `TE Connectivity` | `282837-3` | 3-pos 5.08 mm PCB screw terminal block (strip out), THT | te.com (282837 series) | Connector / terminal block |
| 4 | `TE Connectivity` | `282837-2` | 2-pos 5.08 mm PCB screw terminal block (5 V injection), THT | te.com (282837 series) | Connector / terminal block |
| 5 | `Panasonic` | `EEU-FR1C102` | 1000 µF 16 V aluminum electrolytic, radial (strip inrush bulk) | industrial.panasonic.com | Capacitor / aluminum electrolytic |
| 6 | `Littelfuse` | `SMAJ5.0A` | Uni-directional TVS, VRWM 5.0 V, SMA (5V_EXT over-voltage clamp) | littelfuse.com SMAJ series | Diode / TVS |
| 7 | `Nexperia` | `PESD5V0S1BA` | Bidirectional ESD protection diode, 5 V, SOD-323 (J4 DATA) | assets.nexperia.com/.../PESD5V0S1BA_BB_BL.pdf | Diode / ESD-TVS |
| 8 | `Samsung Electro-Mechanics` | `CL21A475KAQNNNE` | MLCC 4.7 µF 25 V X5R 0805 (VBUS bulk) | datasheet.octopart.com (CL21A475KAQNNNE) | Capacitor / MLCC |

> Manufacturer string note: #8 must read **`Samsung Electro-Mechanics`** to match the
> existing Samsung core lines (C1/C2/C3/C7…) — not "Samsung".

## After all 8 exist — verify BEFORE importing the BOM

1. Confirm each `(manufacturer, mpn)` exists with the exact string (parts catalog search,
   or the read-only `otd-parts` MCP `lookup_part`).
2. Confirm the **reused** core lines already match (Pass 2.6 said they do): the 470 Ω
   `RC0805FR-07470RL`, 0.1 µF `CL21B104KBCNNNC`, 10 µF `CL21A106KOQNNNE` (now C1 only), etc.
3. Only then: create the revision → Generate DESIGN_VALIDATION → import `bom.csv`
   (strict match; unmatched rows are reported, never auto-created) → board-readiness → guide.

## Friction to watch for (feeds the skill)

- Does the category combobox have a clean leaf for each of these? (TVS vs ESD diode;
  addressable-RGB LED; 5.08 mm terminal block.) Note any missing/awkward leaf.
- Does the KiCad auto-suggest produce a *correct* symbol/footprint, or is Pass-6 manual
  work unavoidable? (Expected: manual at schematic.)
- Any field the BOM import needs that the form doesn't capture? (e.g. per-line unit price
  lives on the BOM line, not the Part — confirm.)
- Exact-string transcription errors (the #1 documented gotcha).
