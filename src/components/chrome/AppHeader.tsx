// App-shell header. Split out of the root layout for Cache Components: it reads
// the session, the middleware `x-pathname` header, and (for the avatar) the DB,
// so it is inherently request-time. Keeping it here lets the root layout stay a
// static, prerenderable shell and stream this in behind a <Suspense> boundary.
//
// Chrome renders for signed-in users plus anonymous visitors on PUBLIC routes
// (the SEO funnel); `/sign-in` and `/embed/*` stay chrome-free (shouldRenderChrome).
import Link from "next/link";
import { headers } from "next/headers";

import { auth, signOut } from "@/auth";
import { db } from "@/lib/db";
import { shouldRenderChrome } from "@/lib/chrome";
import { avatarSrc } from "@/lib/effective-avatar";
import { BrandMark } from "@/components/BrandMark";
import { MainNav } from "@/components/MainNav";
import { RememberLastUser } from "@/components/auth/RememberLastUser";
import { SignUpCta } from "@/components/SignUpCta";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";

export async function AppHeader() {
  // `role` drives MainNav: the operator links (Projects / Curriculum) show for
  // ADMINs only. auth() decodes the JWT session cookie (strategy: "jwt"), so this
  // is not a DB round-trip and the sibling AppFooter calling it again is cheap.
  const session = await auth();
  const email = session?.user?.email ?? null;
  const role = session?.user?.role ?? null;
  const name = session?.user?.name ?? null;
  const providerImage = session?.user?.image ?? null;

  const pathname = (await headers()).get("x-pathname") ?? "";
  if (!shouldRenderChrome({ pathname, signedIn: !!email })) return null;

  // The effective avatar is the custom upload when set, else the sign-in provider
  // image, else null (the menu then shows the initial).
  const account = email
    ? await db.user
        .findUnique({
          where: { email },
          select: { id: true, avatarUpdatedAt: true },
        })
        .catch(() => null)
    : null;
  const image = account
    ? avatarSrc(account.id, account.avatarUpdatedAt, providerImage)
    : providerImage;

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/sign-in" });
  }

  // Persist the theme choice to the signed-in user's account (a no-op for
  // anonymous visitors — the cookie/localStorage already carry the device
  // choice). Passed to ThemeToggle only when signed in.
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
    <>
      {/* Remember the signed-in identity on-device so a later signed-OUT visit
          can offer the C1 "welcome back" fast-path. Renders nothing. */}
      {email ? <RememberLastUser email={email} name={name} image={image} /> : null}
      {/* Header is `z-40` so it (and its account / hamburger dropdowns) sits ABOVE
          the guide layer (rail / meter / resume pill at `z-30`), while staying
          below the `z-50` tooltips that portal above it. The two dropdowns order
          among themselves inside this context (account > hamburger). */}
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

        {/* On mobile the nav drops to its own full-width row below the
            brand/user cluster (order-last + w-full); from sm up it sits
            inline between them again. Keeps the top row cleanly
            brand-left / avatar-right instead of wrapping unpredictably. */}
        <MainNav
          role={role}
          signedIn={!!email}
          className="order-last w-full sm:order-none sm:w-auto"
        />

        {/* Right cluster. Signed in: the email menu (sign-out lives inside it now
            — no redundant standalone header sign-out). Anonymous (public routes):
            a sign-up CTA in place of the menu. */}
        <div className="ml-auto flex items-center gap-3">
          {/* Theme toggle lives in the right cluster — always visible at every
              breakpoint (the cluster never collapses), so it's the one
              always-reachable home on mobile too. Signed-in visitors persist the
              choice to their account. */}
          <ThemeToggle onPersist={email ? saveThemeAction : undefined} />
          {email ? (
            <UserMenu
              email={email}
              name={name}
              image={image}
              role={role}
              signOutAction={signOutAction}
            />
          ) : (
            <SignUpCta />
          )}
        </div>
      </header>
    </>
  );
}
