"use client";

// Top-right user menu (design polish §15.3).
//
// A small dropdown anchored to the right of the header on every signed-in
// page. The trigger is a pill with a gold-rimmed avatar disk + the user's
// email (collapsed to just the avatar below md). When open the menu
// renders as a glass card with a "Signed in as" header, the full email,
// and a coral "Sign out" button.
//
// Implementation notes:
//   • Native dropdown via a `<details>` element — no portal, no library,
//     no focus-trap state. ESC closes via the element's default behavior
//     on focused summaries. The summary doubles as both trigger and
//     focusable anchor.
//   • Body-level click-outside closes the menu via a small effect that
//     listens for `pointerdown` outside the host.
//   • The sign-out action is a tiny server action passed in by the layout
//     so the client component itself never imports `@/auth`.
//   • The trigger uses .glass-button at rest and .glass-button-active when
//     the menu is open so the open state gets the same gold-glow ring as
//     the rest of the gold-active vocabulary.

import { useEffect, useRef, useState } from "react";

export function UserMenu({
  email,
  signOutAction,
}: {
  email: string;
  signOutAction: () => Promise<void>;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      const el = ref.current;
      if (!el || !el.open) return;
      if (e.target instanceof Node && el.contains(e.target)) return;
      el.open = false;
      setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const initial = email.charAt(0).toUpperCase();

  return (
    <details
      ref={ref}
      className="relative"
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary
        // list-none + ::marker hide kill the default disclosure arrow.
        className={`glass-button inline-flex cursor-pointer list-none items-center gap-2 rounded-full py-1 pl-1 pr-1 font-mono text-xs uppercase tracking-wider md:pr-3 ${
          open ? "glass-button-active" : ""
        }`}
        style={{ listStyleType: "none" }}
      >
        <span
          aria-hidden="true"
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-command-gold/50 bg-deep-space/70 font-display text-sm tracking-wider text-command-gold"
        >
          {initial}
        </span>
        <span className="hidden text-gold-dim md:inline">{email}</span>
      </summary>

      <div className="glass-card absolute right-0 z-10 mt-2 min-w-[16rem] overflow-hidden p-0">
        <div className="section-band px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-gold-dim">
            Signed in as
          </p>
          <p className="mt-1 truncate font-mono text-xs text-link-muted">
            {email}
          </p>
        </div>
        <form action={signOutAction} className="p-2">
          <button
            type="submit"
            className="glass-button glass-button-danger block w-full rounded px-3 py-2 text-left font-mono text-xs uppercase tracking-wider"
          >
            Sign out
          </button>
        </form>
      </div>
    </details>
  );
}
