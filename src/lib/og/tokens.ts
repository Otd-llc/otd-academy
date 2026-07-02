// OG-side palette (Task 1).
//
// The share cards are BAKED DARK ARTIFACTS — Satori has no CSS custom-property
// support, so `var(--color-*)` tokens can't cross into ImageResponse. These are
// the hardcoded hex mirror of the DARK `@theme` block in src/app/globals.css.
// This is correct by design: a card never renders in light mode, so there is no
// token to resolve against. If globals.css dark values change, mirror them here.

export const OG = {
  // Fields
  DEEP_SPACE: "#08090d", // near-black navy background
  BG_2: "#0f1018", // slightly raised
  BG_3: "#1a1a2e",
  NAVY_DARK: "#1f2438", // panel fill / radial-wash target
  PANEL_BORDER: "#3a3f50", // hairline frame + panels
  DIAGRAM_SURFACE: "#1f2438",

  // Gold family (the primary accent)
  COMMAND_GOLD: "#c8963e",
  GOLD_LIGHT: "#e8b865",
  GOLD_DIM: "#8b6428",

  // Blue (secondary signal)
  SIGNAL_BLUE: "#4a8fff",
  BLUE_DIM: "#2a5fcc",

  // Ink
  TITLE: "#f1ece0", // warm ivory — headings
  TEXT: "#e8e8e8", // bright body
  MUTED: "#aaaaaa", // secondary / labels
  GRAY_3: "#555555", // faint / meta
} as const;

// Every OG card is the canonical 1200×630 (1.91:1) share dimension.
export const SIZE = { width: 1200, height: 630 } as const;
