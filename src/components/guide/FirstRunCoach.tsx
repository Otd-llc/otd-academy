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
          <Dialog.Title className="title-card mt-2">How this works</Dialog.Title>

          {/* The orient / do / check ribbon — mono tags on a gold hairline. */}
          <div className="mt-4 flex items-center gap-3 border-y border-panel-border/60 py-3 font-mono text-xs uppercase tracking-[0.18em]">
            <span className="text-command-gold">Orient</span>
            <span aria-hidden className="text-gray-3">
              ·
            </span>
            <span className="text-command-gold">Do</span>
            <span aria-hidden className="text-gray-3">
              ·
            </span>
            <span className="text-command-gold">Check</span>
          </div>

          <Dialog.Description className="mt-4 font-serif text-sm leading-relaxed text-text">
            Every card follows that rhythm. The hexes up top are your stages, in
            order. Clear a stage and the your track panel advances you.
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
