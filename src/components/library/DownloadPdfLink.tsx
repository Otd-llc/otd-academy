// The "share / download" affordance for the Library PDFs. The PDF is generated
// live from the same content the page renders, so this link IS the shareable,
// always-current artifact (no separate export, no drift). Opens in a new tab
// (the route serves it inline), so the reader can view, save, or share it.
//
// A gold-outline action (glass-button) — sanctioned for an action even on a
// content surface; the brand's gold ladder, restrained radius, mono label.
import Link from "next/link";

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

export function DownloadPdfLink({
  href,
  label,
  className = "",
}: {
  href: string;
  label: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener"
      prefetch={false}
      className={`glass-button inline-flex items-center gap-2 px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] ${className}`}
    >
      {label}
      <DownloadGlyph />
    </Link>
  );
}
