"use client";

// The patch how-to / progression detail modal (extracted from PatchWall 2026-07-14 so
// the library follower card can open the same thing on a badge click). Deep-space +
// gold hairline + elevation over a dimmed backdrop. Full-color badges (earned view).
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
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-deep-space/70 p-4" onClick={onClose}>
      <div className="relative w-full max-w-sm border border-command-gold/25 bg-deep-space p-6 shadow-[var(--elev-card)]" style={{ borderRadius: 8 }} onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-2.5 top-2.5 z-10 grid h-7 w-7 place-items-center rounded-full text-base leading-none text-muted transition-colors hover:bg-command-gold/10 hover:text-command-gold">&#10005;</button>
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
    </div>
  );
}
