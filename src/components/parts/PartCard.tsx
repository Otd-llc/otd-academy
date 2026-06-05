// src/components/parts/PartCard.tsx
// Mobile (< md) card for one part row. Desktop uses the table in page.tsx.
import Link from "next/link";
import type { PartsListRow } from "@/lib/parts-list";
import { PartGlanceTrigger } from "@/components/parts/PartGlanceTrigger";

export function PartCard({ part: p }: { part: PartsListRow }) {
  return (
    <li className="glass-card flex flex-col gap-2 p-4 font-mono text-sm">
      <div className="flex items-start justify-between gap-3">
        <Link href={`/parts/${p.id}`} className="text-command-gold underline-offset-2 hover:underline">
          {p.mpn}
        </Link>
        <PartGlanceTrigger partId={p.id} mpn={p.mpn} />
      </div>
      <p className="text-link-muted">{p.manufacturer}</p>
      <p className="text-link-muted">{p.description}</p>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <span>{p.category ?? "—"}</span>
        <span>·</span>
        <span>{p.lifecycle}</span>
        {p.isCertifiedModule && (
          <span className="rounded border border-panel-border bg-navy-dark px-2 py-0.5 uppercase tracking-wider text-alert-red">
            CERTIFIED MODULE
          </span>
        )}
      </div>
    </li>
  );
}
