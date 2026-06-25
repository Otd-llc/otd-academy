// The Brain-to-Swarm curriculum system map (the document's centrepiece), a
// faithful render of the capability-brief PDF:
//   - the embossed gold seal (seal.png) as the L1.01 core,
//   - a backplane bus with 45-degree PCB-routed (chamfered) corners fanning to
//     the four track hexes (SENSE green / POWER red / COMMS blue / ACT gold),
//   - converging on the two capstone hexes (EEG, HUB), navy-filled with a gold
//     double ring and a star.
// One self-contained SVG, symmetric about the centre, so it scales as a unit and
// prints to the PDF identically.

const GOLD = "var(--color-command-gold)";

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

const TRACK_CY = 170;
const TRACK_S = 0.82;
const TRACK_TOP = TRACK_CY - 48 * TRACK_S; // 131
const TRACK_BOT = TRACK_CY + 48 * TRACK_S; // 209
const TOP_BUS = 104;
const BOT_RAIL = 246;
const CAP_CY = 312;
const CAP_S = 1.0;
const CAP_TOP = CAP_CY - 48 * CAP_S; // 264
const SEAL_CX = 380;
const SEAL_CY = 50;
const SEAL_R = 36;
const C = 14; // chamfer

const wire = {
  stroke: GOLD,
  strokeWidth: 1.4,
  strokeOpacity: 0.6,
  fill: "none",
} as const;

export function BriefSystemMap() {
  return (
    <svg
      viewBox="0 0 760 392"
      className="h-auto w-full"
      role="img"
      aria-label="The L1.01 core feeds a backplane bus that fans into four tracks, SENSE, POWER, COMMS and ACT, which converge on two capstones, the EEG brain-computer-interface front-end and the ESP-NOW fleet hub."
    >
      {/* Connectors: the chamfered backplane bus. */}
      {/* Seal drop into the top bus. */}
      <path d={`M${SEAL_CX} ${SEAL_CY + SEAL_R} L${SEAL_CX} ${TOP_BUS}`} {...wire} />
      {/* Top staple: SENSE up, across (chamfered ends), down into ACT. */}
      <path
        d={`M110 ${TRACK_TOP} L110 ${TOP_BUS + C} L${110 + C} ${TOP_BUS} L${650 - C} ${TOP_BUS} L650 ${TOP_BUS + C} L650 ${TRACK_TOP}`}
        {...wire}
      />
      {/* Inner track drops from the top bus. */}
      <path d={`M290 ${TOP_BUS} L290 ${TRACK_TOP}`} {...wire} />
      <path d={`M470 ${TOP_BUS} L470 ${TRACK_TOP}`} {...wire} />
      {/* Bottom staple: SENSE down, across (chamfered), up into ACT. */}
      <path
        d={`M110 ${TRACK_BOT} L110 ${BOT_RAIL - C} L${110 + C} ${BOT_RAIL} L${650 - C} ${BOT_RAIL} L650 ${BOT_RAIL - C} L650 ${TRACK_BOT}`}
        {...wire}
      />
      {/* Inner track drops into the bottom rail. */}
      <path d={`M290 ${TRACK_BOT} L290 ${BOT_RAIL}`} {...wire} />
      <path d={`M470 ${TRACK_BOT} L470 ${BOT_RAIL}`} {...wire} />
      {/* Rail drops to the two capstones. */}
      <path d={`M250 ${BOT_RAIL} L250 ${CAP_TOP}`} {...wire} />
      <path d={`M510 ${BOT_RAIL} L510 ${CAP_TOP}`} {...wire} />

      {/* Track hexes. */}
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

      {/* Capstone hexes (navy fill, gold double ring, star). */}
      {CAPS.map((c) => (
        <g key={c.code}>
          <polygon
            points={hexPoints(c.x, CAP_CY, CAP_S * 1.14)}
            fill="none"
            stroke={GOLD}
            strokeOpacity={0.45}
            strokeWidth={2}
            strokeLinejoin="round"
          />
          <polygon
            points={hexPoints(c.x, CAP_CY, CAP_S)}
            fill="var(--color-navy-dark)"
            stroke={GOLD}
            strokeWidth={3}
            strokeLinejoin="round"
          />
          <text x={c.x} y={CAP_CY - 16} textAnchor="middle" fontSize={16} fill={GOLD}>
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

      {/* Seal core (embossed medallion) + label to the right. */}
      <image
        href="/brand/seal.png"
        x={SEAL_CX - SEAL_R - 2}
        y={SEAL_CY - SEAL_R - 2}
        width={(SEAL_R + 2) * 2}
        height={(SEAL_R + 2) * 2}
      />
      <text
        x={SEAL_CX + SEAL_R + 14}
        y={SEAL_CY - 6}
        fontSize={13}
        fontWeight={700}
        letterSpacing={1.5}
        fill={GOLD}
        style={{ fontFamily: "var(--font-mono, monospace)" }}
      >
        L1.01 · THE CORE
      </text>
      <text
        x={SEAL_CX + SEAL_R + 14}
        y={SEAL_CY + 12}
        fontSize={11}
        fill="var(--color-muted)"
        style={{ fontFamily: "var(--font-mono, monospace)" }}
      >
        free, public root board
      </text>
    </svg>
  );
}
