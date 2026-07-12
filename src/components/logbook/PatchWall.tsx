"use client";

// The Logbook patch wall: a grid of mission-patch tiles; clicking one opens a
// floating how-to card (deep-space + gold hairline + elevation over a dimmed
// backdrop). Earned tiles are full color; locked ones dim + desaturated.
import { useState } from "react";
import { PatchBadge } from "./Patch";
import type { PatchArt } from "@/lib/logbook/patches";

export type PatchEntry = { key: string; label: string; howToEarn: string; earned: boolean; art: PatchArt };

export function PatchWall({ entries }: { entries: PatchEntry[] }) {
  const [sel, setSel] = useState<PatchEntry | null>(null);
  return (
    <>
      <div className="grid grid-cols-3 gap-1 sm:grid-cols-4">
        {entries.map((e) => (
          <button key={e.key} type="button" onClick={() => setSel(e)} className="flex flex-col items-center gap-1.5 py-3 text-center transition-opacity hover:opacity-80">
            <PatchBadge art={e.art} earned={e.earned} size={58} />
            <span className={`font-mono text-[9px] uppercase tracking-[0.14em] ${e.earned ? "text-gold-light" : "text-muted"}`}>{e.label}</span>
          </button>
        ))}
      </div>

      {sel ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-deep-space/70 p-4" onClick={() => setSel(null)}>
          <div className="w-full max-w-sm border border-command-gold/25 bg-deep-space p-6 shadow-[var(--elev-card)]" style={{ borderRadius: 8 }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-4">
              <PatchBadge art={sel.art} earned={sel.earned} size={88} />
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-command-gold">{sel.earned ? "Earned" : "How to earn"}</p>
                <p className="mt-1 font-display text-2xl tracking-wide text-title">{sel.label}</p>
                <p className="mt-2 font-serif text-sm leading-relaxed text-text">{sel.howToEarn}</p>
              </div>
            </div>
            <button type="button" onClick={() => setSel(null)} className="glass-button mt-5 w-full px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em]">Close</button>
          </div>
        </div>
      ) : null}
    </>
  );
}
