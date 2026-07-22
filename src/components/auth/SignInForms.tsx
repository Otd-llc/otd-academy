"use client";

// The sign-in surface — one client component that renders three states off the
// locked design set, all matched to R11:
//   • R11  — the two-up provider grid (Google | GitHub) + a magic-link field.
//   • C1   — "welcome back" fast-path for a returning, signed-OUT visitor whose
//            last-user we remembered on-device (RememberLastUser writes it).
//   • B1   — the "check your email" sent state (Auth.js verifyRequest, /sign-in
//            ?type=email), a pulsing mail glyph.
//
// The three server actions (signIn per provider) are defined in the server page
// and passed down, so this client island never imports @/auth. On submit we
// remember the chosen provider (+ typed email) on-device so next time we can
// show C1. All of that is a same-device convenience, never an auth signal.

import { useEffect, useState } from "react";
import {
  LAST_USER_KEY,
  LAST_PROVIDER_KEY,
  LAST_EMAIL_KEY,
  parseLastUser,
  parseLastProvider,
  providerLabel,
  initialsFrom,
  type LastUser,
  type LastProvider,
} from "@/lib/last-auth";
import { AbuseFields } from "@/components/auth/AbuseFields";

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden focusable="false">
      <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
      <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z" />
      <path fill="#EA4335" d="M24 9.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 3.18 29.93 1 24 1 15.4 1 7.96 5.93 4.34 13.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
    </svg>
  );
}
function GitHubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden focusable="false">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.305-5.467-1.334-5.467-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}
const GoogleChip = ({ size = "h-[18px] w-[18px]" }: { size?: string }) => (
  <span className={`flex ${size} shrink-0 items-center justify-center rounded-full bg-white`}>
    <GoogleMark className="h-3 w-3" />
  </span>
);
function MailIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden focusable="false">
      <path d="M3.5 6h17v12h-17zM3.7 6.6l8.3 5.6 8.3-5.6" />
    </svg>
  );
}

const CTA =
  "flex w-full items-center justify-center gap-2.5 rounded-md border border-command-gold bg-command-gold px-4 py-3 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-deep-space transition-colors hover:bg-gold-light focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold-light";
const OUTLINE =
  "flex w-full items-center justify-center gap-2.5 rounded-md border border-panel-border px-4 py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-text transition-colors hover:border-command-gold hover:text-gold-light focus-visible:outline-none focus-visible:border-command-gold";
const SQUARE_BASE =
  "flex w-full flex-col items-center justify-center gap-2 rounded-md border p-4 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors focus-visible:outline-none";
const INPUT =
  "w-full rounded-md border border-panel-border bg-transparent px-3 py-2.5 font-mono text-sm text-text placeholder:text-muted focus:border-command-gold focus:outline-none";
const LABEL = "block font-mono text-[9px] uppercase tracking-[0.2em] text-muted";

function Divider({ label = "or" }: { label?: string }) {
  return (
    <div className="my-4 flex items-center gap-3" aria-hidden>
      <span className="h-px flex-1 bg-panel-border/70" />
      <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted">{label}</span>
      <span className="h-px flex-1 bg-panel-border/70" />
    </div>
  );
}

export function SignInForms({
  googleAction,
  githubAction,
  resendAction,
  checkEmail,
  interactive = false,
}: {
  googleAction: () => Promise<void>;
  githubAction: () => Promise<void>;
  resendAction: (formData: FormData) => Promise<void>;
  checkEmail: boolean;
  interactive?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const [lastUser, setLastUser] = useState<LastUser | null>(null);
  const [lastProvider, setLastProvider] = useState<LastProvider | null>(null);
  const [lastEmail, setLastEmail] = useState<string | null>(null);
  const [useAnother, setUseAnother] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads a client-only store on mount; SSR fallback then adjusts once
    setMounted(true);
    try {
      setLastUser(parseLastUser(localStorage.getItem(LAST_USER_KEY)));
      setLastProvider(parseLastProvider(localStorage.getItem(LAST_PROVIDER_KEY)));
      setLastEmail(localStorage.getItem(LAST_EMAIL_KEY));
    } catch {
      /* private mode / disabled storage → just show the grid */
    }
  }, []);

  const remember = (p: LastProvider) => {
    try {
      localStorage.setItem(LAST_PROVIDER_KEY, p);
    } catch {}
  };
  const rememberEmail = (e: React.FormEvent<HTMLFormElement>) => {
    try {
      const v = new FormData(e.currentTarget).get("email");
      if (typeof v === "string" && v) {
        localStorage.setItem(LAST_PROVIDER_KEY, "resend");
        localStorage.setItem(LAST_EMAIL_KEY, v);
      }
    } catch {}
  };
  const forget = () => {
    try {
      localStorage.removeItem(LAST_USER_KEY);
      localStorage.removeItem(LAST_PROVIDER_KEY);
      localStorage.removeItem(LAST_EMAIL_KEY);
    } catch {}
    setLastUser(null);
    setUseAnother(true);
  };

  const googleBtn = (cls: string, label = "Continue with Google") => (
    <form action={googleAction}>
      <button type="submit" onClick={() => remember("google")} className={cls}>
        <GoogleChip />
        <span>{label}</span>
      </button>
    </form>
  );
  const githubBtn = (cls: string, label = "Continue with GitHub") => (
    <form action={githubAction}>
      <button type="submit" onClick={() => remember("github")} className={cls}>
        <GitHubMark className="h-4 w-4 shrink-0" />
        <span>{label}</span>
      </button>
    </form>
  );
  const emailForm = (defaultEmail = "", cta = "Email me a magic link") => (
    <form onSubmit={rememberEmail} action={resendAction} className="flex flex-col gap-2.5">
      <label htmlFor="si-email" className="sr-only">
        Email address
      </label>
      <input
        id="si-email"
        type="email"
        name="email"
        required
        autoComplete="email"
        defaultValue={defaultEmail}
        placeholder="you@example.com"
        className={INPUT}
      />
      <AbuseFields interactive={interactive} />
      <button type="submit" className={CTA}>
        <MailIcon className="h-4 w-4" />
        <span>{cta}</span>
      </button>
    </form>
  );

  // ── B1 · check your email ─────────────────────────────
  if (checkEmail) {
    const email = mounted ? lastEmail : null;
    return (
      <div className="flex w-full max-w-xs flex-col items-center text-center">
        <span className="pc-pulse mb-4">
          <MailIcon className="h-6 w-6 text-gold-light" />
        </span>
        <h1 className="font-display text-3xl leading-none tracking-wide text-title">
          Check your email
        </h1>
        <p className="mt-2 font-serif text-sm text-muted">
          We sent a one-time sign-in link to
          <br />
          <span className="font-mono text-[12px] text-gold-light">
            {email ?? "your inbox"}
          </span>
          . It expires in 24 hours.
        </p>
        <span aria-hidden className="my-4 h-px w-[50px] bg-command-gold/90" />
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-gray-3">
          {email ? (
            <form action={resendAction} className="inline">
              <input type="hidden" name="email" value={email} />
              <AbuseFields interactive={interactive} />
              <button type="submit" className="text-muted transition-colors hover:text-gold-light">
                Resend
              </button>
            </form>
          ) : (
            <a href="/sign-in" className="text-muted transition-colors hover:text-gold-light">
              Resend
            </a>
          )}
          {" · "}
          <a href="/sign-in" className="text-muted transition-colors hover:text-gold-light">
            Use another way
          </a>
        </p>
      </div>
    );
  }

  // ── C1 · welcome back ─────────────────────────────────
  if (mounted && lastUser && !useAnother) {
    const label = lastProvider ? providerLabel(lastProvider) : null;
    return (
      <div className="flex w-full max-w-xs flex-col">
        <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
          ▸ Welcome back
        </span>
        <div className="mt-3 flex items-center gap-3">
          {lastUser.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={lastUser.image} alt="" className="h-11 w-11 rounded-full border border-command-gold object-cover" />
          ) : (
            <span className="grid h-11 w-11 place-items-center rounded-full border border-command-gold bg-command-gold/10 font-numeral text-lg font-bold text-command-gold">
              {initialsFrom(lastUser)}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate font-display text-xl leading-none text-title">
              {lastUser.name ?? lastUser.email}
            </p>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.2em] text-muted">
              {label ? `last in · ${label}` : lastUser.email}
            </p>
          </div>
        </div>

        <div className="mt-4">
          {lastProvider === "github"
            ? githubBtn(CTA)
            : lastProvider === "resend"
              ? emailForm(lastUser.email)
              : googleBtn(CTA)}
        </div>

        <Divider />
        {lastProvider === "resend" ? (
          <div className="grid grid-cols-2 gap-2.5">
            {googleBtn(OUTLINE, "Google")}
            {githubBtn(OUTLINE, "GitHub")}
          </div>
        ) : (
          emailForm(lastUser.email, "Email me a link instead")
        )}

        <button
          type="button"
          onClick={forget}
          className="mt-4 self-center font-mono text-[10px] uppercase tracking-[0.14em] text-muted transition-colors hover:text-gold-light"
        >
          Not you? Use another account ›
        </button>
      </div>
    );
  }

  // ── R11 · provider grid + magic link (default) ────────
  return (
    <div className="flex w-full max-w-xs flex-col">
      <p className="font-display text-2xl leading-none tracking-wide text-title">
        One Thousand Drones
      </p>
      <span className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.28em] text-muted">
        ▸ Academy
      </span>
      <span aria-hidden className="my-3 h-px w-[50px] bg-command-gold/90" />

      <label className={LABEL}>Continue with</label>
      <div className="mt-2 grid grid-cols-2 gap-2.5">
        <form action={googleAction}>
          <button
            type="submit"
            onClick={() => remember("google")}
            className={`${SQUARE_BASE} border-command-gold text-command-gold hover:bg-command-gold hover:text-deep-space`}
          >
            <GoogleChip size="h-6 w-6" />
            <span>Google</span>
          </button>
        </form>
        <form action={githubAction}>
          <button
            type="submit"
            onClick={() => remember("github")}
            className={`${SQUARE_BASE} border-panel-border text-text hover:border-command-gold hover:text-gold-light`}
          >
            <GitHubMark className="h-6 w-6 shrink-0" />
            <span>GitHub</span>
          </button>
        </form>
      </div>

      <Divider />
      {/* Plain heading, not a second <label for="si-email"> — the input already
          carries an sr-only "Email address" label inside emailForm(); two labels
          on one control read as a doubled/conflicting name to AT. */}
      <p className={`${LABEL} mb-1.5`} aria-hidden="true">
        Or a magic link
      </p>
      {emailForm()}

      <p className="mt-4 text-center font-mono text-[9px] uppercase tracking-[0.08em] text-muted">
        By continuing you agree to the{" "}
        <a href="/license" className="text-muted transition-colors hover:text-gold-light">
          terms
        </a>
      </p>
    </div>
  );
}
