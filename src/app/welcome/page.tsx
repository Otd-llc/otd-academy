// Lead-magnet welcome (/welcome?fg=<guide>) — the post-signin landing for someone
// who grabbed a field guide. Auto-DOWNLOADS the guide (attachment, so this tab
// stays put), skips the /start goal survey (they self-identified), and funnels
// hard to L1.01. Layout = sandbox pick W6 (guide-forward: the cover is the earned
// artifact, beside a short "yours" hero + the next-build CTA).
//
// otd-frontend-design: hairlines on the deep-space field, NO filled card; Bebas
// hero + gold accent, `.glass-button-cta` primary, `·` separators, Saira numerals.
import { redirect } from "next/navigation";
import Link from "next/link";

import { auth } from "@/auth";
import { clusterByKey } from "@/lib/library/clusters";
import { fieldGuidePdfDownloadUrl, fieldGuideCoverPath } from "@/lib/library/field-guide-links";
import { WelcomeClaim } from "./welcome-claim";

// L1.01 course; its published redirect lands on the live build guide.
const L101 = "/courses/l1-01-wroom-breakout";

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ fg?: string }>;
}) {
  // Post-signin only: an anonymous hit has nothing to claim.
  const session = await auth();
  if (!session?.user) redirect("/library");

  const { fg } = await searchParams;
  const guide = fg && (fg === "combined" || clusterByKey(fg)) ? fg : null;
  const heroName =
    guide === "combined"
      ? "The Reference Library"
      : guide
        ? `The ${clusterByKey(guide)!.label}`
        : null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      {guide ? (
        <WelcomeClaim guide={guide} downloadUrl={fieldGuidePdfDownloadUrl(guide)} />
      ) : null}

      {guide ? (
        // W6 — guide-forward: the earned artifact beside a short hero + next build.
        <div className="flex flex-col items-start gap-7 sm:flex-row sm:items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fieldGuideCoverPath(guide)}
            alt=""
            className="w-[128px] shrink-0 rounded-[4px] border border-panel-border/50 [box-shadow:var(--elev-card)]"
          />
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
              ▸ Saved to your device
            </p>
            <h1 className="mt-1.5 font-display text-4xl uppercase leading-[0.95] text-title sm:text-5xl">
              {heroName}, <span className="text-command-gold">yours</span>
            </h1>
            <p className="mt-3 max-w-md text-sm text-muted">
              Next up: L1.01 · ESP32-S3 USB-C Breakout, your first real board.
            </p>
            <Link
              href={L101}
              className="glass-button-cta mt-5 inline-flex items-center gap-2 px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em]"
            >
              Start L1.01 →
            </Link>
          </div>
        </div>
      ) : (
        // No / unknown guide: a generic welcome that still funnels to L1.01.
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
            ▸ You&apos;re in
          </p>
          <h1 className="mt-1.5 font-display text-5xl uppercase text-title">
            Welcome to the <span className="text-command-gold">Academy</span>
          </h1>
          <p className="mt-3 max-w-md text-sm text-muted">
            Your free account is ready. Start with your first real board.
          </p>
          <Link
            href={L101}
            className="glass-button-cta mt-5 inline-flex items-center gap-2 px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em]"
          >
            Start L1.01 →
          </Link>
        </div>
      )}

      {/* Quiet fallbacks: manual re-download (if the auto-download was blocked) + a
          couple of ways into the site. */}
      <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-panel-border/60 pt-6 font-mono text-[10px] uppercase tracking-[0.14em]">
        {guide ? (
          <a
            href={fieldGuidePdfDownloadUrl(guide)}
            className="text-command-gold hover:text-gold-light"
          >
            Re-download the guide
          </a>
        ) : null}
        <Link href="/library" className="text-muted hover:text-text">
          Browse the library
        </Link>
        <Link href="/courses" className="text-muted hover:text-text">
          All courses
        </Link>
      </div>
    </main>
  );
}
