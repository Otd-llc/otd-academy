// Public share page for a completion / certificate card. Reachable signed-OUT
// (proxy allows /learn/*/certificate/* — the signed token is the gate). Shows the
// card image + Share/Download, and sets og:image so a pasted link previews the
// card. An invalid/forged token → notFound (no card to show).
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { verifyCardToken } from "@/lib/certificate-token";
import { certificateId } from "@/lib/certificate-id";
import { siteUrl } from "@/lib/seo/jsonld";
import { ShareCard } from "@/components/learn/ShareCard";
import { VerifyLinkShare } from "@/components/learn/VerifyLinkShare";

type Params = { slug: string; token: string };

function imagePath(slug: string, token: string) {
  return `/learn/${slug}/certificate/${token}/image`;
}
function pdfPath(slug: string, token: string) {
  return `/learn/${slug}/certificate/${token}/pdf`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug, token } = await params;
  const claims = verifyCardToken(token);
  if (!claims) return { title: "One Thousand Drones Academy" };

  const isCert = claims.variant === "cert";
  const title = isCert
    ? `${claims.name} — Verified Certificate of Achievement`
    : `${claims.name} — Lesson Complete`;
  const description = isCert
    ? `${claims.name} earned a Verified Certificate of Achievement at One Thousand Drones Academy.`
    : `${claims.name} built a real board at One Thousand Drones Academy.`;
  const image = `${siteUrl()}${imagePath(slug, token)}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: image, width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function CertificateSharePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug, token } = await params;
  const claims = verifyCardToken(token);
  if (!claims) notFound();

  const isCert = claims.variant === "cert";
  const heading = isCert
    ? "Verified Certificate of Achievement"
    : "Lesson Complete";

  return (
    <main className="mx-auto flex max-w-3xl flex-col items-center gap-8 px-4 py-16 text-center sm:px-6">
      <span className="font-mono text-[11px] uppercase tracking-[0.4em] text-gold-dim">
        // {heading}
      </span>
      {/* Display the certificate as an image (renders reliably everywhere); the
          Download button pulls the print-quality PDF. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- dynamic certificate PNG, not a static asset */}
      <img
        src={imagePath(slug, token)}
        alt={`${heading} — ${claims.name}`}
        width={1200}
        height={848}
        className="w-full max-w-3xl rounded-lg border border-panel-border shadow-lg"
      />
      <ShareCard
        downloadUrl={pdfPath(slug, token)}
        shareUrl={`${siteUrl()}/learn/${slug}/certificate/${token}`}
        title={heading}
      />
      <VerifyLinkShare
        code={certificateId(token)}
        verifyUrl={`${siteUrl()}/verify?code=${certificateId(token)}`}
      />
      <Link
        href="/courses"
        className="font-mono text-xs uppercase tracking-[0.2em] text-gray-3 transition-colors hover:text-command-gold"
      >
        Build your own → One Thousand Drones Academy
      </Link>
    </main>
  );
}
