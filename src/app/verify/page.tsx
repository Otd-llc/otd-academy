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
import { VerifyForm } from "@/components/verify/VerifyForm";

export const metadata: Metadata = {
  title: "Verify a certificate · One Thousand Drones Academy",
  description: "Confirm a One Thousand Drones Academy certificate by its code.",
};

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

      <div className="relative mx-auto max-w-2xl px-5 py-16 sm:px-6">
        {/* Hero */}
        <div className="flex flex-col items-center text-center">
          <BrandMark className="h-12 w-12 text-command-gold" />
          <span className="mt-5 font-mono text-[11px] uppercase tracking-[0.4em] text-gold-dim">
            // Certificate verification
          </span>
          <h1 className="mt-3 title-hero">
            Verify a certificate
          </h1>
          <p className="mt-3 max-w-md font-serif text-[15px] leading-relaxed text-text">
            Every certificate is recorded the moment it is issued. Enter the code
            from one to confirm who earned it, the board they built, and when.
          </p>
        </div>

        {/* Lookup — type just the 8 characters; OTD- and the dash are added. */}
        <VerifyForm initialCode={code} />

        {/* Default: what a code confirms (the selling point, stated plainly). */}
        {!code && (
          <div className="mx-auto mt-12 max-w-md rounded-md border border-panel-border bg-navy-dark/40 p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-command-gold">
              What a code confirms
            </p>
            <ul className="mt-4 space-y-3 font-serif text-[15px] leading-snug text-text">
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
            <p className="mt-2 font-serif text-sm text-text">
              We couldn&rsquo;t find a certificate with the code{" "}
              <span className="font-mono text-text">{code}</span>. Check it and try
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
              <p className="mt-2 title-section">
                {cert.name}
              </p>
              <p className="mt-2 font-serif text-[15px] italic text-text">
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
