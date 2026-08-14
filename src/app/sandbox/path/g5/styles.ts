// SANDBOX CSS — G5 convergence. Six ways to dress the same laced full card.
//
// Every device here is lifted from somewhere the house already uses it, so the round
// is choosing between OUR treatments rather than inventing six new ones:
//
//   leader dots      /hex `SpecRows` (R3): mono label, dotted rule, Saira value
//   corner ticks     /hex `Frame` (F5b): four bordered spans, not an svg
//   dimension line   /hex (P4): a caliper over a big Saira readout
//   accent bar       the configurator's floating label (`border-l-2`)
//   rule pair        /hex's `border-y border-command-gold/40` document band
//   numeral readout  the frontend-design signature: Saira, gold, tabular
//
// Sizes are container-query units off the cell, because a hex on this comb ranges from
// about 120px on a phone to 340px in the desktop column and a fixed px stack would be
// either illegible at one end or absurd at the other.
//
// Token-only colour, square corners. Two house rules the SHIPPED comb breaks and none
// of these do: `.phex-chip` carries `border-radius: 999px` (the pill ban) and
// `.phex:hover .phex-title` sets a literal `#fff` (the hardcoded-colour ban).

export const G5_CSS = `
/* A bench control, not a chrome default: hairline track, square gold thumb. */
.g5-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 170px;
  height: 14px;
  background: transparent;
  cursor: pointer;
}
.g5-slider:focus-visible {
  outline: none;
}
.g5-slider::-webkit-slider-runnable-track {
  height: 1px;
  background: var(--color-panel-border);
}
.g5-slider::-moz-range-track {
  height: 1px;
  background: var(--color-panel-border);
}
.g5-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 9px;
  height: 9px;
  margin-top: -4px;
  border: 0;
  background: var(--color-command-gold);
}
.g5-slider::-moz-range-thumb {
  width: 9px;
  height: 9px;
  border: 0;
  border-radius: 0;
  background: var(--color-command-gold);
}
.g5-slider:focus-visible::-webkit-slider-thumb,
.g5-slider:focus-visible::-moz-range-thumb {
  background: var(--color-gold-light);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-command-gold) 45%, transparent);
}

.g5-node {
  display: flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  container-type: inline-size;
}
.g5-node:focus-visible {
  outline: none;
}
/* The content block sits in the hex's widest band and never in its points. 62% of a
   flat-top cell is inside the silhouette at every height the stack occupies. */
.g5-inner {
  position: relative;
  z-index: 1;
  width: 62%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(4px, 2.4cqw, 9px);
  text-align: center;
}

.g5-eyebrow {
  font-family: var(--font-mono), monospace;
  font-size: clamp(7px, 2.9cqw, 10px);
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--accent);
}
.g5-name {
  font-family: var(--font-display), sans-serif;
  font-size: clamp(13px, 8.4cqw, 26px);
  line-height: 0.94;
  letter-spacing: 0.03em;
  color: var(--color-title);
  text-wrap: balance;
  transition: color 0.18s ease;
}
.g5-node:hover .g5-name,
.g5-node:focus-visible .g5-name {
  color: var(--color-gold-light);
}
.g5-unit {
  font-family: var(--font-mono), monospace;
  font-size: clamp(7px, 2.6cqw, 10px);
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--color-muted);
}

/* ── leader dots (from /hex SpecRows) ── */
.g5-spec {
  display: flex;
  width: 100%;
  align-items: baseline;
  gap: clamp(3px, 1.6cqw, 7px);
}
.g5-spec-label {
  font-family: var(--font-mono), monospace;
  font-size: clamp(7px, 2.6cqw, 10px);
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--color-muted);
}
.g5-spec-rule {
  flex: 1 1 auto;
  min-width: 0.5rem;
  transform: translateY(-2px);
  border-bottom: 1px dotted var(--color-panel-border);
}
.g5-spec-value {
  font-family: var(--font-numeral), sans-serif;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  font-size: clamp(11px, 4.6cqw, 18px);
  letter-spacing: 0.02em;
  color: var(--color-title);
}

/* ── dimension line (from /hex P4) ── */
.g5-caliper {
  display: flex;
  width: 100%;
  align-items: center;
  gap: clamp(3px, 1.6cqw, 7px);
}
.g5-caliper span:first-child,
.g5-caliper span:last-child {
  width: 1px;
  height: clamp(5px, 2.4cqw, 10px);
  background: color-mix(in srgb, var(--accent) 70%, transparent);
}
.g5-caliper span:nth-child(2) {
  flex: 1 1 auto;
  height: 1px;
  background: color-mix(in srgb, var(--accent) 70%, transparent);
}
.g5-readout {
  font-family: var(--font-numeral), sans-serif;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 0.9;
  letter-spacing: 0.02em;
  font-size: clamp(20px, 13cqw, 44px);
  color: var(--color-command-gold);
}

/* ── corner ticks (from /hex Frame) ── */
.g5-ticks {
  position: relative;
  width: 100%;
  padding: clamp(6px, 3.4cqw, 13px);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(4px, 2.4cqw, 9px);
}
.g5-tick {
  position: absolute;
  width: clamp(6px, 3.4cqw, 13px);
  height: clamp(6px, 3.4cqw, 13px);
  border-color: color-mix(in srgb, var(--accent) 70%, transparent);
}

/* ── rule pair (the document band) ── */
.g5-band {
  width: 100%;
  padding: clamp(4px, 2.6cqw, 10px) 0;
  border-top: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
}

/* ── accent bar (the configurator's floating label) ── */
.g5-bar {
  width: 100%;
  border-left: 2px solid var(--accent);
  padding-left: clamp(6px, 3.4cqw, 12px);
  text-align: left;
}

/* Square, never a pill. */
.g5-badge {
  font-family: var(--font-mono), monospace;
  font-weight: 700;
  font-size: clamp(7px, 2.6cqw, 10px);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--accent);
  border: 1px solid color-mix(in srgb, var(--accent) 55%, transparent);
  padding: clamp(1px, 1cqw, 4px) clamp(5px, 3.4cqw, 12px);
}
`;
