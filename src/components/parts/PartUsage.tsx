// "Used in" — the public cross-reference from a part to the lessons/boards whose
// BOM includes it (resolved by `getPartUsageRows` + `summarizePartUsage`). Server
// component; renders nothing when the part isn't on any public project's BOM, so
// a catalog-only part stays clean. Each row links to the project's guide hub and
// lists the reference designators it fills there.
import Link from "next/link";
import type { PartUsageEntry } from "@/lib/part-usage";

export function PartUsage({ entries }: { entries: PartUsageEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <section className="mb-10 space-y-3">
      <h2 className="font-display text-2xl tracking-wider text-title">Used in</h2>
      <ul className="space-y-2">
        {entries.map((e) => (
          <li
            key={e.href}
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-panel-border pb-2"
          >
            <Link
              href={e.href}
              className="text-signal-blue underline decoration-dotted underline-offset-2 hover:text-command-gold"
            >
              {e.title}
            </Link>
            <span className="font-mono text-xs text-muted">{e.refDes}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
