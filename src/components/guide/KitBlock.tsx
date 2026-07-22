"use client";

// KitBlock — "The Bench" per-lesson tools list (the `kit` content block),
// rendered as the 9C-5 "tick what you own" checklist: tier subheads
// (Required / Recommended / Helpful) each showing an owned x/y count, a
// checkbox per tool that dims + strikes it and hides its buy link once owned,
// and a real per-item Amazon Associate "Shop" link on everything you don't yet
// have. There is NO bulk cart (we have no multi-ASIN Amazon cart); each tool
// links to its own tagged product, and the Associates disclosure renders
// unconditionally beneath the list.
//
// CLIENT component: the owned state is interactive and PERSISTED per learner in
// localStorage (keyed by `storageKey`), so a bench checklist survives revisits.
// The Amazon associate tag is server-only, so pick hrefs are resolved by the
// server block renderer and passed in already-tagged.

import { useEffect, useState } from "react";
import { ExternalLinkIcon } from "@/components/icons";
import { Inline } from "@/components/guide/InlineText";

export type KitNeed = "required" | "recommended" | "helpful";
export type KitPick = { label?: string; href: string };
export type KitItem = {
  label: string;
  need?: KitNeed;
  note?: string;
  picks?: KitPick[];
};

const NEED_ORDER: KitNeed[] = ["required", "recommended", "helpful"];
const NEED_LABEL: Record<KitNeed, string> = {
  required: "Required",
  recommended: "Recommended",
  helpful: "Helpful",
};

function Check({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      title={on ? "You have this — tap to unmark" : "Mark as owned"}
      className="mt-1 grid h-4 w-4 shrink-0 place-items-center border border-command-gold/60 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-command-gold"
      style={on ? { background: "var(--color-command-gold)" } : undefined}
    >
      {on ? (
        <span className="text-[10px] font-bold" style={{ color: "var(--color-deep-space)" }} aria-hidden>
          ✓
        </span>
      ) : null}
    </button>
  );
}

function ShopLinks({ picks }: { picks?: KitPick[] }) {
  if (!picks || picks.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-1.5">
      {picks.map((p, j) => (
        <a
          key={j}
          href={p.href}
          target="_blank"
          rel="noopener noreferrer nofollow sponsored"
          className="inline-flex items-center gap-1 rounded border border-command-gold/55 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space"
        >
          {p.label || "Shop"}
          <ExternalLinkIcon className="h-2.5 w-2.5 shrink-0" />
        </a>
      ))}
    </span>
  );
}

export function KitBlock({
  intro,
  items,
  storageKey,
}: {
  intro?: string;
  items: KitItem[];
  storageKey: string;
}) {
  // Owned set, hydrated from localStorage after mount (SSR + first client render
  // both start empty, so there's no hydration mismatch).
  const [owned, setOwned] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reads a client-only store on mount; SSR fallback then adjusts once
      if (raw) setOwned(new Set(JSON.parse(raw) as string[]));
    } catch {
      // corrupt / unavailable storage → start clean, still fully usable
    }
  }, [storageKey]);

  const toggle = (label: string) =>
    setOwned((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      try {
        localStorage.setItem(storageKey, JSON.stringify([...next]));
      } catch {
        // ignore persistence failures — the in-session toggle still works
      }
      return next;
    });

  const groups = NEED_ORDER.map((need) => ({
    need,
    rows: items.filter((it) => it.need === need),
  })).filter((g) => g.rows.length > 0);
  const ungrouped = items.filter((it) => !it.need);

  const Row = ({ it }: { it: KitItem }) => {
    const on = owned.has(it.label);
    return (
      <li className="flex items-start gap-3 border-b border-panel-border/40 py-2.5">
        <Check on={on} onClick={() => toggle(it.label)} />
        <div className="min-w-0 flex-1">
          <span
            className={`font-serif text-[15px] font-medium ${on ? "text-muted line-through" : "text-text"}`}
          >
            {it.label}
          </span>
          {/* Checked dims via opacity, not gray-3 (fails AA in both themes). */}
          {it.note ? (
            <p className={`mt-0.5 font-serif text-sm leading-snug text-muted ${on ? "opacity-75" : ""}`}>
              <Inline text={it.note} />
            </p>
          ) : null}
        </div>
        {/* Buy links live in a right-aligned column (hidden once you own it). */}
        {on ? null : (
          <div className="flex shrink-0 flex-wrap justify-end gap-1.5 pt-0.5">
            <ShopLinks picks={it.picks} />
          </div>
        )}
      </li>
    );
  };

  return (
    <section className="border-t border-panel-border/60 pt-6">
      <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-command-gold">
        ▸ The bench · tick what you own
      </p>
      {intro ? (
        <p className="mb-5 whitespace-pre-wrap font-serif text-base leading-relaxed text-muted">
          <Inline text={intro} />
        </p>
      ) : null}

      <div className="border-t border-panel-border/50">
        {groups.map(({ need, rows }) => {
          const ownedInTier = rows.filter((r) => owned.has(r.label)).length;
          return (
            <div key={need}>
              <div className="mb-1 mt-4 flex items-baseline justify-between gap-3">
                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-command-gold">
                  {NEED_LABEL[need]}
                </p>
                <p className="font-mono text-[10px] tabular-nums text-muted">
                  {ownedInTier}/{rows.length}
                </p>
              </div>
              <ul>
                {rows.map((it) => (
                  <Row key={it.label} it={it} />
                ))}
              </ul>
            </div>
          );
        })}
        {ungrouped.length > 0 ? (
          <ul className="mt-4">
            {ungrouped.map((it) => (
              <Row key={it.label} it={it} />
            ))}
          </ul>
        ) : null}
      </div>

      <p className="mt-5 font-mono text-[11px] uppercase tracking-wider text-muted">
        As an Amazon Associate, the academy earns from qualifying purchases, at no extra cost to you.
      </p>
    </section>
  );
}
