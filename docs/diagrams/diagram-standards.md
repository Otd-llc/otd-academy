# Guide-diagram standards (v3)

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
broke light mode and print. This v2 supersedes it. **v3 (2026-07-16)** splits
diagrams into two CLASSES (below), drops the unjustified wide-aspect ceiling, and
adds the Plate rules.

---

## Two classes (v3, 2026-07-16)

Until now this doc assumed one kind of diagram. It isn't. There are two, and they
answer to different rules:

| | **Instrument** (default) | **Plate** (premium) |
|---|---|---|
| Reports | values, structure, sequence | a place, or a relationship in space |
| Reads as | a figure | a scene |
| Aspect | 1.4–1.8 | **1.4–2.4** (see directive 3) |
| Labels | in the component, beside the art | **HTML over the art**, never in the SVG |
| Motion | Tier A reveal; Tier B if the motion teaches | **Tier P** — scroll-linked parallax |
| Narrow form | reflow to rows/cards | **re-compose**, never summarise |
| Cost | hours | a full design session |
| Examples | all 84 others | `DroneSharedAutonomy`, `L101GerberStack` |

**Plates shipped, and why each earned it:**

| Plate | Signed off | The depth that is load-bearing |
|---|---|---|
| `DroneSharedAutonomy` | 2026-07-16 | "you are looking through the aircraft" cannot survive being drawn as a flowchart |
| `L101GerberStack` | 2026-07-28 | the lesson IS that eight sheets are pressed together in an order; a flat frame makes that claim false |

**The default is Instrument, and a Plate must be argued for.** A pin map, a
stackup, a bar chart, a pipeline — those are Instruments; making one a Plate adds
cost and buys nothing, because their subject is a set of values and values don't
have a horizon. A Plate is only justified when **the spatial relationship IS the
lesson** — when a learner has to believe they are standing somewhere, and a
labelled box would kill the very thing being taught. `DroneSharedAutonomy` earns
it because "you are looking through the aircraft" cannot survive being drawn as a
flowchart.

A Plate is expensive: the first one took a full session of sandbox rounds. **Get
the owner's sign-off before starting one**, not after.

Everything below applies to BOTH classes unless a rule says otherwise. The
Plate-only rules live in [Class II — the Plate](#class-ii--the-plate).

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
- **Landscape. Floor ~1.2. Portrait (ratio < 1.0) is BANNED.**
- **Instrument: target 1.4–1.8. Plate: up to ~2.4.**
- Reflow information that *wants* to be a tall vertical list into a **horizontal
  flow, a 2-column grid, or side-by-side panels.** A 5-step pipeline is a
  left-to-right rail, not a top-to-bottom stack.
- This is the single biggest change from v1 and the thing that makes the field
  guide read cleanly.

> **The old 1.78 ceiling was never justified and is gone (2026-07-16.)** Every
> argument above is against *tallness*, and the PDF code agrees: it sets
> `w = CONTENT_W; h = w / ratio`, then only shrinks width if `h > maxH`
> (`src/lib/pdf/library-pdf.tsx`, and read its comment — *"FLOOR the width so a
> TALL, height-capped diagram never gets so narrow its labels fall below ~9pt"*).
> A **wide** diagram never reaches that cap: it renders at FULL column width, the
> shortest height, and the smallest page cost. Baked labels are a fixed fraction
> of raster width, and width is the constant — so aspect does not move them at
> all. Wider is strictly *cheaper* in print.
>
> **What the wide ceiling actually is.** `CONTENT_W` is 487pt (A4 minus padding),
> so a figure's printed height is `487 / ratio`: 271pt at 1.8, 221pt at 2.2, 203pt
> at 2.4, 122pt at 4.0 — and `maxH` only bites below ratio ~0.97 (portrait). So the
> limit is not the labels, and not the page: it is that **the art itself** stops
> reading once the figure becomes a letterbox strip. ~2.4 (≈200pt tall) is where a
> scene still has room to be a scene. That is the entire argument — if a Plate wants
> to go wider, argue it at column height, not against this number.
>
> (The phone is NOT a reason: it gets the Plate's portrait re-composition and never
> sees the wide aspect at all.)

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

### Bare mode — in-lesson vs. standalone (2026-07-14)

The eyebrow/title/caption echo the prose beside the diagram, so **in the reading
view they are redundant.** `DiagramFrame` reads a `DiagramChrome` context
(`components/guide/diagrams/DiagramChrome.tsx`) with a `bare` flag:

- **In-lesson (bare):** `GuideBlocks` wraps every diagram in
  `<DiagramChromeProvider bare fig={N}>`, so the frame shows **only the graphic +
  a "Fig N" corner label** — no eyebrow/title/caption. `fig` is the diagram's
  1-based position among the lesson's diagrams. The library-index **hero** diagram
  is bare too, but with `fig={null}` (a hero is not a numbered figure), so it's
  frame + graphic only.
- **Standalone (full):** the `/diagram-render` export and any render with **no
  provider** use the default context (`bare: false`) and keep the full
  eyebrow/title/caption. This is what the indexable `.webp`, the share card, and
  the PDF embed — so the exported image keeps its own context.

Author diagrams the same way regardless: the component always declares its real
`eyebrow`/`title`/`caption`/`ariaLabel`; the context decides what renders. Never
hardcode a bare variant into a diagram component.

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

## Class II — the Plate

A Plate is a **scene**: a world with a ground plane, depth, and objects standing in
it. Everything above still binds it (tokens, faces, the frame, the ~14px floor,
all three surfaces). These are the rules a scene needs *on top*, and every one of
them is here because the first Plate broke it first.

### P1 — Labels leave the SVG entirely

Directive 1 taken to its conclusion. A Plate's viewBox is large (~1000 units) and
renders at ~0.54× in a 576px frame, so **in-SVG text lands at ~7px** no matter what
you set it to. The label is HTML positioned over the art (`%` for placement so it
tracks the art; real `px` for type so it never scales).

Consequence to design for, not fight: **a legal label is physically large next to
scene art.** It needs its own clear zone in the composition. If it fits without
one, it's too small to be legal.

### P2 — Planted things do not move

The ground plane and everything standing on it (contour, grid, trees) is **static**.
Only the sky and the subject parallax. The ground grid is a *fixed reference*: a
tree that slides laterally visibly skates across its own cells. Horizontal parallax
does not save you from this — it only helps things with nothing to skate against
(clouds float; a far ridge sits above the grid).

### P3 — Coupled objects share one layer factor

Anything joined by a connector must ride the same factor, or the connector tears
off its anchors as the layers separate. Draw order is not a reason to split them:
give two groups the *same* factor if something must draw between them.

### P4 — Depth dim goes on `stroke-opacity`, never group `opacity`

For anything **filled**. Group opacity fades the fill too, so a "far" object stops
occluding what is behind it — it goes see-through and the grid runs straight
through it. Keep group `opacity` for stroke-only art (clouds, `fill:none`); use
`stroke-opacity` for anything with a fill. This one survived two rounds of "fix the
fill" because it presents as a fill bug and isn't.

> **The one sanctioned inversion (2026-07-28).** `L101GerberStack` uses group
> `opacity` on filled sheets *on purpose*: its lesson is that eight layers are
> pressed together in an order, so the front sheets must stop occluding the inner
> planes as the stack spreads. That is precisely the failure P4 describes, used as
> the effect. The rule stands everywhere else — if you reach for group `opacity` on
> a filled object, you owe a comment at the call site saying which you meant, or the
> next person will "fix" it. Note the two are not interchangeable: `stroke-opacity`
> could not produce this, because the thing that must become see-through is a fill.

### P5 — Scale is derived, never eyeballed

Pick one body of known real size, then compute everything else from the perspective
relation. In `DroneSharedAutonomy` the pilot is ~18.5 units for a ~0.9m seated
body, the horizon is `y=90`, so apparent size goes as `(y - 90)` and every tree's
height falls out of its own depth. Eyeball it and you ship a human-height fir and
never notice, because it looks fine next to nothing.

Corollary: **a glyph's native proportions are not a fact about the world.** Our fir
is squat (~0.7 w/h) where a real fir is ~0.3, so height and width need separate
scales or a tree tall enough to read as a tree is wide enough to bury the HUD.

### P6 — One profile, many views

If two views show the same world, they **share the source array** — one ridge
drives both the outer horizon and the goggle's inner peaks. Fork them and the link
that makes the second view legible as *a view of this place* dies quietly. Any
treatment (softening, height correction) applies to **both** or neither.

### P7 — Anchors derive from their object, not the canvas

A connector's ends are computed from the objects they join (a transform helper for
one end, a centre-offset for the other). Hardcode them to canvas coordinates and
every future composition change silently detaches them — and it will look like the
connector is broken rather than the anchor.

### P8 — Size ornament and motion to the FRAME, not the viewBox

A cloud at 3% of a 1000-unit box reads as scenery; the same 3% of a 300-unit box is
a speck. Same for parallax factors: the wide scene renders at ~0.54 and the
portrait at ~1:1, so the same *number* is double the motion. Size to what the eye
sees at the rendered width, then check it at that width.

### P9 — Faceted objects need a ramp, and rivals need different ramps

A 2.5D object's tone comes from each facet's edge normal, so it needs a 4-step ramp
(`hi`/`mid`/`lo`/`dk`), not one fill. Two protagonists in one frame need *separate*
ramps or they merge into one mass — the goggle is slate, the drone is gold. Scene
ramps are **scene-scoped tokens** (`--color-s-*`, `--color-f-*`, `--color-glass`,
the sky/ground planes): they are lighting, not page palette, and must not be
reached for in page UI. They still live in BOTH theme blocks — an invented token
resolves to its hex fallback and never flips, which is directive 2's failure mode
wearing a new hat.

### P10 — The narrow form is a re-composition, not a summary

A Plate's phone form is the **same world laid out vertically**, not text cards. If
the wide form's information doesn't survive the reflow, the reflow is wrong. (Text
cards are a legitimate Instrument reflow; for a Plate they throw away the only
reason the Plate exists.)

### P11 — The viewBox IS the figure

Author the art **inside** the viewBox, with margin. Anything painted outside it does
not exist, and the way you find out is brutal: the exporter calls
`figure.screenshot()`, which captures only the figure's box, so overflow is **cut
from every raster** — webp, share card, PDF — while the live web happily paints it
onto the page and looks perfect. You will not see the bug on the surface you're
designing on.

This shipped. The first Plate was authored with 1232 units of art inside a
1000-unit viewBox (`overflow: visible` let a sandbox absorb the spill), so the PDF
silently lost **37% of the width** and sliced the foreground trees in half.

- **`overflow: hidden` on the SVG, always.** Not a crop — a guardrail. If it clips
  anything, your viewBox is wrong; fix the viewBox, don't remove the rule.
- **Measure, don't eyeball.** `getBBox()` ignores CSS transforms and will lie to
  you. Screenshot the SVG under reduced-motion, diff against the field colour, and
  assert the painted bbox touches **no edge**. That check is cheap and it's the only
  one that would have caught this.
- A **frame-break** breaks the *sky plate* (the depicted world's edge), never the
  figure. The plate floats inside the viewBox; foreground objects cross it onto the
  bare field, and the viewBox still contains them.
- Widening a viewBox shrinks the art relative to the frame while **HTML labels stay
  real px** (P1), so they get proportionally bigger and their `%` anchors now point
  at a different scene coordinate. Re-map both.

### P12 — The settled frame is the raster

The exporter emulates reduced-motion, so a Plate's motion resolves to its settled
frame and *that* is what ships to the `.webp`, the share card and the PDF. Design
the settled frame to be complete on its own; verify it by rendering under
`reducedMotion: "reduce"` rather than trusting scroll position.

### Plate pre-ship (on top of the main checklist)

- [ ] Owner signed off on it BEING a Plate before the work started.
- [ ] Labels are HTML over the art; nothing text-bearing inside the SVG.
- [ ] Ground + everything planted on it is static; only sky and subject move.
- [ ] Connector-joined objects share one layer factor.
- [ ] Every filled object dims via `stroke-opacity`, not group `opacity`.
- [ ] Object scales derive from a stated reference body; the reference is in a comment.
- [ ] Shared-world profiles are one array, and every treatment hits all views.
- [ ] Anchors derive from objects, not canvas coordinates.
- [ ] Scene ramps are tokens in BOTH theme blocks.
- [ ] Narrow form re-composes the world; nothing is summarised away.
- [ ] `overflow:hidden` on the SVG, and the painted bbox touches NO viewBox edge —
      asserted from a screenshot, not from `getBBox()` (it ignores CSS transforms).
- [ ] Raster edges eyeballed after export. The live web hides overflow bugs.
- [ ] Settled frame verified under emulated reduced-motion, not by scroll luck.

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

- [ ] Class decided on purpose: **Instrument by default**; a Plate only where the
      spatial relationship IS the lesson, and only with prior sign-off.
- [ ] Component (not a scaled SVG) for anything labelled.
- [ ] Token-only color; NO literal hex (incl. SVG — `style`/class, not `fill="#…"`);
      no white-on-ivory. Re-themes cleanly under `data-theme="light"`.
- [ ] **Landscape, never portrait;** Instrument 1.4–1.8, Plate up to ~2.1;
      reflowed if the content wanted to be tall.
- [ ] All text ≥ ~14px web → ≥ ~9pt print; big data numbers are Saira.
- [ ] Gold dominant, blue secondary, red critical-only, green success-only; no
      off-palette hue; no gradient/glass/glow; restrained radius.
- [ ] Math (if any) is KaTeX, palette-styled, subscripts legible.
- [ ] Reflows/stacks at 360px; clean at 700px; final settled state (reduced motion).
- [ ] Accurate single `aria-label`; no em-dashes anywhere.
- [ ] Read on DARK web, LIGHT web, and PRINT.
- [ ] Registered + `diagrams:export` (+ `--light`) run; `.webp` + `-light.png` +
      manifest committed.
