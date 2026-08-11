// SANDBOX — the spin profiles as curves. DEV ONLY.
//
// The whip is a SHAPE, and a number that flickers past in a readout does not
// show a shape. Plotting rate against time makes the difference between the
// profiles legible in one look: where the owl is tracking, where it runs out of
// neck, how abruptly it re-acquires. It also exposes anything ugly in the
// curve, like a spike or a dip toward zero mid-whip, which a canvas at sixty
// frames a second will happily hide.

import { HANDOFF, SECONDS } from "./timing";
import { PROFILE_LABELS, spinAt, type SpinProfile } from "./spin";

const W = 960;
const H = 150;
const PAD = { l: 42, r: 8, t: 10, b: 20 };

export function RateGraph() {
  const profiles = Object.keys(PROFILE_LABELS) as SpinProfile[];
  const samples = 480;

  const series = profiles.map((p) => {
    const pts: [number, number][] = [];
    for (let i = 0; i <= samples; i += 1) {
      const t = (i / samples) * SECONDS;
      pts.push([t, spinAt(p, t).rate]);
    }
    return { p, pts };
  });

  // The scale has to span NEGATIVE rates now. Anticipation and overshoot both
  // run the turntable backwards, and a graph clamped at zero would hide the two
  // features the profiles exist for.
  const all = series.flatMap((s) => s.pts.map(([, r]) => r));
  const maxRate = Math.max(...all);
  const minRate = Math.min(0, ...all);
  const span = maxRate - minRate;
  const x = (t: number) => PAD.l + (t / SECONDS) * (W - PAD.l - PAD.r);
  const y = (r: number) => H - PAD.b - ((r - minRate) / span) * (H - PAD.t - PAD.b);

  // Gold for the spring profiles, blue for the constant baseline: blue is data,
  // gold is the thing being proposed.
  const colour: Record<SpinProfile, string> = {
    constant: "var(--color-signal-blue)",
    snap: "var(--color-command-gold)",
    crack: "var(--color-gold-light)",
    doubletake: "var(--color-gold-dim)",
    hero: "var(--color-danger-coral)",
  };

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label="Spin rate over the loop">
        <line
          x1={PAD.l} y1={y(0)} x2={W - PAD.r} y2={y(0)}
          stroke="var(--color-panel-border)" strokeWidth="1"
        />
        <line
          x1={x(HANDOFF)} y1={PAD.t} x2={x(HANDOFF)} y2={H - PAD.b + 4}
          stroke="var(--color-command-gold)" strokeWidth="1" strokeDasharray="3 3" opacity="0.6"
        />
        <text
          x={x(HANDOFF) + 5} y={PAD.t + 9}
          fill="var(--color-command-gold)" fontSize="9" fontFamily="var(--font-mono)"
          letterSpacing="1.4"
        >
          HANDOFF
        </text>
        {[Math.round(minRate), 0, Math.round(maxRate / 2), Math.round(maxRate)].map((r) => (
          <text
            key={r} x={PAD.l - 6} y={y(r) + 3} textAnchor="end"
            fill="var(--color-gray-3)" fontSize="9" fontFamily="var(--font-mono)"
          >
            {r}
          </text>
        ))}
        {[0, 4, 8, 12].map((t) => (
          <text
            key={t} x={x(t)} y={H - 6} textAnchor="middle"
            fill="var(--color-gray-3)" fontSize="9" fontFamily="var(--font-mono)"
          >
            {t}s
          </text>
        ))}
        {series.map(({ p, pts }) => (
          <polyline
            key={p}
            fill="none"
            stroke={colour[p]}
            strokeWidth={p === "constant" ? 1 : 1.6}
            strokeDasharray={p === "constant" ? "4 3" : undefined}
            points={pts.map(([t, r]) => `${x(t)},${y(r)}`).join(" ")}
          />
        ))}
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
        {profiles.map((p) => (
          <span key={p} className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            <span aria-hidden className="mr-1.5" style={{ color: colour[p] }}>
              ▬
            </span>
            {PROFILE_LABELS[p]}
          </span>
        ))}
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-gray-3">
          degrees per second
        </span>
      </figcaption>
    </figure>
  );
}
