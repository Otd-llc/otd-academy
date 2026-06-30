"use client";

// The goals stat-board: a grid of big Saira numerals (live vs target). Goals
// carry a gold progress rule (green when met); counters are blue with no rule.
// Click any stat to expand its "what is what" detail (the records behind the
// number) below the grid. Hairline rows on the deep-space field, per the brand.
import { useState } from "react";

import Link from "next/link";

import type { GoalStat } from "@/lib/admin/goals";

export function GoalsBoard({ stats }: { stats: GoalStat[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const active = stats.find((s) => s.key === open) ?? null;

  return (
    <div className="mt-8">
      <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
        {stats.map((s) => {
          const isCounter = s.target == null;
          const met = s.target != null && s.live >= s.target;
          const pct = s.target
            ? Math.min(100, Math.round((s.live / s.target) * 100))
            : 0;
          const isOpen = s.key === open;
          const color = met
            ? "text-status-green"
            : isCounter
              ? "text-signal-blue"
              : "text-command-gold";
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setOpen(isOpen ? null : s.key)}
              aria-expanded={isOpen}
              className="group block text-left focus-visible:outline-none"
            >
              <span
                className={`block font-numeral text-4xl leading-none tabular-nums sm:text-5xl ${color}`}
              >
                {s.live}
                {s.target != null ? (
                  <span className="text-xl text-muted sm:text-2xl">
                    /{s.target}
                  </span>
                ) : null}
              </span>
              {isCounter ? (
                <span className="mt-2.5 block font-mono text-[10px] uppercase tracking-[0.18em] text-gray-3">
                  live
                </span>
              ) : (
                <span className="mt-2.5 block h-[2px] w-full overflow-hidden rounded-sm bg-panel-border/70">
                  <span
                    className={`block h-full ${met ? "bg-status-green" : "bg-command-gold"}`}
                    style={{ width: `${pct}%` }}
                  />
                </span>
              )}
              <span
                className={`mt-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors ${
                  isOpen
                    ? "text-command-gold"
                    : "text-muted group-hover:text-gold-light"
                }`}
              >
                {s.label}
                <span
                  aria-hidden="true"
                  className={`text-[8px] ${isOpen ? "rotate-180" : ""}`}
                >
                  ▾
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {active ? (
        <section className="mt-10 border-t border-command-gold/30 pt-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
            <span aria-hidden="true">▸ </span>
            {active.label} · what is what
          </p>
          {active.cap ? (
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-gray-3">
              {active.cap}
            </p>
          ) : null}

          {active.rows.length === 0 ? (
            <p className="mt-4 font-mono text-sm uppercase tracking-wider text-muted">
              Nothing yet.
            </p>
          ) : (
            <ul className="mt-4 border-t border-panel-border/60">
              {active.rows.map((r, i) => {
                const inner = (
                  <>
                    <span className="min-w-0 flex-1 truncate text-sm text-text">
                      {r.primary}
                    </span>
                    {r.secondary ? (
                      <span
                        className={`shrink-0 font-mono text-[11px] uppercase tracking-[0.12em] ${
                          r.tone === "live"
                            ? "text-status-green"
                            : r.tone === "pending"
                              ? "text-gold-dim"
                              : "text-muted"
                        }`}
                      >
                        {r.secondary}
                      </span>
                    ) : null}
                  </>
                );
                return (
                  <li
                    key={`${r.primary}-${i}`}
                    className="border-b border-panel-border/60"
                  >
                    {r.href ? (
                      <Link
                        href={r.href}
                        className="flex items-center justify-between gap-4 py-2.5 hover:bg-command-gold/[0.04] focus-visible:bg-command-gold/[0.06] focus-visible:outline-none"
                      >
                        {inner}
                      </Link>
                    ) : (
                      <div className="flex items-center justify-between gap-4 py-2.5">
                        {inner}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {active.moreHref ? (
            <Link
              href={active.moreHref}
              className="mt-5 inline-block font-mono text-[11px] uppercase tracking-[0.14em] text-command-gold transition-colors hover:text-gold-light focus-visible:outline-none"
            >
              {active.moreLabel ?? "More"} →
            </Link>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
