# Visual verification — bench console comparison

_Last reviewed: 2026-05-28 (Phase 1 / Task 15.6)_

This is a one-shot diff of `src/app/globals.css` design tokens against the
TB-1-POWER bench console stylesheet at
`c:/zzz/otd/hardware/schematic/test-boards/TB-1-POWER/docs/bench/_bench.css`.

The bench console is the canonical "look and feel" reference for the
brand — Project Foundry mostly matches but a few token values drift.

## Palette mismatches

| Token             | Foundry (`globals.css`) | Bench (`_bench.css`)  | Note                                                                                                                |
| ----------------- | ----------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `--deep-space`    | `#08090D`               | `#08090D`             | Match.                                                                                                              |
| `--command-gold`  | `#C8963E`               | `#C8963E`             | Match.                                                                                                              |
| `--signal-blue`   | `#4A8FFF`               | `#4A8FFF`             | Match.                                                                                                              |
| `--muted` / `--muted-gray` | `#AAAAAA`     | `#AAAAAA`             | Match (renamed in Foundry to `--muted`).                                                                            |
| `--navy-dark`     | `#1F2438`               | `#1A1A2E`             | **Drift.** Foundry is slightly bluer and lighter; bench is denser navy. Acceptable for now — same family.            |
| `--alert-red`     | `#EF5350`               | `#C62828`             | **Drift.** Foundry is brighter/coral; bench is deeper brick-red. Foundry's choice was made for better dark-on-dark contrast. |
| `--gold-light`    | _(none)_                | `#E8B865`             | Bench has a light-gold tint for inline `em` / `<code>` highlights. Foundry uses `text-command-gold` directly.       |
| `--navy-elevated` | _(none)_                | `#232347`             | Bench derived tint for hover backgrounds. Foundry doesn't currently need it.                                        |

## Typography

| Element         | Foundry                                | Bench                                | Note                                              |
| --------------- | -------------------------------------- | ------------------------------------ | ------------------------------------------------- |
| Display heading | Bebas Neue                             | Bebas Neue                           | Match.                                            |
| Mono            | Space Mono 400/700                     | Space Mono 400/700                   | Match.                                            |
| Body serif      | Lora 400/500                           | Lora 400/600 + italic                | Slight weight difference — Foundry not using italic body text yet. |

## Accent-bar usage

- Bench uses a fixed 3px `command-gold` top bar (`body::before`) across every
  page.
- Foundry doesn't have a global top accent bar; gold accent is per-component
  via `border-l-4 border-l-command-gold` on revision/build header strips
  (design §9.1 / §9.2).
- Both approaches are valid; Foundry's per-card accent encodes "this is the
  active revision/build" semantics that the bench console doesn't need.

## Status badges / pills

- Bench `.badge` is 9px caps Space Mono with 0.22em letter-spacing on a
  transparent background with a colored 1px border.
- Foundry pills (e.g., `BoardsTable.StatusPill`, `ErrataItem` severity pill,
  measurement result pill) are 10px caps Space Mono with `tracking-wider`
  (0.05em) on a `navy-dark` chip with a 1px border.
- The Foundry treatment is denser and more readable on small chips inside
  panel tables; the bench treatment is airier and works better in headers.
  Different layouts, both consistent within their respective surfaces — no
  action.

## Callouts vs `InlineBanner`

- Bench `.callout` is left-border 4px + tinted background (gold-dim,
  red-dim, blue-dim) with a small uppercase label.
- Foundry `InlineBanner` (added Task 15.2) is a full 1px border on
  `navy-dark` with bold caps text — no tinted background.
- Functionally equivalent. Foundry's choice is denser and reads as
  "system-status" rather than "editorial callout"; suited to the form UX
  context.

## Action items

None for Phase 1. The drift in `--navy-dark` and `--alert-red` is
intentional / acceptable given the different lighting context (dense web
app vs. printable bench reference). The missing `--gold-light` token can
be added in a future polish pass if we surface inline highlights that
need a lighter tint than `command-gold`.
