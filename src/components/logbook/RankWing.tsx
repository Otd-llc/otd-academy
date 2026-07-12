// The rank wing emblem (LOCKED 2026-07-11). Authentic pilot wing: a wide
// symmetric feathered wing + a central device that changes every 4-level tier
// (roundel → hex → shield), with a rank device above that escalates WITHIN the
// tier — 1 star · 2 stars · triad · triad + a large star in the central device.
// Feathers grow with rank. Pure SVG (token colors); safe server or client.
import { CENTER_SET, wingTierOf, tierPos } from "@/lib/logbook/rank";

const G = "var(--color-command-gold)";
const GL = "var(--color-gold-light)";

function starPath(cx: number, cy: number, ro: number, ri: number) {
  let d = "";
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? ri : ro;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    d += (i ? "L" : "M") + (cx + Math.cos(a) * r).toFixed(1) + " " + (cy + Math.sin(a) * r).toFixed(1);
  }
  return d + "Z";
}

function Feathers({ count, c }: { count: number; c: string }) {
  const out: React.ReactNode[] = [];
  for (const side of [-1, 1] as const) {
    for (let i = 0; i < count; i++) {
      const f = count === 1 ? 0 : i / (count - 1);
      const len = 24 - f * 11;
      const bx = 32 + side * 5, by = 33 + (f - 0.4) * 6;
      const tx = 32 + side * (5 + len), ty = 33 + (f - 0.4) * 15;
      const w = 1.5 - f * 0.5;
      out.push(
        <path key={`${side}${i}`} d={`M${bx} ${(by - w).toFixed(1)}L${tx.toFixed(1)} ${ty.toFixed(1)}L${bx} ${(by + w).toFixed(1)}Z`} fill={c} />,
      );
    }
  }
  return <>{out}</>;
}

function Device({ t, centerStar, accent }: { t: (typeof CENTER_SET)[number]; centerStar: boolean; accent: string }) {
  const cy = 32;
  const shell =
    t === "roundel" ? (
      <circle cx="32" cy={cy} r="5.5" fill="none" stroke={accent} strokeWidth={1.3} />
    ) : t === "hexagon" ? (
      <path d={`M32 ${cy - 6.5}l6 3.5v6l-6 3.5-6-3.5v-6z`} fill="none" stroke={accent} strokeWidth={1.3} />
    ) : (
      <path d={`M32 ${cy - 6}l5.5 2v4.5c0 3-2.2 5-5.5 6.5-3.3-1.5-5.5-3.5-5.5-6.5V${cy - 4}z`} fill="none" stroke={accent} strokeWidth={1.3} />
    );
  return (
    <>
      {shell}
      {centerStar ? (
        <path d={starPath(32, cy + 0.5, 4, 1.6)} fill={accent} />
      ) : (
        <circle cx="32" cy={cy + 0.5} r="1.3" fill={accent} />
      )}
    </>
  );
}

function Above({ pos, c }: { pos: number; c: string }) {
  if (pos === 1) return <path d={starPath(32, 14, 3, 1.2)} fill={c} />;
  if (pos === 2)
    return <>{[28.5, 35.5].map((x) => <path key={x} d={starPath(x, 14, 2.8, 1.1)} fill={c} />)}</>;
  return (
    <>
      <path d={starPath(32, 13, 3.2, 1.3)} fill={c} />
      <path d={starPath(24.5, 15, 2.4, 0.95)} fill={c} />
      <path d={starPath(39.5, 15, 2.4, 0.95)} fill={c} />
    </>
  );
}

export function RankWing({
  level,
  earned = true,
  size = 34,
}: {
  level: number;
  earned?: boolean;
  size?: number;
}) {
  const c = earned ? G : "var(--color-gray-3)";
  const accent = earned ? GL : "var(--color-gray-3)";
  const tier = wingTierOf(level);
  const pos = tierPos(level);
  const count = Math.min(11, 4 + Math.round(level * 0.7));
  return (
    <svg viewBox="0 0 64 52" style={{ width: size * 2.1, height: size }} aria-hidden>
      <g style={{ opacity: earned ? 1 : 0.85 }}>
        <Feathers count={count} c={c} />
        <Device t={CENTER_SET[tier - 1]} centerStar={pos === 4} accent={accent} />
        <Above pos={pos} c={c} />
      </g>
    </svg>
  );
}
