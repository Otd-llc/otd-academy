import Link from "next/link";

// The "print / export BOM" affordance for the BOM SOURCING stage — the bench
// shopping sheet. Styled after the bioscale-viz hex export chip (gold-glass,
// Space Mono caps, an icon that fills gold on hover) wearing the academy card
// idiom (the stage-card gradient + serif-italic lead). Links to the printable
// BOM route, which carries its own Print / Save-PDF button.
export function BomExportLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-xl border border-command-gold/30 [background:linear-gradient(180deg,#13131f_0%,#0d0e14_100%)] px-5 py-4 transition-colors hover:border-command-gold hover:bg-command-gold/[0.03]"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-command-gold/40 bg-command-gold/10 text-command-gold transition-colors group-hover:bg-command-gold group-hover:text-deep-space">
        <svg
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M6 9V3h12v6" />
          <path d="M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
          <rect x="6" y="14" width="12" height="7" rx="1" />
        </svg>
      </span>
      <span className="min-w-0">
        <span className="block font-mono text-xs font-bold uppercase tracking-[0.2em] text-command-gold group-hover:text-gold-light">
          Print / Export BOM
        </span>
        <span className="mt-1 block font-serif text-sm italic leading-relaxed text-gray-2">
          The bench shopping sheet — print it or save it as a PDF for your parts run.
        </span>
      </span>
      <span
        aria-hidden
        className="ml-auto shrink-0 font-mono text-lg text-command-gold transition-transform group-hover:translate-x-0.5"
      >
        →
      </span>
    </Link>
  );
}
