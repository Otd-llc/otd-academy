// Share-card primitives + the locked card template.
//
// The shared vocabulary every `opengraph-image` route composes from. The visual
// language is now FIXED: Josh picked FW7 (the "ivory ghost" — a large, faint
// warm-ivory brand mark bleeding off the right, over an open deep-space field
// with the radial wash, no hairline frame). `ShareCard` bakes that look; surfaces
// that need a right-side asset or a numeral hero compose `Field` + primitives
// directly.
//
// Satori rules obeyed throughout:
//   • Every element with >1 child sets `display: flex` explicitly (Satori throws
//     otherwise).
//   • No `var(--token)` — hex only, from ./tokens (cards are baked dark).
//   • SVG is inline with literal fill/stroke attributes.
//   • Fonts are matched by (family, weight); Saira MUST request weight 800.

import type { CSSProperties, ReactElement, ReactNode } from "react";
import { ImageResponse } from "next/og";
import { BRANDMARK_PATH, BRANDMARK_VIEWBOX } from "@/lib/pdf/certificate-content";
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

// ── Brand glyph ───────────────────────────────────────────────────────────────
// The One Thousand Drones drone-bee mark, drawn from the canonical shared path
// (same constant the certificate PNG + Field Guide PDF use, so they never drift).
// This is the field-guide watermark treatment: a large, low-opacity gold mark
// behind the content. `width` drives size (aspect locked 418:400); `opacity`
// dims the whole glyph; `style` positions it (usually absolute). Pass a brighter
// `fill` + high opacity for a crisp lockup instead of a watermark.
export function BrandGlyph({
  width = 420,
  fill = OG.COMMAND_GOLD,
  opacity = 0.08,
  style,
}: {
  width?: number;
  fill?: string;
  opacity?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={width}
      height={width * (400 / 418)}
      viewBox={BRANDMARK_VIEWBOX}
      style={{ opacity, ...style }}
    >
      <path d={BRANDMARK_PATH} fill={fill} fillRule="evenodd" />
    </svg>
  );
}

// ── Field (the locked shell) ──────────────────────────────────────────────────
// The deep-space field the winning look sits on. `wash` toggles the radial glow
// (on for the FW7 look); `frame` toggles the hairline border (off for FW7).
// Padding + fonts match the kit. Absolute children (watermark, frame) anchor to
// the card because Satori resolves absolute against the root.
export const WASH = `radial-gradient(1200px 620px at 82% -12%, ${OG.NAVY_DARK} 0%, ${OG.DEEP_SPACE} 58%)`;

export function Field({
  wash = true,
  frame = false,
  children,
}: {
  wash?: boolean;
  frame?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: OG.DEEP_SPACE,
        // Omit the key when off — Satori's background parser throws on undefined.
        ...(wash ? { backgroundImage: WASH } : {}),
        padding: "64px 80px",
        fontFamily: "Space Mono",
        color: OG.TEXT,
      }}
    >
      {children}
      {frame ? (
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
      ) : null}
    </div>
  );
}

// Body area that vertically centers its children in the free space between the
// wordmark row and the footer.
export function Center({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flexGrow: 1,
        justifyContent: "center",
      }}
    >
      {children}
    </div>
  );
}

// ── IvoryGhost (the FW7 watermark) ────────────────────────────────────────────
// The locked watermark: the brand mark in warm ivory, faint, bleeding off the
// right edge. Absolute so it never disturbs the content column.
export function IvoryGhost({
  width = 620,
  opacity = 0.07,
}: {
  width?: number;
  opacity?: number;
}) {
  return (
    <BrandGlyph
      width={width}
      opacity={opacity}
      fill={OG.TITLE}
      style={{ position: "absolute", right: -60, top: 24 }}
    />
  );
}

// ── ShareCard (the locked template) ───────────────────────────────────────────
// The FW7 look as one call: ivory-ghost watermark, wordmark masthead, an eyebrow
// (house ▸ by default) over a Bebas title, and the gold-rule footer. This is the
// default for every text-only surface (course, guide, root fallback). Surfaces
// with a right-side asset (library diagram, part render) or a numeral hero
// compose Field + primitives directly instead.
export function ShareCard({
  eyebrow,
  title,
  titleSize = 74,
  titleMaxWidth = 760,
  tri = true,
  footer,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  titleSize?: number;
  titleMaxWidth?: number;
  tri?: boolean;
  footer?: ReactNode;
}) {
  return (
    <Field wash frame={false}>
      <IvoryGhost />
      <Wordmark />
      <Center>
        <Eyebrow tri={tri}>{eyebrow}</Eyebrow>
        <CardTitle size={titleSize} maxWidth={titleMaxWidth}>
          {title}
        </CardTitle>
      </Center>
      {footer ?? <DefaultFooter />}
    </Field>
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
