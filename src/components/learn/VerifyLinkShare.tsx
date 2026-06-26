"use client";

// "Share verification link" for a certificate. The holder sends the link to an
// employer, who opens it and sees the certificate confirmed with no code to type
// (the code is in the URL). The code is also shown for manual entry on /verify.
import { useState } from "react";

export function VerifyLinkShare({
  code,
  verifyUrl,
}: {
  code: string;
  verifyUrl: string;
}) {
  const [copied, setCopied] = useState<"link" | "code" | null>(null);

  async function copy(text: string, which: "link" | "code") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // clipboard blocked — the value stays on screen to copy by hand
    }
  }

  async function shareLink() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "Verify my One Thousand Drones Academy certificate",
          url: verifyUrl,
        });
        return;
      } catch {
        // cancelled or unsupported → fall through to copy
      }
    }
    copy(verifyUrl, "link");
  }

  return (
    <div className="w-full max-w-md rounded-lg border border-panel-border bg-navy-dark/40 p-5 text-left">
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-command-gold">
        Verification
      </p>
      <p className="mt-2 font-serif text-sm leading-relaxed text-gray-2">
        Send this link to an employer. They can confirm your certificate with one
        click, no code to enter.
      </p>

      <button
        type="button"
        onClick={shareLink}
        className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded border border-command-gold bg-command-gold px-5 py-2.5 font-mono text-xs uppercase tracking-[0.16em] text-deep-space transition-colors hover:bg-gold-light"
      >
        {copied === "link" ? "✓ Link copied" : "⇗ Share verification link"}
      </button>

      <div className="mt-3 flex items-stretch gap-2">
        <span className="flex min-w-0 flex-1 items-center justify-center rounded border border-panel-border bg-deep-space px-3 py-2 font-mono text-sm tracking-[0.16em] text-gray-1">
          {code}
        </span>
        <button
          type="button"
          onClick={() => copy(code, "code")}
          className="shrink-0 rounded border border-panel-border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-gray-2 transition-colors hover:border-command-gold hover:text-command-gold"
        >
          {copied === "code" ? "✓" : "Copy code"}
        </button>
      </div>
      <p className="mt-2 font-mono text-[10px] tracking-wider text-muted">
        Or they can enter this code at {verifyHost(verifyUrl)}
      </p>
    </div>
  );
}

function verifyHost(url: string): string {
  try {
    const u = new URL(url);
    return `${u.host}/verify`;
  } catch {
    return "/verify";
  }
}
