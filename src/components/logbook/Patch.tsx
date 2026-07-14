// The mission-patch badge (LOCKED 2026-07-12). Each of the 10 badges is a poster
// scene inside its own silhouette frame (sky-glow gradient → bespoke scene → 3-line
// gold merrow), except Wings, which is a clean insignia on deep-space. Earned = full
// color; locked = dimmed + desaturated. Pure SVG (token colors); server-safe.
import type { PatchArt, LogbookArt, HardwareArt } from "@/lib/logbook/patches";

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
const FRAMED: Record<Exclude<LogbookArt, "wings">, Framed> = {
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

// ---- hardware/build family (tiered, design 2026-07-13): real medal metal for the
// frame + background (bronze / silver / gold); the scene develops per stage, silver
// adds a metal glow, gold adds a star crown. ----
const gear = (r: number) => { const n = 24, inner = r * 0.84; let d = ""; for (let i = 0; i < n; i++) { const rr = i % 2 ? inner : r; const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; d += (i ? "L" : "M") + (50 + Math.cos(a) * rr).toFixed(1) + " " + (50 + Math.sin(a) * rr).toFixed(1); } return d + "Z"; };
const rsq = (r: number) => { const k = r * 0.86, c = r * 0.24; return `M${50 - k + c} ${50 - k}L${50 + k - c} ${50 - k}Q${50 + k} ${50 - k} ${50 + k} ${50 - k + c}L${50 + k} ${50 + k - c}Q${50 + k} ${50 + k} ${50 + k - c} ${50 + k}L${50 - k + c} ${50 + k}Q${50 - k} ${50 + k} ${50 - k} ${50 + k - c}L${50 - k} ${50 - k + c}Q${50 - k} ${50 - k} ${50 - k + c} ${50 - k}Z`; };
const docTag = (r: number) => { const w = r * 0.8, h = r * 0.98, f = r * 0.3; return `M${50 - w} ${50 - h}L${50 + w - f} ${50 - h}L${50 + w} ${50 - h + f}L${50 + w} ${50 + h}L${50 - w} ${50 + h}Z`; };
const trapezoid = (r: number) => { const t = r * 0.72, b = r * 1.0, h = r * 0.92, c = r * 0.1; return `M${50 - t + c} ${50 - h}L${50 + t - c} ${50 - h}Q${50 + t} ${50 - h} ${50 + t + c * 0.4} ${50 - h + c}L${50 + b} ${50 + h - c}Q${50 + b} ${50 + h} ${50 + b - c} ${50 + h}L${50 - b + c} ${50 + h}Q${50 - b} ${50 + h} ${50 - b} ${50 + h - c}L${50 - t - c * 0.4} ${50 - h + c}Q${50 - t} ${50 - h} ${50 - t + c} ${50 - h}Z`; };
const rosette = (r: number) => { const n = 12; let d = ""; for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; const px = 50 + Math.cos(a) * r, py = 50 + Math.sin(a) * r; const mid = a - Math.PI / n; const cx = 50 + Math.cos(mid) * r * 1.12, cy = 50 + Math.sin(mid) * r * 1.12; d += i ? `Q${cx.toFixed(1)} ${cy.toFixed(1)} ${px.toFixed(1)} ${py.toFixed(1)}` : `M${px.toFixed(1)} ${py.toFixed(1)}`; } return d + "Z"; };
// real medal metals (brand has no bronze/silver — Olympic scheme): bronze · silver · gold
// `edge` = a darkened rim tone per metal so the seal reads on the light-theme ivory
// (the bright `hi` sheen now sits inside as a bevel, not on the outer edge).
const METAL = [{ base: "#c67b3a", hi: "#e6a866", sh: "#5c3410", bot: "#c67b3a", edge: "#6b3d16" }, { base: "#7d828b", hi: "#eef1f6", sh: "#565b63", bot: "#c6cad1", edge: "#474c54" }, { base: G, hi: GL, sh: GD, bot: GL, edge: GD }];
const glowRays = (cx: number, cy: number, r1: number, op: number, c: string) => <g>{Array.from({ length: 11 }).map((_, i) => { const a = -Math.PI / 2 + (i - 5) * 0.16; return <path key={i} d={`M${cx} ${cy}L${cx + Math.cos(a) * r1} ${cy + Math.sin(a) * r1}L${cx + Math.cos(a + 0.05) * r1} ${cy + Math.sin(a + 0.05) * r1}Z`} fill={c} opacity={op} />; })}</g>;
const iron = (hx: number, hy: number, tx: number, ty: number) => <g><line x1={hx} y1={hy} x2={tx} y2={ty} stroke={G} strokeWidth={2.6} strokeLinecap="round" /><path d={`M${tx} ${ty}l-5 -1 3 5z`} fill={GD} /><path d={`M${hx} ${hy}l5 -3 -1 5z`} fill={GD} /></g>;
const spark = (x: number, y: number, s = 4) => <g stroke={GL} strokeWidth={1} strokeLinecap="round">{[0, 45, 90, 135].map((deg) => { const a = (deg * Math.PI) / 180; return <line key={deg} x1={x - Math.cos(a) * s} y1={y - Math.sin(a) * s} x2={x + Math.cos(a) * s} y2={y + Math.sin(a) * s} />; })}</g>;
const bd = (x: number, y: number, w: number, h: number) => <rect x={x} y={y} width={w} height={h} rx="1.5" fill={DS} stroke={G} strokeWidth={1.2} />;
const comp = (x: number, y: number, w = 7, h = 4) => <rect x={x} y={y} width={w} height={h} rx="0.6" fill="none" stroke={G} strokeWidth={0.8} />;
const builtBoard = (x: number, y: number, w: number, h: number) => <g>{bd(x, y, w, h)}<path d={`M${x + 6} ${y + 6}h${w * 0.4}v${h * 0.4}h${w * 0.35}`} fill="none" stroke={G} strokeWidth={0.6} opacity={0.6} />{comp(x + 5, y + h - 8)}{comp(x + w - 14, y + 5)}<rect x={x + w * 0.4} y={y + h * 0.4} width="8" height="8" rx="1" fill="none" stroke={G} strokeWidth={0.8} /></g>;
const pin = (x: number, y: number, c = GREEN) => <g><path d={`M${x} ${y}c-4 0 -6 3 -6 6 0 4 6 10 6 10s6-6 6-10c0-3-2-6-6-6z`} fill={DS} stroke={c} strokeWidth={1.4} /><circle cx={x} cy={y + 6} r="2" fill={c} /></g>;
const sealMark = (x: number, y: number, r = 9) => { const lobes = Array.from({ length: 16 }, (_, i) => { const a = (i / 16) * Math.PI * 2; const rr = r + (i % 2 ? 1.2 : -0.7); return `${(x + Math.cos(a) * rr).toFixed(1)} ${(y + Math.sin(a) * rr).toFixed(1)}`; }).join("L"); return <g><path d={`M${lobes}Z`} fill={GD} stroke={G} strokeWidth={0.8} /><path d={starD(x, y, r * 0.5, r * 0.2)} fill={GL} /></g>; };
const hcheck = (x: number, y: number, s = 1) => <path d={`M${x - 4 * s} ${y}l${3 * s} ${3 * s} ${5 * s} ${-6 * s}`} fill="none" stroke={GREEN} strokeWidth={2 * s} strokeLinecap="round" strokeLinejoin="round" />;
const pw = (cx: number, cy: number, r: number) => <g stroke={GL} strokeWidth={2.6} fill="none"><path d={`M${cx - r * 0.75} ${cy - r * 0.2}a${r} ${r} 0 1 0 ${r * 1.5} 0`} /><line x1={cx} y1={cy - r * 1.4} x2={cx} y2={cy} /></g>;
const arcp = (cx: number, cy: number, r: number, frac: number) => { if (frac >= 1) return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`; const a1 = -Math.PI / 2 + frac * 2 * Math.PI; const large = frac > 0.5 ? 1 : 0; return `M${cx} ${cy - r}A${r} ${r} 0 ${large} 1 ${(cx + Math.cos(a1) * r).toFixed(1)} ${(cy + Math.sin(a1) * r).toFixed(1)}`; };
const hbox = (x: number, y: number, w = 20, h = 16) => <g><rect x={x} y={y} width={w} height={h} rx="1" fill={DS} stroke={G} strokeWidth={1.2} /><path d={`M${x} ${y}l${w / 2} ${h * 0.32} ${w / 2} ${-h * 0.32}`} fill="none" stroke={GL} strokeWidth={0.6} /></g>;

type Stage = () => React.ReactNode;
const HW: Record<HardwareArt, { shape: (r: number) => string; r: number; states: [Stage, Stage, Stage] }> = {
  "hw-solder": { shape: gear, r: 36, states: [
    () => <g>{bd(28, 52, 44, 24)}<circle cx="48" cy="62" r="3" fill="none" stroke={GD} strokeWidth={1} />{iron(80, 28, 53, 58)}</g>,
    () => <g>{bd(28, 52, 44, 24)}<circle cx="48" cy="62" r="5" fill={GL} opacity={0.25} /><circle cx="48" cy="62" r="2.8" fill={GL} />{iron(80, 30, 52, 60)}{spark(48, 60)}</g>,
    () => <g>{bd(28, 56, 44, 22)}<path d="M40 66a8 5 0 0 1 16 0z" fill={GL} /><path d="M43 64q5 -2 10 0" stroke={IV} strokeWidth={0.8} opacity={0.5} fill="none" /></g>,
  ] },
  "hw-powered": { shape: rsq, r: 37, states: [
    () => <g>{pw(50, 62, 9)}<path d={arcp(50, 64, 15, 1 / 3)} fill="none" stroke={GREEN} strokeWidth={2.4} strokeLinecap="round" /></g>,
    () => <g>{pw(50, 62, 9)}<path d={arcp(50, 64, 15, 2 / 3)} fill="none" stroke={GREEN} strokeWidth={2.4} strokeLinecap="round" /></g>,
    () => <g>{pw(50, 62, 9)}<path d={arcp(50, 64, 15, 1)} fill="none" stroke={GREEN} strokeWidth={2.4} /><circle cx="50" cy="64" r="12" fill={GREEN} opacity={0.12} /></g>,
  ] },
  "hw-tapeout": { shape: docTag, r: 38, states: [
    () => <g>{bd(28, 58, 44, 16)}{hcheck(50, 44, 1.4)}</g>,
    () => <g>{bd(28, 58, 44, 16)}{sealMark(50, 46)}</g>,
    () => <g>{bd(28, 62, 44, 14)}{sealMark(50, 54, 8)}</g>,
  ] },
  "hw-shipped": { shape: trapezoid, r: 38, states: [
    () => <g>{hbox(40, 54, 20, 16)}<path d="M50 54v16M42 62h16" stroke={G} strokeWidth={0.8} opacity={0.6} /></g>,
    () => <g>{hbox(30, 60, 18, 14)}{pin(64, 36)}<path d="M38 60Q52 44 62 40" fill="none" stroke={GL} strokeWidth={0.8} opacity={0.5} strokeDasharray="2 3" /></g>,
    () => <g>{hbox(40, 62, 20, 14)}{pin(50, 48, GREEN)}{hcheck(66, 60, 0.8)}</g>,
  ] },
  "hw-build": { shape: rosette, r: 34, states: [
    () => <g>{bd(36, 50, 28, 18)}{comp(42, 58)}{comp(52, 58)}<circle cx="45" cy="55" r="1" fill={GD} /><circle cx="55" cy="55" r="1" fill={GD} /></g>,
    () => <g>{builtBoard(30, 54, 40, 20)}</g>,
    () => <g>{builtBoard(30, 54, 40, 20)}</g>,
  ] },
};

function renderHardware(art: HardwareArt, tier: number, size: number, style: React.CSSProperties, className?: string, frameW = 1.5, edgeColor?: string) {
  const { shape, r, states } = HW[art];
  const t = Math.max(0, Math.min(2, tier));
  const m = METAL[t];
  const uid = `${art}-${t}`;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden style={style} className={className}>
      <defs>
        <linearGradient id={`hs-${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={DS} /><stop offset="0.5" stopColor={m.sh} /><stop offset="1" stopColor={m.bot} /></linearGradient>
        <clipPath id={`hc-${uid}`}><path d={shape(r - 2)} /></clipPath>
      </defs>
      <g clipPath={`url(#hc-${uid})`}>
        <rect x="8" y="8" width="84" height="84" fill={`url(#hs-${uid})`} />
        {t >= 1 ? <g>{glowRays(50, 56, 28, 0.16, m.hi)}<circle cx="50" cy="58" r="16" fill={m.hi} opacity={0.12} /></g> : null}
        {states[t]()}
        {t === 2 ? <g>{[[37, 37], [50, 30], [63, 37]].map((p, i) => <path key={i} d={starD(p[0], p[1], i === 1 ? 4.2 : 3, 1.4)} fill={GL} />)}</g> : null}
      </g>
      <path d={shape(r + 2.4)} fill="none" stroke="rgba(18,13,6,0.45)" strokeWidth={1.1} />
      <path d={shape(r)} fill="none" stroke={edgeColor ?? m.edge} strokeWidth={frameW} />
      <path d={shape(r - 2)} fill="none" stroke={m.hi} strokeWidth={0.7} opacity={0.7} />
      <path d={shape(r - 5)} fill="none" stroke={m.base} strokeWidth={0.9} />
    </svg>
  );
}

export function PatchBadge({ art, earned = true, size = 64, tier = 0, frameW = 1.5, edge }: { art: PatchArt; earned?: boolean; size?: number; tier?: number; frameW?: number; edge?: string }) {
  // Earned badges POP (owner-picked 2026-07-13): a subtle breathing glow via the
  // `.patch-pop` class, tinted per metal by `--patch-glow` — gold-light for the gold
  // cluster/skill patches, bronze/silver highlights for the hardware tiers. A locked
  // badge stays dim + desaturated with just a small lift shadow.
  const hw = art.startsWith("hw-");
  const glow = hw ? ["#e6a866", "#d8dde4", "var(--color-gold-light)"][Math.max(0, Math.min(2, tier))] : "var(--color-gold-light)";
  const className = earned ? "patch-pop" : undefined;
  // Scale the pop-glow radii with size (1 at the tuned sizes, smaller below 46) so
  // small badges in dense rows don't blow out.
  const popR = size >= 46 ? "1" : (size / 46).toFixed(2);
  const style: React.CSSProperties = earned
    ? ({ ["--patch-glow" as string]: glow, ["--pop-r" as string]: popR } as React.CSSProperties)
    : { opacity: 0.38, filter: "saturate(0.35) drop-shadow(0 1.5px 2px rgba(22,16,8,0.34))" };
  if (hw) return renderHardware(art as HardwareArt, tier, size, style, className, frameW, edge);
  if (art === "wings") {
    return <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden style={style} className={className}>{wingsInsignia()}</svg>;
  }
  const { shape, r, scene } = FRAMED[art as Exclude<LogbookArt, "wings">];
  const uid = art;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden style={style} className={className}>
      <defs>
        <linearGradient id={`hs-${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={DS} /><stop offset="0.52" stopColor={GD} /><stop offset="1" stopColor={GL} /></linearGradient>
        <clipPath id={`hc-${uid}`}><path d={shape(r - 2)} /></clipPath>
      </defs>
      <g clipPath={`url(#hc-${uid})`}><rect x="8" y="8" width="84" height="84" fill={`url(#hs-${uid})`} />{scene()}</g>
      <path d={shape(r + 2.4)} fill="none" stroke="rgba(18,13,6,0.45)" strokeWidth={1.1} />
      <path d={shape(r)} fill="none" stroke={edge ?? G} strokeWidth={frameW} />
      <path d={shape(r - 2)} fill="none" stroke={GL} strokeWidth={0.7} opacity={0.7} />
      <path d={shape(r - 5)} fill="none" stroke={G} strokeWidth={0.9} />
    </svg>
  );
}
