"use client";

// The Logbook standing rail (design 2026-07-13): a large rank wing centered in the
// XP ring, the FL chip on the ring's lower edge, title + next-to + XP to the right.
// The whole block is a button that opens the RANK LADDER — a rolodex wheel of all 12
// wings (full color), the centered rank's wing grown 2× (animated), current marked.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { RankWing } from "./RankWing";
import { LEVELS } from "@/lib/logbook/economy";

const num = (n: number) => n.toLocaleString("en-US");
const ROW_H = 68, WHEEL_H = 320;

export function StandingRail({ level, title, xp, nextMinXp, nextLevel, bandPct }: {
  level: number; title: string; xp: number; nextMinXp: number | null; nextLevel: number | null; bandPct: number;
}) {
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState(level - 1);
  const wheel = useRef<HTMLDivElement>(null);
  const idxRef = useRef(level - 1);
  const clampIdx = (n: number) => Math.max(0, Math.min(LEVELS.length - 1, n));
  const goto = (idx: number) => { idxRef.current = idx; setFocus(idx); wheel.current?.scrollTo({ top: idx * ROW_H, behavior: "smooth" }); };
  const step = (dir: number) => goto(clampIdx(idxRef.current + dir));
  const onScroll = () => { if (wheel.current) { const k = clampIdx(Math.round(wheel.current.scrollTop / ROW_H)); idxRef.current = k; setFocus(k); } };
  const pad = (WHEEL_H - ROW_H) / 2;

  // Open: snap instantly to the current rank.
  useEffect(() => {
    if (!open) return;
    idxRef.current = level - 1;
    setFocus(level - 1);
    requestAnimationFrame(() => { if (wheel.current) wheel.current.scrollTop = (level - 1) * ROW_H; });
  }, [open, level]);

  // One wheel notch = exactly one rank. React's onWheel is passive (can't
  // preventDefault), so bind a native non-passive listener; a short lock keeps a
  // single scroll gesture's event burst from skipping ranks.
  useEffect(() => {
    const el = wheel.current;
    if (!open || !el) return;
    let locked = false;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (locked || e.deltaY === 0) return;
      const cur = idxRef.current;
      const next = Math.max(0, Math.min(LEVELS.length - 1, cur + Math.sign(e.deltaY)));
      if (next !== cur) { idxRef.current = next; setFocus(next); el.scrollTo({ top: next * ROW_H, behavior: "smooth" }); }
      locked = true;
      window.setTimeout(() => { locked = false; }, 160);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-6 rounded-lg p-2 text-left transition-opacity hover:opacity-80" aria-label="Open the rank ladder">
        <div className="relative shrink-0">
          <div className="relative grid h-[168px] w-[168px] place-items-center">
            <svg viewBox="0 0 80 80" className="h-[168px] w-[168px] -rotate-90" aria-hidden>
              {Array.from({ length: 44 }).map((_, i) => { const a = (i / 44) * Math.PI * 2; const on = i / 44 <= bandPct; return <line key={i} x1={40 + Math.cos(a) * 30} y1={40 + Math.sin(a) * 30} x2={40 + Math.cos(a) * 36} y2={40 + Math.sin(a) * 36} stroke={on ? "var(--color-command-gold)" : "var(--color-panel-border)"} strokeWidth="1.5" />; })}
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

      {open && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[100] grid place-items-center bg-deep-space/80 p-4" onClick={() => setOpen(false)}>
              <div className="relative w-full max-w-sm border border-command-gold/25 bg-deep-space p-5 shadow-[var(--elev-card)]" style={{ borderRadius: 8 }} onClick={(e) => e.stopPropagation()}>
                <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="absolute right-2.5 top-2.5 grid h-7 w-7 place-items-center rounded-full text-base leading-none text-muted transition-colors hover:bg-command-gold/10 hover:text-command-gold">&#10005;</button>
                <div className="mb-2 border-b border-panel-border/50 pb-2 pr-8">
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-command-gold">Flight levels</p>
                  <p className="font-display text-xl tracking-wide text-title">The rank ladder</p>
                </div>
                <div className="relative mx-auto w-[288px]">
                  <div className="pointer-events-none absolute inset-x-2 top-1/2 z-10 -translate-y-1/2 rounded-md border-y border-command-gold/25 bg-command-gold/[0.06]" style={{ height: ROW_H }} />
                  {/* scroll affordances — click to step one rank; hidden at the ends */}
                  <button type="button" onClick={() => step(-1)} disabled={focus === 0} aria-label="Scroll to higher ranks" className="absolute left-1/2 top-0 z-20 grid h-6 w-10 -translate-x-1/2 place-items-center rounded-b-md bg-deep-space/70 text-sm leading-none text-command-gold transition-opacity hover:opacity-70 disabled:pointer-events-none disabled:opacity-0">&#9650;</button>
                  <button type="button" onClick={() => step(1)} disabled={focus === LEVELS.length - 1} aria-label="Scroll to lower ranks" className="absolute bottom-0 left-1/2 z-20 grid h-6 w-10 -translate-x-1/2 place-items-center rounded-t-md bg-deep-space/70 text-sm leading-none text-command-gold transition-opacity hover:opacity-70 disabled:pointer-events-none disabled:opacity-0">&#9660;</button>
                  <div ref={wheel} onScroll={onScroll} className="overflow-y-auto overscroll-contain" style={{ height: WHEEL_H, scrollbarWidth: "none", scrollSnapType: "y proximity", WebkitMaskImage: "linear-gradient(180deg, transparent, #000 20%, #000 80%, transparent)" }}>
                    <div style={{ paddingTop: pad, paddingBottom: pad }}>
                      {LEVELS.map((l, i) => {
                        const d = Math.abs(i - focus), cur = i === focus, mine = l.level === level;
                        const scale = cur ? 2 : Math.max(0.6, 1 - d * 0.18), op = cur ? 1 : Math.max(0.3, 1 - d * 0.28);
                        return (
                          <div key={l.level} className="relative flex items-center justify-center gap-3" style={{ height: ROW_H, scrollSnapAlign: "center", opacity: op, transition: "opacity .22s ease" }}>
                            {mine ? <span className="absolute left-1 font-mono text-xs text-command-gold" aria-label="Your current rank">&#9656;</span> : null}
                            <div style={{ transform: `scale(${scale})`, transformOrigin: "center", transition: "transform .22s cubic-bezier(.2,.85,.25,1)" }}><RankWing level={l.level} size={32} /></div>
                            <div className="w-[120px]">
                              <p className={`font-mono text-[10px] uppercase tracking-[0.1em] ${cur ? "text-command-gold" : "text-muted"}`}>FL{l.level} · {l.title}</p>
                              {cur ? <p className="font-numeral text-[10px] tabular-nums text-command-gold">{num(l.minXp)} XP</p> : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
