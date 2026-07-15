"use client";

// The library sticky-rail follower card for a signed-in learner (owner-picked V5-B,
// 2026-07-14): the XP ring hero (wing + FL chip, opens the rank ladder) over the resume
// block (eyebrow + lesson title + blurb) + the lesson's diagram + the resume CTA, then a
// "▸ Patches" label over the earned-badge row (each opens its detail). The diagram is a
// server-rendered node passed as children. Anonymous visitors get RailAlso instead.
import { useState } from "react";
import Link from "next/link";
import { RankWing } from "@/components/logbook/RankWing";
import { PatchBadge } from "@/components/logbook/Patch";
import { RankLadderModal } from "@/components/logbook/RankLadderModal";
import { PatchDetailModal, type PatchEntry } from "@/components/logbook/PatchDetailModal";

const num = (n: number) => n.toLocaleString("en-US");

export function FollowerCard({
  eyebrow,
  title,
  blurb,
  href,
  cta,
  clusterLabel,
  readingMinutes,
  level,
  rankTitle,
  xp,
  bandPct,
  entries,
  children,
}: {
  eyebrow: string;
  title: string;
  blurb: string;
  href: string;
  cta: string;
  clusterLabel: string | null;
  readingMinutes: number;
  level: number;
  rankTitle: string;
  xp: number;
  bandPct: number;
  entries: PatchEntry[];
  children?: React.ReactNode; // the lesson's hero diagram (server-rendered)
}) {
  const [rankOpen, setRankOpen] = useState(false);
  const [sel, setSel] = useState<PatchEntry | null>(null);

  return (
    <div>
      {/* XP ring hero — opens the rank ladder */}
      <button type="button" onClick={() => setRankOpen(true)} className="flex items-center gap-4 rounded-lg p-1 text-left transition-opacity hover:opacity-80" aria-label="Open the rank ladder">
        <div className="relative grid h-[92px] w-[92px] shrink-0 place-items-center">
          <svg viewBox="0 0 80 80" className="h-[92px] w-[92px] -rotate-90" aria-hidden>
            {Array.from({ length: 40 }).map((_, i) => {
              const a = (i / 40) * Math.PI * 2;
              const on = i / 40 <= bandPct;
              // Round the trig to a fixed precision so the SSR + client strings match
              // (raw floats serialize with different last digits → hydration mismatch).
              const q = (n: number) => n.toFixed(3);
              return <line key={i} x1={q(40 + Math.cos(a) * 30)} y1={q(40 + Math.sin(a) * 30)} x2={q(40 + Math.cos(a) * 36)} y2={q(40 + Math.sin(a) * 36)} stroke={on ? "var(--color-command-gold)" : "var(--color-panel-border)"} strokeWidth="1.5" />;
            })}
          </svg>
          <div className="absolute"><RankWing level={level} size={48} /></div>
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full border border-command-gold/40 bg-deep-space px-2 py-0.5 font-numeral text-xs leading-none tabular-nums text-command-gold">FL{level}</span>
        </div>
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">{rankTitle}</p>
          <p className="font-numeral text-xl tabular-nums text-command-gold">{num(xp)} XP</p>
        </div>
      </button>

      <div className="my-4 border-t border-panel-border/60" />

      {/* Resume block */}
      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-command-gold">▸ {eyebrow}</p>
      <h3 className="mt-1.5">
        <Link href={href} className="font-display text-2xl font-normal leading-tight tracking-wide text-title transition-colors hover:text-command-gold focus-visible:text-command-gold focus-visible:outline-none">
          {title}
        </Link>
      </h3>
      {blurb ? <p className="mt-1.5 font-serif text-sm leading-relaxed text-muted">{blurb}</p> : null}
      <p className="mt-2 flex flex-wrap items-center gap-x-2 font-mono text-[9px] uppercase tracking-[0.18em] text-muted">
        {clusterLabel ? (<><span className="text-gray-3">{clusterLabel}</span><span className="text-command-gold">·</span></>) : null}
        <span><span className="font-numeral tabular-nums text-command-gold">{readingMinutes}</span> min</span>
      </p>

      {children ? <div className="mx-auto mt-4 w-full">{children}</div> : null}

      <div className="mt-4">
        <Link href={href} className="inline-flex items-center gap-1.5 rounded border border-command-gold px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space focus-visible:bg-command-gold focus-visible:text-deep-space focus-visible:outline-none">
          {cta} <span aria-hidden>→</span>
        </Link>
      </div>

      {/* Earned patches — each opens its detail */}
      {entries.length > 0 ? (
        <>
          <p className="mb-2 mt-6 font-mono text-[9px] uppercase tracking-[0.2em] text-command-gold">▸ Patches earned</p>
          <div className="flex flex-wrap items-center gap-3">
            {entries.map((e) => (
              <button key={e.key} type="button" onClick={() => setSel(e)} className="transition-opacity hover:opacity-80" title={e.label}>
                <PatchBadge art={e.art} earned tier={e.tier ?? 0} size={28} />
              </button>
            ))}
          </div>
        </>
      ) : null}

      {rankOpen ? <RankLadderModal level={level} onClose={() => setRankOpen(false)} /> : null}
      {sel ? <PatchDetailModal entry={sel} onClose={() => setSel(null)} /> : null}
    </div>
  );
}
