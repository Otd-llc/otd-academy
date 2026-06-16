"use client";

// Share + Download controls for the completion / certificate card. Download pulls
// the PNG straight from the image route; Share uses the native share sheet when
// available (mobile) and falls back to copying the public share link. Used on the
// share page, the certificate reveal, and the complete screen.
import { useState } from "react";

export function ShareCard({
  imageUrl,
  shareUrl,
  title,
  compact = false,
}: {
  imageUrl: string;
  shareUrl: string;
  title: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    // Resolve a relative share path to an absolute URL at click time, so callers
    // (client components without siteUrl) can pass `/learn/...`.
    const absolute = shareUrl.startsWith("/")
      ? `${window.location.origin}${shareUrl}`
      : shareUrl;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url: absolute });
        return;
      } catch {
        // user cancelled or share failed → fall through to copy
      }
    }
    try {
      await navigator.clipboard.writeText(absolute);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked — leave the link visible for manual copy
    }
  }

  const btn =
    "inline-flex items-center justify-center gap-1.5 rounded border px-5 py-2.5 font-mono text-xs uppercase tracking-[0.16em] transition-colors";

  return (
    <div className={compact ? "flex flex-wrap items-center justify-center gap-2" : "flex flex-wrap items-center justify-center gap-3"}>
      <a
        href={imageUrl}
        download={`otd-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`}
        className={`${btn} border-command-gold bg-command-gold text-deep-space hover:bg-gold-light`}
      >
        ↓ Download
      </a>
      <button
        type="button"
        onClick={share}
        className={`${btn} border-command-gold bg-navy-dark text-command-gold hover:bg-command-gold hover:text-deep-space`}
      >
        {copied ? "✓ Link copied" : "⇗ Share"}
      </button>
    </div>
  );
}
