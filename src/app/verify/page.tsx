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

  return (
    <main className="mx-auto flex min-h-[70svh] max-w-2xl flex-col items-center gap-8 px-4 py-16 sm:px-6">
      <BrandMark className="h-12 w-12 text-command-gold" />
      <div className="text-center">
        <span className="font-mono text-[11px] uppercase tracking-[0.4em] text-gold-dim">
          // Certificate verification
        </span>
        <h1 className="mt-3 font-display text-3xl tracking-wider text-gray-1">
          Verify a certificate
        </h1>
        <p className="mt-2 font-serif text-sm italic text-gray-2">
          Enter the code printed on the certificate (e.g. OTD-A1B2-C3D4).
        </p>
      </div>

      <form method="get" className="flex w-full max-w-md flex-wrap items-center justify-center gap-3">
        <input
          type="text"
          name="code"
          defaultValue={code ?? ""}
          placeholder="OTD-XXXX-XXXX"
          autoCapitalize="characters"
          className="flex-1 rounded border border-panel-border bg-navy-dark px-4 py-2.5 font-mono text-sm uppercase tracking-[0.16em] text-gray-1 outline-none placeholder:text-muted focus:border-command-gold"
        />
        <button
          type="submit"
          className="glass-button glass-button-cta px-6 py-2.5 font-mono text-xs uppercase tracking-[0.18em]"
        >
          Verify
        </button>
      </form>

      {cert === "notfound" && (
        <div className="w-full max-w-md rounded border border-alert-red/40 bg-navy-dark p-5 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-alert-red">
            ✕ No certificate found
          </p>
          <p className="mt-2 font-serif text-sm text-gray-2">
            We couldn&rsquo;t find a certificate with the code{" "}
            <span className="font-mono text-gray-1">{code}</span>. Check the code and try again.
          </p>
        </div>
      )}

      {cert && cert !== "notfound" && (
        <div className="w-full max-w-lg rounded border border-command-gold/40 bg-navy-dark p-6 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-status-green">
            ✓ Valid certificate
          </p>
          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.3em] text-gold-dim">
            {cert.variant === "cert" ? "Verified Certificate of Achievement" : "Lesson Complete"}
          </p>
          <p className="mt-2 font-display text-2xl tracking-wide text-gray-1">{cert.name}</p>
          <p className="mt-1 font-serif text-sm italic text-gray-2">
            {cert.variant === "cert" ? "earned this certificate for building" : "built"} {cert.board}
          </p>
          <dl className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 font-mono text-[11px] uppercase tracking-wider text-muted">
            <span>Issued {fmtDate(cert.date)}</span>
            {cert.variant === "cert" && typeof cert.score === "number" && typeof cert.total === "number" && (
              <span>Exam {cert.score}/{cert.total}</span>
            )}
            <span>ID {code}</span>
          </dl>
          <Link
            href={`/learn/${cert.slug}/certificate/${cert.token}`}
            className="glass-button mt-5 inline-block px-6 py-2.5 font-mono text-xs uppercase tracking-[0.18em]"
          >
            View certificate →
          </Link>
        </div>
      )}
    </main>
  );
}
