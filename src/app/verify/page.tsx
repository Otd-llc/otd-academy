// Public certificate verification — the credential-registry lookup terminal. A
// third party (e.g. an employer) enters the code printed on a certificate; we
// look it up in the issued-certificates table and return the record — recipient,
// board, date — plus a "view certificate" link (the token is re-signed from the
// stored fields, since we don't store it). No code → a specimen record showing
// what a verified code returns. Reachable signed-out (added to isPublicPath).
import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { signCardToken } from "@/lib/certificate-token";
import { levelFor } from "@/lib/logbook/economy";
import { BrandMark } from "@/components/BrandMark";
import { VerifyForm } from "@/components/verify/VerifyForm";

export const metadata: Metadata = {
  title: "Verify a certificate · One Thousand Drones Academy",
  description: "Confirm a One Thousand Drones Academy certificate by its code.",
};

// One record row: a mono gold label and its value, hairline-separated. Shared by
// the specimen (default) and the sealed record (a hit), so both read as the same
// registry record.
function Row({
  label,
  children,
}: {
  label: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-5 border-b border-command-gold/20 py-3 last:border-b-0">
      <dt className="shrink-0 font-mono text-[10px] uppercase tracking-[0.22em] text-command-gold">
        {label}
      </dt>
      <dd className="text-right font-mono text-[13px] leading-snug text-text">
        {children ?? <span className="text-muted">·</span>}
      </dd>
    </div>
  );
}

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
        flair?: { level: number; title: string; patches: number } | null;
      }
    | null
    | "notfound" = null;

  if (code) {
    const row = await db.certificate.findUnique({
      where: { code },
      select: { slug: true, name: true, variant: true, score: true, total: true, issuedAt: true, userId: true },
    });
    if (!row) {
      cert = "notfound";
    } else {
      const project = await db.project.findUnique({
        where: { slug: row.slug },
        select: { name: true },
      });
      const date = row.issuedAt.toISOString().slice(0, 10);

      // Logbook flair (design §13): the recipient's rating + earned patches, shown
      // only when above the defaults (a brand-new account adds nothing to the card).
      let flair: { level: number; title: string; patches: number } | null = null;
      if (row.userId) {
        const holder = await db.user.findUnique({
          where: { id: row.userId },
          select: { xpTotal: true, badges: { select: { badgeKey: true } } },
        });
        if (holder) {
          const lv = levelFor(holder.xpTotal);
          const patches = holder.badges.filter(
            (b) => b.badgeKey.startsWith("cluster:") || b.badgeKey.startsWith("wings:"),
          ).length;
          if (lv.level > 1 || patches > 0) {
            flair = { level: lv.level, title: lv.title, patches };
          }
        }
      }
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
        flair,
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
    <main className="relative isolate min-h-[90svh] overflow-hidden">
      {/* Corner registration brackets — the "official record" frame. */}
      <span aria-hidden="true" className="pointer-events-none absolute left-4 top-4 h-6 w-6 border-l border-t border-command-gold/40" />
      <span aria-hidden="true" className="pointer-events-none absolute right-4 top-4 h-6 w-6 border-r border-t border-command-gold/40" />
      <span aria-hidden="true" className="pointer-events-none absolute bottom-4 left-4 h-6 w-6 border-b border-l border-command-gold/40" />
      <span aria-hidden="true" className="pointer-events-none absolute bottom-4 right-4 h-6 w-6 border-b border-r border-command-gold/40" />

      <div className="relative mx-auto max-w-2xl px-5 py-16 sm:px-6">
        {/* Hero */}
        <div className="flex flex-col items-center text-center">
          <BrandMark className="h-12 w-12 text-command-gold" />
          <span className="mt-5 font-mono text-[11px] uppercase tracking-[0.4em] text-gold-dim">
            // Certificate registry
          </span>
          <h1 className="title-hero mt-3">
            Verify a <span className="accent">certificate</span>
            <span className="tdot">.</span>
          </h1>
          <p className="mt-4 max-w-md font-serif text-[15px] leading-relaxed text-text">
            Every certificate is recorded the moment it is issued. Enter the code
            from one to confirm who earned it, the board they built, and when.
          </p>
        </div>

        {/* The query terminal. */}
        <VerifyForm initialCode={code} />

        {/* Default: a specimen of the record a code returns. */}
        {!code && (
          <section className="mx-auto mt-12 max-w-md border-t border-command-gold/30 pt-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-command-gold">
              What a verified code returns
            </p>
            <dl className="mt-4">
              <Row label="Recipient" />
              <Row label="Board" />
              <Row label="Program" />
              <Row label="Issued" />
              <Row label="Exam score" />
              <Row label="Status" />
            </dl>
            <p className="mt-5 border-t border-panel-border pt-4 font-mono text-[11px] leading-relaxed tracking-wider text-muted">
              Codes look like OTD-A1B2-C3D4 and are printed on every certificate
              and its PDF.
            </p>
          </section>
        )}

        {/* No match. */}
        {cert === "notfound" && (
          <section className="mx-auto mt-10 max-w-md border-t border-alert-red/40 pt-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-alert-red">
                ✕ No match
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                {code}
              </span>
            </div>
            <p className="mt-4 font-serif text-sm leading-relaxed text-text">
              No certificate is registered under that code. Check the characters
              and try again. A real code looks like{" "}
              <span className="font-mono text-text">OTD-A1B2-C3D4</span>.
            </p>
          </section>
        )}

        {/* A hit: the sealed record. */}
        {cert && cert !== "notfound" && (
          <section className="mx-auto mt-10 max-w-md border-t border-command-gold/40 pt-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-status-green">
                ✓ Authentic
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                {code}
              </span>
            </div>

            <div className="mt-7 flex flex-col items-center text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/seal.png"
                alt=""
                width={84}
                height={84}
                className="h-[84px] w-[84px] drop-shadow-[0_0_20px_color-mix(in_srgb,var(--color-command-gold)_35%,transparent)]"
              />
              <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.3em] text-gold-dim">
                {cert.variant === "cert"
                  ? "Verified Certificate of Achievement"
                  : "Lesson Complete"}
              </p>
              <p className="title-section mt-2">{cert.name}</p>
            </div>

            <dl className="mt-7">
              <Row label="Board">{cert.board}</Row>
              <Row label="Issued">{fmtDate(cert.date)}</Row>
              {hasScore ? (
                <Row label="Exam score">
                  <span className="font-numeral text-base tabular-nums tracking-wide text-command-gold">
                    {cert.score}/{cert.total}
                  </span>
                </Row>
              ) : null}
              {cert.flair ? (
                <Row label="Logbook">
                  <span className="font-numeral text-base tabular-nums tracking-wide text-command-gold">
                    FL{cert.flair.level} {cert.flair.title.toUpperCase()}
                    {cert.flair.patches > 0
                      ? ` · ${cert.flair.patches} ${cert.flair.patches === 1 ? "PATCH" : "PATCHES"}`
                      : ""}
                  </span>
                </Row>
              ) : null}
            </dl>

            <div className="mt-6">
              <Link
                href={`/learn/${cert.slug}/certificate/${cert.token}`}
                className="glass-button glass-button-cta block px-6 py-2.5 text-center font-mono text-xs uppercase tracking-[0.18em]"
              >
                View certificate →
              </Link>
            </div>
          </section>
        )}

        {/* Authority — the registry is run by a verifiable, registered entity. */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 border-t border-panel-border/50 pt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
          <span className="inline-flex items-center gap-2 text-muted">
            <BrandMark className="h-3.5 w-3.5 text-command-gold" />
            One Thousand Drones
          </span>
          <span className="text-panel-border">·</span>
          <span>
            <span className="text-command-gold">SAM.gov</span> registered
          </span>
          <span className="text-panel-border">·</span>
          <span>
            <span className="text-command-gold">CAGE</span> 1ZYS4
          </span>
        </div>
      </div>
    </main>
  );
}
