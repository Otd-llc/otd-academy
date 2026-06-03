// Trust-state badge for a PartFact group (design §6). Pure presentational, so
// it is safe in both the server detail page and the FactGroupCard client island.
//
//   • UNVERIFIED → muted/gray (the resting state of a freshly-curated fact)
//   • VERIFIED   → command-gold (passed the gate; shows verifier + date)
//   • FLAGGED    → alert-red (disputed; excluded from all retrieval)
//
// The verifier/date line renders only for VERIFIED rows that carry the
// stamp — it is the human-readable receipt of the gate having been cleared.

import type { FactTrust } from "@prisma/client";

const TONE: Record<FactTrust, { box: string; label: string }> = {
  UNVERIFIED: {
    box: "border-panel-border bg-navy-dark text-muted",
    label: "UNVERIFIED",
  },
  VERIFIED: {
    box: "border-command-gold bg-navy-dark text-command-gold",
    label: "VERIFIED",
  },
  FLAGGED: {
    box: "border-alert-red bg-navy-dark text-alert-red",
    label: "FLAGGED",
  },
};

function formatDate(d: Date): string {
  // Stable, locale-independent YYYY-MM-DD so server and client render the same
  // string (avoids a hydration mismatch from toLocaleDateString).
  return d.toISOString().slice(0, 10);
}

export function VerifyBadge({
  trust,
  verifierName,
  verifiedAt,
}: {
  trust: FactTrust;
  /** Display name/email of the verifier (VERIFIED only). */
  verifierName?: string | null;
  /** When the fact was verified (VERIFIED only). */
  verifiedAt?: Date | string | null;
}) {
  const tone = TONE[trust];
  const verifiedDate =
    trust === "VERIFIED" && verifiedAt
      ? formatDate(verifiedAt instanceof Date ? verifiedAt : new Date(verifiedAt))
      : null;

  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`inline-flex items-center rounded border px-2 py-0.5 font-mono text-xs uppercase tracking-wider ${tone.box}`}
      >
        {tone.label}
      </span>
      {verifiedDate ? (
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
          {verifierName ? `${verifierName} · ` : ""}
          {verifiedDate}
        </span>
      ) : null}
    </span>
  );
}
