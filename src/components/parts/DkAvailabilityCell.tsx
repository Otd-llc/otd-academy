// DigiKey availability cell for the parts catalog (watchdog). Shows live stock
// qty + a status badge + how long ago it was checked. Pure presentational; the
// status/label come from the shared assessor so the catalog matches the BOM
// chips + board-readiness. Used by both the desktop table (page.tsx) and the
// mobile PartCard.
import { assessPartAvailability, availabilityBadge } from "@/lib/part-availability";

const TONE_CLASS: Record<string, string> = {
  green: "bg-signal-blue/15 text-signal-blue",
  amber: "bg-command-gold/15 text-command-gold",
  red: "bg-alert-red/15 text-alert-red",
  grey: "bg-navy-dark text-muted",
};

function relativeAge(from: Date, now: Date): string {
  const secs = Math.max(0, Math.round((now.getTime() - from.getTime()) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

export interface DkSnapshotFields {
  dkStockQty: number | null;
  dkInStock: boolean | null;
  dkLifecycle: string | null;
  dkCheckedAt: Date | null;
}

export function DkAvailabilityCell({ part }: { part: DkSnapshotFields }) {
  if (part.dkCheckedAt == null) {
    return <span className="text-muted">never checked</span>;
  }
  const now = new Date();
  const { status } = assessPartAvailability(
    { dkInStock: part.dkInStock, dkLifecycle: part.dkLifecycle, dkCheckedAt: part.dkCheckedAt },
    now,
  );
  const { label, tone, title } = availabilityBadge(status);
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5" title={title}>
      <span
        className={`inline-flex items-center rounded px-1 py-px font-mono text-[10px] font-bold uppercase tracking-wider ${TONE_CLASS[tone]}`}
      >
        {label}
      </span>
      {part.dkStockQty != null ? (
        <span className="font-mono text-xs text-muted">
          {part.dkStockQty.toLocaleString()} in stock
        </span>
      ) : null}
      <span className="font-mono text-[10px] text-muted">{relativeAge(part.dkCheckedAt, now)}</span>
    </span>
  );
}
