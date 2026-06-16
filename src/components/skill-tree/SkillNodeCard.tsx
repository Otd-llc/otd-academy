// Presentational skill-tree node card (server component — NO "use client").
//
// Renders one curriculum project as a card: title + tagline, track/level chips,
// and a state affordance. The click destination is resolved by the pure
// `hrefForNode`; linked states wrap in a Next `<Link>`, non-linked states
// (coming-soon, or any state whose href resolves null) render a plain <div>.
//
// The only interactive island this pulls in is the existing `<Tooltip>`
// ("use client") used to list missing prerequisites for `locked-prereq` nodes —
// this card stays a server component; Radix runs inside that small child.
//
// Tokens match the existing CurriculumDag / /courses vocabulary: glass-card,
// command-gold, signal-blue, status-green, alert-red, panel-border, text-muted,
// font-display, font-mono.

import Link from "next/link";
import { Tooltip } from "@/components/Tooltip";
import { AdminTierToggle } from "@/components/skill-tree/AdminTierToggle";
import type { NodeState, SkillNode } from "@/lib/skill-tree-core";
import { hrefForNode, type HrefViewer } from "@/lib/skill-tree-href";
import { formatUsd, resolveBuyPriceCents } from "@/lib/format-money";

// Capstone projects get a distinct ★ glow. Slug-keyed on purpose — the title
// copy is clean and must NOT be parsed for a star.
const CAPSTONE_SLUGS = new Set<string>([
  "l3-01-eeg-front-end",
  "l3-05-wireless-hub",
]);

// Track → accent color, mirroring CurriculumDag's chip palette.
const TRACK_COLOR: Record<string, string> = {
  SENSE: "text-status-green",
  ACT: "text-command-gold",
  POWER: "text-alert-red",
  COMMS: "text-signal-blue",
};

// Per-state container styling layered over the shared `glass-card` base.
const STATE_RING: Record<NodeState, string> = {
  done: "border-status-green/60",
  available: "border-command-gold shadow-[0_0_18px_-4px_rgba(200,150,62,0.55)]",
  "locked-prereq": "border-panel-border opacity-60",
  "locked-account": "border-signal-blue/40",
  "locked-paywall": "border-panel-border",
  preview: "border-signal-blue/40",
  "coming-soon": "border-panel-border opacity-40",
};

function Chip({ label, color }: { label: string; color?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded border border-panel-border bg-deep-space/60 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] ${color ?? "text-command-gold"}`}
    >
      {label}
    </span>
  );
}

// The state affordance line shown at the bottom of the card. A small mono
// badge/lock per state; the price chip is guarded so it only appears with a
// real price (deferred → "Premium" everywhere right now).
function Affordance({ node }: { node: SkillNode }) {
  switch (node.state) {
    case "done":
      return (
        <span className="mt-auto inline-flex items-center gap-1 font-mono text-xs font-bold uppercase tracking-wider text-status-green">
          <span aria-hidden="true">✓</span> Done
        </span>
      );
    case "available":
      return (
        <span className="mt-auto inline-flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-signal-blue">
          Start the build
          <span aria-hidden="true">→</span>
          {node.isNext ? (
            <span className="rounded bg-command-gold/15 px-1.5 py-0.5 text-[10px] tracking-[0.2em] text-command-gold">
              Next →
            </span>
          ) : null}
        </span>
      );
    case "locked-prereq": {
      const trigger = (
        <span
          tabIndex={0}
          className="mt-auto inline-flex cursor-help items-center gap-1 font-mono text-xs uppercase tracking-wider text-muted outline-none focus-visible:text-command-gold"
        >
          <span aria-hidden="true">🔒</span> Complete prerequisites
        </span>
      );
      if (node.missingPrereqs.length === 0) return trigger;
      return (
        <Tooltip
          label="Locked — finish first"
          content={
            <ul className="space-y-0.5">
              {node.missingPrereqs.map((p) => (
                <li key={p.slug}>{p.title}</li>
              ))}
            </ul>
          }
        >
          {trigger}
        </Tooltip>
      );
    }
    case "locked-account":
      return (
        <span className="mt-auto inline-flex items-center gap-1 font-mono text-xs font-bold uppercase tracking-wider text-signal-blue">
          <span aria-hidden="true">🔒</span> Sign in — free
        </span>
      );
    case "locked-paywall": {
      // SkillNode carries priceCents but not stripePriceId; pass it as null so
      // the guard requires BOTH to surface a price. Prices are deferred (no
      // stripePriceId on any project yet) → this resolves null → "Premium".
      const cents = resolveBuyPriceCents({
        priceCents: node.priceCents,
        stripePriceId: null,
      });
      return (
        <span className="mt-auto inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-command-gold">
          <span aria-hidden="true">🔒</span>
          {cents !== null ? (
            <span className="rounded bg-command-gold/15 px-1.5 py-0.5 tracking-[0.2em]">
              {formatUsd(cents)}
            </span>
          ) : (
            "Premium"
          )}
        </span>
      );
    }
    case "preview":
      return (
        <span className="mt-auto inline-flex items-center gap-1 font-mono text-xs font-bold uppercase tracking-wider text-signal-blue">
          Preview
          <span aria-hidden="true">→</span>
        </span>
      );
    case "coming-soon":
      return (
        <span className="mt-auto inline-flex items-center gap-1 font-mono text-xs uppercase tracking-wider text-muted">
          Coming soon
        </span>
      );
    default:
      return null;
  }
}

function CardBody({ node, viewer }: { node: SkillNode; viewer: HrefViewer }) {
  const trackColor = node.track ? TRACK_COLOR[node.track] : "text-muted";
  const isCapstone = CAPSTONE_SLUGS.has(node.slug);
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {node.track ? <Chip label={node.track} color={trackColor} /> : null}
        {node.level ? <Chip label={node.level} /> : null}
        {isCapstone ? (
          <span
            className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.2em] text-command-gold"
            title="Capstone"
          >
            <span aria-hidden="true">★</span> Capstone
          </span>
        ) : null}
      </div>
      <span className="font-display text-2xl tracking-wider text-white">
        {node.title}
      </span>
      {node.tagline ? (
        <span className="font-serif text-sm italic text-muted">
          {node.tagline}
        </span>
      ) : null}
      <Affordance node={node} />
      {/* Admin-only inline tier toggle — server decides via `viewer.isAdmin`;
          the action re-checks requireAdmin (defense in depth). */}
      {viewer.isAdmin ? (
        <AdminTierToggle slug={node.slug} tier={node.accessTier} />
      ) : null}
    </>
  );
}

export interface SkillNodeCardProps {
  node: SkillNode;
  viewer: HrefViewer;
}

export function SkillNodeCard({ node, viewer }: SkillNodeCardProps) {
  const href = hrefForNode(node, viewer);
  const isCapstone = CAPSTONE_SLUGS.has(node.slug);
  const base = `glass-card flex h-full min-h-[9rem] flex-col gap-3 border p-5 ${STATE_RING[node.state]}`;
  const capstoneGlow = isCapstone
    ? " shadow-[0_0_24px_-6px_rgba(200,150,62,0.7)] ring-1 ring-command-gold/40"
    : "";

  if (href === null) {
    // Non-interactive (coming-soon, or a missing outline label): a plain div.
    return (
      <div
        id={`node-${node.slug}`}
        className={`${base}${capstoneGlow} cursor-default`}
      >
        <CardBody node={node} viewer={viewer} />
      </div>
    );
  }

  return (
    <Link
      id={`node-${node.slug}`}
      href={href}
      className={`${base}${capstoneGlow} transition-colors hover:bg-command-gold/5`}
    >
      <CardBody node={node} viewer={viewer} />
    </Link>
  );
}
