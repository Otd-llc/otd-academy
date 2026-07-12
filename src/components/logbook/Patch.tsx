// The mission-patch badge (LOCKED 2026-07-12). Each of the 10 badges is a poster
// scene inside its own silhouette frame (sky-glow gradient → bespoke scene → 3-line
// gold merrow), except Wings, which is a clean insignia on deep-space. Earned = full
// color; locked = dimmed + desaturated. Pure SVG (token colors); server-safe.
import type { PatchArt } from "@/lib/logbook/patches";

const G = "var(--color-command-gold)";
const GL = "var(--color-gold-light)";
const GD = "var(--color-gold-dim)";
const DS = "var(--color-deep-space)";
const BLUE = "var(--color-signal-blue)";
const GREEN = "var(--color-status-green)";
const IV = "var(--color-title)";
const CORAL = "var(--color-danger-coral)";

// ---- silhouettes around (50,50) ----
const ngon = (r: number, n: number, rot: number) => Array.from({ length: n }, (_, i) => { const a = rot + (i * 2 * Math.PI) / n; return `${(50 + Math.cos(a) * r).toFixed(1)} ${(50 + Math.sin(a) * r).toFixed(1)}`; }).join("L").replace(/^/, "M") + "Z";
const circle = (r: number) => `M${50 - r} 50a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
const hexagon = (r: number) => ngon(r, 6, -Math.PI / 2);
const octagon = (r: number) => ngon(r, 8, -Math.PI / 8);
const diamond = (r: number) => ngon(r, 4, -Math.PI / 2);
const pentagon = (r: number) => ngon(r, 5, -Math.PI / 2);
const pennant = (r: number) => { const w = r * 0.98, t = 50 - r * 0.72, b = 50 + r * 0.98, c = r * 0.16; return `M${50 - w + c} ${t}L${50 + w - c} ${t}Q${50 + w} ${t} ${50 + w - c * 0.7} ${t + c * 1.3}L${50 + c} ${b - c * 1.6}Q50 ${b} ${50 - c} ${b - c * 1.6}L${50 - w + c * 0.7} ${t + c * 1.3}Q${50 - w} ${t} ${50 - w + c} ${t}Z`; };
function starD(cx: number, cy: number, ro: number, ri: number) { let d = ""; for (let i = 0; i < 10; i++) { const rr = i % 2 ? ri : ro; const a = -Math.PI / 2 + (i * Math.PI) / 5; d += (i ? "L" : "M") + (cx + Math.cos(a) * rr).toFixed(1) + " " + (cy + Math.sin(a) * rr).toFixed(1); } return d + "Z"; }
const star = (r: number) => starD(50, 50, r, r * 0.42);
const shield = (r: number) => { const w = r * 0.84, t = 50 - r, sh = 50 - r * 0.52, mid = 50 + r * 0.08; return `M50 ${t}L${50 + w} ${sh}L${50 + w} ${mid}Q${50 + w} ${50 + r * 0.64} 50 ${50 + r}Q${50 - w} ${50 + r * 0.64} ${50 - w} ${mid}L${50 - w} ${sh}Z`; };
const heater = (r: number) => { const w = r * 0.88, t = 50 - r * 0.82; return `M${50 - w} ${t}H${50 + w}V${50 - r * 0.05}Q${50 + w} ${50 + r * 0.72} 50 ${50 + r}Q${50 - w} ${50 + r * 0.72} ${50 - w} ${50 - r * 0.05}Z`; };

// ---- scene primitives ----
const R = { flat: "M8 80h84v12H8z", hills: "M8 82q20-9 42 0t42 0v10H8z", peaks: "M8 92L30 66l14 12 20-24 22 30z", range: "M8 74l14-9 12 7 12-11 14 11 10-6 14 8v18H8z" };
const stars = (pts: number[][]) => <g>{pts.map((p, i) => <path key={i} d={starD(p[0], p[1], p[2], p[2] * 0.4)} fill={IV} opacity={0.85} />)}</g>;
const rays = (cx: number, cy: number, r1: number, op = 0.16) => <g>{Array.from({ length: 11 }).map((_, i) => { const a = -Math.PI / 2 + (i - 5) * 0.16; return <path key={i} d={`M${cx} ${cy}L${cx + Math.cos(a) * r1} ${cy + Math.sin(a) * r1}L${cx + Math.cos(a + 0.05) * r1} ${cy + Math.sin(a + 0.05) * r1}Z`} fill={GL} opacity={op} />; })}</g>;
const pulse = (cx: number, cy: number, c: string, rs: number[]) => <g>{rs.map((r) => <circle key={r} cx={cx} cy={cy} r={r} fill="none" stroke={c} strokeWidth={1} opacity={0.45} />)}</g>;
const humpWave = (y: number, sw: number, op: number) => <path d={`M10 ${y}q10-12 20 0t20 0 20 0 20 0`} fill="none" stroke={BLUE} strokeWidth={sw} opacity={op} strokeLinejoin="round" />;
const omega = (x: number, y: number) => <path d={`M${x - 9} ${y}v-6a9 9 0 1 1 18 0v6h-4.5v-6a4.5 4.5 0 1 0-9 0v6z`} fill="none" stroke={GL} strokeWidth={1.6} />;
const chipMono = (x: number, y: number, s: number) => <g><rect x={x - 10 * s} y={y - 12 * s} width={20 * s} height={24 * s} fill={DS} stroke={G} strokeWidth={1.4} /><rect x={x - 5 * s} y={y - 6 * s} width={10 * s} height={9 * s} fill={BLUE} opacity={0.7} /><g stroke={G} strokeWidth={1.1} strokeLinecap="round">{[-6, 0, 6].map((o) => <g key={o}><line x1={x - 10 * s} y1={y + o * s} x2={x - 14 * s} y2={y + o * s} /><line x1={x + 10 * s} y1={y + o * s} x2={x + 14 * s} y2={y + o * s} /></g>)}</g></g>;
const bigBolt = (cx: number, top: number, bot: number, c = GL) => { const mid = (top + bot) / 2; return <path d={`M${cx + 3} ${top}L${cx - 11} ${mid}h9l-5 ${bot - mid}L${cx + 13} ${mid - 4}h-9z`} fill={c} />; };

// premium wing (from patch-wings v8): scalloped upswept feathered wing + shield★
const RW = "M52 49Q66 40 85 35Q80 41 74 40Q77 45 67 44Q71 49 61 47Q66 53 55 51Q51 53 52 49Z";
const RW_HI = "M52 49Q66 40 85 35";
const RW_LINES = ["M54 50Q66 44 80 40", "M55 52Q63 48 71 46"];
const halfWing = () => (<g><path d={RW} fill={GD} stroke={G} strokeWidth={1} strokeLinejoin="round" /><path d={RW_HI} fill="none" stroke={GL} strokeWidth={0.8} />{RW_LINES.map((d, i) => <path key={i} d={d} fill="none" stroke={G} strokeWidth={0.4} opacity={0.6} />)}</g>);
const wingsInsignia = () => (
  <g>
    <path d={circle(44)} fill={DS} />
    {rays(50, 47, 28, 0.14)}
    {halfWing()}<g transform="translate(100 0) scale(-1 1)">{halfWing()}</g>
    <path d="M43 39h14v9c0 6-4 9-7 11-3-2-7-5-7-11z" fill={DS} stroke={G} strokeWidth={1.4} />
    <path d={starD(50, 48, 4.4, 1.8)} fill={GL} />
    <circle cx="50" cy="50" r="44" fill="none" stroke={G} strokeWidth={2} />
    <circle cx="50" cy="50" r="41.5" fill="none" stroke={GL} strokeWidth={0.6} />
  </g>
);

type Framed = { shape: (r: number) => string; r: number; scene: () => React.ReactNode };
const FRAMED: Record<Exclude<PatchArt, "wings">, Framed> = {
  flight: { shape: circle, r: 36, scene: () => <g><circle cx="74" cy="38" r="2" fill={GL} /><path d="M18 54Q46 46 74 38" fill="none" stroke={GL} strokeWidth={1} opacity={0.55} strokeDasharray="2 3" /><path d={R.range} fill={DS} /></g> },
  fund: { shape: pentagon, r: 39, scene: () => <g>{stars([[22, 24, 1], [76, 22, 1], [50, 18, 1.2]])}{omega(50, 50)}<path d={R.range} fill={DS} /></g> },
  eeg: { shape: hexagon, r: 38, scene: () => <g>{stars([[24, 24, 1], [76, 22, 1]])}{humpWave(34, 2.4, 0.6)}{humpWave(41, 1.3, 0.35)}<circle cx="50" cy="38" r="1.6" fill={BLUE} /><path d={R.hills} fill={DS} /><path d="M41 82a9 8 0 0 1 18 0z" fill={DS} stroke={G} strokeWidth={0.9} /><line x1="50" y1="74" x2="50" y2="66" stroke={GD} strokeWidth={1} /><path d={starD(50, 64, 2.4, 1)} fill={GL} /></g> },
  pcb: { shape: shield, r: 37, scene: () => <g>{stars([[28, 24, 1], [72, 22, 1]])}<path d="M24 80V58h20v-14h22" fill="none" stroke={G} strokeWidth={1.6} /><circle cx="24" cy="80" r="2.4" fill={GREEN} /><circle cx="44" cy="58" r="2" fill={GL} /><rect x="60" y="40" width="8" height="8" fill={DS} stroke={G} strokeWidth={1} /><path d={R.flat} fill={DS} /></g> },
  chip: { shape: octagon, r: 38, scene: () => <g><path d="M18 46h6v-10h8v10h8v-10h8v10h6" fill="none" stroke={BLUE} strokeWidth={2} strokeLinejoin="round" />{chipMono(50, 70, 0.8)}</g> },
  comms: { shape: heater, r: 38, scene: () => <g>{stars([[26, 24, 1]])}{pulse(50, 44, IV, [10, 16, 22])}<path d={R.peaks} fill={DS} /><line x1="50" y1="58" x2="50" y2="44" stroke={GD} strokeWidth={1.4} /><circle cx="50" cy="42" r="2" fill={IV} /></g> },
  power: { shape: diamond, r: 41, scene: () => <g><circle cx="50" cy="46" r="18" fill={CORAL} opacity={0.22} />{bigBolt(50, 22, 70)}<path d={R.flat} fill={DS} /><rect x="42" y="72" width="16" height="8" fill={DS} stroke={G} strokeWidth={1} /></g> },
  shipped: { shape: pennant, r: 40, scene: () => <g><rect x="38" y="46" width="24" height="20" rx="1.5" fill={DS} stroke={GREEN} strokeWidth={1.4} /><path d="M50 46v20M38 56h24" stroke={GREEN} strokeWidth={1} /><path d="M50 46q-4-8 -8-4t8 4q4-8 8-4t-8 4" fill="none" stroke={GL} strokeWidth={1.2} /><path d={R.hills} fill={DS} /></g> },
  rating: { shape: star, r: 40, scene: () => <g>{rays(50, 48, 30, 0.22)}<path d={starD(50, 48, 16, 6.7)} fill={GL} />{stars([[24, 26, 1], [76, 24, 1]])}</g> },
};

export function PatchBadge({ art, earned = true, size = 64 }: { art: PatchArt; earned?: boolean; size?: number }) {
  const style = { opacity: earned ? 1 : 0.38, filter: earned ? undefined : "saturate(0.35)" } as const;
  if (art === "wings") {
    return <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden style={style}>{wingsInsignia()}</svg>;
  }
  const { shape, r, scene } = FRAMED[art];
  const uid = art;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden style={style}>
      <defs>
        <linearGradient id={`hs-${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={DS} /><stop offset="0.52" stopColor={GD} /><stop offset="1" stopColor={GL} /></linearGradient>
        <clipPath id={`hc-${uid}`}><path d={shape(r - 2)} /></clipPath>
      </defs>
      <g clipPath={`url(#hc-${uid})`}><rect x="8" y="8" width="84" height="84" fill={`url(#hs-${uid})`} />{scene()}</g>
      <path d={shape(r)} fill="none" stroke={G} strokeWidth={4.2} />
      <path d={shape(r + 1.5)} fill="none" stroke={GL} strokeWidth={0.7} />
      <path d={shape(r - 5)} fill="none" stroke={G} strokeWidth={0.9} />
    </svg>
  );
}
