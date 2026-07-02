# Guide-diagram standards (v2)

> Motion is a separate concern — see [`animation-standards.md`](./animation-standards.md).
> The end-to-end authoring + export workflow is the **diagram-export** skill.

Diagrams are OTD's teaching instruments. **One diagram, authored once, must read
perfectly on three surfaces:**

1. the **web in DARK** (deep-space ground),
2. the **web in LIGHT** (ivory ground), and
3. the **print field-guide PDF** (a rasterized embed on ivory paper).

A diagram is a **figure on the engineering-paper field**, part of the same
console system as the rest of the product — read the **otd-frontend-design**
skill first; this doc is diagram-specific and assumes it. The old v1 of this doc
was dark-only and told you to fall back to literal hex; that is exactly what
broke light mode and print. This v2 supersedes it.

---

## The four prime directives (non-negotiable)

**1. A labelled diagram is a responsive COMPONENT, never a scaled SVG.**
An SVG scales its text with its width: a 780-wide graphic on a 360px phone
renders at ~0.46×, so 24-unit text becomes ~11px and 14-unit text ~6px. There is
no font size that stays accessible once an SVG scales down. So anything carrying
labels is HTML/CSS with real `px` text that **reflows/stacks** instead of
shrinking. (Pure-vector graphics with no/large text, and generated CAD exports,
are the only SVG exceptions.)

**2. Token-only color. Light + dark parity is MANDATORY.**
Every color is a `var(--color-*)` token so the whole diagram flips when
`:root[data-theme="light"]` overrides the tokens (see `globals.css`). Rules:
- **No literal hex anywhere** — not in CSS, and **not in SVG presentation
  attributes.** `fill="#c8963e"` / `stroke="#…"` CANNOT read a CSS variable, so a
  diagram using them will NOT re-theme (this is why 5 hardware diagrams are still
  dark). In SVG use `style={{ fill: "var(--color-command-gold)" }}` or a CSS
  class (`.x{fill:var(--color-command-gold)}`), never the presentation attribute.
- **Never white-on-ivory.** A headline is `--color-title` (ink on light, ivory on
  dark), never `#fff`. Any standalone `#fff`/`#ffffff` is a light-mode bug.
- A token fallback (`var(--color-x, #hex)`) is allowed ONLY as a belt-and-braces
  default; the token must be the real source, and the fallback must be the DARK
  value (the light value comes from the token override).
- **Verify BOTH themes every time** (see Verify, below). "Looks right on dark" is
  half the job.

**3. Print-ready aspect — landscape, never tall.**
The diagram is screenshotted and embedded in the field-guide PDF at text-column
width. A TALL diagram (portrait) is forced to its own page (gapping the page
before it) and, if height-capped, shrinks its own baked text below the legible
floor. So:
- **Target a landscape aspect ratio, ~3:2 (1.5) to 16:9 (1.78). Floor ~1.2.
  Portrait (ratio < 1.0) is BANNED.**
- Reflow information that *wants* to be a tall vertical list into a **horizontal
  flow, a 2-column grid, or side-by-side panels.** A 5-step pipeline is a
  left-to-right rail, not a top-to-bottom stack.
- This is the single biggest change from v1 and the thing that makes the field
  guide read cleanly.

**4. Legible at EVERY scale, including print.**
Real `px` text with a clamp floor of **~14px**. Because directive 3 keeps the
diagram landscape, the print embed renders at ~full column width (~0.9pt per css
px), so a 14px web label lands at ~12pt in print — comfortably above the ~9pt
print floor. Tallness is the only thing that breaks this; keep it landscape and
the floor takes care of itself.

---

## Palette — tokens only, both themes

Pull EVERY color from a token. The same token name resolves to a dark value and a
light value; you never write the light value. (Values are informative — the code
in `globals.css` is source of truth.)

| Token | Dark | Light | Job in a diagram |
|---|---|---|---|
| `--color-deep-space` | `#08090d` | `#faf7f0` | the ground; the DiagramFrame background |
| `--color-navy-dark` | `#1a1a2e` | `#ffffff` | a filled sub-panel INSIDE the figure (channel card, part body) |
| `--color-panel-border` | `#3a3f50` | `#d9d2c2` | hairlines, baselines, sub-panel borders |
| `--color-command-gold` | `#c8963e` | `#9c7016` | primary accent — outlines, key emphasis, takeaway. **Dominant.** |
| `--color-gold-light` | `#e8b865` | `#7e5610` | hover / stronger emphasis |
| `--color-signal-blue` | `#4a8fff` | `#2563c4` | data / "at rest" / secondary. **Never dominant.** |
| `--color-title` | `#f1ece0` | `#15191f` | headline + key glyph text |
| `--color-text` | `#e8e8e8` | `#20252d` | a value above label weight |
| `--color-muted` | `#aaaaaa` | `#6b7280` | labels, captions, dims |
| `--color-status-green` | `#66bb6a` | `#2f8a4d` | success / verified state ONLY |
| `--color-alert-red` | `#ef5350` | `#c5362f` | critical / "must-not" state ONLY |

**Gold leads. Blue is always secondary. Red is critical-only. Green is
success-only. No other hues** — no teal, purple, orange, off-palette gray.

A diagram's FRAME groups by a hairline on the bare ground (deep-space/ivory), not
a filled card — but the figure's internal elements (a channel box, a chip body, a
region) MAY be filled `--color-navy-dark` panels; they're graphic content, not a
"record surface". No gradients-as-accent, no glassmorphism, no drop-shadow glows
(all light-mode dirt), restrained radius (6px chrome / square badges).

## The four faces (one job each)

Same type system as the rest of the product. Never substitute a system font.

| Face | Token | Use in a diagram |
|---|---|---|
| **Bebas Neue** | `--font-display` | the diagram TITLE (via DiagramFrame), section headers inside a figure |
| **Saira Condensed** | `--font-numeral` | **any number that is data** — a stat, a count, a stage number, an axis value, a measured quantity. Weight 800, `tabular-nums`. |
| **Space Mono** | `--font-mono` | labels, eyebrows, units, chip text, axis ticks, data readouts |
| **Lora** (web) / Crimson (print) | `--font-serif` | a full-sentence statement or the caption |

The current diagrams under-use Saira — big numerals/stats should be the Saira
instrument readout, not mono.

## The frame — `DiagramFrame`

Every diagram uses the shared `DiagramFrame` (never a one-off header): a
gold/blue/green Space-Mono eyebrow (`▸ TOPIC`) over a Bebas title in
`--color-title`, on the deep-space/ivory ground with a `--color-panel-border`
hairline, a Lora caption footer, and an accurate `ariaLabel` (**it becomes the
image's `alt`** — write it as real teaching prose). In PRINT the diagram is
**frameless** — the PDF adds no box; the DiagramFrame's own hairline is the only
frame. Supply ONLY the graphic body + its scoped `<style>`.

## Aspect & size

- **Web:** max `36rem` (576px) centered; reflow/stack on a ~360px phone (test at
  360 and 700).
- **Print (the budget):** author the DESKTOP layout to a **landscape aspect
  1.4–1.8** (see directive 3). If the content is inherently a long list, reflow it
  horizontally; do not ship a portrait diagram. The exporter screenshots the
  desktop (576px) render, so the desktop aspect IS the print aspect.

## Type scale (real px, clamped)

| Role | clamp | renders | face |
|---|---|---|---|
| Title | `clamp(1.15rem, 3.6vw, 1.6rem)` | ~18–26px | Bebas |
| Primary label / glyph | `clamp(1.1rem, 3vw, 1.4rem)` | ~18–22px | Mono or Bebas |
| Data numeral / stat | `clamp(1.1rem, 3.2vw, 1.5rem)` | ~18–24px | **Saira** |
| Body statement | `clamp(0.95rem, 2.5vw, 1.05rem)` | ~15–17px | Lora |
| Label / caption | `clamp(0.9rem, 2.3vw, 1rem)` | ~14–16px | Mono |

**Never below ~14px rendered.** A micro tracked-caps tag (`REF`) may be `0.7rem`
fixed — it's a label, not body, and still lands ≥ ~10pt in print at landscape
width.

## Math — KaTeX (first-class)

Real math is set with **KaTeX**, not hand-drawn glyphs or unicode. KaTeX renders
to HTML/CSS, so it bakes into the raster (web + light + print) with no special
handling — just ensure the KaTeX fonts load in the `/diagram-render` route.

- A shared `<Math>{"\\tau = RC"}</Math>` helper (inline) and `<MathBlock>` (display).
- Style onto the console palette: the **key variable/result in
  `--color-command-gold`**, the rest in `--color-title`; never KaTeX's default
  black-on-white.
- Keep equations readable at the landscape floor (KaTeX scriptstyle subscripts
  are the smallest glyphs — size the base so subscripts stay ≥ ~14px web).
- **Prose math (in a lesson, not a diagram)** rides the SAME raster pipeline for
  print: a `math` content block renders KaTeX on the web and a pre-rendered PNG in
  the PDF (react-pdf can't run KaTeX). Treat a standalone equation like a small
  diagram.

## Motion

The frame owns the Tier-A entrance reveal; a diagram may drive its own Tier-B
internal motion off the shared `.armed`/`.in` state — see
[`animation-standards.md`](./animation-standards.md). The exporter forces
reduced-motion, so **the raster is always the final, settled state** — design the
static state to be complete on its own.

## Content rules

- Preserve the teaching data exactly; never invent or drop a value.
- **Never claim "to scale"** (DPI/devices make it impossible). Ratio claims
  ("≈ 1/5 the area") are fine and encouraged.
- One accurate `aria-label`; don't triple-label (figcaption + aria-label +
  `<img alt>` all identical).
- No em-dashes in any rendered glyph (shared house rule); `·` is the separator.

## Layout discipline

- Annotations in the gutters, not on the subject (exception: a centered ref, or a
  region label inside its own filled region).
- Leaders at 0° / 45° / 90° only; gap at the label end; stop short of the target;
  never cross another leader, the subject, or text; color = the label's semantic
  token.
- ≥ 16px clearance between unrelated strokes/symbols.

## Verify — all THREE surfaces, every time

A diagram isn't done until it's been read on all three:

1. **Dark web** — `/diagram-render/<key>` at 360px AND 700px.
2. **Light web** — same route with `document.documentElement.dataset.theme =
   "light"`. No white-on-ivory, no dark box that didn't flip, gold deepened.
3. **Print** — embed the exported `-light.png` at column width (or render the
   field guide) and read the smallest label. Landscape? Text ≥ ~9pt? No page gap?

## Export pipeline (SEO + light + print)

Registration is the trigger: a diagram in `DIAGRAM_COMPONENTS` MUST have committed
rasters + a manifest entry (CI's `diagrams:check` enforces presence + alt).

- `pnpm diagrams:export` → dark **`<name>.webp`** (indexable, web) + manifest.
- `pnpm diagrams:export --light` → **`<name>-light.png`** rendered under
  `data-theme="light"` (used by the field-guide PDF, which prefers `-light.png`
  and falls back to the dark `.png`). A diagram with literal hex is skipped by
  `--light` — which is the tell that it violates directive 2.
- Commit the component, registry, `.webp`, `-light.png`, and manifest together.

## The design process — sandbox rounds, one diagram at a time

Diagrams are redesigned **slowly, one at a time, best-possible-outcome:**

1. **Sandbox rounds.** Mock the diagram as standalone HTML (both themes),
   screenshot it, iterate options with the owner until ONE is approved — exactly
   like the PDF-cover rounds. Design to this v2 (landscape, tokens, four faces,
   math if needed).
2. **Implement** the approved design as the real responsive component to this doc.
3. **Verify all three surfaces** (above).
4. **Export** (`diagrams:export` + `--light`), eyeball both rasters, commit.
5. **Next diagram.** Do not batch; one approval at a time.

## Pre-ship checklist

- [ ] Component (not a scaled SVG) for anything labelled.
- [ ] Token-only color; NO literal hex (incl. SVG — `style`/class, not `fill="#…"`);
      no white-on-ivory. Re-themes cleanly under `data-theme="light"`.
- [ ] **Landscape aspect (~1.4–1.8, never portrait);** reflowed if the content
      wanted to be tall.
- [ ] All text ≥ ~14px web → ≥ ~9pt print; big data numbers are Saira.
- [ ] Gold dominant, blue secondary, red critical-only, green success-only; no
      off-palette hue; no gradient/glass/glow; restrained radius.
- [ ] Math (if any) is KaTeX, palette-styled, subscripts legible.
- [ ] Reflows/stacks at 360px; clean at 700px; final settled state (reduced motion).
- [ ] Accurate single `aria-label`; no em-dashes anywhere.
- [ ] Read on DARK web, LIGHT web, and PRINT.
- [ ] Registered + `diagrams:export` (+ `--light`) run; `.webp` + `-light.png` +
      manifest committed.
