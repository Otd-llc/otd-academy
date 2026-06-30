"use client";

// Top-right user menu (design polish §15.3).
//
// A small dropdown anchored to the right of the header on every signed-in
// page. The trigger is a gold rail + outline avatar disk + the user's
// email (collapsed to the rail + avatar below md). When open the menu
// renders as an opaque deep-space popover with a gold rail and hairline
// key/value rows: signed-in/email, role, the admin links, and a coral
// "Sign out".
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
//   • The trigger is a gold rail + outline avatar + email (no button fill); the
//     rail continues into the open panel so the cluster reads as one unit.
//     Sign-out lives ONLY in the menu — the header has no standalone sign-out.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

// Admin-only tools that live in the user menu. Add new admin destinations here.
const ADMIN_LINKS: { href: string; label: string }[] = [
  { href: "/admin/sourcing", label: "Sourcing health" },
];

export function UserMenu({
  email,
  role,
  signOutAction,
}: {
  email: string;
  role?: "ADMIN" | "LEARNER" | null;
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
        // list-none + ::marker hide kill the default disclosure arrow. The gold
        // rail on the left is the head of the thread that continues down the open
        // panel — pill, menu and sign-out read as one rail-anchored unit.
        className="group inline-flex cursor-pointer list-none items-center gap-2.5 rounded-sm py-1 pr-1 font-mono text-xs uppercase tracking-wider outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-gold-light/70"
        style={{ listStyleType: "none" }}
      >
        <span
          aria-hidden="true"
          className="h-7 w-0.5 shrink-0 self-stretch bg-gradient-to-b from-command-gold to-command-gold/40"
        />
        <span
          aria-hidden="true"
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-command-gold/60 bg-deep-space/40 font-numeral text-sm font-bold text-command-gold transition-colors group-hover:border-gold-light"
        >
          {initial}
        </span>
        <span className="hidden text-gold-dim transition-colors group-hover:text-gold-light md:inline">
          {email}
        </span>
      </summary>

      {/* Popover (chrome) styled as the "rail + rows" direction: an opaque
          deep-space panel with a gold rail and hairline key/value rows. */}
      <div className="absolute right-0 z-10 mt-2 min-w-[17rem] overflow-hidden rounded-md border border-panel-border bg-bg-2 shadow-[0_26px_50px_-12px_rgba(0,0,0,0.95)]">
        <div className="flex gap-3.5 p-4">
          <div
            aria-hidden="true"
            className="w-0.5 shrink-0 self-stretch bg-gradient-to-b from-command-gold to-command-gold/10"
          />
          <div className="min-w-0 flex-1 font-mono">
            <div className="border-b border-command-gold/15 pb-2.5">
              <p className="text-[10px] uppercase tracking-[0.2em] text-gold-dim">
                Signed in
              </p>
              <p className="mt-1 truncate text-xs text-text">{email}</p>
            </div>

            {role && (
              <div className="flex items-center justify-between gap-3 border-b border-command-gold/15 py-2.5">
                <span className="text-[10px] uppercase tracking-[0.18em] text-gold-dim">
                  Role
                </span>
                <span
                  className={`text-[11px] uppercase tracking-[0.16em] ${
                    role === "ADMIN" ? "text-command-gold" : "text-signal-blue"
                  }`}
                >
                  {role === "ADMIN" ? "★ Admin" : "Learner"}
                </span>
              </div>
            )}

            {role === "ADMIN"
              ? ADMIN_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => {
                      if (ref.current) ref.current.open = false;
                      setOpen(false);
                    }}
                    className="flex items-center justify-between gap-3 border-b border-command-gold/15 py-2.5 text-[11px] uppercase tracking-[0.14em] text-muted transition-colors hover:text-gold-light focus-visible:text-gold-light focus-visible:outline-none"
                  >
                    <span>{link.label}</span>
                    <span aria-hidden="true">→</span>
                  </Link>
                ))
              : null}

            <form action={signOutAction} className="pt-3">
              <button
                type="submit"
                className="font-mono text-[11px] uppercase tracking-[0.16em] text-danger-coral transition-colors hover:text-[#ffb0a0] focus-visible:text-[#ffb0a0] focus-visible:outline-none"
              >
                ↩ Sign out
              </button>
            </form>
          </div>
        </div>
      </div>
    </details>
  );
}
