import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { auth, signOut } from "@/auth";
import { BrandMark } from "@/components/BrandMark";
import { MainNav } from "@/components/MainNav";
import { TooltipProvider } from "@/components/TooltipProvider";
import { UserMenu } from "@/components/UserMenu";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Project Foundry",
  description: "Hardware design lifecycle tracker",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Resolve the session server-side so the UserMenu only renders for
  // signed-in users. `/sign-in` and `/api/auth/*` are excluded from the
  // middleware matcher (src/middleware.ts), so on those routes auth()
  // returns null and the menu stays hidden.
  const session = await auth();
  const email = session?.user?.email ?? null;

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/sign-in" });
  }

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* One app-wide tooltip provider — hoisted here so every `<Tooltip>`
            renders only a `<Root>` beneath this shared context (hydration fix;
            see TooltipProvider / Tooltip). The provider is a client island; its
            server-rendered children pass straight through, and it adds no DOM
            wrapper so the body's flex column is preserved. */}
        <TooltipProvider>
          {email ? (
            // App-shell chrome only renders when signed in, so `/sign-in`
            // stays a clean full-bleed boot screen. Header is `z-20` so the
            // sticky bar stays below the `z-50` tooltips that portal above it.
            <header className="sticky top-0 z-20 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-panel-border bg-deep-space px-4 py-2 sm:px-6">
              <Link
                href="/"
                aria-label="Project Foundry home"
                className="group flex items-center gap-2"
              >
                <BrandMark className="h-6 w-6 text-command-gold transition-colors group-hover:text-gold-light" />
                <span className="font-display text-lg tracking-wider text-gray-1">
                  PROJECT <span className="text-command-gold">FOUNDRY</span>
                </span>
              </Link>

              {/* On mobile the nav drops to its own full-width row below the
                  brand/user cluster (order-last + w-full); from sm up it sits
                  inline between them again. Keeps the top row cleanly
                  brand-left / avatar-right instead of wrapping unpredictably. */}
              <MainNav className="order-last w-full sm:order-none sm:w-auto" />

              {/* Right cluster — explicit header sign-out + the email menu. The
                  text sign-out is hidden on mobile to declutter the top row; the
                  same action stays reachable inside the UserMenu dropdown. */}
              <div className="ml-auto flex items-center gap-3">
                <form action={signOutAction} className="hidden sm:block">
                  <button
                    type="submit"
                    className="font-mono text-xs uppercase tracking-wider text-muted transition-colors hover:text-command-gold"
                  >
                    Sign out
                  </button>
                </form>
                <UserMenu email={email} signOutAction={signOutAction} />
              </div>
            </header>
          ) : null}

          {/* `flex-1` lets the footer settle at the bottom on short pages. */}
          <div className="flex-1">{children}</div>

          {email ? (
            <footer className="border-t border-panel-border px-4 py-6 font-mono text-xs text-muted sm:px-6">
              {/* Stacked + left-aligned on mobile; the space-between row only
                  kicks in from sm up, where there's room for both clusters. */}
              <div className="mx-auto flex max-w-6xl flex-col items-start gap-x-6 gap-y-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <BrandMark className="h-4 w-4 text-gold-dim" />
                  <span>
                    © 2026 One Thousand Drones. All rights reserved.
                  </span>
                  <Link
                    href="/license"
                    className="text-link-muted transition-colors hover:text-command-gold"
                  >
                    License
                  </Link>
                </div>
                <span className="text-gray-3">
                  Project Foundry · hardware design lifecycle
                </span>
              </div>
            </footer>
          ) : null}
        </TooltipProvider>
      </body>
    </html>
  );
}
