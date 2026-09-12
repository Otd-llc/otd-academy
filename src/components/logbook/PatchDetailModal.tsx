"use client";

// The patch how-to / progression detail modal (extracted from PatchWall 2026-07-14 so
// the library follower card can open the same thing on a badge click). Deep-space +
// gold hairline + elevation over a dimmed backdrop. Full-color badges (earned view).
//
// DISMISSAL + FOCUS: a native <dialog> (`showModal()`), matching PartGlanceModal
// and the other three dialogs in the app. This used to be a plain positioned div
// with an onClick on the backdrop, which meant it had NO focus trap, NO Escape
// handler, and no portal — so it rendered in the normal stacking context at
// `z-50` and a keyboard user could tab straight out of an open modal into the
// page behind it. `showModal()` gives all three back from the platform: focus is
// trapped, Escape fires `cancel`, and the top layer removes the z-index question
// entirely (this sat at z-50 while RankLadderModal sat at z-[100] — a race
// nobody had adjudicated).
//
// The VISUAL treatment is unchanged and was already correct: deep-space surface,
// gold hairline, --elev-card, over a dimmed backdrop. No navy fill.
import { useEffect, useRef } from "react";
import { PatchBadge } from "./Patch";
import type { PatchArt } from "@/lib/logbook/patches";

export type PatchEntry = {
  key: string;
  label: string;
  howToEarn: string;
  earned: boolean;
  art: PatchArt;
  tier?: number;
  progression?: { thresholds: number[]; earnedTier: number; unit: string };
};

const METALS = ["Bronze", "Silver", "Gold"];

export function PatchDetailModal({ entry, onClose }: { entry: PatchEntry; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  // Both call sites mount this only while a patch is selected, so opening on
  // mount is the whole lifecycle. showModal() (not show()) is what makes it
  // modal: it is the call that traps focus and puts the element in the top layer.
  useEffect(() => {
    const dlg = ref.current;
    if (dlg && !dlg.open) dlg.showModal();
  }, []);

  // A click whose target is the <dialog> itself landed on the backdrop, not on
  // the panel inside it. This replaces the old stopPropagation dance, which
  // needed a click handler on a non-interactive div to work.
  function onDialogClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === ref.current) onClose();
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      onClick={onDialogClick}
      aria-label={entry.label}
      // Centred explicitly (fixed inset-0 + m-auto + h-fit): Tailwind's preflight
      // margin reset defeats the UA's default modal centring, and without this
      // the dialog falls to the inset-0 origin. Same fix as PartGlanceModal.
      className="fixed inset-0 m-auto h-fit w-[calc(100%-2rem)] max-w-sm border border-command-gold/25 bg-deep-space p-6 text-text shadow-[var(--elev-card)] backdrop:bg-deep-space/70"
      style={{ borderRadius: 8 }}
    >
      <div className="relative">
        <button type="button" autoFocus onClick={onClose} aria-label="Close" className="absolute right-0 top-0 z-10 grid h-7 w-7 place-items-center rounded-full text-base leading-none text-muted transition-colors hover:bg-command-gold/10 hover:text-command-gold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-command-gold">&#10005;</button>
        {entry.progression ? (
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-command-gold">Progression</p>
            <p className="mt-1 font-display text-2xl tracking-wide text-title">{entry.label}</p>
            <p className="mt-1 font-serif text-sm leading-relaxed text-text">{entry.howToEarn}</p>
            <div className="mt-4 flex justify-between gap-2">
              {[0, 1, 2].map((t) => {
                const done = t <= entry.progression!.earnedTier;
                return (
                  <div key={t} className="flex flex-1 flex-col items-center gap-1 text-center">
                    <PatchBadge art={entry.art} earned tier={t} size={72} />
                    <span className={`font-mono text-[10px] uppercase tracking-[0.14em] ${done ? "text-gold-light" : "text-text"}`}>{METALS[t]}</span>
                    <span className="font-numeral text-[11px] tabular-nums text-muted">{entry.progression!.thresholds[t]} {entry.progression!.unit}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-4">
            <PatchBadge art={entry.art} earned size={88} tier={entry.tier ?? 0} />
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-command-gold">{entry.earned ? "Earned" : "How to earn"}</p>
              <p className="mt-1 font-display text-2xl tracking-wide text-title">{entry.label}</p>
              <p className="mt-2 font-serif text-sm leading-relaxed text-text">{entry.howToEarn}</p>
            </div>
          </div>
        )}
      </div>
    </dialog>
  );
}
