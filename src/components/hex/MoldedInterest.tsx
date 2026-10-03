"use client";

// The two interest signals on /hex/molded (hex-v2 next plan 1.2.2 / 1.2.3).
//
// WantButton: one tap per design. The server counts it once per IP-day or
// drops it (closed limiter); the browser remembers a counted tap in
// localStorage so the button reads "Counted" on return and a second tap is
// inert. A dropped tap says so plainly rather than pretending.
//
// MoldedWaitlist: one form for the page: an address and the designs wanted.
// Submitting sends one confirmation mail (double opt-in); nothing is sent to
// the address until the page behind that mail is submitted.
import { useState, useSyncExternalStore } from "react";

import { InlineBanner } from "@/components/InlineBanner";
import {
  notifyOnHexPart,
  tapHexPartInterest,
} from "@/lib/actions/hex-part-interest";

const MARK_PREFIX = "otd.hex.interest.";

function marked(stem: string): boolean {
  try {
    return localStorage.getItem(MARK_PREFIX + stem) === "1";
  } catch {
    return false;
  }
}
function mark(stem: string): void {
  try {
    localStorage.setItem(MARK_PREFIX + stem, "1");
  } catch {
    // private window, blocked storage: the server still counted it
  }
}

type TapPhase = "idle" | "sending" | "counted" | "already" | "dropped" | "off";

export function WantButton({ stem, name }: { stem: string; name: string }) {
  const [tapped, setTapped] = useState<TapPhase>("idle");
  // The browser's own memory of a counted tap, read without an effect: the
  // server snapshot is "not marked" so the first paint matches on both sides,
  // and the client snapshot is the stored mark.
  const stored = useSyncExternalStore(
    () => () => {},
    () => marked(stem),
    () => false,
  );
  const phase: TapPhase = tapped === "idle" && stored ? "counted" : tapped;
  const setPhase = setTapped;

  const label =
    phase === "counted"
      ? "Counted"
      : phase === "already"
        ? "Counted today"
        : phase === "dropped"
          ? "Not counted, try later"
          : phase === "off"
            ? "Counting paused"
            : phase === "sending"
              ? "…"
              : "I want this made";

  return (
    <button
      type="button"
      aria-label={`${label}: ${name}`}
      disabled={phase !== "idle"}
      onClick={() => {
        setPhase("sending");
        void tapHexPartInterest({ stem }).then(
          (res) => {
            if (res.ok) {
              mark(stem);
              setPhase("counted");
            } else if (res.reason === "already") {
              mark(stem);
              setPhase("already");
            } else if (res.reason === "off") {
              setPhase("off");
            } else {
              setPhase("dropped");
            }
          },
          () => setPhase("dropped"),
        );
      }}
      className="glass-button px-5 py-2 font-mono text-[11px] uppercase tracking-[0.16em] disabled:opacity-60"
    >
      {label}
    </button>
  );
}

type FormPhase = "idle" | "sending" | "done" | "error";

export function MoldedWaitlist({
  concepts,
  open,
  supportEmail,
}: {
  concepts: { stem: string; name: string }[];
  open: boolean;
  supportEmail: string;
}) {
  const [email, setEmail] = useState("");
  const [chosen, setChosen] = useState<string[]>([]);
  const [phase, setPhase] = useState<FormPhase>("idle");
  const [error, setError] = useState("");
  const [state, setState] = useState<"confirm-sent" | "confirmed" | "pending">(
    "pending",
  );

  if (!open) {
    return (
      <p className="mt-4 max-w-xl font-serif text-base leading-relaxed text-text">
        Write to{" "}
        <a
          href={`mailto:${supportEmail}`}
          className="text-command-gold underline underline-offset-4 hover:text-gold-light"
        >
          {supportEmail}
        </a>{" "}
        and name the part. A count of replies per design decides what goes to a
        mold maker first. No account is needed, and nothing is charged.
      </p>
    );
  }

  if (phase === "done") {
    return (
      <p className="mt-4 max-w-xl font-serif text-base leading-relaxed text-text">
        {state === "confirm-sent"
          ? "Check your inbox. One message asks you to confirm the address; nothing else is sent until you do."
          : "Noted. You are on the list for the designs you picked, and you will hear from us once, when one of them goes to the mold maker."}
      </p>
    );
  }

  return (
    <form
      className="mt-4 max-w-xl"
      onSubmit={(e) => {
        e.preventDefault();
        setPhase("sending");
        setError("");
        void notifyOnHexPart({ email, stems: chosen }).then(
          (res) => {
            if (res.ok) {
              setState(res.state);
              setPhase("done");
            } else {
              setError(res.error);
              setPhase("error");
            }
          },
          () => {
            setError("That did not reach us. Try again.");
            setPhase("error");
          },
        );
      }}
    >
      <p className="font-serif text-base leading-relaxed text-text">
        Pick the designs you would buy, leave an address, and you hear from us
        once: when one of them goes to a mold maker. No account, nothing
        charged, one confirmation mail first.
      </p>
      <fieldset className="mt-4">
        <legend className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
          &#9656; Designs
        </legend>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
          {concepts.map((c) => (
            <label
              key={c.stem}
              className="flex items-center gap-2 font-serif text-sm text-text"
            >
              <input
                type="checkbox"
                className="accent-command-gold"
                checked={chosen.includes(c.stem)}
                disabled={phase === "sending"}
                onChange={(e) =>
                  setChosen((prev) =>
                    e.target.checked
                      ? [...prev, c.stem]
                      : prev.filter((s) => s !== c.stem),
                  )
                }
              />
              {c.name}
            </label>
          ))}
        </div>
      </fieldset>
      {phase === "error" && (
        <div className="mt-3">
          <InlineBanner variant="error">{error}</InlineBanner>
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label htmlFor="hex-molded-email" className="sr-only">
          Email address
        </label>
        <input
          id="hex-molded-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          disabled={phase === "sending"}
          className="w-full max-w-xs border border-panel-border/60 bg-transparent px-3 py-2 font-serif text-sm text-title outline-none focus-visible:border-command-gold sm:w-auto"
        />
        <button
          type="submit"
          disabled={
            phase === "sending" || email.trim() === "" || chosen.length === 0
          }
          className="glass-button px-5 py-2 font-mono text-[11px] uppercase tracking-[0.16em] disabled:opacity-50"
        >
          {phase === "sending" ? "Sending…" : "Tell me when"}
        </button>
      </div>
    </form>
  );
}
