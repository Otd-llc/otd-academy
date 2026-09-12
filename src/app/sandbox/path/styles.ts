// SANDBOX CSS for the go-further round. Injected by the page rather than added to
// globals.css: a sandbox is deleted once the owner picks, and whatever survives gets
// promoted deliberately.
//
// Token-only colour throughout, which is not just tidiness here. The comb this round
// replaces feeds `--accent` from a map of LITERAL hex values, so its accent is the one
// thing on /courses that cannot flip under the light token block. Every accent below
// resolves through `var(--color-*)`, and the theme toggle on this page is what proves
// it.

export const PATH_SANDBOX_CSS = `
.pv-node {
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  text-decoration: none;
  container-type: inline-size;
}
.pv-node:focus-visible {
  outline: none;
}
.pv-stack {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(4px, 3cqw, 10px);
  padding: 0 14%;
}

/* The lesson ribbon's own pairing: a big Saira figure with a wide-tracked mono label
   beneath it. The figure's size is set inline per cell, because it has to track the
   measured cell rather than a clamp that stalls once the hex gets large. */
.pv-code {
  font-family: var(--font-numeral), sans-serif;
  font-weight: 800;
  line-height: 0.85;
  letter-spacing: 0.02em;
  color: var(--color-title);
  transition: color 0.18s ease;
}
.pv-node.flag .pv-code {
  color: var(--color-command-gold);
}
.pv-sub {
  font-family: var(--font-mono), monospace;
  font-size: clamp(8px, 3.4cqw, 11px);
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--accent);
}
.pv-name {
  font-family: var(--font-display), sans-serif;
  font-size: clamp(15px, 11cqw, 30px);
  line-height: 0.92;
  letter-spacing: 0.03em;
  color: var(--color-title);
  text-wrap: balance;
  transition: color 0.18s ease;
}
.pv-node:hover .pv-name,
.pv-node:focus-visible .pv-name {
  color: var(--color-gold-light);
}
.pv-chip {
  font-family: var(--font-mono), monospace;
  font-weight: 700;
  font-size: clamp(8px, 3.4cqw, 11px);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--accent);
  border: 1px solid var(--accent);
  padding: clamp(2px, 1.4cqw, 5px) clamp(8px, 4.4cqw, 15px);
}

/* The code as a watermark behind the name, the same device the body combs use for
   their ordinal, and at the same strength: 14%, which is the number the composited
   contrast measurement landed on. */
/* Clipped to its own hex, exactly as the body combs clip their ordinal. Without
   this the mark runs straight across the neighbours, which is very visible on a
   laced run where the neighbours overlap. The polygon has to match the cell's
   ORIENTATION, so it arrives as a variable rather than being assumed. */
.pv-mark {
  position: absolute;
  inset: 0;
  clip-path: var(--hex-clip);
  z-index: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  font-family: var(--font-numeral), sans-serif;
  font-weight: 800;
  line-height: 1;
  letter-spacing: 0.02em;
  color: transparent;
  background-image: linear-gradient(
    to bottom,
    transparent 0%,
    color-mix(in srgb, var(--color-gold-light) 14%, transparent) 100%
  );
  -webkit-background-clip: text;
  background-clip: text;
}

`;
