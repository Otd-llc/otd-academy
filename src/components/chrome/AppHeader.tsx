// App-shell header — a STATIC frame with dynamic islands inside it.
//
// This component is deliberately NOT async and reads nothing request-scoped. It
// lives in the (chrome) route-group layout, so anything it awaited would block
// prerendering for every route in the group — the same trap the root layout hit
// during the Cache Components migration, one level down.
//
// The frame (the <header> box, the brand lockup, the theme toggle) is therefore
// part of the prerendered shell and lands in the FIRST flush, above the page
// content. That is the whole point: before the route groups, chrome sat behind a
// `<Suspense fallback={null}>` in the root layout and streamed in AFTER <main>,
// shoving the content down on every route.
//
// Which routes get chrome is now STRUCTURAL — it is decided by the route group a
// page lives in, not by sniffing an `x-pathname` header at request time. `/sign-in`
// and `/embed/*` live under (bare) and have no chrome. The old session half of the
// gate ("anonymous visitors get chrome only on PUBLIC routes") was dead weight:
// proxy.ts redirects anonymous requests for non-public paths to /sign-in, so a
// non-public route never renders for a signed-out visitor anyway.
import { Suspense } from "react";
import Link from "next/link";

import { auth, signOut } from "@/auth";
import { db } from "@/lib/db";
import { currentAccount } from "@/lib/current-account";
import { BrandMark } from "@/components/BrandMark";
import { MainNav, MainNavStatic } from "@/components/MainNav";
import { SignUpCta } from "@/components/SignUpCta";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";
import { IdentitySync } from "@/components/chrome/IdentitySync";

export function AppHeader() {
  // Persist the theme choice to the signed-in user's account. Passed
  // UNCONDITIONALLY so the toggle stays part of the static frame: the action
  // already no-ops for anonymous visitors, and ThemeToggle renders identically
  // with or without it (it only calls it on click). Gating the prop on the
  // session would have made the toggle a third island for no visual difference.
  async function saveThemeAction(next: "light" | "dark") {
    "use server";
    if (next !== "light" && next !== "dark") return;
    const current = await auth();
    const userEmail = current?.user?.email;
    if (!userEmail) return;
    await db.user
      .update({ where: { email: userEmail }, data: { theme: next } })
      .catch(() => {});
  }

  return (
    // `z-40` so the header (and its account / hamburger dropdowns) sits ABOVE the
    // guide layer (rail / meter / resume pill at `z-30`), while staying below the
    // `z-50` tooltips that portal above it.
    <header className="app-shell-header sticky top-0 z-40 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-panel-border bg-deep-space px-4 py-2 print:hidden sm:px-6">
      <Link
        href="/"
        aria-label="One Thousand Drones Academy home"
        className="group flex items-center gap-2"
      >
        <BrandMark className="h-6 w-6 shrink-0 text-command-gold transition-colors group-hover:text-gold-light" />
        <span className="font-display text-sm tracking-wider text-gray-1 sm:text-lg">
          OTD <span className="text-command-gold">ACADEMY</span>
        </span>
      </Link>

      {/* On mobile the nav drops to its own full-width row below the brand/user
          cluster (order-last + w-full); from sm up it sits inline between them.

          The fallback is MainNavStatic — the same view, rendering the ANONYMOUS
          link set with nothing highlighted, and crucially WITHOUT usePathname(),
          which a Suspense fallback may not call (it is part of the prerendered
          shell, which has no URL). So the real nav links ship in the first flush;
          the island then swaps in the active highlight plus any role-gated links.
          The box is identical either way (mobile clips to one line via max-h-5,
          desktop is a single row), so the swap costs no vertical shift. */}
      <Suspense
        fallback={
          <MainNavStatic className="order-last w-full sm:order-none sm:w-auto" />
        }
      >
        <HeaderNav />
      </Suspense>

      <div className="ml-auto flex items-center gap-3">
        <ThemeToggle onPersist={saveThemeAction} />
        {/* The account slot is the one genuinely session-shaped thing here. Its
            `h-8` fallback matches the toggle beside it, which already pins the
            row at 32px — so the swap never moves the header's height. A signed-in
            visitor sees the right cluster settle horizontally once; anonymous
            visitors (the crawl + SEO traffic this exists for) get the CTA in the
            prerendered shell with no swap at all. */}
        <Suspense fallback={<div className="h-8 w-8" aria-hidden="true" />}>
          <HeaderAccount />
        </Suspense>
      </div>
    </header>
  );
}

// Dynamic island: the nav needs `role` (the operator links show for ADMINs only)
// and `signedIn` (Learn is the personal dashboard).
async function HeaderNav() {
  const account = await currentAccount();
  return (
    <MainNav
      role={account?.role ?? null}
      signedIn={!!account}
      className="order-last w-full sm:order-none sm:w-auto"
    />
  );
}

// Dynamic island: the signed-in menu, or the sign-up CTA for anonymous visitors.
// Also mounts IdentitySync (PostHog identify/reset) — this island already
// resolved the session, so identity stitching costs no extra request.
async function HeaderAccount() {
  const account = await currentAccount();

  if (!account) {
    return (
      <>
        <IdentitySync userId={null} />
        <SignUpCta />
      </>
    );
  }

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/sign-in" });
  }

  return (
    <>
      <IdentitySync userId={account.id} />
      <UserMenu
        email={account.email}
        name={account.name}
        image={account.image}
        role={account.role}
        signOutAction={signOutAction}
      />
    </>
  );
}
