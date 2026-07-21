"use client";

// The "set up once" collapsible band (guide-pacing plan, Task 5). Wraps the
// derived setup range (a `Setup · …` callout + the blocks up to the first
// numbered section) in a styled <details>. It renders OPEN on the server so
// crawlers, the PDF export, and first-time learners always see the content;
// on mount it collapses for RETURNING visitors (a resume record already exists
// for this card), so the ~26-block preamble stops pushing island 01 down the
// page on every revisit. Purely a render-time grouping — the block list stays
// flat, so readiness counters and PDF export are unaffected.

import { useEffect, useState } from "react";

export function SetupBand({ title, count, storageKey, children }: { title: string; count: number; storageKey: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true); // SSR-open fallback

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reads a client-only store on mount; SSR fallback then adjusts once
      if (localStorage.getItem(storageKey)) setOpen(false); // returning → collapse
    } catch {
      /* private mode — stay open */
    }
  }, [storageKey]);

  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      className="border-y border-command-gold/30"
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 py-3 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
        <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">▸ Set up once</span>
        <span className="truncate font-mono text-[13px] tracking-[0.03em] text-title">{title}</span>
        <span className="ml-auto whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
          {count} {count === 1 ? "step" : "steps"} · {open ? "hide" : "show"}
        </span>
        <span aria-hidden style={{ color: "var(--color-command-gold)", transition: "transform .2s", transform: open ? "rotate(90deg)" : "none" }}>›</span>
      </summary>
      <div className="space-y-5 pb-4 pt-1">{children}</div>
    </details>
  );
}
