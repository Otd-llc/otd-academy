"use client";

// Shared-autonomy control as a responsive diagram (v3).
//
// Teaching point (the page's thesis): you do NOT fly a shared-autonomy drone
// stick-and-rudder. You supply sparse, high-level intent (~one command a second);
// the drone's own flight controller does the fast continuous work. A live video
// feed closes the loop.
//
// v3 (owner-picked, 2026-07-15): there is no pilot figure outside. An FPV goggle
// IS the viewport, large in the left foreground, and the only place the pilot
// exists is inside it — sitting cross-legged on the ground, seen from the drone's
// own camera. A gold intent stream of shrinking packets arcs over the top and
// stops SHORT of the drone; a blue feed bows back under and returns to the goggle,
// closing the loop. The world behind (shared ridge profile, contour, trees) is the
// same world the goggle is showing, which is why the ridge array drives both.
//
// MOTION — Tier B (docs/diagrams/animation-standards.md). The motion IS the
// lesson: the drone's bank and the goggle's video bank are one number, because the
// picture is the drone's camera. Depth is expressed by parallax on scroll.
//   - Everything PLANTED on the ground (contour, grid, every tree) is static. The
//     grid is a fixed reference, so a tree sliding laterally skates across its own
//     cells. Only the sky and the subject move.
//   - The goggle and the loop/drone share one factor, or the strands would tear
//     off their anchors as the layers separate.
// Reduced motion / no-JS / SSR: --p is never written, every var(--p,0) resolves to
// 0, and the diagram renders at its settled frame. See useScrollParallax.
import { type CSSProperties } from "react";
import { DiagramFrame } from "./DiagramFrame";
import { useScrollParallax } from "./useScrollParallax";

/* ── geometry ───────────────────────────────────────────────────────────────
   All of this is deterministic and lives at module scope so the server and the
   client render byte-identical markup. The bezel polygon is PRE-SAMPLED: it used
   to come from getTotalLength()/getPointAtLength(), which has no DOM in SSR. */

// 48-point sample of the goggle bezel. Facet count = angularity.
const BEZEL48: [number, number][] = [
  [62, 48], [71.24, 46.87], [80.51, 46.05], [89.8, 45.48],
  [99.11, 45.14], [108.42, 45], [117.72, 45.07], [127.03, 45.34],
  [136.33, 45.83], [145.61, 46.56], [154.86, 47.57], [164.12, 48.41],
  [173.1, 50.78], [181.15, 55.4], [187.64, 62.04], [192.23, 70.11],
  [194.94, 79], [195.97, 88.24], [195.44, 97.52], [193.02, 106.49],
  [188.48, 114.58], [181.94, 121.17], [173.93, 125.86], [165.07, 128.68],
  [155.85, 129.9], [146.54, 130], [137.23, 130], [127.94, 129.75],
  [119.8, 125.36], [111.58, 121.15], [102.83, 123.6], [95.01, 128.63],
  [85.94, 130], [76.63, 130], [67.32, 130], [58.04, 129.26],
  [49.02, 127.02], [40.66, 122.99], [33.54, 117.02], [28.29, 109.37],
  [25.16, 100.63], [24.02, 91.41], [24.53, 82.12], [26.64, 73.07],
  [30.58, 64.66], [36.44, 57.46], [44.02, 52.1], [52.76, 48.97],
];

const GC: [number, number] = [110, 88]; // goggle-local centre
const pts2s = (p: [number, number][]) => p.map(([x, y]) => `${x},${y}`).join(" ");
const inset = (p: [number, number][], k: number): [number, number][] =>
  p.map(([x, y]) => [GC[0] + (x - GC[0]) * k, GC[1] + (y - GC[1]) * k]);

// Per-edge side quads for the 2.5D shell. Tone comes from each edge's outward
// normal; back-facing edges are skipped.
function facets(p: [number, number][], dx: number, dy: number) {
  const out: { cls: string; pts: string }[] = [
    { cls: "dsa-dk", pts: pts2s(p.map(([x, y]) => [x + dx, y + dy])) },
  ];
  for (let i = 0; i < p.length; i++) {
    const a = p[i];
    const b = p[(i + 1) % p.length];
    const ex = b[0] - a[0];
    const ey = b[1] - a[1];
    const L = Math.hypot(ex, ey) || 1;
    const nx = ey / L;
    const ny = -ex / L;
    if (nx * dx + ny * dy <= 0) continue;
    out.push({
      cls: ny < -0.35 ? "dsa-hi" : ny > 0.35 ? "dsa-dk" : "dsa-lo",
      pts: `${a[0]},${a[1]} ${b[0]},${b[1]} ${(b[0] + dx).toFixed(1)},${(b[1] + dy).toFixed(1)} ${(a[0] + dx).toFixed(1)},${(a[1] + dy).toFixed(1)}`,
    });
  }
  return out;
}

// One normalised ridge profile drives BOTH the goggle's inner peaks and the outer
// far ridge — same world, two views. Do not fork these.
const RIDGE = [
  [0, 0], [0.07, 0.55], [0.13, 0.18], [0.22, 0.95], [0.31, 0.22], [0.4, 0.62],
  [0.48, 0.15], [0.58, 0.88], [0.68, 0.25], [0.78, 0.7], [0.88, 0.2], [1, 0],
];
const ridge = (x0: number, x1: number, by: number, h: number) =>
  "M" + RIDGE.map(([u, v]) => `${(x0 + u * (x1 - x0)).toFixed(1)},${(by - v * h).toFixed(1)}`).join(" L");

const CLOUDS = [
  "M0,0 C-5,0 -7.5,-5 -3.5,-8.5 C-6,-15 3,-19.5 8.5,-15 C11.5,-23 23,-23 26,-14 C33,-17.5 39.5,-11 36,-4.5 C40.5,-2.5 39.5,0 35,0 Z",
  "M0,0 C-4.5,0 -6,-5 -2,-7.5 C-4,-13 5,-15.5 8,-10.5 C12,-17 21,-14.5 22,-7 C27,-9 31,-4.5 28,0 Z",
  "M0,0 C-6,0 -8.5,-6.5 -3,-9.5 C-4,-17 7,-21 13,-14.5 C17,-21.5 28,-19 29,-10 C36,-12.5 41,-4.5 35,0 Z",
];
const FIR = "M0,-24 L6,-14 L2.6,-14 L9,-5 L4,-5 L11.5,4 L-11.5,4 L-4,-5 L-9,-5 L-2.6,-14 L-6,-14 Z";
const TRUNK = "M-1.8,3 L1.8,3 L1.8,9.5 L-1.8,9.5 Z";

const GY = 438; // ground line
const CONTOUR = `M20,${GY} Q160,${GY - 26} 320,${GY - 8} Q480,${GY - 32} 640,${GY - 12} Q800,${GY - 28} 980,${GY - 6}`;

// Locked scene values (owner-tuned in the sandbox, 2026-07-15).
const T = { near: 6.5, left: 12.4, leftY: -22, mid: 2.46, frameBreak: 30, cloud: 4.5, ridgeH: 182 };
const G = { x: 244, y: 414, s: 3.2 };            // goggle placement
const GT = { h: 2.7, w: 2.75, x: 43, y: 104 };   // the goggle's hero tree
const BANK0 = -4;                                 // settled bank

// goggle-local -> scene coords. Mirrors the goggle's own transform (incl. the -3deg
// head tilt) so every strand anchor tracks the placement instead of being hand-tuned.
const HEAD = (-3 * Math.PI) / 180;
const HC = Math.cos(HEAD);
const HS = Math.sin(HEAD);
const gpt = (lx: number, ly: number): [number, number] => {
  const rx = lx - GC[0];
  const ry = ly - GC[1];
  return [G.x + G.s * (rx * HC - ry * HS), G.y + G.s * (rx * HS + ry * HC)];
};

// INTENT anchors INSIDE the goggle silhouette on purpose — the goggle draws last, so
// the trail emerges from behind it, which is the depth cue. FEED must clear the shell:
// its head points back at the goggle, so anchoring on the shell means the goggle eats it.
const IA = gpt(200, 52);
const FA = gpt(228, 86);
const IP1: [number, number] = [660, 140];
const IP2: [number, number] = [762, 190]; // terminates SHORT of the drone
// FC1 sits near-level with FA so the curve LEAVES horizontally: the arrowhead reverses
// that tangent, and a steep departure aims the head at open sky instead of the goggle.
const FC1: [number, number] = [720, 436];
const FC2: [number, number] = [830, 350];
const FP3: [number, number] = [806, 222];

const quad = (t: number): [number, number] => {
  const u = 1 - t;
  return [
    u * u * IA[0] + 2 * u * t * IP1[0] + t * t * IP2[0],
    u * u * IA[1] + 2 * u * t * IP1[1] + t * t * IP2[1],
  ];
};

const INTENT_DOTS = Array.from({ length: 51 }, (_, i) => {
  const t = i / 50;
  const [x, y] = quad(t);
  return { x: +x.toFixed(1), y: +y.toFixed(1), r: +(3.2 - t * 1.5).toFixed(1) };
});
// packets ride the trail, shrinking toward the drone
const PACKETS = ([[0.2, 44], [0.5, 33], [0.8, 25]] as const).map(([t, k]) => {
  const [x, y] = quad(t);
  return { x: +(x - k / 2).toFixed(1), y: +(y - k / 2).toFixed(1), k, r: k * 0.18, w: +(k / 16).toFixed(1) };
});

// filled notched arrowhead, tip at (x,y) pointing along ang
const head = (x: number, y: number, ang: number, len: number, w: number) => {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const bx = x - c * len;
  const by = y - s * len;
  const nx = x - c * len * 0.55;
  const ny = y - s * len * 0.55;
  return `M${x.toFixed(1)},${y.toFixed(1)} L${(bx - s * w).toFixed(1)},${(by + c * w).toFixed(1)} L${nx.toFixed(1)},${ny.toFixed(1)} L${(bx + s * w).toFixed(1)},${(by - c * w).toFixed(1)} Z`;
};
const IANG = Math.atan2(IP2[1] - IP1[1], IP2[0] - IP1[0]);
const INTENT_HEAD = head(IP2[0] + Math.cos(IANG) * 8, IP2[1] + Math.sin(IANG) * 8, IANG, 15, 5);
const FEED_HEAD = head(FA[0], FA[1], Math.atan2(FA[1] - FC1[1], FA[0] - FC1[0]), 16, 5.2);

// the feed wiggle, tapered to zero at the goggle end so it can't knot the arrowhead
const FEED_PATH = (() => {
  const N = 150;
  let ph = 0;
  const pts: string[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const u = 1 - t;
    const bx = u * u * u * FA[0] + 3 * u * u * t * FC1[0] + 3 * u * t * t * FC2[0] + t * t * t * FP3[0];
    const by = u * u * u * FA[1] + 3 * u * u * t * FC1[1] + 3 * u * t * t * FC2[1] + t * t * t * FP3[1];
    const amp = (3.5 + 11 * (1 - t)) * Math.min(1, t / 0.11);
    ph += 0.75;
    pts.push(`${bx.toFixed(1)},${(by - amp * Math.sin(ph)).toFixed(1)}`);
  }
  return "M" + pts.join(" L");
})();

const DEPTH = 29;
const DDX = DEPTH * Math.cos((-20 * Math.PI) / 180);
const DDY = DEPTH * Math.sin((-20 * Math.PI) / 180);
const SHELL = facets(BEZEL48, DDX, DDY);

// near/far antenna rule: right is NEAR (bigger, mounted forward), left is FAR. Depth
// reads from size + mount position, never occlusion — the shell extrudes up-right and
// swallows anything drawn behind it.
const ANT_FAR = 0.87;
const ANT_NEAR = 1.16;
function antenna(bx: number, by: number, deg: number, len: number, w: number) {
  const a = (deg * Math.PI) / 180;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  let px = -uy;
  let py = ux;
  if (py > 0) { px = -px; py = -py; }
  const tx = bx + ux * len;
  const ty = by + uy * len;
  const hx = bx + ux * 7;
  const hy = by + uy * 7;
  const hw = w * 1.5;
  const mx = hx + ux * (len * 0.5);
  const my = hy + uy * (len * 0.5);
  return {
    quads: [
      { cls: "dsa-lo", pts: `${bx + px * hw},${by + py * hw} ${hx + px * hw},${hy + py * hw} ${hx - px * hw},${hy - py * hw} ${bx - px * hw},${by - py * hw}` },
      { cls: "dsa-hi", pts: `${bx - px * hw},${by - py * hw} ${hx - px * hw},${hy - py * hw} ${hx - px * hw * 0.25},${hy - py * hw * 0.25} ${bx - px * hw * 0.25},${by - py * hw * 0.25}` },
      { cls: "dsa-lo", pts: `${hx + px * w},${hy + py * w} ${tx + px * w},${ty + py * w} ${tx - px * w},${ty - py * w} ${hx - px * w},${hy - py * w}` },
      { cls: "dsa-hi", pts: `${hx - px * w},${hy - py * w} ${tx - px * w},${ty - py * w} ${tx - px * w * 0.15},${ty - py * w * 0.15} ${hx - px * w * 0.15},${hy - py * w * 0.15}` },
      { cls: "dsa-mid", pts: `${mx + px * w * 1.25 - ux * 2},${my + py * w * 1.25 - uy * 2} ${mx + px * w * 1.25 + ux * 2},${my + py * w * 1.25 + uy * 2} ${mx - px * w * 1.25 + ux * 2},${my - py * w * 1.25 + uy * 2} ${mx - px * w * 1.25 - ux * 2},${my - py * w * 1.25 - uy * 2}` },
    ],
    tip: { cx: +tx.toFixed(1), cy: +ty.toFixed(1), r: +(w * 1.05).toFixed(1) },
    dir: [ux, uy] as [number, number],
  };
}
const ANT_L = antenna(77, 44, -128, 38 * ANT_FAR, 4 * ANT_FAR);
const ANT_R = antenna(176, 50, -52, 38 * ANT_NEAR, 4 * ANT_NEAR);

// ground grid (static — the fixed reference everything is planted against)
const GRID: string[] = [];
[8, 20, 36, 58].forEach((k) => GRID.push(`M20,${GY + k} L980,${GY + k - 6}`));
[140, 300, 460, 620, 780, 920].forEach((x) => GRID.push(`M${x},${GY} L${500 + (x - 500) * 1.7},486`));
// the goggle's inner ground grid
const FGRID: string[] = [];
for (let i = 0; i <= 8; i++) FGRID.push(`M${(26 + i * 21).toFixed(0)},126 L110,90`);
[4, 9, 16, 25].forEach((k) => FGRID.push(`M22,${90 + k} L198,${90 + k}`));

type Tree = { x: number; y: number; s: number };
const sortBySize = (a: Tree, b: Tree) => a.s - b.s; // bigger tree draws on top
const MID_TREES: Tree[] = [{ x: 828, y: GY - 8, s: 0.55 }, { x: 886, y: GY - 17, s: 1.1 }]
  .map((t) => ({ ...t, s: t.s * T.mid })).sort(sortBySize);
const NEAR_TREES: Tree[] = [
  { x: 18 - T.frameBreak, y: GY + T.leftY, s: T.left },
  { x: 70 - T.frameBreak * 0.45, y: GY + 16, s: 0.6 * T.near },
  { x: 112, y: GY + 4, s: 0.3 * T.near },
  { x: 960 + T.frameBreak * 0.45, y: GY + 32, s: 0.96 * T.near },
  { x: 1002 + T.frameBreak, y: GY + 14, s: 0.58 * T.near },
].sort(sortBySize);

// Trees inside the goggle. Scale is DERIVED, not eyeballed: the pilot is ~18.5 units
// for a ~0.9m cross-legged body, so a tree drawn at the pilot's own size is a 0.9m
// shrub. Horizon is y=90, so apparent size goes as (y-90); each height below is
// (y-90)/36 x the hero's. sx is separate from sy because the FIR glyph is squat
// (~0.7 w/h) where a real fir is ~0.3 — a tree tall enough to tower over the pilot
// would otherwise be wide enough to bury the HUD.
const GOG_TREES = [
  { x: GT.x, y: GT.y, sy: GT.h, sx: GT.w, o: 0.9 },
  { x: 46, y: 93, sy: 0.3, sx: 0.2, o: 0.5 },
  { x: 172, y: 92, sy: 0.26, sx: 0.17, o: 0.5 },
  { x: 92, y: 91.5, sy: 0.22, sx: 0.15, o: 0.45 },
].sort((a, b) => a.sy - b.sy);

const cloudW = (s: number) => +(1.4 / s).toFixed(2);
const firW = (s: number) => +(1.2 / s).toFixed(2);

export function DroneSharedAutonomy({ caption }: { caption?: string }) {
  const ref = useScrollParallax<HTMLDivElement>();
  return (
    <DiagramFrame
      eyebrow="SHARED AUTONOMY"
      tone="gold"
      title="You steer. The drone flies."
      ariaLabel="Shared-autonomy drone control, drawn as a loop. A pilot sits cross-legged on the ground, seen only inside the lens of a large FPV goggle, because that view is the drone's own camera looking back down at them. A gold intent stream of packets arcs from the goggle up toward the drone, shrinking as it goes, and stops short of the aircraft: the human sends sparse high-level commands at roughly one a second, and the drone's own flight controller does the fast continuous flying. A blue live video feed bows back underneath and returns to the goggle, closing the loop so the human can watch and adjust."
      caption={caption}
      defaultCaption="Intent goes up about once a second. Video comes back continuously. The drone does the fast flying in between."
    >
      <style>{CSS}</style>

      <div className="dsa" ref={ref}>
        <div className="dsa-scene">
          <div className="dsa-stage">
            <svg className="dsa-svg" viewBox="0 0 1000 490" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
              <defs>
                <linearGradient id="dsaSky" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" className="dsa-sky-a" /><stop offset="1" className="dsa-sky-b" />
                </linearGradient>
                <linearGradient id="dsaGnd" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" className="dsa-gnd-a" /><stop offset="1" className="dsa-gnd-b" />
                </linearGradient>
                <linearGradient id="dsaInt" gradientUnits="userSpaceOnUse" x1={IA[0].toFixed(1)} y1={IA[1].toFixed(1)} x2={IP2[0]} y2={IP2[1]}>
                  <stop offset="0" className="dsa-int-a" /><stop offset="1" className="dsa-int-b" />
                </linearGradient>
                <linearGradient id="dsaFee" gradientUnits="userSpaceOnUse" x1={FA[0].toFixed(1)} y1={FA[1].toFixed(1)} x2={FP3[0]} y2={FP3[1]}>
                  <stop offset="0" className="dsa-fee-a" /><stop offset="1" className="dsa-fee-b" />
                </linearGradient>
                <clipPath id="dsaGnc"><path d={`${CONTOUR} L980,486 L20,486 Z`} /></clipPath>
                <clipPath id="dsaScr"><polygon points={pts2s(inset(BEZEL48, 0.82))} /></clipPath>
              </defs>

              {/* STATIC STAGE — sky and ground never parallax. They are the frame, and the
                  grid is the fixed reference every tree is planted against. */}
              <rect x="5" y="5" width="990" height="480" rx="16" fill="url(#dsaSky)" />
              <path d={`${CONTOUR} L980,486 L20,486 Z`} fill="url(#dsaGnd)" />
              <path className="dsa-gld" strokeWidth="2" d={CONTOUR} />
              <g clipPath="url(#dsaGnc)">
                <g className="dsa-gld dsa-wgrid" strokeWidth=".5">
                  {GRID.map((d, i) => <path key={i} d={d} />)}
                </g>
              </g>

              {/* FAR — ridge + clouds. The ridge sits above the grid, so it has nothing to
                  skate against and can move. */}
              <g className="dsa-lyr" style={{ "--k": 16 } as CSSProperties}>
                <path className="dsa-blu dsa-l-far" strokeWidth={cloudW(0.34 * T.cloud)} transform={`translate(170,54) scale(${0.34 * T.cloud})`} d={CLOUDS[1]} />
                <path className="dsa-blu dsa-l-far" strokeWidth={cloudW(0.3 * T.cloud)} transform={`translate(706,40) scale(${0.3 * T.cloud})`} d={CLOUDS[2]} />
                <path className="dsa-blu dsa-l-far" strokeWidth={cloudW(0.36 * T.cloud)} transform={`translate(858,56) scale(${0.36 * T.cloud})`} d={CLOUDS[0]} />
                <path className="dsa-gld dsa-l-far" strokeWidth="1.3" d={ridge(20, 980, GY - 14, T.ridgeH)} />
              </g>

              {/* MID cloud moves; MID TREES DO NOT (planted). */}
              <g className="dsa-lyr" style={{ "--k": 7 } as CSSProperties}>
                <path className="dsa-blu dsa-l-mid" strokeWidth={cloudW(0.6 * T.cloud)} transform={`translate(300,200) scale(${0.6 * T.cloud})`} d={CLOUDS[2]} />
              </g>
              {MID_TREES.map((t, i) => (
                <g key={i} className="dsa-so-mid" transform={`translate(${t.x},${t.y}) scale(${t.s})`}>
                  <path className="dsa-fir" strokeWidth={firW(t.s)} d={TRUNK} />
                  <path className="dsa-fir" strokeWidth={firW(t.s)} d={FIR} />
                </g>
              ))}

              {/* SUBJECT (back half) — loop + drone. Shares --k with the goggle below, or
                  the strands tear off their anchors when the layers separate. */}
              <g className="dsa-lyr" style={{ "--k": -5 } as CSSProperties}>
                <g fill="url(#dsaInt)">
                  {INTENT_DOTS.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={d.r} />)}
                </g>
                {PACKETS.map((p, i) => (
                  <rect key={i} x={p.x} y={p.y} width={p.k} height={p.k} rx={p.r} fill="none" stroke="url(#dsaInt)" strokeWidth={p.w} />
                ))}
                <path fill="url(#dsaInt)" stroke="none" d={INTENT_HEAD} />
                <path fill="none" stroke="url(#dsaFee)" strokeWidth="2.8" strokeLinecap="round" d={FEED_PATH} />
                <path fill="url(#dsaFee)" stroke="none" d={FEED_HEAD} />
                <g transform="translate(818,178) scale(1.7)">
                  <g className="dsa-bank">
                    <Drone />
                    {/* the only ambient loop here; owner-approved 2026-07-15 */}
                    <circle className="dsa-rec" cx="10" cy="-7" r="1.7" />
                  </g>
                </g>
              </g>

              {/* NEAR clouds move; NEAR TREES DO NOT (planted). */}
              <g className="dsa-lyr" style={{ "--k": -22 } as CSSProperties}>
                <path className="dsa-blu dsa-l-near" strokeWidth={cloudW(0.9 * T.cloud)} transform={`translate(60,146) scale(${0.9 * T.cloud})`} d={CLOUDS[1]} />
                <path className="dsa-blu dsa-l-near" strokeWidth={cloudW(0.48 * T.cloud)} transform={`translate(944,206) scale(${0.48 * T.cloud})`} d={CLOUDS[2]} />
              </g>
              {NEAR_TREES.map((t, i) => (
                <g key={i} className="dsa-so-near" transform={`translate(${t.x},${t.y}) scale(${t.s})`}>
                  <path className="dsa-fir" strokeWidth={firW(t.s)} d={TRUNK} />
                  <path className="dsa-fir" strokeWidth={firW(t.s)} d={FIR} />
                </g>
              ))}

              {/* GOGGLE — same --k as the subject layer above. */}
              <g className="dsa-lyr" style={{ "--k": -5 } as CSSProperties}>
                <g transform={`translate(${G.x},${G.y}) scale(${G.s}) translate(-110,-88)`}>
                  <g className="dsa-tilt">
                    {SHELL.map((f, i) => <polygon key={i} className={f.cls} points={f.pts} />)}
                    <polygon className="dsa-mid" points={pts2s(BEZEL48)} />
                    <polygon className="dsa-lo" points={pts2s(inset(BEZEL48, 0.87))} />

                    <g clipPath="url(#dsaScr)">
                      <rect className="dsa-glass" x="15" y="30" width="195" height="115" />
                      {/* THE LESSON: this bank and the drone's are the same number. */}
                      <g className="dsa-bank dsa-feed">
                        <circle className="dsa-celest" cx="154" cy="70" r="6" />
                        {[0, 45, 90, 135, 180, 225, 270, 315].map((A) => {
                          const t = (A * Math.PI) / 180;
                          return <line key={A} className="dsa-ray"
                            x1={(154 + Math.cos(t) * 8).toFixed(1)} y1={(70 + Math.sin(t) * 8).toFixed(1)}
                            x2={(154 + Math.cos(t) * 11).toFixed(1)} y2={(70 + Math.sin(t) * 11).toFixed(1)} />;
                        })}
                        <path className="dsa-terr" opacity=".42" strokeWidth="4" transform="translate(52,68) scale(.28)" d={CLOUDS[1]} />
                        <path className="dsa-terr" opacity=".34" strokeWidth="5" transform="translate(104,58) scale(.22)" d={CLOUDS[2]} />
                        <path className="dsa-terr" opacity=".3" strokeWidth="5.5" transform="translate(172,80) scale(.2)" d={CLOUDS[0]} />
                        <g className="dsa-terr dsa-fgrid" strokeWidth=".5">
                          {FGRID.map((d, i) => <path key={i} d={d} />)}
                        </g>
                        {/* opaque, closed to the horizon — a stroke-only ridge let the moon bleed through */}
                        <path className="dsa-glassfill" d={`${ridge(24, 196, 90, 26)} L198,90 L22,90 Z`} />
                        <path className="dsa-terr dsa-farrange" fill="none" strokeWidth="1.1" d={ridge(24, 196, 90, 26)} />
                        <path className="dsa-terr" strokeWidth="1.3" d="M24,90 Q56,85 82,89 Q108,83 134,88 Q162,84 196,89" />
                        <line className="dsa-terr" strokeWidth="1.9" x1="22" y1="90" x2="198" y2="90" />
                        {GOG_TREES.map((t, i) => (
                          <g key={i} strokeOpacity={t.o} transform={`translate(${t.x},${t.y}) scale(${t.sx},${t.sy})`}>
                            <path className="dsa-gfir" strokeWidth={+(1.1 / Math.sqrt(t.sx * t.sy)).toFixed(2)} d={TRUNK} />
                            <path className="dsa-gfir" strokeWidth={+(1.1 / Math.sqrt(t.sx * t.sy)).toFixed(2)} d={FIR} />
                          </g>
                        ))}
                        <ellipse className="dsa-pilot" cx="110" cy="114" rx="11" ry="2.4" opacity=".24" />
                        <circle className="dsa-pilot" cx="110" cy="99" r="3.5" />
                        <path className="dsa-pilot" d="M110,102 C106.2,102 105.2,106.5 104.4,109.5 C99.6,111.9 97.8,114 101.6,114 L110,112.2 L118.4,114 C122.2,114 120.4,111.9 115.6,109.5 C114.8,106.5 113.8,102 110,102 Z" />
                        {/* rides the bank so it stays locked on the pilot */}
                        <rect className="dsa-det" x="96" y="95" width="28" height="24" />
                        <rect className="dsa-detbar" x="96" y="89.3" width="28" height="5.7" />
                      </g>

                      {/* HUD — fixed to the goggle, not the video */}
                      <g className="dsa-h" strokeWidth=".7">
                        <line x1="34" y1="66" x2="34" y2="112" />
                        {[0, 1, 2, 3, 4].map((i) => <line key={i} x1="34" y1={68 + i * 11} x2="38" y2={68 + i * 11} />)}
                      </g>
                      <g className="dsa-hd" strokeWidth=".5">
                        {[-24, -12, 12, 24].map((k) => (
                          <line key={k} x1={102 + Math.abs(k) / 4} y1={88 + k} x2={118 - Math.abs(k) / 4} y2={88 + k} />
                        ))}
                      </g>
                      <g opacity=".55">
                        <g className="dsa-h" strokeWidth=".7">
                          <line x1="60" y1="68" x2="160" y2="68" />
                          {[0, 1, 2, 3, 4, 5].map((i) => <line key={i} x1={64 + i * 18} y1="68" x2={64 + i * 18} y2="72" />)}
                        </g>
                        <polygon className="dsa-hf" points="110,68 106,63 114,63" />
                        <rect className="dsa-h" strokeWidth=".8" x="148" y="101" width="18" height="7.5" rx="1.5" />
                        <rect className="dsa-hf" x="149.2" y="102.2" width="11.5" height="5.1" />
                        <rect className="dsa-hf" x="166.6" y="103.4" width="1.5" height="3" />
                      </g>
                      <g className="dsa-gld dsa-whisk" strokeWidth="1.4" strokeLinecap="round">
                        <line x1="110" y1="82.5" x2="110" y2="85.5" /><line x1="110" y1="90.5" x2="110" y2="93.5" />
                        <line x1="102.5" y1="88" x2="105.5" y2="88" /><line x1="114.5" y1="88" x2="117.5" y2="88" />
                      </g>
                    </g>

                    {/* antennae drawn AFTER the shell: the body extrudes up-right and would
                        swallow the right one. Depth is size + mount, never occlusion. */}
                    <g className="dsa-antl">
                      {ANT_L.quads.map((q, i) => <polygon key={i} className={q.cls} points={q.pts} />)}
                      <circle className="dsa-mid" cx={ANT_L.tip.cx} cy={ANT_L.tip.cy} r={ANT_L.tip.r} />
                    </g>
                    <g className="dsa-antr">
                      {ANT_R.quads.map((q, i) => <polygon key={i} className={q.cls} points={q.pts} />)}
                      <circle className="dsa-mid" cx={ANT_R.tip.cx} cy={ANT_R.tip.cy} r={ANT_R.tip.r} />
                    </g>
                  </g>
                </g>
              </g>
            </svg>

            {/* Label is HTML at real px, NOT text inside the svg: an svg scales its text
                with its width, so at 576px an in-svg label falls under the ~14px floor
                (diagram-standards.md §1). Positioned in % so it tracks the art. */}
            <p className="dsa-lbl">
              <span className="dsa-eyebrow"><span aria-hidden="true">▸ </span>Intent stream</span>
              <span className="dsa-readout">~1 / SEC</span>
            </p>
          </div>
        </div>

        {/* narrow: reflow to stacked cards — never scale the scene down (directive 1) */}
        <div className="dsa-cards" aria-hidden="true">
          <div className="dsa-card">
            <p className="dsa-ck">You send the goal</p>
            <p className="dsa-ct"><b>~1 command / sec.</b> Sparse, high-level intent: "go left", "hold". Nothing continuous.</p>
          </div>
          <div className="dsa-card dsa-card-drone">
            <p className="dsa-ck">The drone flies, you watch</p>
            <p className="dsa-ct">It holds altitude, stays stable and dodges obstacles on its own at <b>~100s of Hz</b>. Its camera streams back the only picture you have.</p>
          </div>
        </div>
      </div>
    </DiagramFrame>
  );
}

function Drone() {
  const pod = (x: number, y: number) => (
    <>
      <polygon className="dsa-flo" points={`${x - 5},${y} ${x + 5},${y} ${x + 5},${y + 13} ${x - 5},${y + 13}`} />
      <polygon className="dsa-fmid" points={`${x - 5},${y} ${x},${y + 2.5} ${x},${y + 15.5} ${x - 5},${y + 13}`} />
      <ellipse className="dsa-fhi" cx={x} cy={y} rx="5" ry="2.2" />
    </>
  );
  const prop = (x: number, y: number) => (
    <>
      <ellipse className="dsa-fprop" cx={x} cy={y} rx="24" ry="4" opacity=".5" />
      <ellipse className="dsa-fprop" cx={x} cy={y} rx="8.4" ry="2.4" opacity=".8" />
    </>
  );
  return (
    <>
      {prop(-36, -26)}{prop(36, -26)}{pod(-36, -24)}{pod(36, -24)}
      <polygon className="dsa-flo" points="-31,-14 -14,-6 -14,0 -31,-8" />
      <polygon className="dsa-flo" points="31,-14 14,-6 14,0 31,-8" />
      <polygon className="dsa-fhi" points="-18,-9 0,-16 18,-9 0,-2" />
      <polygon className="dsa-fmid" points="-18,-9 0,-2 0,12 -18,4" />
      <polygon className="dsa-flo" points="18,-9 0,-2 0,12 18,4" />
      <circle className="dsa-fdk" cx="0" cy="2" r="6" />
      <circle className="dsa-lens" cx="0" cy="2" r="4" />
      <polygon className="dsa-fdk" points="-10,9 -6,10 -12,26 -17,26" />
      <polygon className="dsa-fdk" points="10,9 6,10 12,26 17,26" />
    </>
  );
}

const CSS = `
.dsa-svg{overflow:visible;width:100%;height:auto;display:block;}
.dsa-stage{position:relative;}

/* Scene palette. Token-only: every colour resolves through a --color-* var so the
   whole diagram flips under [data-theme="light"]. The slate/gold split keeps the two
   protagonists apart — the goggle is slate, the drone is gold. */
.dsa-hi{fill:var(--color-s-hi,#8c9ab9);}
.dsa-mid{fill:var(--color-s-mid,#5f6d8f);}
.dsa-lo{fill:var(--color-s-lo,#414d6d);}
.dsa-dk{fill:var(--color-s-dk,#2c3550);}
.dsa-fhi{fill:var(--color-f-hi,#f0cd86);}
.dsa-fmid{fill:var(--color-command-gold,#c8963e);}
.dsa-flo{fill:var(--color-f-lo,#8f6a2b);}
.dsa-fdk{fill:var(--color-f-dk,#39435e);}
.dsa-fprop{fill:var(--color-f-prop,#8794b8);}
.dsa-lens{fill:var(--color-signal-blue,#4a8fff);}
.dsa-glass{fill:var(--color-glass,#101d36);}
.dsa-glassfill{fill:var(--color-glass,#101d36);stroke:none;}
.dsa-celest{fill:var(--color-celest,#cfd8e8);}
.dsa-terr{stroke:var(--color-terr,#4a8fff);fill:none;}
.dsa-pilot{fill:var(--color-pilot,#f1ece0);}
.dsa-blu{stroke:var(--color-signal-blue,#4a8fff);fill:none;}
.dsa-gld{stroke:var(--color-command-gold,#c8963e);fill:none;}
/* Filled with the frame's own field, so a tree occludes the grid behind it AND the
   frame-breaking part reads clean where it spills past the sky plate. */
.dsa-fir{stroke:var(--color-command-gold,#c8963e);fill:var(--color-deep-space,#08090d);}
.dsa-gfir{stroke:var(--color-terr,#4a8fff);fill:var(--color-glass,#101d36);}
.dsa-det{fill:none;stroke:var(--color-status-green,#66bb6a);stroke-width:.9;}
.dsa-detbar{fill:var(--color-status-green,#66bb6a);}
.dsa-h{stroke:var(--color-gold-light,#e8b865);fill:none;stroke-linecap:round;}
.dsa-hf{fill:var(--color-gold-light,#e8b865);stroke:none;}
.dsa-hd{stroke:var(--color-hud-dim,#8b93a3);fill:none;}
.dsa-sky-a{stop-color:var(--color-sky-a,#12182a);} .dsa-sky-b{stop-color:var(--color-sky-b,#0a0e17);}
.dsa-gnd-a{stop-color:var(--color-gnd-a,#1a1a12);} .dsa-gnd-b{stop-color:var(--color-gnd-b,#0c0d11);}
.dsa-int-a{stop-color:var(--color-intent-a,#f6dfa8);} .dsa-int-b{stop-color:var(--color-intent-b,#a9761f);}
.dsa-fee-a{stop-color:var(--color-feed-a,#b4d2ff);} .dsa-fee-b{stop-color:var(--color-feed-b,#2a548f);}
.dsa-ray{stroke:var(--color-celest,#cfd8e8);stroke-width:1.2;opacity:.85;display:none;}

/* Depth ladder. l-* is GROUP opacity and is only safe for the clouds (stroke-only,
   fill:none). Anything FILLED uses so-* (stroke-opacity): group opacity fades the fill
   too, and a half-transparent tree stops occluding the grid running behind it. */
.dsa-l-far{opacity:.24;} .dsa-l-mid{opacity:.5;} .dsa-l-near{opacity:.85;}
.dsa-so-mid{stroke-opacity:.55;} .dsa-so-near{stroke-opacity:.9;}
.dsa-wgrid{opacity:.34;} .dsa-farrange{opacity:.4;} .dsa-fgrid{opacity:.36;}

.dsa-tilt{transform:rotate(-3deg);transform-box:fill-box;transform-origin:center;}

/* ── PARALLAX (Tier B) ───────────────────────────────────────────────────────
   useScrollParallax writes --p (-1..+1) on .dsa. Everything below only reads it via
   transform, so the work stays composited and CLS is 0. No --p (SSR / no-JS /
   reduced-motion) resolves to 0 = the settled frame. */
.dsa-lyr{transform:translateX(calc(var(--p,0) * var(--k,0) * 1px));}
/* THE LESSON: the drone's bank and the goggle video's bank are the same expression,
   so they cannot drift apart in a later edit. */
.dsa-bank{transform:rotate(calc(-4deg + var(--p,0) * 6deg));}
.dsa-feed{transform-box:view-box;transform-origin:110px 90px;}
.dsa-antl{transform:translate(calc(var(--p,0) * -1.35px),calc(var(--p,0) * -1.73px));}
.dsa-antr{transform:translate(calc(var(--p,0) * 1.35px),calc(var(--p,0) * -1.73px));}

/* The one ambient loop in this diagram (owner-approved). Slow, subtle, gated. */
.dsa-rec{fill:var(--color-alert-red,#ef5350);animation:dsaRec 2.6s ease-in-out infinite;}
@keyframes dsaRec{0%,44%{opacity:.22}52%,92%{opacity:.95}100%{opacity:.22}}

/* Label — real px, never scaled with the art. */
.dsa-lbl{position:absolute;left:36.5%;top:11.2%;margin:0;text-align:left;pointer-events:none;}
.dsa-eyebrow{display:block;font-family:var(--font-mono,"Space Mono",monospace);font-size:14px;
  font-weight:700;text-transform:uppercase;letter-spacing:.24em;
  color:var(--color-command-gold,#c8963e);white-space:nowrap;}
.dsa-readout{display:block;font-family:var(--font-numeral,"Saira Condensed",sans-serif);
  font-weight:800;font-size:24px;font-variant-numeric:tabular-nums;letter-spacing:.02em;
  color:var(--color-text,#e8e8e8);white-space:nowrap;}

/* Reflow, don't shrink: below 520px of FRAME width the scene is dropped for stacked
   cards, so the label never scales under the ~14px floor. Container query, not a media
   query — a diagram in the narrow follower rail must reflow off the frame, not the
   viewport. */
.dsa-cards{display:none;flex-direction:column;gap:.7rem;text-align:left;}
@container (max-width:520px){
  .dsa-scene{display:none;}
  .dsa-cards{display:flex;}
}
.dsa-card{border-radius:6px;padding:.7rem .8rem;}
.dsa-card-drone{box-shadow:inset 0 0 0 2px var(--color-command-gold,#c8963e);}
.dsa-ck{margin:0 0 .25rem;font-family:var(--font-display,"Bebas Neue",sans-serif);
  font-size:1.2rem;letter-spacing:.02em;color:var(--color-title,#f1ece0);}
.dsa-card-drone .dsa-ck{color:var(--color-command-gold,#c8963e);}
.dsa-ct{margin:0;font-family:var(--font-serif,"Lora",serif);font-size:.88rem;line-height:1.4;
  color:var(--color-text,#e8e8e8);}
.dsa-ct b{color:var(--color-title,#f1ece0);font-weight:700;}

.dgfrm.armed .dsa-card{opacity:0;transform:translateY(5px);}
.dgfrm.armed.in .dsa-card{opacity:1;transform:none;
  transition:opacity .5s ease,transform .5s cubic-bezier(.2,.7,.2,1);}
.dgfrm.armed.in .dsa-card-drone{transition-delay:.12s;}

/* HARD rule: reduced motion is the settled frame, no parallax, no blink. */
@media (prefers-reduced-motion:reduce){
  .dgfrm .dsa-card{opacity:1!important;transform:none!important;}
  .dsa-rec{animation:none;opacity:.85;}
}
`;
