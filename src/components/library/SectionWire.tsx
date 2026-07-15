// The schematic wire that heads a /library cluster section (owner pick C7/X1): a
// gold rule with a two-symbol motif inline, LEFT-JUSTIFIED so the symbols underline
// the heading (slots 110 / 280). Every wire is a SIBLING of the Fundamentals one
// (resistor + capacitor) via sib(a, b). The rule is painted with a gradient (owner
// pick v8: gold-light -> gold-dim, dark-weighted, fading out at both ends) applied
// on a wrapping <g fill/stroke>; gold elements (class sw-l / sw-lf, no own color)
// inherit it, while blue SIGNAL elements (sw-b) keep their own blue. Token-only so
// it flips with the theme. Doubles as the section header's rule.
import type { ReactNode } from "react";

const CSS = `
.sw-svg{display:block;width:100%;height:auto;overflow:visible;}
.sw-l{fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}
.sw-lf{stroke:none;}
.sw-b{fill:none;stroke:var(--color-signal-blue,#4a8fff);stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}
`;
const L = "sw-l";
const LF = "sw-lf";
const BL = "sw-b";
const GL = "var(--color-gold-light,#e8b865)";
const GD = "var(--color-gold-dim,#8b6428)";

type Sym = { w: number; draw: (cx: number) => ReactNode };

// Left-justified rhythm: slot A at 110, slot B at 280, wire to the edges.
function sib(a: Sym, b: Sym, aC = 110, bC = 280): ReactNode {
  const aL = aC - a.w / 2, aR = aC + a.w / 2;
  const bL = bC - b.w / 2, bR = bC + b.w / 2;
  return (
    <>
      <line className={L} x1={2} y1={13} x2={aL} y2={13} />
      {a.draw(aC)}
      <line className={L} x1={aR} y1={13} x2={bL} y2={13} />
      {b.draw(bC)}
      <line className={L} x1={bR} y1={13} x2={718} y2={13} />
    </>
  );
}

// --- symbol kit (pure line-art; gold = class sw-l/sw-lf inherits paint) -----
const RES: Sym = { w: 96, draw: (c) => { const x = c - 48; return <polyline className={L} points={`${x},13 ${x + 12},4 ${x + 30},22 ${x + 48},4 ${x + 66},22 ${x + 84},4 ${x + 96},13`} />; } };
const CAP: Sym = { w: 16, draw: (c) => <><line className={L} x1={c - 8} y1={3} x2={c - 8} y2={23} /><line className={L} x1={c + 8} y1={3} x2={c + 8} y2={23} /></> };
const IC = (w: number): Sym => ({ w, draw: (c) => { const x = c - w / 2; const n = Math.max(3, Math.round(w / 15)); const legs = Array.from({ length: n }, (_, i) => (i + 0.5) / n); return <><rect className={L} x={x} y={3} width={w} height={18} rx={2} /><circle className={LF} cx={x + 6} cy={8} r={1.7} />{legs.map((f, i) => <line key={`t${i}`} className={L} x1={x + w * f} y1={3} x2={x + w * f} y2={-1} strokeWidth={1.6} />)}{legs.map((f, i) => <line key={`b${i}`} className={L} x1={x + w * f} y1={21} x2={x + w * f} y2={25} strokeWidth={1.6} />)}</>; } });
const SINE = (bumps: number, amp = 9, cls = BL): Sym => ({ w: bumps * 20, draw: (c) => { const x = c - (bumps * 20) / 2; let d = `M${x} 13 Q ${x + 10} ${13 - amp} ${x + 20} 13`; for (let i = 1; i < bumps; i++) d += ` T ${x + 20 * (i + 1)} 13`; return <path className={cls} d={d} />; } });
const PLANE = (w = 44, hatch = 3): Sym => ({ w, draw: (c) => { const x = c - w / 2; const els: ReactNode[] = [<rect key="r" className={L} x={x} y={5} width={w} height={16} />]; for (let i = 0; i < hatch; i++) { const hx = x + (w * (i + 1)) / (hatch + 1); els.push(<line key={i} className={L} x1={hx - 5} y1={20} x2={hx + 5} y2={6} strokeWidth={1} />); } return <>{els}</>; } });
const PAD = (w = 30): Sym => ({ w, draw: (c) => <rect className={L} x={c - w / 2} y={5} width={w} height={16} rx={2} /> });
const BATT = (cells = 1): Sym => ({ w: cells === 1 ? 16 : 32, draw: (c) => { const x = c - (cells === 1 ? 8 : 16); const el: ReactNode[] = []; for (let i = 0; i < cells; i++) { const bx = x + i * 16; el.push(<line key={`l${i}`} className={L} x1={bx} y1={2} x2={bx} y2={24} />, <line key={`s${i}`} className={L} x1={bx + 8} y1={7} x2={bx + 8} y2={19} />); } return <>{el}</>; } });
const DIODE = (dir: 1 | -1 = 1): Sym => ({ w: 22, draw: (c) => { const x = c - 11, bx = dir === 1 ? x + 22 : x; const tri = dir === 1 ? `M${x} 4 L${x + 22} 13 L${x} 22 Z` : `M${x + 22} 4 L${x} 13 L${x + 22} 22 Z`; return <><path className={L} d={tri} /><line className={L} x1={bx} y1={3} x2={bx} y2={23} /></>; } });
const SQ = (cycles: number, cls: string, hiW: number, loW: number, h = 8): Sym => ({ w: cycles * (hiW + loW), draw: (c) => { const w = cycles * (hiW + loW); const x = c - w / 2; const top = 13 - h, bot = 13 + h; const pts = [`${x},13`, `${x},${top}`]; let cx = x; for (let i = 0; i < cycles; i++) { const last = i === cycles - 1; pts.push(`${cx + hiW},${top}`, `${cx + hiW},${bot}`, `${cx + hiW + loW},${bot}`, `${cx + hiW + loW},${last ? 13 : top}`); cx += hiW + loW; } return <polyline className={cls} points={pts.join(" ")} />; } });

// The finalized motif per cluster (owner picks, 2026-07-14).
const MOTIFS: Record<string, ReactNode> = {
  fundamentals: sib(RES, CAP),
  "eeg-bci": sib(SINE(2, 12), SINE(4, 6)),
  "pcb-design": sib(PLANE(44, 3), PAD(30)),
  "comms-interfaces": sib(IC(44), SQ(2, BL, 12, 12)),
  "power-batteries": sib(BATT(2), DIODE(1)),
  microcontrollers: sib(IC(52), SQ(3, L, 10, 10)),
};

export function SectionWire({ motif }: { motif: string }) {
  const gid = `sw-grad-${motif}`;
  return (
    <svg viewBox="0 0 720 26" preserveAspectRatio="none" className="sw-svg h-[22px]" aria-hidden>
      <style>{CSS}</style>
      <defs>
        <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="720" y2="0">
          <stop offset="0" style={{ stopColor: GL, stopOpacity: 0 }} />
          <stop offset="0.12" style={{ stopColor: GL, stopOpacity: 1 }} />
          <stop offset="0.45" style={{ stopColor: GD, stopOpacity: 1 }} />
          <stop offset="0.88" style={{ stopColor: GD, stopOpacity: 1 }} />
          <stop offset="1" style={{ stopColor: GD, stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      <g fill={`url(#${gid})`} stroke={`url(#${gid})`}>
        {MOTIFS[motif] ?? MOTIFS.fundamentals}
      </g>
    </svg>
  );
}
