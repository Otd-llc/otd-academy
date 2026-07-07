"use client";

// First-run coach — a one-time orientation overlay on a learner's very first
// stage card. Progressive disclosure: it names the orient/do/check rhythm, the
// rail, and where to advance, then gets out of the way. Shown once per board
// (localStorage), so it never nags on return visits. This is a tip/orientation
// panel = a CONTENT surface, so it groups by gold hairlines on the deep-space
// field (NOT a .glass-card navy fill): the overlay panel is deep-space framed by
// a single hairline.
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";

// Whether the coach should open: only when not previously dismissed. Guarded for
// SSR (localStorage is client-only) — returns false on the server so the initial
// client render matches. Dialog.Root renders no inline DOM (content is portaled),
// so opening on the client's first render causes no hydration mismatch.
function shouldOpen(storageKey: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return !localStorage.getItem(storageKey);
  } catch {
    // localStorage unavailable (private mode) — just don't show the coach.
    return false;
  }
}

export function FirstRunCoach({ storageKey }: { storageKey: string }) {
  const [open, setOpen] = useState<boolean>(() => shouldOpen(storageKey));

  function dismiss() {
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      // ignore — worst case the coach shows again next visit.
    }
    setOpen(false);
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) dismiss();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-deep-space/80 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[min(92vw,32rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[14px] border border-panel-border bg-deep-space p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
            ▸ First run
          </p>
          <Dialog.Title className="title-card mt-2">
            Every card, three beats
          </Dialog.Title>

          {/* orient / do / check as three hairline-separated beats (M4). */}
          <dl className="mt-4 border-t border-panel-border/60">
            {(
              [
                ["Orient", "what this stage is"],
                ["Do", "the actual work"],
                ["Check", "prove it passes"],
              ] as const
            ).map(([term, gloss]) => (
              <div
                key={term}
                className="flex items-baseline gap-4 border-b border-panel-border/60 py-2.5"
              >
                <dt className="w-20 shrink-0 font-mono text-[11px] uppercase tracking-[0.18em] text-command-gold">
                  {term}
                </dt>
                <dd className="font-serif text-sm text-text">{gloss}</dd>
              </div>
            ))}
          </dl>

          <Dialog.Description className="mt-4 font-serif text-sm leading-relaxed text-muted">
            The hexes up top are your stages. Clear one and the your track panel
            advances you.
          </Dialog.Description>

          <div className="mt-6">
            <button
              type="button"
              onClick={dismiss}
              className="glass-button-cta inline-flex items-center gap-1.5 px-4 py-2 font-mono text-xs uppercase tracking-wider"
            >
              Start →
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
