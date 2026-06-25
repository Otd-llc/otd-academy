// Portrait variant of the curriculum system map for narrow screens. The desktop
// map (BriefSystemMap) is wide (760x392); scaled down to a phone its labels turn
// illegible, so this lays the same flow out vertically: the L1.01 core at top, a
// spine fanning to the four tracks (SENSE / POWER / COMMS / ACT) in a 2x2 block,
// then down to the two capstones (EEG, HUB). Bigger type, readable at ~320px.
// Used by BriefDocumentMobile.

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

const SPINE_X = 180;
const SEAL_CY = 50;
const SEAL_R = 38;
const TRACK_S = 0.92;
const ROW1 = 222;
const ROW2 = 350;
const COL_L = 100;
const COL_R = 260;
const SPINE_TOP = 138;
const SPINE_BOT = 430;
const CAP_RAIL = 452;
const CAP_CY = 506;
const CAP_S = 0.9;
const CAP_L = 110;
const CAP_R = 250;

const TRACKS = [
  { code: "SENSE", x: COL_L, y: ROW1, color: "var(--color-status-green)" },
  { code: "POWER", x: COL_R, y: ROW1, color: "var(--color-alert-red)" },
  { code: "COMMS", x: COL_L, y: ROW2, color: "var(--color-signal-blue)" },
  { code: "ACT", x: COL_R, y: ROW2, color: GOLD },
] as const;

const CAPS = [
  { code: "EEG", x: CAP_L, sub: "READ THE BRAIN" },
  { code: "HUB", x: CAP_R, sub: "COMMAND THE SWARM" },
] as const;

const wire = {
  stroke: GOLD,
  strokeWidth: 1.6,
  strokeOpacity: 0.55,
  fill: "none",
  strokeLinejoin: "round",
} as const;

export function BriefSystemMapMobile() {
  const innerEdge = 43 * TRACK_S; // hex half-width at the spine side
  return (
    <svg
      viewBox="0 0 360 582"
      className="h-auto w-full"
      role="img"
      aria-label="The L1.01 core feeds a spine that fans into four tracks, SENSE, POWER, COMMS and ACT, which converge on two capstones: the EEG brain-computer-interface front-end and the ESP-NOW fleet hub."
    >
      {/* Spine from the core down to the capstone rail. */}
      <path d={`M${SPINE_X} ${SPINE_TOP} L${SPINE_X} ${SPINE_BOT}`} {...wire} />
      {/* Branches to each track hex. */}
      {TRACKS.map((t) => (
        <path
          key={`b-${t.code}`}
          d={`M${SPINE_X} ${t.y} L${t.x < SPINE_X ? t.x + innerEdge : t.x - innerEdge} ${t.y}`}
          {...wire}
        />
      ))}
      {/* Rail down to the two capstones. */}
      <path
        d={`M${SPINE_X} ${SPINE_BOT} L${SPINE_X} ${CAP_RAIL} L${CAP_L} ${CAP_RAIL} L${CAP_L} ${CAP_CY - 48 * CAP_S}`}
        {...wire}
      />
      <path
        d={`M${SPINE_X} ${SPINE_BOT} L${SPINE_X} ${CAP_RAIL} L${CAP_R} ${CAP_RAIL} L${CAP_R} ${CAP_CY - 48 * CAP_S}`}
        {...wire}
      />

      {/* Track hexes. */}
      {TRACKS.map((t) => (
        <g key={t.code}>
          <polygon
            points={hexPoints(t.x, t.y, TRACK_S)}
            fill="color-mix(in srgb, var(--color-deep-space) 65%, transparent)"
            stroke={t.color}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
          <text
            x={t.x}
            y={t.y}
            dominantBaseline="central"
            textAnchor="middle"
            fontSize={16}
            fontWeight={700}
            letterSpacing={1.2}
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
          <text x={c.x} y={CAP_CY - 13} textAnchor="middle" fontSize={14} fill={GOLD}>
            ★
          </text>
          <text
            x={c.x}
            y={CAP_CY + 9}
            textAnchor="middle"
            fontSize={18}
            fontWeight={700}
            letterSpacing={1.2}
            fill={GOLD}
            style={{ fontFamily: "var(--font-mono, monospace)" }}
          >
            {c.code}
          </text>
          <text
            x={c.x}
            y={CAP_CY + 48 * CAP_S + 18}
            textAnchor="middle"
            fontSize={10}
            letterSpacing={1}
            fill="var(--color-muted)"
            style={{ fontFamily: "var(--font-mono, monospace)" }}
          >
            {c.sub}
          </text>
        </g>
      ))}

      {/* Core seal + label. */}
      <image
        href="/brand/seal.png"
        x={SPINE_X - SEAL_R}
        y={SEAL_CY - SEAL_R}
        width={SEAL_R * 2}
        height={SEAL_R * 2}
      />
      <text
        x={SPINE_X}
        y={SEAL_CY + SEAL_R + 21}
        textAnchor="middle"
        fontSize={13}
        fontWeight={700}
        letterSpacing={1.2}
        fill={GOLD}
        style={{ fontFamily: "var(--font-mono, monospace)" }}
      >
        L1.01 · THE CORE
      </text>
      <text
        x={SPINE_X}
        y={SEAL_CY + SEAL_R + 37}
        textAnchor="middle"
        fontSize={10}
        fill="var(--color-muted)"
        style={{ fontFamily: "var(--font-mono, monospace)" }}
      >
        free, public root board
      </text>
    </svg>
  );
}
