"use client";

// Layer-0 fields for a magic-link SEND form (design §9): the Cloudflare Turnstile
// widget (managed, cookieless — it injects its own hidden `cf-turnstile-response`
// input), a honeypot, and a dwell timer. Drop this inside ANY <form> that sends a
// magic link; the fields ride the submit (a form action's FormData, or a manual
// `new FormData(form)`) to the server, which forwards them to signIn() and reads
// them in the ONE locus (sendVerificationRequest) via request.json().
//
// Dwell is measured from the FIRST interaction, not mount (N3): a pre-filled fast
// path with no interaction (C1 welcome-back, B1 resend, a reopened modal) submits
// an EMPTY dwell, which the server exempts. Turnstile refreshes its own token, so
// a reopened form / a resend gets a fresh single-use token (D2).
import { useEffect, useRef } from "react";
import { Turnstile } from "@marsidev/react-turnstile";
import { env } from "@/env";
import { HONEYPOT_FIELD, DWELL_FIELD, TURNSTILE_FIELD } from "@/lib/abuse-guard";

export function AbuseFields({ interactive = false }: { interactive?: boolean } = {}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const dwellRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const form = anchorRef.current?.closest("form");
    if (!form) return;
    let firstTs: number | null = null;

    // First interaction = the first TYPING/paste into a field ("input" bubbles).
    // NOT focus or a click: a one-click fast path (B1 resend, C1 welcome-back)
    // where the user only clicks the button must leave firstTs null → an empty
    // dwell the server exempts (N3). A form where the user types an email always
    // dwells far past the threshold.
    const onFirstInput = () => {
      if (firstTs === null) firstTs = Date.now();
    };
    const onSubmit = () => {
      if (dwellRef.current) {
        dwellRef.current.value = firstTs === null ? "" : String(Date.now() - firstTs);
      }
    };

    form.addEventListener("input", onFirstInput);
    // Capture phase so dwell is written BEFORE React collects FormData / runs the
    // form action or the onSubmit handler.
    form.addEventListener("submit", onSubmit, { capture: true });

    return () => {
      form.removeEventListener("input", onFirstInput);
      form.removeEventListener("submit", onSubmit, { capture: true });
    };
  }, []);

  const siteKey = env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  return (
    <span ref={anchorRef} className="contents">
      {/* Managed + cookieless; injects its own cf-turnstile-response hidden input.
          interaction-only keeps it invisible unless a challenge is needed. Renders
          nothing when unconfigured (keyless local / CI). */}
      {siteKey ? (
        <Turnstile
          siteKey={siteKey}
          options={{
            // Soft-cap escalation (design §7.3): "always" forces a visible
            // challenge for everyone; "interaction-only" is invisible unless
            // Turnstile itself decides a challenge is needed.
            appearance: interactive ? "always" : "interaction-only",
            responseFieldName: TURNSTILE_FIELD,
            refreshExpired: "auto",
          }}
        />
      ) : null}
      {/* Honeypot: off-screen (not display:none — bots skip display:none), never
          tabbable or autofilled. A human never fills it; a naive bot fills it. */}
      <input
        type="text"
        name={HONEYPOT_FIELD}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        defaultValue=""
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
      />
      <input ref={dwellRef} type="hidden" name={DWELL_FIELD} defaultValue="" />
    </span>
  );
}
