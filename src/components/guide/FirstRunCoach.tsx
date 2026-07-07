"use client";

// First-run coach — a one-time orientation overlay on a learner's very first
// stage card. Progressive disclosure: it names the rail, the orient/do/check
// rhythm, and where to advance, then gets out of the way. Shown once per board
// (localStorage), so it never nags on return visits. A floating modal is app
// chrome, so .glass-card is the right surface here.
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
        <Dialog.Content className="glass-card fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[min(92vw,32rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-panel-border p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
            ▸ First run
          </p>
          <Dialog.Title className="title-card mt-2">
            You are about to design a real board
          </Dialog.Title>
          <Dialog.Description className="mt-3 font-serif text-sm leading-relaxed text-text">
            Three things before you start.
          </Dialog.Description>

          <ul className="mt-4 space-y-3">
            <li className="border-t border-panel-border/60 pt-3">
              <p className="font-mono text-[11px] uppercase tracking-wider text-command-gold">
                The rail
              </p>
              <p className="mt-1 font-serif text-sm text-text">
                The hexes up top are the stages, in order. You are on the first
                one.
              </p>
            </li>
            <li className="border-t border-panel-border/60 pt-3">
              <p className="font-mono text-[11px] uppercase tracking-wider text-command-gold">
                Orient · do · check
              </p>
              <p className="mt-1 font-serif text-sm text-text">
                Each card orients you, has you do the work, then checks it. Read
                it top to bottom.
              </p>
            </li>
            <li className="border-t border-panel-border/60 pt-3">
              <p className="font-mono text-[11px] uppercase tracking-wider text-command-gold">
                Your track
              </p>
              <p className="mt-1 font-serif text-sm text-text">
                When a stage is done, the your track panel lets you advance.
                Clear its checks to move on.
              </p>
            </li>
          </ul>

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
