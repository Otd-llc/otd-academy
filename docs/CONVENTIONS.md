# Project Foundry — Conventions

This document defines what data lives in the foundry vs. what lives in each board's own repository under `/docs/`. The short version: **the foundry is canonical for everything structured.** Board repos hold KiCad source, firmware, mechanical CAD, and freeform overflow notes.

## Canonical data — the foundry is source of truth

The foundry owns every structured concept on this list. Do not duplicate this data into board repos:

- **Errata** (`Erratum` model)
- **Measurements** (`Measurement` model)
- **Checklists + items** (`Checklist` / `ChecklistItem`)
- **BRINGUP_LOG entries** (Artifact with `subkind = BRINGUP_LOG`)
- **Stage transitions** (`StageTransition`)
- **BOM lines** (`BomLine`) and the parts library (`Part`)
- **Build status, Board status** (`Build.frozenAt`, `Board.status`)
- **Every artifact** — revision-scoped or build-scoped, including the R2 build-snapshot subkinds (e.g. `GERBER_ZIP`, `BOM_CSV_AS_ORDERED`, `ASSEMBLY_PHOTO`, `BRINGUP_MEASUREMENTS_CSV`)

If you want to record a fact about a board that fits one of these shapes, file it through the foundry. The board repo should not be the place that fact lives.

## Board-repo `/docs/` — freeform overflow only

The `/docs/` directory in each board repo is for material that isn't structured yet (or never will be). Examples:

- Hand-drawn sketches or photos of scope traces.
- Datasheet scans that aren't yet linked from a `Part.datasheetUrl`.
- Bring-up scratch notes too rough to translate into a `Measurement` row yet.
- Draft narrative text that may later become a structured note (Erratum / BRINGUP_LOG artifact).

`/docs/` is the staging area. Anything that earns a structured representation in the foundry should be promoted.

## Crossing the boundary

When a `/docs/` note becomes structured — a scratch table becomes Measurements, a draft narrative becomes an Erratum, a photo gets attached to a build — edit the original `/docs/` file so it starts with a quoted pointer into the foundry:

```md
> Replaced by foundry measurement [m_01ABCD…](https://<foundry-host>/measurements/m_01ABCD…)
```

(Or `> Replaced by foundry erratum <id>`, `> Promoted to BRINGUP_LOG artifact <id>`, etc.)

The structured data lives in the foundry from then on. The original `/docs/` note is preserved for provenance — useful for tracing how an idea evolved — but it is no longer canonical. Don't keep editing it.

## First board repo — layout template

The canonical directory layout for a new board's repository:

```
<board-slug>/
├── README.md               # Project name, link back to foundry project page, 1-2 paragraph overview
├── LICENSE                 # OSS license — match foundry top-level
├── hardware/
│   ├── <board>.kicad_pro
│   ├── <board>.kicad_sch
│   ├── <board>.kicad_pcb
│   └── gerbers/            # generated artifacts; foundry holds the canonical GERBER_ZIP
├── firmware/
│   └── …                   # source tree per project
├── cad/
│   └── <enclosure>.step    # mechanical models if applicable
└── docs/
    └── <freeform>.md       # see "Board-repo /docs/ policy" above
```

`<board-slug>` matches the foundry project's `slug` field exactly. Subdirectories that don't apply to a given board (no firmware, no mechanical CAD) can be omitted — don't keep empty placeholders.

## README rules for board repos

The board repo's top-level `README.md` must:

- Open with one sentence describing what the board does.
- Link to the foundry project page — e.g. `https://<foundry-host>/projects/<slug>`.
- State the curriculum track + level if applicable (e.g. "SENSE · L1").
- **Never** duplicate the canonical BOM, errata, or measurements. Link to the foundry instead.

The foundry already renders the structured view of the board; the README is the index card that points readers to it.

## License

Board repos use the same license as the foundry top-level. Set it explicitly in the repo root `LICENSE` file rather than inheriting by reference — repos travel independently of this convention doc. The foundry's license decision is set in [the foundry's own `LICENSE.md`](../LICENSE.md) and is out of scope here.
