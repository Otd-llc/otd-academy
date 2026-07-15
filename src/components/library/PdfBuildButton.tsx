"use client";

// A download button for the Library PDFs that makes the "built fresh to order"
// nature legible. Each PDF is rendered live from the current content on request
// (never a stale cached export), so there's a short build wait — this button owns
// that wait: it opens a blank tab synchronously (so no popup blocker), fetches the
// PDF (the spinner is tied to the REAL completion), then points the tab at the
// blob. A toast explains the fresh-build + asks for a moment's patience.
import { useState } from "react";
import { createPortal } from "react-dom";

function Spinner({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={`shrink-0 animate-spin ${className}`} fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

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

function BuildToast() {
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[70] flex justify-center px-4" role="status" aria-live="polite">
      <div className="pointer-events-auto flex max-w-md items-center gap-3 rounded-[8px] border border-command-gold/30 bg-deep-space px-4 py-3 [box-shadow:var(--elev-card)]">
        <span className="text-command-gold">
          <Spinner className="h-5 w-5" />
        </span>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-command-gold">
            ▸ Building your PDF
          </p>
          <p className="mt-0.5 font-serif text-[13px] leading-snug text-muted">
            Rendered fresh from the live content, so it&apos;s never stale. Give it a few seconds.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function PdfBuildButton({
  href,
  label,
  className = "",
}: {
  href: string;
  label: string;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "building" | "error">("idle");

  async function go() {
    if (state === "building") return;
    setState("building");
    // Open the target tab SYNCHRONOUSLY inside the click handler so the browser
    // doesn't treat the post-fetch open as an unrequested popup and block it.
    const tab = window.open("", "_blank");
    try {
      // no-store: each PDF is built fresh, so never serve a cached (possibly stale)
      // copy from a prior download.
      const res = await fetch(href, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (tab) {
        tab.location.href = url;
      } else {
        // Popup blocked: fall back to a same-gesture download.
        const a = document.createElement("a");
        a.href = url;
        a.rel = "noopener";
        a.target = "_blank";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setState("idle");
    } catch {
      tab?.close();
      setState("error");
    }
  }

  const buttonClass = `glass-button inline-flex items-center gap-2 px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] disabled:opacity-80 ${className}`;

  return (
    <>
      <button type="button" onClick={go} disabled={state === "building"} className={buttonClass}>
        {label}
        {state === "building" ? <Spinner /> : <DownloadGlyph />}
      </button>
      {state === "building" ? <BuildToast /> : null}
      {state === "error" ? (
        <span className="ml-2 font-mono text-[10px] uppercase tracking-wide text-alert-red">
          Failed · retry
        </span>
      ) : null}
    </>
  );
}
