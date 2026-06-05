// Server-rendered pager. Prev/Next are partsHref links built with an explicit
// `{ page: String(page±1) }` patch — so the page key is always present and the
// href always carries `page=N` (including `page=1`). Returns null when there's
// only a single page. Disabled ends render as plain spans (no href).
import Link from "next/link";
import { partsHref } from "@/lib/parts-list-url";

export function PartsPagination({
  page,
  totalPages,
  current,
}: {
  page: number;
  totalPages: number;
  current: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;
  const cls =
    "rounded border border-panel-border bg-navy-dark px-3 py-1 font-mono text-xs uppercase tracking-wider";
  const prev =
    page > 1 ? partsHref(current, { page: String(page - 1) }) : null;
  const next =
    page < totalPages ? partsHref(current, { page: String(page + 1) }) : null;
  return (
    <nav
      className="mt-8 flex items-center justify-between gap-4"
      aria-label="Parts pages"
    >
      {prev ? (
        <Link href={prev} className={`${cls} text-command-gold`}>
          ← Prev
        </Link>
      ) : (
        <span className={`${cls} text-muted opacity-50`}>← Prev</span>
      )}
      <span className="font-mono text-xs uppercase tracking-wider text-muted">
        Page {page} of {totalPages}
      </span>
      {next ? (
        <Link href={next} className={`${cls} text-command-gold`}>
          Next →
        </Link>
      ) : (
        <span className={`${cls} text-muted opacity-50`}>Next →</span>
      )}
    </nav>
  );
}
