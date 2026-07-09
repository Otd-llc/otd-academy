"use client";

// Top-right user menu (design D5 — hairline panel).
//
// A dropdown anchored to the right of the header on every signed-in page. The
// trigger is a compact pill: a gold-outline avatar disk + the first name + a
// chevron. Open, it's a deep-space popover grouped by GOLD HAIRLINES (not a navy
// fill) — a name/email header, real learner destinations, admin tools when the
// role warrants, and a gold "Sign out". Theme lives in the header toggle, so it
// is intentionally not duplicated here.
//
// Native dropdown via <details> (no portal/library); a pointerdown-outside
// effect closes it. The sign-out action is a server action passed by the layout
// so this client component never imports @/auth.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const BOOK = (
  <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
    <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H19v14H5.5A1.5 1.5 0 0 0 4 19.5zM8 8h7M8 11h7" />
  </svg>
);
const HEX = (
  <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
    <path d="M12 3l7.5 4.3v8.6L12 21l-7.5-4.3V7.3z" />
  </svg>
);
const SHIELD = (
  <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
    <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6zM9.5 12l1.8 1.8L15 10" />
  </svg>
);
const OUT = (
  <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
    <path d="M14 7V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-2M10 12h10M17 9l3 3-3 3" />
  </svg>
);
const GEAR = (
  <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" />
  </svg>
);

const ADMIN_LINKS: { href: string; label: string }[] = [
  { href: "/admin/students", label: "Students" },
  { href: "/admin/billing", label: "Billing" },
  { href: "/admin/goals", label: "Goals" },
  { href: "/admin/sourcing", label: "Sourcing health" },
];

const ROW =
  "flex items-center gap-2.5 border-b border-panel-border/40 px-3.5 py-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-text transition-colors hover:bg-command-gold/[0.06] hover:text-gold-light focus-visible:bg-command-gold/[0.08] focus-visible:text-gold-light focus-visible:outline-none";

// Avatar — the account image seeded by the sign-in provider (Google/GitHub), or
// the first initial when there's none (e.g. an email magic-link account). A
// custom uploaded avatar overrides the provider image upstream (User.avatarUrl),
// so this component just renders whatever `image` it's handed.
function Avatar({
  image,
  initial,
  className,
  text,
}: {
  image?: string | null;
  initial: string;
  className: string;
  text: string;
}) {
  return image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={image}
      alt=""
      referrerPolicy="no-referrer"
      className={`${className} rounded-full border border-command-gold object-cover`}
    />
  ) : (
    <span
      aria-hidden
      className={`${className} grid place-items-center rounded-full border border-command-gold bg-command-gold/10 font-numeral ${text} font-bold text-command-gold`}
    >
      {initial}
    </span>
  );
}

export function UserMenu({
  email,
  name,
  image,
  role,
  signOutAction,
}: {
  email: string;
  name?: string | null;
  image?: string | null;
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

  const close = () => {
    if (ref.current) ref.current.open = false;
    setOpen(false);
  };
  const initial = (name?.trim()?.[0] ?? email[0] ?? "?").toUpperCase();
  const firstName = name?.trim().split(/\s+/)[0] ?? email.split("@")[0];

  return (
    <details
      ref={ref}
      className="relative"
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary
        className={`group inline-flex cursor-pointer list-none items-center gap-2 rounded-md border py-1 pl-1 pr-2.5 outline-none transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-gold-light/70 ${
          open
            ? "border-command-gold bg-command-gold/[0.06]"
            : "border-panel-border bg-deep-space/40 hover:border-command-gold/60"
        }`}
        style={{ listStyleType: "none" }}
      >
        <span className="sr-only">Signed in as {email}. Open account menu</span>
        <Avatar image={image} initial={initial} className="h-7 w-7" text="text-sm" />
        <span
          aria-hidden
          className="max-w-[8rem] truncate font-mono text-[10px] uppercase tracking-[0.1em] text-text"
        >
          {firstName}
        </span>
        <span
          aria-hidden
          className={`font-mono text-[10px] leading-none transition-transform ${
            open ? "rotate-180 text-command-gold" : "text-muted group-hover:text-command-gold"
          }`}
        >
          ▾
        </span>
      </summary>

      {/* D5 — hairline panel on deep space (chrome popover, but grouped by gold
          hairlines rather than a navy fill). */}
      <div className="absolute right-0 z-40 mt-2 w-60 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-md border border-panel-border bg-deep-space shadow-[var(--elev-card)]">
        <div className="flex items-center gap-3 border-b border-panel-border/70 p-3.5">
          <Avatar
            image={image}
            initial={initial}
            className="h-9 w-9 shrink-0"
            text="text-base"
          />
          <div className="min-w-0">
            {name ? (
              <p className="truncate font-display text-base leading-none text-title">{name}</p>
            ) : null}
            <p className="mt-1 truncate font-mono text-[9px] tracking-[0.04em] text-muted">
              {email}
            </p>
          </div>
        </div>

        <Link href="/learn" onClick={close} className={ROW}>
          <span className="text-muted group-hover:text-gold-light">{BOOK}</span>
          <span>My learning</span>
          <span aria-hidden className="ml-auto text-gray-3">›</span>
        </Link>
        <Link href="/courses" onClick={close} className={ROW}>
          <span className="text-muted">{HEX}</span>
          <span>Courses</span>
          <span aria-hidden className="ml-auto text-gray-3">›</span>
        </Link>
        <Link href="/account" onClick={close} className={ROW}>
          <span className="text-muted">{GEAR}</span>
          <span>Account</span>
          <span aria-hidden className="ml-auto text-gray-3">›</span>
        </Link>

        {role === "ADMIN"
          ? ADMIN_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={close}
                className={`${ROW} text-command-gold`}
              >
                <span className="text-gold-dim">{SHIELD}</span>
                <span>{link.label}</span>
                <span aria-hidden className="ml-auto text-gray-3">›</span>
              </Link>
            ))
          : null}

        <form action={signOutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 px-3.5 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-command-gold transition-colors hover:bg-command-gold/[0.06] hover:text-gold-light focus-visible:outline-none"
          >
            <span className="text-gold-dim">{OUT}</span>
            <span>Sign out</span>
          </button>
        </form>
      </div>
    </details>
  );
}
