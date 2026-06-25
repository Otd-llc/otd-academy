// The Brain-to-Swarm curriculum system map, the brief's signature element.
//
// A web port of the capability-brief PDF: the gold bee seal as the L1.01 core,
// a backplane bus fanning to the four track hexes (SENSE / POWER / COMMS / ACT,
// each in its track colour), converging on the two capstone hexes (EEG, HUB).
// One self-contained, responsive SVG so it scales as a unit. Pointy-top hex
// geometry + track colours match the /courses skill tree (HexMedallion).

import { BRANDMARK_PATH, BRANDMARK_VIEWBOX } from "@/lib/pdf/certificate-content";

const GOLD = "var(--color-command-gold)";

// Pointy-top hex vertices relative to its centre (base "radius" ~48 tall).
const HEX = [
  [0, -48],
  [43, -24],
  [43, 24],
  [0, 48],
  [-43, 24],
  [-43, -24],
] as const;

function hexPoints(cx: number, cy: number, s: number): string {
  return HEX.map(([dx, dy]) => `${cx + dx * s},${cy + dy * s}`).join(" ");
}

const TRACKS = [
  { code: "SENSE", x: 110, color: "var(--color-status-green)" },
  { code: "POWER", x: 290, color: "var(--color-alert-red)" },
  { code: "COMMS", x: 470, color: "var(--color-signal-blue)" },
  { code: "ACT", x: 650, color: GOLD },
] as const;

const CAPS = [
  { code: "EEG", x: 250, sub: "READ THE BRAIN" },
  { code: "HUB", x: 510, sub: "COMMAND THE SWARM" },
] as const;

const TRACK_CY = 210;
const TOP_BUS = 150;
const BOT_RAIL = 312;
const CAP_CY = 382;
const TRACK_S = 0.82;
const CAP_S = 1.0;
const wire = { stroke: GOLD, strokeWidth: 1.4, strokeOpacity: 0.55, fill: "none" } as const;

export function BriefSystemMap() {
  return (
    <svg
      viewBox="0 0 760 470"
      className="h-auto w-full"
      role="img"
      aria-label="The L1.01 core feeds a backplane bus that fans into four tracks, SENSE, POWER, COMMS and ACT, which converge on two capstones, the EEG brain-computer-interface front-end and the ESP-NOW fleet hub."
    >
      {/* ── Connectors: the backplane bus ─────────────────────────── */}
      {/* Seal feeds the top bus. */}
      <line x1={340} y1={104} x2={340} y2={TOP_BUS} {...wire} />
      <line x1={110} y1={TOP_BUS} x2={650} y2={TOP_BUS} {...wire} />
      {/* Drops from the top bus to each track. */}
      {TRACKS.map((t) => (
        <line
          key={`td-${t.code}`}
          x1={t.x}
          y1={TOP_BUS}
          x2={t.x}
          y2={TRACK_CY - 48 * TRACK_S}
          {...wire}
        />
      ))}
      {/* Tracks feed the bottom rail. */}
      {TRACKS.map((t) => (
        <line
          key={`tb-${t.code}`}
          x1={t.x}
          y1={TRACK_CY + 48 * TRACK_S}
          x2={t.x}
          y2={BOT_RAIL}
          {...wire}
        />
      ))}
      <line x1={110} y1={BOT_RAIL} x2={650} y2={BOT_RAIL} {...wire} />
      {/* Rail drops to the two capstones. */}
      {CAPS.map((c) => (
        <line
          key={`cd-${c.code}`}
          x1={c.x}
          y1={BOT_RAIL}
          x2={c.x}
          y2={CAP_CY - 48 * CAP_S}
          {...wire}
        />
      ))}

      {/* ── Track hexes ───────────────────────────────────────────── */}
      {TRACKS.map((t) => (
        <g key={t.code}>
          <polygon
            points={hexPoints(t.x, TRACK_CY, TRACK_S)}
            fill="color-mix(in srgb, var(--color-deep-space) 65%, transparent)"
            stroke={t.color}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
          <text
            x={t.x}
            y={TRACK_CY}
            dominantBaseline="central"
            textAnchor="middle"
            fontSize={15}
            fontWeight={700}
            letterSpacing={1.5}
            fill={t.color}
            style={{ fontFamily: "var(--font-mono, monospace)" }}
          >
            {t.code}
          </text>
        </g>
      ))}

      {/* ── Capstone hexes (double gold ring + star) ──────────────── */}
      {CAPS.map((c) => (
        <g key={c.code}>
          <polygon
            points={hexPoints(c.x, CAP_CY, CAP_S * 1.13)}
            fill="none"
            stroke={GOLD}
            strokeOpacity={0.4}
            strokeWidth={2}
            strokeLinejoin="round"
          />
          <polygon
            points={hexPoints(c.x, CAP_CY, CAP_S)}
            fill="color-mix(in srgb, var(--color-command-gold) 8%, var(--color-deep-space))"
            stroke={GOLD}
            strokeWidth={3}
            strokeLinejoin="round"
          />
          <text
            x={c.x}
            y={CAP_CY - 16}
            textAnchor="middle"
            fontSize={16}
            fill={GOLD}
          >
            ★
          </text>
          <text
            x={c.x}
            y={CAP_CY + 8}
            textAnchor="middle"
            fontSize={20}
            fontWeight={700}
            letterSpacing={1.5}
            fill={GOLD}
            style={{ fontFamily: "var(--font-mono, monospace)" }}
          >
            {c.code}
          </text>
          <text
            x={c.x}
            y={CAP_CY + 48 * CAP_S + 20}
            textAnchor="middle"
            fontSize={11}
            letterSpacing={2}
            fill="var(--color-muted)"
            style={{ fontFamily: "var(--font-mono, monospace)" }}
          >
            {c.sub}
          </text>
        </g>
      ))}

      {/* ── Seal core (gold rings + bee) ──────────────────────────── */}
      <circle cx={340} cy={66} r={36} fill="var(--color-deep-space)" stroke={GOLD} strokeWidth={2} />
      <circle cx={340} cy={66} r={29} fill="none" stroke={GOLD} strokeWidth={1} strokeOpacity={0.6} />
      <svg x={340 - 24} y={66 - 24} width={48} height={48} viewBox={BRANDMARK_VIEWBOX}>
        <path d={BRANDMARK_PATH} fill={GOLD} />
      </svg>
      <text
        x={392}
        y={60}
        fontSize={13}
        fontWeight={700}
        letterSpacing={1.5}
        fill={GOLD}
        style={{ fontFamily: "var(--font-mono, monospace)" }}
      >
        L1.01 · THE CORE
      </text>
      <text
        x={392}
        y={78}
        fontSize={11}
        fill="var(--color-muted)"
        style={{ fontFamily: "var(--font-mono, monospace)" }}
      >
        free, public root board
      </text>
    </svg>
  );
}
