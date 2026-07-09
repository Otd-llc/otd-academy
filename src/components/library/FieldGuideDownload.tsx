"use client";

// Gated download control for a Library FIELD GUIDE (a cluster book, or the
// combined "00" book). Free but account-gated: signed-in → one click emails the
// portable link; signed-out → a modal prompts a free account, then (on return)
// the link is emailed. Per-lesson PDFs use the plain DownloadPdfLink (ungated) —
// they are the quality sample that sells the compiled guide.
//
// Marketing consent is intentionally NOT collected here: new accounts opt in once
// at /start onboarding (and manage it in /account), so a checkbox here would be a
// double-ask. This control only ever sends a TRANSACTIONAL "here's your download"
// email, which needs no marketing consent.

import { useState, useTransition, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

import { requestFieldGuide } from "@/lib/actions/field-guide-download";

type Result = Awaited<ReturnType<typeof requestFieldGuide>>;

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
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<
    null | { kind: "sent"; email: string } | { kind: "error"; msg: string }
  >(null);
  const [modalOpen, setModalOpen] = useState(false);
  const search = useSearchParams();
  const router = useRouter();
  const autoFired = useRef(false);

  function send() {
    startTransition(async () => {
      const r: Result = await requestFieldGuide(guide);
      if (r.ok) {
        setStatus({ kind: "sent", email: r.email });
        setModalOpen(false);
      } else if ("needsAuth" in r) {
        setModalOpen(true);
      } else {
        setStatus({ kind: "error", msg: r.error });
      }
    });
  }

  // Best-effort auto-send after returning from sign-in with ?fg=<guide>. Brand-new
  // users may get routed through /start first (dropping the marker) — they simply
  // click once more, which works because they are now signed in.
  useEffect(() => {
    if (autoFired.current) return;
    if (signedIn && search.get("fg") === guide) {
      autoFired.current = true;
      send();
      const params = new URLSearchParams(Array.from(search.entries()));
      params.delete("fg");
      router.replace(`/library${params.toString() ? `?${params.toString()}` : ""}`, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, search, guide]);

  function onClick() {
    if (status?.kind === "sent" || pending) return;
    if (signedIn) send();
    else setModalOpen(true);
  }

  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        disabled={pending || status?.kind === "sent"}
        className={`glass-button inline-flex items-center gap-2 px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] disabled:opacity-70 ${className}`}
      >
        {status?.kind === "sent" ? "Sent — check your inbox" : pending ? "Sending…" : label}
        <DownloadGlyph />
      </button>
      {status?.kind === "sent" ? (
        <p className="mt-1.5 font-mono text-[10px] tracking-wide text-muted">
          Download link emailed to {status.email}.
        </p>
      ) : null}
      {status?.kind === "error" ? (
        <p className="mt-1.5 font-mono text-[10px] tracking-wide text-alert-red">{status.msg}</p>
      ) : null}

      {modalOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Download ${name}`}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setModalOpen(false)}
        >
          <div className="absolute inset-0 bg-black/60" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="glass-card relative z-10 w-full max-w-sm p-6"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-command-gold">
              Free field guide
            </p>
            <h2 className="mt-2 font-display text-xl font-normal tracking-wide text-title">
              Create a free account to get {name}
            </h2>
            <p className="mt-3 font-serif text-sm leading-relaxed text-muted">
              Field guides are free with an account. We&apos;ll email you the download link, so it
              works on any device. The individual lesson PDFs stay open, no account needed.
            </p>
            <button
              type="button"
              onClick={() =>
                signIn(undefined, { callbackUrl: `/library?fg=${encodeURIComponent(guide)}` })
              }
              className="glass-button mt-5 inline-flex w-full items-center justify-center px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em]"
            >
              Create a free account / Sign in
            </button>
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="mt-3 block w-full text-center font-mono text-[10px] uppercase tracking-wider text-muted hover:text-gray-1"
            >
              Maybe later
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
