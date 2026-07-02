// Share-card primitives (Task 1).
//
// The shared vocabulary every `opengraph-image` route composes from. These build
// the CONTRACT now (shell + eyebrow + title + numeral readout + hex badge +
// renderCard); the final visual language is fixed by the Task 2 sandbox pick and
// then restyled in place — callers keep working because the component surface
// stays put.
//
// Satori rules obeyed throughout:
//   • Every element with >1 child sets `display: flex` explicitly (Satori throws
//     otherwise).
//   • No `var(--token)` — hex only, from ./tokens (cards are baked dark).
//   • SVG is inline with literal fill/stroke attributes.
//   • Fonts are matched by (family, weight); Saira MUST request weight 800.

import type { ReactElement, ReactNode } from "react";
import { ImageResponse } from "next/og";
import { ogFonts } from "./fonts";
import { OG, SIZE } from "./tokens";

// ── Wordmark ────────────────────────────────────────────────────────────────
// ONE THOUSAND DRONES (ivory) · ACADEMY (gold), Bebas, wide-tracked. The fixed
// masthead on every card.
export function Wordmark() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        fontFamily: "Bebas Neue",
        fontSize: 40,
        letterSpacing: 7,
        lineHeight: 1,
      }}
    >
      <span style={{ color: OG.TITLE }}>ONE THOUSAND DRONES&nbsp;</span>
      <span style={{ color: OG.COMMAND_GOLD }}>ACADEMY</span>
    </div>
  );
}

// ── Default footer ────────────────────────────────────────────────────────────
// Gold rule + a mono tagline. Callers can pass their own footer to CardShell.
export function DefaultFooter({
  tagline = "One mind, many machines.",
}: {
  tagline?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "flex",
          height: 4,
          width: 200,
          backgroundColor: OG.COMMAND_GOLD,
          marginBottom: 18,
        }}
      />
      <div
        style={{
          display: "flex",
          fontFamily: "Space Mono",
          fontSize: 22,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: OG.MUTED,
        }}
      >
        {tagline}
      </div>
    </div>
  );
}

// ── Card shell ────────────────────────────────────────────────────────────────
// The deep-space field, radial wash, padding, hairline frame, wordmark masthead,
// and footer. `children` is the body, vertically centred in the free space.
export function CardShell({
  children,
  footer,
}: {
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: OG.DEEP_SPACE,
        backgroundImage: `radial-gradient(1200px 620px at 82% -12%, ${OG.NAVY_DARK} 0%, ${OG.DEEP_SPACE} 58%)`,
        padding: "68px 84px",
        color: OG.TEXT,
        fontFamily: "Space Mono",
      }}
    >
      <Wordmark />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          justifyContent: "center",
          paddingTop: 40,
          paddingBottom: 40,
        }}
      >
        {children}
      </div>
      {footer ?? <DefaultFooter />}
      {/* Hairline frame — absolute, drawn last, over the field. */}
      <div
        style={{
          position: "absolute",
          top: 22,
          left: 22,
          right: 22,
          bottom: 22,
          border: `1px solid ${OG.PANEL_BORDER}`,
          borderRadius: 18,
        }}
      />
    </div>
  );
}

// ── Eyebrow ───────────────────────────────────────────────────────────────────
// Space Mono, uppercase, wide-tracked, gold. The kicker above a title. The house
// ▸ lead is drawn as a real SVG triangle (`tri`) — the glyph U+25B8 is not in
// Space Mono and Satori has no fallback font, so a glyph would render as tofu.
// The // lead is just literal slashes in the text.
export function Eyebrow({
  children,
  tri = false,
}: {
  children: ReactNode;
  tri?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: 22 }}>
      {tri ? (
        <svg
          width={16}
          height={18}
          viewBox="0 0 16 18"
          style={{ marginRight: 16 }}
        >
          <polygon points="1,0 16,9 1,18" fill={OG.GOLD_LIGHT} />
        </svg>
      ) : null}
      <div
        style={{
          display: "flex",
          fontFamily: "Space Mono",
          fontWeight: 700,
          fontSize: 26,
          letterSpacing: 6,
          textTransform: "uppercase",
          color: OG.GOLD_LIGHT,
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ── Title ─────────────────────────────────────────────────────────────────────
// Bebas, ivory, tall. Bebas is caps-only display; long titles wrap tight at
// lineHeight ~1. `maxWidth` guards against a runaway single word.
export function CardTitle({
  children,
  size = 92,
  maxWidth = 1000,
}: {
  children: ReactNode;
  size?: number;
  maxWidth?: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        fontFamily: "Bebas Neue",
        fontSize: size,
        lineHeight: 1.0,
        letterSpacing: 1,
        color: OG.TITLE,
        maxWidth,
      }}
    >
      {children}
    </div>
  );
}

// ── Saira readout ─────────────────────────────────────────────────────────────
// The numeral moment: Saira 800 gold value + unit, muted label beneath. Used for
// tool exemplar values and stage counters. `tabular-nums` keeps digits aligned.
export function SairaReadout({
  value,
  unit,
  label,
}: {
  value: ReactNode;
  unit?: ReactNode;
  label?: ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "flex-end" }}>
        <div
          style={{
            display: "flex",
            fontFamily: "Saira Condensed",
            fontWeight: 800,
            fontSize: 150,
            lineHeight: 0.9,
            color: OG.COMMAND_GOLD,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {value}
        </div>
        {unit ? (
          <div
            style={{
              display: "flex",
              fontFamily: "Saira Condensed",
              fontWeight: 800,
              fontSize: 56,
              lineHeight: 1,
              color: OG.GOLD_LIGHT,
              marginLeft: 14,
              marginBottom: 14,
            }}
          >
            {unit}
          </div>
        ) : null}
      </div>
      {label ? (
        <div
          style={{
            display: "flex",
            fontFamily: "Space Mono",
            fontSize: 24,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: OG.MUTED,
            marginTop: 8,
          }}
        >
          {label}
        </div>
      ) : null}
    </div>
  );
}

// ── Hex badge ─────────────────────────────────────────────────────────────────
// The honeycomb signature: a pointy-top hex outline with a Saira numeral centred.
// Matches the .gh-hex node motif. SVG behind (absolute), number as the sole
// centred flex child.
export function HexBadge({
  n,
  size = 132,
  stroke = OG.COMMAND_GOLD,
}: {
  n: ReactNode;
  size?: number;
  stroke?: string;
}) {
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        <polygon
          points="50,3 93,26 93,74 50,97 7,74 7,26"
          fill="none"
          stroke={stroke}
          strokeWidth={3}
          strokeLinejoin="round"
        />
      </svg>
      <div
        style={{
          display: "flex",
          fontFamily: "Saira Condensed",
          fontWeight: 800,
          fontSize: size * 0.44,
          lineHeight: 1,
          color: stroke,
        }}
      >
        {n}
      </div>
    </div>
  );
}

// ── renderCard ────────────────────────────────────────────────────────────────
// The single seam to ImageResponse. Every route returns `renderCard(<CardShell…>)`.
export async function renderCard(node: ReactElement): Promise<ImageResponse> {
  return new ImageResponse(node, {
    width: SIZE.width,
    height: SIZE.height,
    fonts: await ogFonts(),
  });
}
