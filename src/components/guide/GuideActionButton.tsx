"use client";

// Client island for an in-guide `action` block — the button the guide tells the
// student to click. Each action maps to a server action that presigns a
// download: "downloadKicadStarter" (the board's KiCad starter) and
// "downloadReferenceFiles" (the verified reference gerber set).
//
// PUBLIC-RESOURCE RULE: anyone can SEE this on a public lesson, but downloading a
// resource requires an account. An anonymous visitor is funnelled to sign-up
// rather than dead-ending at requireUser() — the download is a free-account
// conversion moment. Apply this same rule to any future public resource download.
import Link from "next/link";
import { useState, useTransition } from "react";
import {
  getKicadStarterUrl,
  getReferenceFilesUrl,
} from "@/lib/actions/learner-resources";

// action key → { resolve, notReady }. `resolve` presigns the download (or null
// when the asset isn't attached yet); `notReady` is the learner-facing message
// for that null case.
const ACTIONS: Record<
  string,
  { resolve: (projectId: string) => Promise<string | null>; notReady: string }
> = {
  downloadKicadStarter: {
    resolve: getKicadStarterUrl,
    notReady: "The KiCad starter isn't available for this board yet.",
  },
  downloadReferenceFiles: {
    resolve: getReferenceFilesUrl,
    notReady: "The reference files aren't available for this board yet.",
  },
};

const BUTTON_CLASS =
  "inline-flex items-center gap-1.5 rounded border border-command-gold bg-navy-dark px-4 py-2 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space";

export function GuideActionButton({
  action,
  label,
  projectId,
  isSignedIn = false,
}: {
  action: string;
  label: string;
  projectId?: string;
  isSignedIn?: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const config = ACTIONS[action];
  if (!config) return null;

  // Funnel anonymous visitors to sign-up instead of attempting a download that
  // would only fail at requireUser(). A free account unlocks the files + progress.
  if (!isSignedIn) {
    return (
      <div className="my-2 space-y-2">
        <Link href="/sign-in" className={BUTTON_CLASS}>
          ↓ Sign up to download
        </Link>
        <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
          Free account — download the files + track your progress
        </p>
      </div>
    );
  }

  function run() {
    start(async () => {
      setError(null);
      if (!projectId) {
        setError("Open this from a board to download.");
        return;
      }
      try {
        const url = await config.resolve(projectId);
        if (url) {
          window.open(url, "_blank", "noopener,noreferrer");
        } else {
          setError(config.notReady);
        }
      } catch {
        setError("Couldn't fetch the download — try again.");
      }
    });
  }

  return (
    <div className="my-2 space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={run}
        className={`${BUTTON_CLASS} disabled:opacity-50`}
      >
        ↓ {pending ? "Preparing…" : label}
      </button>
      {error && (
        <p className="font-mono text-xs uppercase tracking-wider text-alert-red">
          {error}
        </p>
      )}
    </div>
  );
}
