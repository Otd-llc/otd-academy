"use client";

// The Logbook patch wall: a grid of mission-patch tiles; clicking one opens the shared
// how-to / progression detail (PatchDetailModal). Earned tiles are full color; locked
// ones dim + desaturated.
import { useState } from "react";
import { PatchBadge } from "./Patch";
import { PatchDetailModal, type PatchEntry } from "./PatchDetailModal";

export type { PatchEntry }; // re-exported for existing consumers (the logbook page)

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

      {sel ? <PatchDetailModal entry={sel} onClose={() => setSel(null)} /> : null}
    </>
  );
}
