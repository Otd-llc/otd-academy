# Guide-diagram animation standards

Companion to [`diagram-standards.md`](./diagram-standards.md). Those rules govern
how a diagram *looks*; these govern how (and whether) it *moves*. The overriding
rule, set against an engineering-serious brand:

> **Animate only when the motion teaches something a static frame can't —
> direction, order, magnitude, or cause→effect. If you can't name what the
> motion teaches, it's a static reveal.** Motion is restrained by default;
> decorative movement does not ship.

The reference implementation already exists: `MpnAnatomyDiagram.tsx` — a
scroll-triggered, reduced-motion-safe, staggered reveal. These rules codify it
and define the two richer tiers.

## The tiers

Every diagram is exactly one tier. Default is A; B, C and P must justify the motion.

A, B and C all **fire once and settle** — they are *events*. Tier P is different in
kind: it is **state**, continuously bound to scroll position, and it exists because
a Plate (see `diagram-standards.md` § Two classes) has depth to express and depth
is not an event.

### Tier A — Entrance reveal (the baseline; every diagram gets this)
A staggered fade + small rise as the card scrolls into view, in reading order.
Teaches only "here it comes, in order." No motion after it settles.

Diagrams: `MpnAnatomy` (reference), `SchematicConventions`, `Adc1PinMap`,
`HaslVsEnig`, `PackageSize`, `TwoLayerCrossSection`, `AntennaKeepout`,
`BringupProbePoints`.

### Tier B — Directional / sequential motion (the motion *is* the lesson)
A single pass that expresses flow, sequence, or magnitude, then settles.

| Diagram | Motion | Teaches |
|---|---|---|
| `WroomPowerFlow` | one gold pulse travels J1→F1→U2→U1; blue pulse on the data path | direction of flow; power and data are separate paths |
| `CurrentBudget` | red 600 mA ceiling draws first, then bars fill 0→value and stop short | magnitude / "does it fit" |
| `GerberLayerStack` | rows stack front-to-back in order | stack order |
| `BringupLadder` | rungs reveal 1→5 in sequence (prove each before the next) | the gated sequence |
| `DecouplingPlacement` | a current dot circulates the loop — brisk on the small loop, sluggish on the big loop | *why* loop area matters |

### Tier C — Action demonstration (heaviest; use sparingly)
Shows a physical action once (a probe landing, a meter resolving). Only ship if
it reads unambiguously at 360 px. Currently a candidate, not a commitment:
`ContinuityVbusGnd` (probes descend, meter resolves to `OL`).

### Tier P — Scroll-bound parallax (Plates only)
Layers move at different rates against scroll position, continuously, for as long
as the diagram is on screen. **Not an event — a binding.** Reserved to the Plate
class; an Instrument that wants this is an Instrument that wants to be a Plate, and
should be argued as one.

It earns its place only where **depth is load-bearing**: the diagram claims to be a
place, and a flat frame would make that claim false. If you can't say what the
depth teaches, it's decoration and it doesn't ship.

| Rule | Value |
|---|---|
| **Binding** | One CSS custom property (`--p`, -1..+1, 0 = element centred) written by the shared `useScrollParallax` primitive. `useScrollReveal` is fire-once and structurally cannot express this; do not reinvent either per file. |
| **Read path** | CSS only, and **only `transform` may read `--p`.** No React state — a scroll must never re-render the tree. Composited properties only; CLS 0. |
| **Listener** | rAF-throttled, attached ONLY while the diagram is intersecting. A lesson page holds several diagrams; none may cost a scroll handler offscreen. |
| **Budget** | Sized to the FRAME, not the viewBox. ~8–12 CSS px of travel for the outermost layers; the total near-to-far separation should read as depth, not as a slideshow of planes. |
| **Coupling** | Objects joined by a connector share one factor (`diagram-standards` P3). Anything planted on the ground does not move at all (P2). |
| **Settled state** | `--p` unset ⇒ every `var(--p,0)` resolves to 0 ⇒ the diagram renders its settled frame. This is what SSR, no-JS, reduced-motion AND the raster exporter all get, which is why it must be the composition you actually want. |
| **Reduced motion** | Same HARD rule: never observe, never write `--p`. Nothing to undo, because 0 *is* the design. |

Tier P **composes with** the frame's Tier-A reveal (the reveal is the entrance, the
parallax is the state) and with a Tier-B pass if the Plate has one.

Diagrams: `DroneSharedAutonomy` (the drone's bank and the goggle's video bank are
one expression, because the picture is the drone's camera — that coupling is the
lesson, and depth is what makes it a place rather than a chart).

## The numbers

Anchored to the shipped `MpnAnatomyDiagram` values so the standard is not
arbitrary.

| Rule | Value |
|---|---|
| **Trigger** | Scroll-into-view, **fire once** (IntersectionObserver, threshold ~0.25, `disconnect()` after first intersection). Never autoplay offscreen; never infinite-loop a whole diagram. |
| **Element duration** | **0.4–0.6 s** (MPN = .55 s). Floor 0.3 s (faster reads as a glitch), cap 0.7 s (slower feels sluggish). |
| **Stagger step** | **60–120 ms** per element (.06 s for tight items like glyphs, .12 s for big cards). Tighter for many small items, looser for few big ones. |
| **Total sequence** | **≤ ~1.8 s** to fully settle; hard cap 2.5 s. A learner must never *wait on* a diagram. (MPN lands at ~1.85 s — treat as the ceiling, not the target.) |
| **Easing** | Entrances: ease-out `cubic-bezier(.2,.7,.2,1)`. Continuous pulses / bar-fills: `linear`. **No bounce, overshoot, or elastic** — toylike and off-brand. |
| **Transform budget** | `translateY` ≤ 8–10 px; `scale` within 0.96–1.0; always paired with `opacity` 0→1. No large slides or zooms. |
| **Reduced motion** | **Hard rule.** `prefers-reduced-motion: reduce` → render the *final* state, no JS arming, no transition. Non-negotiable, same status as the text-size floor in the design doc. |
| **Loop policy** | **Single-play by default.** An ambient loop must be slow (≥ 1.5 s period), subtle, reduced-motion-gated, and signed off — it is never a default. Sanctioned: (1) the LED2 "it's alive" blink on the last `BringupLadder` rung; (2) the recording LED on `DroneSharedAutonomy`'s drone (2.6 s, `.22`→`.95`). Both say the same thing — *this machine is powered and running* — which is the only thing a loop has ever been allowed to say here. A loop that decorates, or that competes with a Tier-P binding for attention, does not ship. |
| **Palette** | Moving elements keep their semantic brand colour (gold = power, blue = data, red = fault/limit **only**). No glow, neon trails, or off-palette hue. Same palette law as static diagrams. |
| **No layout shift** | Animate only `transform` / `opacity` / `clip`. Reserve the final space so the card never reflows — **CLS must be 0**. Jank on scroll-in is worse than no motion. |
| **Performance** | Composited properties only (`transform`, `opacity`). No animating `box-shadow` / `filter` over large areas. One IntersectionObserver per diagram; disconnect after it fires. |

## Implementation discipline (enforce by construction)

Build every animated diagram on the shared mechanisms — don't reinvent motion per
file. There are exactly **two** primitives, and they are not interchangeable:

- **`useScrollReveal`** — fire-once. Returns `armed` / `in` (with the
  reduced-motion bail). Backs Tiers A/B/C and the frame's own reveal. Plus shared
  CSS for the two-class reveal driven by a `--d` stagger custom property.
- **`useScrollParallax`** — continuous. Writes `--p` (-1..+1) on the element and
  lets CSS do the rest; never sets React state. Backs Tier P.

They answer different questions ("has it entered yet?" vs "where is it now?"), so
a third mechanism is a smell: if neither fits, the tier is probably wrong.

Tier-A diagrams then get the reveal for free; only Tier-B/C diagrams write custom
motion on top. `DiagramFrame` is a server component, so the reveal lives in a
thin client wrapper the frame opts into — server-render the final state, use
`"use client"` only for the observer.

The `armed`/`in` contract (from the reference):

```css
/* initial hidden state, only once JS has armed it */
.x.armed .anim { opacity: 0; transform: translateY(8px); }
/* settled state, staggered by each element's --d */
.x.armed.in .anim {
  opacity: 1; transform: none;
  transition: opacity .55s cubic-bezier(.2,.7,.2,1),
              transform .55s cubic-bezier(.2,.7,.2,1);
  transition-delay: var(--d, 0s);
}
@media (prefers-reduced-motion: reduce) {
  .x .anim { opacity: 1 !important; transform: none !important; transition: none !important; }
}
```

Because the initial-hidden state is gated behind `.armed` (set by JS), a
no-JS / SSR render shows the diagram fully visible — never blank.

## Pre-ship checklist

- [ ] Motion has a named teaching purpose (or it's Tier A reveal only).
- [ ] Fires once on scroll-in; nothing loops except a sanctioned, signed-off LED.
- [ ] Settles within ~1.8 s; element transitions 0.4–0.6 s; stagger 60–120 ms.
- [ ] Ease-out entrance curve; no bounce/overshoot.
- [ ] `prefers-reduced-motion: reduce` shows the final state, no motion, no jank.
- [ ] No layout shift (CLS 0); only `transform`/`opacity` animate.
- [ ] Moving elements keep brand-semantic colour; red motion only for fault/limit.
- [ ] Built on a shared primitive (`useScrollReveal` OR `useScrollParallax`), not a
      one-off re-implementation.

**Tier P also:**

- [ ] It's a Plate, and depth is load-bearing — you can say what it teaches.
- [ ] Only `transform` reads `--p`; no React state on scroll.
- [ ] Listener attached only while intersecting; rAF-throttled.
- [ ] Planted things don't move; connector-joined objects share one factor.
- [ ] Settled frame (`--p` unset) is the composition you want — it IS the raster.
- [ ] Motion **measured**, not eyeballed: sample the computed transforms across the
      sweep and under emulated reduced-motion.
- [ ] Verified at **360 px and 700 px** on the real `#08090D` ground (per the
      design-doc verification method).
```
