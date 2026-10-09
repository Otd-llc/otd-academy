"use client";

// Share + Download controls for the certificate. Download pulls the premium PDF;
// Share uses the native share sheet when available (mobile) and falls back to
// copying the public share link. Used on the share page, the certificate reveal,
// and the complete screen.
import { useState } from "react";
import { trackFileDownload, trackShare } from "@/lib/analytics-client";

// The course slug, from a share path like /learn/<slug>/certificate/<token>.
// Only the slug: the token is the learner's name.
function slugOf(shareUrl: string): string | undefined {
  return shareUrl.match(/\/learn\/([^/]+)\/certificate\//)?.[1];
}

export function ShareCard({
  downloadUrl,
  shareUrl,
  title,
  compact = false,
}: {
  downloadUrl: string;
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
        trackShare({ method: "native", contentType: "certificate", itemId: slugOf(shareUrl) });
        return;
      } catch {
        // user cancelled or share failed → fall through to copy
      }
    }
    try {
      await navigator.clipboard.writeText(absolute);
      trackShare({ method: "copy_link", contentType: "certificate", itemId: slugOf(shareUrl) });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked — leave the link visible for manual copy
    }
  }

  const btn =
    "glass-button inline-flex items-center justify-center gap-1.5 px-5 py-2.5 font-mono text-xs uppercase tracking-[0.16em]";

  return (
    <div className={compact ? "flex flex-wrap items-center justify-center gap-2" : "flex flex-wrap items-center justify-center gap-3"}>
      <a
        href={downloadUrl}
        download="otd-certificate.pdf"
        onClick={() =>
          trackFileDownload({ fileName: "certificate", fileExtension: "pdf", linkUrl: downloadUrl })
        }
        className={`${btn} glass-button-cta`}
      >
        ↓ Download PDF
      </a>
      <button
        type="button"
        onClick={share}
        className={btn}
      >
        {copied ? "✓ Link copied" : "⇗ Share"}
      </button>
    </div>
  );
}
