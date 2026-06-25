// Public certificate verification. A third party (e.g. an employer) enters the
// code printed on a certificate; we look it up in the issued-certificates table
// and confirm it — recipient, lesson, date — and offer a "view certificate" link
// (the token is re-signed from the stored fields, since we don't store it). No
// code → just the lookup form. Reachable signed-out (added to isPublicPath).
import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { signCardToken } from "@/lib/certificate-token";
import { BrandMark } from "@/components/BrandMark";

export const metadata: Metadata = {
  title: "Verify a certificate · One Thousand Drones Academy",
  description: "Confirm a One Thousand Drones Academy certificate by its code.",
};

// Honeycomb field (matches the capability briefs and the certificate itself).
const HONEYCOMB =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='49' viewBox='0 0 28 49'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c8963e' fill-opacity='0.04'%3E%3Cpath d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.9v12.7l10.99 6.34 11-6.35V17.9l-11-6.34L3 17.9zM0 15l12.98-7.5V0h-2v6.35L0 12.69v2.3zm0 18.5L12.98 41v8h-2v-6.85L0 35.81v-2.3zM15 0v7.5L27.99 15H28v-2.31h-.01L17 6.35V0h-2zm0 49v-8l12.99-7.5H28v2.31h-.01L17 42.15V49h-2z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const code = (await searchParams).code?.trim().toUpperCase();

  let cert:
    | {
        name: string;
        board: string;
        variant: string;
        score: number | null;
        total: number | null;
        date: string;
        token: string;
        slug: string;
      }
    | null
    | "notfound" = null;

  if (code) {
    const row = await db.certificate.findUnique({
      where: { code },
      select: { slug: true, name: true, variant: true, score: true, total: true, issuedAt: true },
    });
    if (!row) {
      cert = "notfound";
    } else {
      const project = await db.project.findUnique({
        where: { slug: row.slug },
        select: { name: true },
      });
      const date = row.issuedAt.toISOString().slice(0, 10);
      const token = signCardToken({
        slug: row.slug,
        name: row.name,
        variant: row.variant as "cert" | "done",
        score: row.score ?? undefined,
        total: row.total ?? undefined,
        date,
      });
      cert = {
        name: row.name,
        board: project?.name ?? row.slug,
        variant: row.variant,
        score: row.score,
        total: row.total,
        date,
        token,
        slug: row.slug,
      };
    }
  }

  const fmtDate = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });

  const hasScore =
    cert && cert !== "notfound" &&
    cert.variant === "cert" &&
    typeof cert.score === "number" &&
    typeof cert.total === "number";

  return (
    <main className="relative isolate min-h-[88svh] overflow-hidden bg-deep-space">
      {/* Honeycomb field + corner brackets, to match the briefs and certificate. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ backgroundImage: HONEYCOMB, backgroundSize: "104px auto" }}
      />
      <span aria-hidden="true" className="pointer-events-none absolute left-4 top-4 h-6 w-6 border-l border-t border-command-gold/40" />
      <span aria-hidden="true" className="pointer-events-none absolute right-4 top-4 h-6 w-6 border-r border-t border-command-gold/40" />
      <span aria-hidden="true" className="pointer-events-none absolute bottom-4 left-4 h-6 w-6 border-b border-l border-command-gold/40" />
      <span aria-hidden="true" className="pointer-events-none absolute bottom-4 right-4 h-6 w-6 border-b border-r border-command-gold/40" />

      <div className="relative mx-auto max-w-2xl px-5 py-16 sm:px-6">
        {/* Hero */}
        <div className="flex flex-col items-center text-center">
          <BrandMark className="h-12 w-12 text-command-gold" />
          <span className="mt-5 font-mono text-[11px] uppercase tracking-[0.4em] text-gold-dim">
            // Certificate verification
          </span>
          <h1 className="mt-3 font-display text-5xl tracking-wide text-gray-1">
            Verify a certificate
          </h1>
          <p className="mt-3 max-w-md font-serif text-[15px] leading-relaxed text-gray-2">
            Every certificate is recorded the moment it is issued. Enter the code
            from one to confirm who earned it, the board they built, and when.
          </p>
        </div>

        {/* Lookup */}
        <form
          method="get"
          className="mx-auto mt-8 flex w-full max-w-md flex-wrap items-center justify-center gap-3"
        >
          <input
            type="text"
            name="code"
            defaultValue={code ?? ""}
            placeholder="OTD-XXXX-XXXX"
            autoCapitalize="characters"
            aria-label="Certificate code"
            className="min-w-0 flex-1 rounded border border-panel-border bg-navy-dark/80 px-4 py-3 text-center font-mono text-sm uppercase tracking-[0.22em] text-gray-1 outline-none placeholder:text-muted focus:border-command-gold"
          />
          <button
            type="submit"
            className="glass-button glass-button-cta px-7 py-3 font-mono text-xs uppercase tracking-[0.18em]"
          >
            Verify
          </button>
        </form>

        {/* Default: what a code confirms (the selling point, stated plainly). */}
        {!code && (
          <div className="mx-auto mt-12 max-w-md rounded-md border border-panel-border bg-navy-dark/40 p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-command-gold">
              What a code confirms
            </p>
            <ul className="mt-4 space-y-3 font-serif text-[15px] leading-snug text-gray-2">
              <li className="flex gap-3">
                <span className="text-command-gold">→</span>
                The name of the person who earned it.
              </li>
              <li className="flex gap-3">
                <span className="text-command-gold">→</span>
                The board they designed and the program it belongs to.
              </li>
              <li className="flex gap-3">
                <span className="text-command-gold">→</span>
                The date it was issued, and the exam score where one was taken.
              </li>
            </ul>
            <p className="mt-5 border-t border-panel-border pt-4 font-mono text-[11px] leading-relaxed tracking-wider text-muted">
              Codes look like OTD-A1B2-C3D4 and are printed on every certificate and
              its PDF.
            </p>
          </div>
        )}

        {/* Not found */}
        {cert === "notfound" && (
          <div className="mx-auto mt-10 max-w-md rounded-md border border-alert-red/40 bg-navy-dark/60 p-6 text-center">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-alert-red">
              ✕ No certificate found
            </p>
            <p className="mt-2 font-serif text-sm text-gray-2">
              We couldn&rsquo;t find a certificate with the code{" "}
              <span className="font-mono text-gray-1">{code}</span>. Check it and try
              again.
            </p>
          </div>
        )}

        {/* Valid: a sealed, official-looking record. */}
        {cert && cert !== "notfound" && (
          <div className="mx-auto mt-10 max-w-lg overflow-hidden rounded-md border border-command-gold/40 bg-navy-dark/70 shadow-[0_0_60px_-20px_rgba(200,150,62,0.4)]">
            <div className="flex items-center justify-between border-b border-command-gold/25 px-5 py-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-status-green">
                ✓ Authentic
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                ID {code}
              </span>
            </div>
            <div className="flex flex-col items-center px-6 py-8 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/seal.png"
                alt=""
                width={88}
                height={88}
                className="h-[88px] w-[88px] drop-shadow-[0_0_20px_rgba(200,150,62,0.35)]"
              />
              <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.3em] text-gold-dim">
                {cert.variant === "cert"
                  ? "Verified Certificate of Achievement"
                  : "Lesson Complete"}
              </p>
              <p className="mt-2 font-display text-4xl tracking-wide text-gray-1">
                {cert.name}
              </p>
              <p className="mt-2 font-serif text-[15px] italic text-gray-2">
                {cert.variant === "cert"
                  ? "earned this certificate for building"
                  : "built"}{" "}
                {cert.board}
              </p>
              <dl className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-1.5 font-mono text-[11px] uppercase tracking-wider text-muted">
                <span>Issued {fmtDate(cert.date)}</span>
                {hasScore && (
                  <span>
                    Exam {cert.score}/{cert.total}
                  </span>
                )}
              </dl>
              <Link
                href={`/learn/${cert.slug}/certificate/${cert.token}`}
                className="glass-button glass-button-cta mt-6 inline-block px-6 py-2.5 font-mono text-xs uppercase tracking-[0.18em]"
              >
                View certificate →
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
