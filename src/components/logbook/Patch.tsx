// A patch tile (LOCKED 2026-07-11): the beaded frame (beads between two rings) +
// a central emblem by kind + label. Earned = gold; locked = dim silhouette with a
// how-to line. Pure SVG (token colors).

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

export type PatchKind = "cluster" | "wings" | "skill" | "rating";

function Emblem({ kind, c, accent }: { kind: PatchKind; c: string; accent: string }) {
  switch (kind) {
    case "wings":
      return (
        <g fill={c}>
          {[-1, 1].map((side) =>
            Array.from({ length: 4 }).map((_, i) => {
              const f = i / 3, len = 13 - f * 5;
              const bx = 32 + side * 3, by = 32 + (f - 0.4) * 4;
              const tx = 32 + side * (3 + len), ty = 32 + (f - 0.4) * 9;
              return <path key={`${side}${i}`} d={`M${bx} ${(by - 1).toFixed(1)}L${tx.toFixed(1)} ${ty.toFixed(1)}L${bx} ${(by + 1).toFixed(1)}Z`} />;
            }),
          )}
          <path d={starPath(32, 31, 3, 1.2)} fill={accent} />
        </g>
      );
    case "skill":
      return <path d={starPath(32, 32, 7, 2.8)} fill={c} />;
    case "rating":
      return (
        <g>
          <path d="M32 24l7 2.5v6c0 4.5-3 7-7 8.5-4-1.5-7-4-7-8.5v-6z" fill="none" stroke={c} strokeWidth={1.3} />
          <path d={starPath(32, 32, 3.4, 1.4)} fill={accent} />
        </g>
      );
    default: // cluster → hex
      return <path d="M32 23l9 5.2v10.6L32 44l-9-5.2V28.2z" fill="none" stroke={c} strokeWidth={1.5} strokeLinejoin="round" />;
  }
}

export function Patch({
  kind,
  label,
  earned,
  howToEarn,
}: {
  kind: PatchKind;
  label: string;
  earned: boolean;
  howToEarn?: string;
}) {
  const c = earned ? G : "var(--color-gray-3)";
  const accent = earned ? GL : "var(--color-gray-3)";
  return (
    <div className="flex flex-col items-center gap-1.5 py-3 text-center">
      <svg viewBox="0 0 64 64" className="h-14 w-14" aria-hidden style={{ opacity: earned ? 1 : 0.8 }}>
        {/* beaded frame 6-7: beads between two rings */}
        <circle cx="32" cy="32" r="28" fill="none" stroke={c} strokeWidth={1.4} />
        <circle cx="32" cy="32" r="22" fill="none" stroke={c} strokeWidth={0.9} />
        {Array.from({ length: 26 }).map((_, i) => {
          const a = (i / 26) * Math.PI * 2;
          return <circle key={i} cx={32 + Math.cos(a) * 25} cy={32 + Math.sin(a) * 25} r={0.9} fill={c} />;
        })}
        <Emblem kind={kind} c={c} accent={accent} />
      </svg>
      <span className={`font-mono text-[9px] uppercase tracking-[0.14em] ${earned ? "text-gold-light" : "text-muted"}`}>
        {label}
      </span>
      {!earned && howToEarn ? (
        <span className="max-w-[8rem] font-serif text-[11px] leading-tight text-gray-3">{howToEarn}</span>
      ) : null}
    </div>
  );
}
