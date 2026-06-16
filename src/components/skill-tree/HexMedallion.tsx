// Hexagon state medallion for the skill path (server component, presentational).
//
// The "game skill-tree" node: a pointy-top hex whose RIM is the track colour and
// whose fill/glyph encode the node STATE. Capstones get a larger gold double-ring
// with a ★. The next step pulses. The hex carries the state at a glance; the
// readable title/tagline live in the slab beside it (a hex can't hold "ESP32-S3
// USB-C Breakout Board"). Honeycomb + copper-trace motif = OTD's hive/PCB theme.
//
// SVG stroke uses the globals.css `--color-*` CSS vars (same approach the old
// edge overlay used), so the palette stays single-sourced.

import type { NodeState } from "@/lib/skill-tree-core";

// Track → rim colour (CSS var). Null track falls back to muted.
const TRACK_STROKE: Record<string, string> = {
  SENSE: "var(--color-status-green)",
  ACT: "var(--color-command-gold)",
  COMMS: "var(--color-signal-blue)",
  POWER: "var(--color-alert-red)",
};

// Pointy-top hexagon on a 100×100 box — top/bottom VERTICES at x=50 so a vertical
// rail threads medallion-to-medallion point-to-point.
const HEX = "50,2 93,26 93,74 50,98 7,74 7,26";

export interface HexMedallionProps {
  state: NodeState;
  track: string | null; // "SENSE" | "ACT" | "COMMS" | "POWER" | null
  level: string | null; // "L1" | "L2" | "L3" | null
  isNext: boolean;
  isCapstone: boolean;
}

export function HexMedallion({
  state,
  track,
  level,
  isNext,
  isCapstone,
}: HexMedallionProps) {
  const GOLD = "var(--color-command-gold)";
  const trackRim = (track && TRACK_STROKE[track]) || "var(--color-muted)";
  const done = state === "done";
  const locked =
    state === "locked-prereq" ||
    state === "locked-paywall" ||
    state === "locked-account";
  const comingSoon = state === "coming-soon";
  const actionable = state === "available" || state === "preview";

  // OTD is gold-forward: the STATE emphasis is gold (done/available/capstone
  // are the hero treatment), and the per-track colour is demoted to a quiet,
  // dim rim accent on the not-yet-reachable nodes (locked / coming-soon). The
  // track is still legible from the slab's track chip beside the hex.
  const emphasised = done || actionable || isCapstone;
  const stroke = emphasised ? GOLD : trackRim;
  const strokeOpacity = emphasised ? 1 : locked ? 0.4 : 0.3;
  const fill = done
    ? GOLD
    : actionable
      ? "color-mix(in srgb, var(--color-deep-space) 70%, transparent)"
      : "color-mix(in srgb, var(--color-deep-space) 40%, transparent)";

  // Centre glyph: ✓ done · ★ capstone · 🔒 locked · level otherwise.
  const glyph = done ? "✓" : isCapstone ? "★" : locked ? "🔒" : (level ?? "");
  const glyphColor = done
    ? "var(--color-deep-space)"
    : isCapstone || actionable
      ? GOLD
      : "var(--color-muted)";

  const size = isCapstone ? 72 : 52;
  const capRim = stroke;

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center ${
        isNext ? "animate-pulse" : ""
      }`}
      style={{
        width: size,
        height: size,
        filter: emphasised
          ? `drop-shadow(0 0 6px var(--color-command-gold))`
          : undefined,
      }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 100 100" width={size} height={size}>
        {/* Capstone outer ring. */}
        {isCapstone ? (
          <polygon
            points={HEX}
            fill="none"
            stroke={capRim}
            strokeOpacity={0.5}
            strokeWidth={3}
            transform="scale(1.12) translate(-6 -6)"
          />
        ) : null}
        <polygon
          points={HEX}
          fill={fill}
          stroke={capRim}
          strokeOpacity={strokeOpacity}
          strokeWidth={isCapstone ? 6 : 4}
          strokeDasharray={comingSoon ? "5 5" : undefined}
          strokeLinejoin="round"
        />
        <text
          x="50"
          y="50"
          dominantBaseline="central"
          textAnchor="middle"
          fontSize={isCapstone ? 30 : glyph.length > 1 ? 26 : 34}
          fontWeight="700"
          fill={glyphColor}
          style={{ fontFamily: "var(--font-mono, monospace)" }}
        >
          {glyph}
        </text>
      </svg>
    </span>
  );
}
