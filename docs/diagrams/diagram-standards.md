# Guide-diagram standards

Diagrams render inside guide cards on the dark app background (`#08090D`). The
overriding rule, learned the hard way:

> **Diagram text must render at an accessible size (~16 px body, never below
> ~14 px) on every viewport — including a ~360 px phone. A diagram whose text is
> too small to read should never ship.**

## Frame & size (the standard)

A diagram is never full-bleed and never tiny — it lives in a fixed frame:

| | value | why |
|---|---|---|
| **Max / standard width** | **`36rem` (576px), centered** | On any screen ≥ 576px the diagram renders at exactly this width — the *standard size*. Caps the "balloon on a wide monitor" failure. Applied via `.guide-diagram` (SVGs) and each component root. |
| **Min width** | shrinks to the column on phones (~320–360px) | reflow/stack territory |

**Text scale — bounded between a floor and a cap (`clamp(min, preferred, max)`),
so it is never illegibly small and never huge:**

| Role | clamp | renders |
|---|---|---|
| Title | `clamp(1.2rem, 3.4vw, 1.5rem)` | 19–24 px |
| Glyph / primary label | `clamp(1.05rem, 3vw, 1.3rem)` | 17–21 px |
| Body / value | `clamp(0.95rem, 2.5vw, 1.05rem)` | 15–17 px |
| Secondary caption | `clamp(0.85rem, 2.3vw, 0.95rem)` | 14–15 px |
| Micro mono label (tracked caps, e.g. `REF`) | `0.62rem` fixed | ~10 px (a label, not body) |

Floor = the accessible minimum; cap = the standard maximum; in between it scales.
Because the frame is capped at 576px, the `vw` preferred term effectively tops out
at the cap on wide screens — text stays put. (A scaled SVG cannot do this: its
text has no floor or cap, so it goes huge on desktop and sub-8px on mobile —
which is the other reason label-bearing diagrams are components.)

## Why most teaching diagrams are components, not SVGs

An SVG scales to its container width. A `780`-wide house SVG on a ~360 px phone
renders at **~0.46×**, so *any* text shrinks to ~0.46 of its unit size: 14-unit
text → ~6 px, even 24-unit text → ~11 px. **There is no font size that keeps an
SVG's text accessible once it scales down to mobile.** This is the trap the old
standard fell into (it prescribed 10–17 px type) and why early L1.01 diagrams
were unreadable on phones.

**So: any diagram that carries labels/text is a responsive HTML component**, with
real CSS-`px` text (`clamp()`), that **reflows/stacks on mobile** instead of
shrinking. Text is `px`, independent of viewport, so it stays accessible.

References (copy these):
- `src/components/guide/MpnAnatomyDiagram.tsx` — callout/anatomy layout, scroll-
  triggered reveal (IntersectionObserver, reduced-motion safe).
- `src/components/guide/PackageSizeDiagram.tsx` — comparison layout, stacks on
  narrow screens.

Wiring: a component is rendered from `ImageBlock` (`GuideBlocks.tsx`) by matching
the content block's `src` (the DB stays a plain `image` block). See the
`src === "/guide-diagrams/…"` branches.

### When an SVG is still fine

- **Generated CAD exports** (KiCad Eeschema `l1-01-*.svg`) — kept as `<img>`,
  their own typography; a separate pinch-zoom concern.
- **Pure graphics** with little/no text, where any label is large and few.
  If you author SVG text anyway, it must be **≥ 28 units** (≈ 13 px at 0.46×) —
  but prefer a component.

## Palette (1KD brand — onethousanddrones.com/brand)

Use ONLY these. Pull from the `@theme` tokens (`var(--color-*)`); the literal hex
is the fallback.

| Role | Token / hex | Use |
|---|---|---|
| Background | `--color-deep-space` `#08090d` | page ground; don't paint a full bg rect |
| Panel / body | `--color-navy-dark` `#1f2438` | cards, component bodies, part fills |
| Primary accent | `--color-command-gold` `#c8963e` | outlines, key emphasis, takeaways — **dominant** |
| Accent highlight | `--color-gold-light` `#e8b865` | hover / emphasis |
| Secondary / data | `--color-signal-blue` `#4a8fff` | data callouts, links — **secondary only, never dominant** |
| Headline / glyph | `#ffffff` | titles, key glyphs |
| Body / labels | `--color-muted` `#aaaaaa` | labels, captions, dims — **never a darker gray** |
| Brighter value | `--color-gray-1` `#e8e8e8` | a value you want above label weight |
| Hairline | `--color-panel-border` `#3a3f50` | dividers, baselines |
| Critical | `--color-alert-red` `#c62828` | error / "must-not" states **only** |

**No greens, teals, purples, oranges, or any hue outside this list.** Gold leads;
blue is always secondary.

## Type (components — real px)

| Role | size | weight |
|---|---|---|
| Title | `clamp(1.15rem, 3.6vw, 1.6rem)` (~18–26 px) | 700 |
| Glyph / primary label | `clamp(1.1rem, 3vw, 1.4rem)` (~18–22 px) | 700 |
| Body / dimension | `clamp(0.95rem, 2.5vw, 1.05rem)` (~15–17 px) | 400 |
| Secondary caption | `clamp(0.9rem, 2.3vw, 1rem)` (~14–16 px) | 400 |

Never below ~14 px rendered. Fonts: `--font-mono` (Space Mono) for labels/data,
`--font-serif` (Lora) for body statements, white for headlines (matches brand
type roles).

## Content rules

- Preserve the teaching data exactly; never invent or drop values.
- **Never claim "to scale"** (DPI/devices make it impossible). Ratio claims
  ("≈ 1/5 the area") are fine and encouraged.
- Keep an accurate `aria-label` / `role="img"`.
- Reflow on mobile: stack columns, don't cram. Test at **360 px and 700 px**.

## Layout discipline (applies to SVG graphics too)

- Annotations in the gutters, not on the subject (exception: a centered ref
  inside a body, or a region label inside its own filled region).
- Leaders at **0° / 45° / 90°** only; gap at the label end; stop short of the
  target; never cross another leader, the subject, or text; color = the label's
  semantic color.
- ≥ 16 px clearance between unrelated strokes/symbols.

## Pre-ship checklist

- [ ] Renders at **360 px**: all text ≥ ~14 px, nothing clipped or overlapping.
- [ ] Reflows/stacks on mobile (no cramped multi-column text).
- [ ] Renders at **700 px**: clean, balanced.
- [ ] Palette is brand-only (no gray darker than `#aaaaaa`; no off-palette hue).
- [ ] Gold dominant; blue secondary; red only for critical states.
- [ ] No "to scale" claim; ratio claims OK.
- [ ] Label-bearing → it's a component (not a scaled SVG).

## Verification

Render on the real `#08090D` ground at 360 px AND 700 px and read both. For a
component, extract its SSR'd markup from the live page and render standalone; for
an SVG, render the file inside a `.guide-diagram` wrapper. (Headless Chrome:
`--headless=new --screenshot --window-size=<w>,<h>`.)

## Inventory

| File / component | Subject | Status |
|---|---|---|
| `MpnAnatomyDiagram.tsx` | MPN anatomy decode | ✅ component (accessible) |
| `PackageSizeDiagram.tsx` | 0805 vs 0402 size (≈ 5:1 area) | ✅ component (accessible) |
| `current-budget.svg` | ~550 mA draw vs 600 mA LDO ceiling | ⚠️ SVG — brand+sized pass done; **pending component conversion** (mobile text ~0.46×) |
| `adc1-pin-map.svg` | ADC1 usable vs ADC2 radio-claimed | ⚠️ SVG — same |
| `antenna-keepout.svg` | WROOM antenna keep-out | ⚠️ SVG — same |
| `decoupling-placement.svg` | decoupling loop area | ⚠️ SVG — same |
| `continuity-vbus-gnd.svg` | VBUS↔GND short check | ⚠️ SVG — same |
| `two-layer-cross-section.svg` | 2-layer stackup edge-on | ⚠️ SVG — same |
| `gerber-layer-stack.svg` | Gerber file set | ⚠️ SVG — same |
| `hasl-vs-enig.svg` | surface-finish comparison | ⚠️ SVG — same |
| `schematic-conventions.svg` | schematic drawing conventions | ⚠️ SVG — same |
| `bringup-ladder.svg` | bring-up sequence | ⚠️ SVG — same |
| `bringup-probe-points.svg` | rail probe points | ⚠️ SVG — same |
| `wroom-power-flow.svg` | USB → 3.3 V power flow | ⚠️ SVG — same |
| `l1-01-*.svg`, `l1-01-schematic-reference.svg` | KiCad exports | CAD `<img>` — separate concern |
