// Post-checkout confirmation / receipt (the O1d direction). Stripe's `success_url`
// redirects here with `?session_id={CHECKOUT_SESSION_ID}` after a paid course or
// Pass checkout. PUBLIC (see admin-routes): a buyer's session cookie can be
// absent/expired at the redirect, and bouncing them to /sign-in right after paying
// is the drop this page prevents.
//
// The access grant is the webhook's job (our DB is the source of truth); this page
// only DISPLAYS a receipt. It reads the amount + item from the Stripe session
// (retrieve by id) rather than our Purchase row, because the webhook write is async
// and can lag the redirect — the session is authoritative and immediate. If the
// session can't be resolved, it degrades to a generic confirmation, never an error.
import type { Metadata } from "next";
import Link from "next/link";

import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";

// Depends on the request query + a runtime Stripe call — never prerender.
export const dynamic = "force-dynamic";

// A receipt is not a landing page — keep it out of the index.
export const metadata: Metadata = {
  title: "Payment confirmed",
  robots: { index: false, follow: false },
};

type Confirmation = {
  amountCents: number | null;
  body: string;
  cta: { label: string; href: string };
  // A quiet secondary link (only when the primary CTA points at a specific course).
  boardsLink: boolean;
};

function usd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// Resolve the confirmation from the Stripe session. Returns a generic confirmation
// (no amount, "unlocking now" copy) when the session id is missing or unresolvable.
async function resolve(sessionId: string | undefined): Promise<Confirmation> {
  const generic: Confirmation = {
    amountCents: null,
    body: "Payment received. Your access is unlocking now and will appear in your boards shortly.",
    cta: { label: "Go to my boards", href: "/learn" },
    boardsLink: false,
  };
  if (!sessionId) return generic;

  let session;
  try {
    session = await getStripe().checkout.sessions.retrieve(sessionId);
  } catch {
    return generic;
  }

  // A no-cost order (100%-off promo) settles as `no_payment_required`; both count
  // as a completed purchase for the confirmation.
  if (
    session.payment_status !== "paid" &&
    session.payment_status !== "no_payment_required"
  ) {
    return generic;
  }

  const amountCents =
    typeof session.amount_total === "number" ? session.amount_total : null;
  const meta = session.metadata ?? {};

  if (meta.kind === "subscription") {
    // A subscription session has no amount_total (billed via invoice) — the amount
    // block simply won't render.
    return {
      amountCents,
      body: "Your subscription is active. Every course is unlocked. Start any board whenever you're ready.",
      cta: { label: "Start learning", href: "/learn" },
      boardsLink: false,
    };
  }

  if (meta.kind === "bundle") {
    return {
      amountCents,
      body: "Every course is unlocked. Start any board whenever you're ready.",
      cta: { label: "Start learning", href: "/learn" },
      boardsLink: false,
    };
  }

  if (typeof meta.projectId === "string" && meta.projectId.length > 0) {
    const project = await db.project.findUnique({
      where: { id: meta.projectId },
      select: { name: true, slug: true },
    });
    if (project) {
      return {
        amountCents,
        body: `${project.name} is unlocked on your account. Open it whenever you're ready to build.`,
        cta: { label: "Start the course", href: `/learn/${project.slug}` },
        boardsLink: true,
      };
    }
  }

  return generic;
}

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;
  const c = await resolve(session_id);

  return (
    <main className="mx-auto max-w-xl px-4 py-16 sm:px-6">
      <div className="flex items-start justify-between gap-8">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-status-green">
            ✓ Payment confirmed
          </p>
          <h1 className="title-hero mt-6">You&apos;re in.</h1>
        </div>
        {c.amountCents != null && (
          <div className="shrink-0 text-right">
            <span className="font-numeral text-3xl tabular-nums text-command-gold">
              {usd(c.amountCents)}
            </span>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              paid
            </p>
          </div>
        )}
      </div>

      <p className="mt-4 font-serif text-base text-muted">{c.body}</p>

      <div className="mt-8 flex flex-wrap items-center gap-6">
        <Link
          href={c.cta.href}
          className="glass-button glass-button-cta inline-flex items-center gap-2 px-7 py-3 font-mono text-sm uppercase tracking-[0.18em]"
        >
          {c.cta.label}
          <span aria-hidden="true">→</span>
        </Link>
        {c.boardsLink && (
          <Link
            href="/learn"
            className="font-mono text-[11px] uppercase tracking-[0.2em] text-command-gold hover:text-gold-light focus-visible:text-gold-light focus-visible:outline-none"
          >
            View all boards
          </Link>
        )}
      </div>
    </main>
  );
}
