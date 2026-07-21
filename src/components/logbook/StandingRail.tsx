"use client";

// The Logbook standing rail (design 2026-07-13): a large rank wing centered in the
// XP ring, the FL chip on the ring's lower edge, title + next-to + XP to the right.
// The whole block is a button that opens the RANK LADDER (RankLadderModal, extracted
// 2026-07-14 so the library follower card can open the same thing).
import { useState } from "react";
import { RankWing } from "./RankWing";
import { RankLadderModal } from "./RankLadderModal";

const num = (n: number) => n.toLocaleString("en-US");

export function StandingRail({ level, title, xp, nextMinXp, nextLevel, bandPct }: {
  level: number; title: string; xp: number; nextMinXp: number | null; nextLevel: number | null; bandPct: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-6 rounded p-2 text-left transition-opacity hover:opacity-80" aria-label="Open the rank ladder">
        <div className="relative shrink-0">
          <div className="relative grid h-[168px] w-[168px] place-items-center">
            <svg viewBox="0 0 80 80" className="h-[168px] w-[168px] -rotate-90" aria-hidden>
              {Array.from({ length: 44 }).map((_, i) => { const a = (i / 44) * Math.PI * 2; const on = i / 44 <= bandPct; const q = (n: number) => n.toFixed(3); return <line key={i} x1={q(40 + Math.cos(a) * 30)} y1={q(40 + Math.sin(a) * 30)} x2={q(40 + Math.cos(a) * 36)} y2={q(40 + Math.sin(a) * 36)} stroke={on ? "var(--color-command-gold)" : "var(--color-panel-border)"} strokeWidth="1.5" />; })}
            </svg>
            <div className="absolute grid place-items-center"><RankWing level={level} size={66} /></div>
          </div>
          <span className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rounded-full border border-command-gold/40 bg-deep-space px-2.5 py-0.5 font-numeral text-sm leading-none tabular-nums text-command-gold shadow-[var(--elev-card)]">FL{level}</span>
        </div>
        <div>
          <p className="font-display text-2xl tracking-wide text-title">{title}</p>
          {nextMinXp && nextLevel ? <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-muted"><span className="font-numeral tabular-nums text-command-gold">{num(xp)}</span> / {num(nextMinXp)} to FL{nextLevel}</p> : <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">top rank</p>}
          <p className="mt-1 font-numeral text-sm tabular-nums text-command-gold">{num(xp)} XP</p>
        </div>
      </button>

      {open ? <RankLadderModal level={level} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
