"use client";

// Top-right user menu (design polish §15.3).
//
// A small dropdown anchored to the right of the header on every signed-in
// page. The trigger is a compact pill: a filled-gold avatar disk + a
// chevron (no email — it shows only in the menu). When open the menu
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
//   • The trigger is a compact avatar + chevron pill (no email; it shows only
//     in the menu, never twice). The chevron flips when the menu is open.
//     Sign-out lives ONLY in the menu — the header has no standalone sign-out.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

// Admin-only tools that live in the user menu. Add new admin destinations here.
const ADMIN_LINKS: { href: string; label: string }[] = [
  { href: "/admin/goals", label: "Goals" },
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
        // list-none + ::marker hide kill the default disclosure arrow. A compact
        // pill: filled-gold avatar + a chevron, no email (the email lives in the
        // menu, so it's never shown twice). Chevron flips when open.
        className={`group inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5 outline-none transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-gold-light/70 ${
          open
            ? "border-command-gold bg-command-gold/[0.06]"
            : "border-panel-border bg-deep-space/40 hover:border-command-gold/60"
        }`}
        style={{ listStyleType: "none" }}
      >
        <span className="sr-only">Signed in as {email}. Open account menu</span>
        <span
          aria-hidden="true"
          className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gold-light font-numeral text-sm font-bold text-deep-space"
        >
          {initial}
        </span>
        <span
          aria-hidden="true"
          className={`font-mono text-[10px] leading-none transition-transform ${
            open ? "rotate-180 text-command-gold" : "text-muted group-hover:text-command-gold"
          }`}
        >
          ▾
        </span>
      </summary>

      {/* Popover (chrome): a deep-space panel with a flush gold rail + hairline
          key/value rows. Right-anchored under the compact avatar pill. */}
      <div className="absolute right-0 z-10 mt-2 min-w-[17rem] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-md border border-panel-border bg-bg-2 shadow-[var(--elev-card)]">
        <div className="flex">
          <div
            aria-hidden="true"
            className="w-0.5 shrink-0 self-stretch bg-gradient-to-b from-command-gold to-command-gold/10"
          />
          <div className="min-w-0 flex-1 px-4 py-3.5 font-mono">
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
                className="font-mono text-[11px] uppercase tracking-[0.16em] text-danger-coral transition-colors hover:text-danger-hover focus-visible:text-danger-hover focus-visible:outline-none"
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
