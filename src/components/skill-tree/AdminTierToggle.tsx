"use client";

// Admin-only inline access-tier toggle (skill-tree Task 10). A tiny <select>
// rendered in the SkillNodeCard footer ONLY when the viewer is an admin (the
// server card decides that via `viewer.isAdmin`; the action re-checks
// `requireAdmin` — defense in depth). Picking a tier calls
// `setProjectAccessTier`, then `router.refresh()` so the revalidated tree
// (revalidatePath("/courses")) re-renders with the new tier.
//
// This control lives inside a card that is otherwise a <Link>/<div>; we stop
// click/keydown propagation on the wrapper so toggling never triggers the
// card's navigation.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setProjectAccessTier } from "@/lib/actions/project-visibility";

type Tier = "PUBLIC" | "FREE" | "PREMIUM";
const TIERS: readonly Tier[] = ["PUBLIC", "FREE", "PREMIUM"];

export function AdminTierToggle({ slug, tier }: { slug: string; tier: Tier }) {
  const [current, setCurrent] = useState<Tier>(tier);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div
      // The card wraps this in a <Link>; keep clicks/keys on the control from
      // bubbling up into a navigation.
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      className="mt-2 flex items-center gap-2 border-t border-panel-border pt-2"
    >
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
        Tier
      </span>
      <select
        aria-label={`Access tier for ${slug}`}
        value={current}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as Tier;
          const prev = current;
          setCurrent(next);
          setError(null);
          start(async () => {
            try {
              await setProjectAccessTier({ slug, tier: next });
              router.refresh();
            } catch (err) {
              setCurrent(prev);
              setError(err instanceof Error ? err.message : "Failed");
            }
          });
        }}
        className="rounded border border-panel-border bg-deep-space/60 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-command-gold disabled:opacity-50"
      >
        {TIERS.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      {error ? (
        <span className="font-mono text-[10px] uppercase tracking-wider text-alert-red">
          {error}
        </span>
      ) : null}
    </div>
  );
}
