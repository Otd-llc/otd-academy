"use client";

// The Logbook patch wall: a grid of mission-patch tiles; clicking one opens a
// floating how-to card (deep-space + gold hairline + elevation over a dimmed
// backdrop). Earned tiles are full color; locked ones dim + desaturated.
import { useState } from "react";
import { PatchBadge } from "./Patch";
import type { PatchArt } from "@/lib/logbook/patches";

export type PatchEntry = { key: string; label: string; howToEarn: string; earned: boolean; art: PatchArt; tier?: number; progression?: { thresholds: number[]; earnedTier: number; unit: string } };
const METALS = ["Bronze", "Silver", "Gold"];

export function PatchWall({ entries }: { entries: PatchEntry[] }) {
  const [sel, setSel] = useState<PatchEntry | null>(null);
  return (
    <>
      <div className="grid grid-cols-3 gap-1 sm:grid-cols-4">
        {entries.map((e) => (
          <button key={e.key} type="button" onClick={() => setSel(e)} className="flex flex-col items-center gap-1.5 py-3 text-center transition-opacity hover:opacity-80">
            <PatchBadge art={e.art} earned={e.earned} size={58} tier={e.tier ?? 0} />
            <span className={`font-mono text-[9px] uppercase tracking-[0.14em] ${e.earned ? "text-gold-light" : "text-muted"}`}>{e.label}</span>
          </button>
        ))}
      </div>

      {sel ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-deep-space/70 p-4" onClick={() => setSel(null)}>
          <div className="relative w-full max-w-sm border border-command-gold/25 bg-deep-space p-6 shadow-[var(--elev-card)]" style={{ borderRadius: 8 }} onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setSel(null)} aria-label="Close" className="absolute right-2.5 top-2.5 z-10 grid h-7 w-7 place-items-center rounded-full text-base leading-none text-muted transition-colors hover:bg-command-gold/10 hover:text-command-gold">&#10005;</button>
            {sel.progression ? (
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-command-gold">Progression</p>
                <p className="mt-1 font-display text-2xl tracking-wide text-title">{sel.label}</p>
                <p className="mt-1 font-serif text-sm leading-relaxed text-text">{sel.howToEarn}</p>
                <div className="mt-4 flex justify-between gap-2">
                  {[0, 1, 2].map((t) => {
                    const done = t <= sel.progression!.earnedTier;
                    return (
                      <div key={t} className="flex flex-1 flex-col items-center gap-1 text-center">
                        <PatchBadge art={sel.art} earned tier={t} size={72} />
                        <span className={`font-mono text-[10px] uppercase tracking-[0.14em] ${done ? "text-gold-light" : "text-text"}`}>{METALS[t]}</span>
                        <span className="font-numeral text-[11px] tabular-nums text-muted">{sel.progression!.thresholds[t]} {sel.progression!.unit}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-4">
                <PatchBadge art={sel.art} earned size={88} tier={sel.tier ?? 0} />
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-command-gold">{sel.earned ? "Earned" : "How to earn"}</p>
                  <p className="mt-1 font-display text-2xl tracking-wide text-title">{sel.label}</p>
                  <p className="mt-2 font-serif text-sm leading-relaxed text-text">{sel.howToEarn}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
