"use client";

// Milestone fanfare (owner-picked 2026-07-11: top-right toast · +XP trailing ·
// scale-pop). Any client component calls useFanfare().fire({...}) when a server
// award comes back with a level-up or a new patch; an unobtrusive gold toast
// scale-pops in top-right and auto-dismisses. aria-live so it isn't sight-only;
// NO audio. The provider mounts once in the root layout; useFanfare() is a safe
// no-op outside it (e.g. the editor preview).
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type FanfareInput = { kind: "level" | "patch"; label: string; xp?: number };
type FanfareItem = FanfareInput & { id: number };

const FanfareCtx = createContext<(f: FanfareInput) => void>(() => {});
export const useFanfare = () => useContext(FanfareCtx);

function Toast({ item, onDone }: { item: FanfareItem; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2900);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="fanfare-toast pointer-events-none inline-flex items-center gap-2.5 border border-command-gold/30 bg-deep-space px-3.5 py-2 shadow-[var(--elev-card)]">
      <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-command-gold">
        {item.kind === "level" ? "Level up" : "Patch earned"}
      </span>
      <span className="font-numeral text-sm font-bold tabular-nums text-gold-light">
        {item.label}
      </span>
      {item.xp ? (
        <span className="font-numeral text-sm font-bold tabular-nums text-command-gold">
          +{item.xp}
        </span>
      ) : null}
    </div>
  );
}

export function FanfareProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<FanfareItem[]>([]);
  const fire = useCallback((f: FanfareInput) => {
    setItems((prev) => [
      ...prev.slice(-3), // cap the stack
      { ...f, id: Date.now() + Math.random() },
    ]);
  }, []);
  const remove = useCallback(
    (id: number) => setItems((prev) => prev.filter((i) => i.id !== id)),
    [],
  );

  return (
    <FanfareCtx.Provider value={fire}>
      {children}
      <div
        className="pointer-events-none fixed right-4 top-4 z-[60] flex flex-col items-end gap-2"
        role="status"
        aria-live="polite"
      >
        {items.map((it) => (
          <Toast key={it.id} item={it} onDone={() => remove(it.id)} />
        ))}
      </div>
    </FanfareCtx.Provider>
  );
}
