// SANDBOX CSS — the round's own rules, injected by the pages rather than added to
// globals.css. A sandbox is deleted when the owner has picked; whatever survives gets
// promoted deliberately, and nothing that does not gets left behind in the stylesheet.
//
// Colour is token-only throughout, exactly as a shipped rule would have to be, so the
// theme toggle proves the treatment flips instead of the round proving nothing.

export const SANDBOX_CSS = `
/* ── lifted out of globals.css ──────────────────────────────────────────
   These style the THREE-POINT control (V0): the per-cell ortho prism shell and the
   path-direction arrows. Nothing in production renders either any more, so serving
   them to every visitor of every page bought nothing. They live here now, with the
   only thing that still draws them. */
/* Ortho-3D prism shell ('HexPrism', sandbox winner H4+K10, 2026-07-07) — the
   /courses combs render each hex as a thin prism: opaque face (gh-top), a
   down-right cast (gh-cast lines) whose faces fill with the field color
   (gh-side, the solid slab). Scoped under .gh-3d so the hub's flat
   '.gh-hex polygon' rules stay untouched. Occlusion rides per-cell zIndex
   (grows with 'left', set inline by the components) — no hover/current z bumps,
   exactly the approved sandbox render. */
.gh-3d .gh-top {
  fill: var(--color-deep-space);
  stroke: var(--color-panel-border);
  stroke-width: 3;
  vector-effect: non-scaling-stroke;
  transition: stroke 0.15s;
}
.gh-3d .gh-cast {
  fill: none;
  stroke: var(--color-panel-border);
  stroke-width: 1.25;
  stroke-linejoin: round;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
  transition: stroke 0.15s;
}
.gh-3d .gh-side {
  fill: var(--color-deep-space);
  stroke: var(--color-panel-border);
  stroke-width: 1.25;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
  transition: stroke 0.15s;
}
.gh-node.done .gh-3d .gh-top {
  fill: url(#gh-honey);
  stroke: #eab94d;
}
.gh-node.done .gh-3d :is(.gh-cast, .gh-side) {
  stroke: #eab94d;
}
.gh-node.current .gh-3d :is(.gh-top, .gh-cast, .gh-side) {
  stroke: var(--color-command-gold);
}
.gh-node.current .gh-3d .gh-top {
  filter: drop-shadow(
    0 0 8px color-mix(in srgb, var(--color-command-gold) 60%, transparent)
  );
  animation: gh-pulse 1.8s ease-in-out infinite;
}
.gh-node.blocked .gh-3d :is(.gh-top, .gh-cast, .gh-side) {
  stroke: var(--color-alert-red);
}
.gh-node:hover .gh-3d :is(.gh-top, .gh-cast, .gh-side) {
  stroke: var(--color-gold-light);
}
.gh-node.sk-goal .gh-3d .gh-top {
  filter: drop-shadow(
    0 0 10px color-mix(in srgb, var(--color-command-gold) 45%, transparent)
  );
}
@media (prefers-reduced-motion: reduce) {
  .gh-node.current .gh-3d .gh-top {
    animation: none;
  }
}

/* path-direction arrows (K10: 12 × 10 triangle, base 7 off the seam, on the
   destination face). Gold = traversed (source done); dim = ahead. Hovering or
   focusing a hex lights ITS outgoing arrow (the .hot class, set by the
   component) so the next step reads off the hover. Overlay sits above every
   prism cell and never intercepts the pointer. */
.sk-arw {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
  z-index: 500;
}
/* z-index note: this used to be 10000, because cell wrappers carried zIndex ≈ their
   'left' for the old cast-occlusion order and reached 700+ on wide layouts. Cells now
   carry their DEPTH order instead — one per cell, so a comb of 22 tops out at 22 —
   and the overlay only has to clear that. */
.sk-arw path {
  transition:
    fill 0.15s,
    filter 0.15s;
  animation: sk-arwdrift 2.6s ease-in-out infinite;
}
.sk-arw g.on path {
  fill: var(--color-command-gold);
}
.sk-arw g.off path {
  fill: color-mix(in srgb, var(--color-panel-border) 90%, transparent);
}
.sk-arw g.hot path {
  fill: var(--color-gold-light);
  filter: drop-shadow(
    0 0 6px color-mix(in srgb, var(--color-gold-light) 70%, transparent)
  );
}
/* the subtle forward drift (the footer Next-arrow motif, quieter): each arrow
   breathes ~3px along its own flow direction (the parent g carries the
   rotation, so translateX IS the path direction). Staggered per-arrow via an
   inline animation-delay so the path reads as a slow wave. */
@keyframes sk-arwdrift {
  0%,
  100% {
    transform: translateX(0);
  }
  50% {
    transform: translateX(3px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .sk-arw path {
    animation: none;
  }
}


/* ── the artwork layer ────────────────────────────────────────────────
   Hoisted out of the cells so a board or a stage tile paints over the WHOLE comb.
   A cell is an absolutely-positioned, z-indexed box, which is a stacking context,
   so art parented inside one can never rise above the next cell's outline, and at
   the sizes a vertical comb uses those outlines cut straight across the boards.
   Hover is driven by the class the cell layer sets, since this layer takes no
   pointer events of its own. */
.cv-art-layer {
  position: absolute;
  inset: 0;
  z-index: 6;
  pointer-events: none;
}
.cv-art-layer .gh-node {
  pointer-events: none;
}
.cv-art-layer .gh-node.hot .gh-art {
  transform: scale(1);
}

/* ── the ordinal watermark ───────────────────────────────────────────
   The shipped '.comb-num' paints a gradient that runs from transparent at the top of
   the face to 32% gold-light at the BOTTOM. On the shipped 3-up comb that is quiet.
   On a big vertical cell it is not, and worse, the strong end lands exactly where the
   title, the lead and the chip live, so the loudest part of a decorative watermark
   sits directly behind the only type on the face.

   That is also what made the first contrast measurement wrong. It sampled the ink
   against the FACE FILL, which is not what is behind the glyphs; the watermark is,
   and the composited backdrop is several stops lighter than the face.

   The strength is now a variable so it can be trimmed against real type instead of
   argued about. Both themes are re-declared, because globals re-points this gradient
   for light and a single rule here would only fix one of them. */
.gh .comb-num {
  background-image: linear-gradient(
    to bottom,
    transparent 0%,
    color-mix(in srgb, var(--color-gold-light) var(--num-alpha, 32%), transparent) 100%
  );
}
:root[data-theme="light"] .gh .comb-num {
  background-image: linear-gradient(
    to bottom,
    transparent 8%,
    color-mix(in srgb, var(--color-gold-light) var(--num-alpha, 20%), transparent) 100%
  );
}

/* ── the round's own sliders ──────────────────────────────────────────
   A bench control, so it reads as one: a hairline track, a square gold thumb, no
   pill and no chrome default. */
.cv-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 150px;
  height: 14px;
  background: transparent;
  cursor: pointer;
}
.cv-slider:focus-visible {
  outline: none;
}
.cv-slider::-webkit-slider-runnable-track {
  height: 1px;
  background: var(--color-panel-border);
}
.cv-slider::-moz-range-track {
  height: 1px;
  background: var(--color-panel-border);
}
.cv-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 9px;
  height: 9px;
  margin-top: -4px;
  background: var(--color-command-gold);
  border: 0;
}
.cv-slider::-moz-range-thumb {
  width: 9px;
  height: 9px;
  border: 0;
  border-radius: 0;
  background: var(--color-command-gold);
}
.cv-slider:focus-visible::-webkit-slider-thumb {
  background: var(--color-gold-light);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-command-gold) 45%, transparent);
}
.cv-slider:focus-visible::-moz-range-thumb {
  background: var(--color-gold-light);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-command-gold) 45%, transparent);
}

/* ── type that grows with the hex ─────────────────────────────────────
   The shipped rules cap the title at 32px, the lead at 15px and the chip at 10px,
   which is right for a 3-up comb whose cells are about 300px wide. A vertical run
   makes cells two or three times that, and at those sizes the caps stop the content
   growing with the hex: the type stalls and a large face fills with empty. This
   block drops the ceilings and keeps the proportion. */
.cv-fill .gh-title {
  font-size: 10cqw;
}
.cv-fill.sk-lean .gh-title,
.cv-fill .sk-lean .gh-title {
  font-size: 10.5cqw;
}
.cv-fill .gh-lead {
  font-size: 4.8cqw;
}
.cv-fill .gh-chip {
  font-size: 3.2cqw;
  padding: 1.3cqw 4cqw;
}
`;
