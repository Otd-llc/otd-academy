"use client";

// The RANK LADDER modal (extracted from StandingRail 2026-07-14 so the library follower
// card can open the same thing): a rolodex wheel of all 12 wings (full color), the
// centered rank's wing grown 2x, the learner's current rank marked. Mounted only while
// open (the parent conditionally renders it); one wheel notch = one rank.
//
// DISMISSAL + FOCUS: a native <dialog> (`showModal()`), matching PartGlanceModal,
// PatchDetailModal and the rest. This used to createPortal a positioned div at
// `z-[100]` with an onClick on the backdrop: no focus trap and no Escape
// handler, so a keyboard user could tab out of an open modal into the page
// behind it and had no way to dismiss it without finding the ✕. The top layer
// also retires the z-index question — this sat at z-[100] purely to out-rank
// PatchDetailModal's z-50, a race nobody had adjudicated.
//
// The VISUAL treatment is unchanged: deep-space, gold hairline, --elev-card,
// dimmed backdrop, radius 8. No navy fill.
import { useEffect, useRef, useState } from "react";
import { RankWing } from "./RankWing";
import { LEVELS } from "@/lib/logbook/economy";

const num = (n: number) => n.toLocaleString("en-US");
const ROW_H = 68, WHEEL_H = 320;

export function RankLadderModal({ level, onClose }: { level: number; onClose: () => void }) {
  const [focus, setFocus] = useState(level - 1);
  const dlg = useRef<HTMLDialogElement>(null);
  const wheel = useRef<HTMLDivElement>(null);
  const idxRef = useRef(level - 1);
  const clampIdx = (n: number) => Math.max(0, Math.min(LEVELS.length - 1, n));
  const goto = (idx: number) => { idxRef.current = idx; setFocus(idx); wheel.current?.scrollTo({ top: idx * ROW_H, behavior: "smooth" }); };
  const step = (dir: number) => goto(clampIdx(idxRef.current + dir));
  const onScroll = () => { if (wheel.current) { const k = clampIdx(Math.round(wheel.current.scrollTop / ROW_H)); idxRef.current = k; setFocus(k); } };
  const pad = (WHEEL_H - ROW_H) / 2;

  // Snap to the current rank on open.
  useEffect(() => {
    idxRef.current = level - 1;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- snaps the wheel when the target rank changes
    setFocus(level - 1);
    requestAnimationFrame(() => { if (wheel.current) wheel.current.scrollTop = (level - 1) * ROW_H; });
  }, [level]);

  // One wheel notch = exactly one rank (React onWheel is passive → native listener).
  useEffect(() => {
    const el = wheel.current;
    if (!el) return;
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
  }, []);

  // The parent mounts this only while open, so opening on mount is the whole
  // lifecycle. showModal() (not show()) is the call that traps focus and puts the
  // element in the top layer.
  useEffect(() => {
    const d = dlg.current;
    if (d && !d.open) d.showModal();
  }, []);

  // A click whose target is the <dialog> itself landed on the backdrop, not the
  // panel. Replaces the old stopPropagation dance, which needed a click handler
  // on a non-interactive div.
  function onDialogClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dlg.current) onClose();
  }

  return (
    <dialog
      ref={dlg}
      onClose={onClose}
      onCancel={onClose}
      onClick={onDialogClick}
      aria-label="The rank ladder"
      // Centred explicitly (fixed inset-0 + m-auto + h-fit): Tailwind's preflight
      // margin reset defeats the UA's default modal centring. Same fix as the
      // other dialogs.
      className="fixed inset-0 m-auto h-fit w-[calc(100%-2rem)] max-w-sm border border-command-gold/25 bg-deep-space p-5 text-text shadow-[var(--elev-card)] backdrop:bg-deep-space/80"
      style={{ borderRadius: 8 }}
    >
      <div className="relative">
        <button type="button" autoFocus onClick={onClose} aria-label="Close" className="absolute right-0 top-0 z-30 grid h-7 w-7 place-items-center rounded-full text-base leading-none text-muted transition-colors hover:bg-command-gold/10 hover:text-command-gold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-command-gold">&#10005;</button>
        <div className="mb-2 border-b border-panel-border/50 pb-2 pr-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-command-gold">Flight levels</p>
          <p className="font-display text-xl tracking-wide text-title">The rank ladder</p>
        </div>
        <div className="relative mx-auto w-[288px]">
          <div className="pointer-events-none absolute inset-x-2 top-1/2 z-10 -translate-y-1/2 rounded-md border-y border-command-gold/25 bg-command-gold/[0.06]" style={{ height: ROW_H }} />
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
    </dialog>
  );
}
