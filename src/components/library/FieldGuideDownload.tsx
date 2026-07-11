"use client";

// Gated download for a Library FIELD GUIDE (a cluster book, or the combined "00"
// book). Free but account-gated; the per-lesson PDFs stay open as the sample.
//
// LEAD-MAGNET flow (email-first, so a new reader gets the guide without a detour):
//   signed-out  → a modal takes an EMAIL and sends ONE magic link whose
//                 post-verification target IS the guide's PDF (callbackUrl). One
//                 click signs them in / creates the account AND opens the guide.
//                 No sign-in-page hop, no /start onboarding wedge (that runs on a
//                 later visit). Google / GitHub are offered as secondary, with the
//                 same callbackUrl, so they land on the guide too.
//   signed-in   → the PDF route authorizes the session (isFieldGuideAuthorized),
//                 so the button links STRAIGHT to the download — no reason to
//                 email a link back to a page they are already on.
//
// Marketing consent is NOT collected here — new accounts opt in once at /start
// onboarding + /account ([[onboarding-build]]); a checkbox here would double-ask.

import { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

import {
  fieldGuideWelcomePath,
  fieldGuideCoverPath,
  fieldGuidePdfDownloadUrl,
} from "@/lib/library/field-guide-links";

function DownloadGlyph() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="h-3 w-3 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 2.5v8M4.5 7 8 10.5 11.5 7M3 13h10" />
    </svg>
  );
}

export function FieldGuideDownload({
  guide,
  label,
  name,
  signedIn,
  className = "",
}: {
  /** A cluster key, or "combined" for the whole-library book. */
  guide: string;
  /** The button text (e.g. "Download Fundamentals Field Guide (PDF)"). */
  label: string;
  /** The guide's proper name for the modal (e.g. "the Fundamentals Field Guide"). */
  name: string;
  signedIn: boolean;
  className?: string;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [gateExpired, setGateExpired] = useState(false);
  const search = useSearchParams();
  const router = useRouter();
  const gateHandled = useRef(false);

  // Landed from the route gate (?gate=<guide>): a direct hit or an expired emailed
  // link. Auto-open the capture for THIS guide (a signed-in visitor never reaches
  // the gate — their session would have served the PDF).
  useEffect(() => {
    if (gateHandled.current) return;
    if (!signedIn && search.get("gate") === guide) {
      gateHandled.current = true;
      setGateExpired(search.get("expired") === "1");
      setModalOpen(true);
      const params = new URLSearchParams(Array.from(search.entries()));
      params.delete("gate");
      params.delete("expired");
      router.replace(`/library${params.toString() ? `?${params.toString()}` : ""}`, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, search, guide]);

  const buttonClass = `glass-button inline-flex items-center gap-2 px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] ${className}`;

  // Signed-in: the session already authorizes the PDF route, so go straight to the
  // download (`?download=1` → the route serves it as an attachment). No email hop.
  if (signedIn) {
    return (
      <a href={fieldGuidePdfDownloadUrl(guide)} className={buttonClass}>
        {label}
        <DownloadGlyph />
      </a>
    );
  }

  // Signed-out: the lead-magnet capture — a modal takes an email + sends ONE magic
  // link whose post-verification target IS the guide (opens it AND creates the
  // account in one click).
  return (
    <div>
      <button type="button" onClick={() => setModalOpen(true)} className={buttonClass}>
        {label}
        <DownloadGlyph />
      </button>

      {modalOpen ? (
        <LeadMagnetModal
          guide={guide}
          name={name}
          expired={gateExpired}
          onClose={() => setModalOpen(false)}
        />
      ) : null}
    </div>
  );
}

function LeadMagnetModal({
  guide,
  name,
  expired,
  onClose,
}: {
  guide: string;
  name: string;
  expired: boolean;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const callbackUrl = fieldGuideWelcomePath(guide); // post-signin target = the welcome (auto-downloads + funnels to L1.01)

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email || state === "sending") return;
    setState("sending");
    try {
      // ONE magic link: signs in / creates the account AND (via callbackUrl) opens
      // the guide. redirect:false keeps us on the page to confirm.
      await signIn("resend", { email, redirect: false, callbackUrl });
      setState("sent");
    } catch {
      setState("error");
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Get ${name}`}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-deep-space/80" />
      {/* N1: floats on the field via a gold hairline + elevation, NOT a navy fill */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-md rounded-[8px] border border-command-gold/25 bg-deep-space p-6 [box-shadow:var(--elev-card)]"
      >
        {state === "sent" ? (
          <>
            <div className="flex items-start gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={fieldGuideCoverPath(guide)}
                alt=""
                className="w-[80px] shrink-0 rounded-[3px] border border-panel-border/50"
              />
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-command-gold">
                  Check your inbox
                </p>
                <h2 className="mt-1.5 font-display text-xl font-normal tracking-wide text-title">
                  Your guide is on the way
                </h2>
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              We emailed a link to <span className="text-text">{email}</span>. Click it to open{" "}
              {name}; the same click sets up your free account.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="glass-button mt-5 inline-flex w-full items-center justify-center px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em]"
            >
              Done
            </button>
          </>
        ) : (
          <>
            <div className="flex items-start gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={fieldGuideCoverPath(guide)}
                alt=""
                className="w-[84px] shrink-0 rounded-[3px] border border-panel-border/50 [box-shadow:var(--elev-card)]"
              />
              <div className="flex-1">
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-command-gold">
                  {expired ? "Link expired" : "▸ Free field guide"}
                </p>
                <h2 className="mt-1.5 font-display text-xl font-normal tracking-wide text-title">
                  {expired ? "Get a fresh link" : `Get ${name}`}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {expired ? `Your link for ${name} expired. ` : "Free with an account. "}
                  We&apos;ll email a link that opens it, and sets up your account in the same step.
                  The lesson PDFs stay open.
                </p>
              </div>
            </div>

            <form onSubmit={submitEmail} className="mt-4">
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="w-full border-0 border-b border-panel-border/60 bg-transparent px-0 py-2 font-mono text-sm text-text placeholder:text-muted focus:border-command-gold focus:outline-none"
              />
              <button
                type="submit"
                disabled={state === "sending"}
                className="glass-button-cta mt-3 w-full py-2 font-mono text-[11px] uppercase tracking-[0.14em] disabled:opacity-70"
              >
                {state === "sending" ? "Sending…" : "Email me the guide"}
              </button>
            </form>
            {state === "error" ? (
              <p className="mt-2 font-mono text-[10px] tracking-wide text-alert-red">
                Something went wrong. Please try again.
              </p>
            ) : null}

            <div className="my-4 flex items-center gap-3 font-mono text-[9px] uppercase tracking-[0.22em] text-muted">
              <span className="h-px flex-1 bg-panel-border/60" />
              or
              <span className="h-px flex-1 bg-panel-border/60" />
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => signIn("google", { callbackUrl })}
                className="inline-flex w-full items-center justify-center rounded-[6px] border border-panel-border px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-text hover:border-command-gold/50 focus-visible:border-command-gold focus-visible:outline-none"
              >
                Continue with Google
              </button>
              <button
                type="button"
                onClick={() => signIn("github", { callbackUrl })}
                className="inline-flex w-full items-center justify-center rounded-[6px] border border-panel-border px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-text hover:border-command-gold/50 focus-visible:border-command-gold focus-visible:outline-none"
              >
                Continue with GitHub
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="mt-3 block w-full text-center font-mono text-[10px] uppercase tracking-wider text-muted hover:text-text"
            >
              Maybe later
            </button>
          </>
        )}
      </div>
    </div>
  );
}
