// Lead-magnet welcome (/welcome?fg=<guide>) — the post-signin landing for someone
// who grabbed a field guide. It auto-DOWNLOADS the guide (attachment, so this tab
// stays put), skips the /start goal survey (they self-identified), and funnels
// hard to L1.01. A distinct flow from the generic first-run onboarding.
//
// otd-frontend-design: a result/landing surface = hairlines on the deep-space
// field, NO filled card; Bebas hero + gold rule + mono eyebrow, `.glass-button-cta`
// primary, `·` separators, Saira for any numeral.
import { redirect } from "next/navigation";
import Link from "next/link";

import { auth } from "@/auth";
import { PageHeader } from "@/components/PageHeader";
import { clusterByKey } from "@/lib/library/clusters";
import {
  fieldGuideLabel,
  fieldGuidePdfDownloadUrl,
  fieldGuideCoverPath,
} from "@/lib/library/field-guide-links";
import { WelcomeClaim } from "./welcome-claim";

export const dynamic = "force-dynamic";

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
  const label = guide ? fieldGuideLabel(guide) : null;
  const leadLabel = label ? label.charAt(0).toUpperCase() + label.slice(1) : null;

  return (
    <main className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
      {guide ? (
        <WelcomeClaim guide={guide} downloadUrl={fieldGuidePdfDownloadUrl(guide)} />
      ) : null}

      <PageHeader
        eyebrow="You're in"
        title="Welcome to the Academy"
        accentWord="Academy"
        lead={
          leadLabel
            ? `${leadLabel} is downloading to your device. When you're ready to build one of these for real, start here.`
            : "Your free account is ready. Here is where to start."
        }
      />

      {/* Start here — the whole point of the funnel. */}
      <section className="mt-8 border-t border-panel-border/60 pt-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
          ▸ Start here
        </p>
        <div className="mt-4 flex items-start gap-4">
          {guide ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fieldGuideCoverPath(guide)}
              alt=""
              className="w-[64px] shrink-0 rounded-[3px] border border-panel-border/50"
            />
          ) : null}
          <div>
            <h2 className="title-card">L1.01 · ESP32-S3 USB-C Breakout</h2>
            <p className="mt-1 text-sm text-muted">
              Your first board, schematic to bring-up. The fundamentals you just grabbed, applied
              to real copper.
            </p>
          </div>
        </div>
        <Link
          href={L101}
          className="glass-button-cta mt-5 inline-flex items-center gap-2 px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em]"
        >
          Start L1.01 →
        </Link>
      </section>

      {/* Quiet fallbacks: the manual re-download (if the auto-download was blocked)
          and a couple of ways into the site. */}
      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-panel-border/60 pt-6 font-mono text-[10px] uppercase tracking-[0.14em]">
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
