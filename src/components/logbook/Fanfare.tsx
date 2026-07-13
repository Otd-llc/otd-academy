"use client";

// Milestone fanfare (owner-picked 2026-07-13: full-width top BANNER · emblem + big
// readout · three-dash countdown · auto-dismiss ~4s · pause on hover · slides in/out).
// Any client component calls useFanfare()({...}) when a server award comes back with a
// level-up or a new patch; the banner drops in, waits, and slides out on its own,
// naming the Logbook and linking to it. aria-live so it isn't sight-only; NO audio.
// The provider mounts once in the root layout; useFanfare() is a safe no-op outside it.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { RankWing } from "./RankWing";
import { PatchBadge } from "./Patch";
import { LEVELS } from "@/lib/logbook/economy";
import type { PatchArt } from "@/lib/logbook/patches";

// `art` (patch) / the level derived from `label` (level) drive the emblem; both are
// optional so existing callers keep working.
export type FanfareInput = { kind: "level" | "patch"; label: string; xp?: number; art?: PatchArt };
type FanfareItem = FanfareInput & { id: number };

const FanfareCtx = createContext<(f: FanfareInput) => void>(() => {});
export const useFanfare = () => useContext(FanfareCtx);

const DWELL = 4000; // Material/Sonner default for a short positive toast
const DASHES = 3;

function Banner({ item, onDone }: { item: FanfareItem; onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const [paused, setPaused] = useState(false);
  const [lit, setLit] = useState(DASHES);
  const litRef = useRef(DASHES);
  const done = useRef(false);
  const dismiss = useCallback(() => {
    if (done.current) return;
    done.current = true;
    setLeaving(true);
    window.setTimeout(onDone, 300);
  }, [onDone]);

  // Three depleting dashes = the countdown; hover pauses it so it waits while read.
  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => {
      litRef.current -= 1;
      setLit(litRef.current);
      if (litRef.current <= 0) {
        window.clearInterval(id);
        dismiss();
      }
    }, DWELL / DASHES);
    return () => window.clearInterval(id);
  }, [paused, dismiss]);

  const isLevel = item.kind === "level";
  const level = isLevel ? Math.max(1, LEVELS.findIndex((l) => l.title === item.label) + 1) : 1;
  const readout = item.xp ? `+${item.xp} XP` : "New";

  return (
    <div
      className={`${leaving ? "fanfare-up" : "fanfare-drop"} pointer-events-auto relative w-full border-b border-panel-border/60 bg-deep-space shadow-[var(--elev-card)]`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-3">
        {isLevel ? <RankWing level={level} size={38} /> : <PatchBadge art={item.art ?? "wings"} earned size={38} />}
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-command-gold">▸ {isLevel ? "Level up" : "Badge earned"}</p>
          <p className="truncate font-display text-xl leading-tight tracking-wide text-title">{item.label}</p>
        </div>
        <p className="font-numeral text-2xl tabular-nums text-command-gold">{readout}</p>
        <Link href="/logbook" className="whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.14em] text-command-gold transition-colors hover:text-gold-light">
          View in Logbook ↗
        </Link>
        <button type="button" onClick={dismiss} aria-label="Dismiss" className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-base leading-none text-muted transition-colors hover:bg-command-gold/10 hover:text-command-gold">
          ✕
        </button>
      </div>
      <div className="flex items-center justify-center gap-1.5 pb-2" aria-hidden="true">
        {Array.from({ length: DASHES }).map((_, i) => (
          <span key={i} className={`h-[3px] w-5 rounded-full transition-colors ${i < lit ? "bg-command-gold" : "bg-gray-3/40"}`} />
        ))}
      </div>
    </div>
  );
}

export function FanfareProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<FanfareItem[]>([]);
  const fire = useCallback((f: FanfareInput) => {
    setItems((prev) => [
      ...prev.slice(-2), // cap the stack (banners are full width)
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
        className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col"
        role="status"
        aria-live="polite"
      >
        {items.map((it) => (
          <Banner key={it.id} item={it} onDone={() => remove(it.id)} />
        ))}
      </div>
    </FanfareCtx.Provider>
  );
}
