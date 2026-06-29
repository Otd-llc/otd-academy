"use client";

// SkillHoneycomb — the /courses learning-path body, rendered to the SAME
// number-hero honeycomb standard as the build-guide hub (`GuideHoneycomb`):
// pointy-top hexes that TESSELLATE in offset, snaking rows and grow to fill the
// width (3-up desktop → 2-up phone). Each hex is the full course button — a big
// outline POSITION numeral owning the top third, then title · tagline · a status
// chip — and the whole hex is the link.
//
// It shares `computeLayout` + the `.gh-*` CSS with GuideHoneycomb (no fork — see
// the C1 design-system note in docs/tech-debt-register.md), and maps the skill
// tree's EIGHT `NodeState`s onto the four honeycomb visual states (done /
// current / pending / blocked) — the chip text + a `sk-dim` recede modifier
// carry the finer distinctions (Premium / Sign in / Soon / Locked).
//
// Progressive enhancement: unlike GuideHoneycomb (which renders nothing until it
// measures), every node ALSO renders in a stacked fallback before the client
// measures, so the `#node-<slug>` anchors (the no-JS "jump to your next step"
// target) and the course list exist in the SSR HTML for crawlers + JS-off users.

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  computeLayout,
  RATIO,
  type Box,
} from "@/components/guide/GuideHoneycomb";
import { Tooltip } from "@/components/Tooltip";
import { AdminTierToggle } from "@/components/skill-tree/AdminTierToggle";
import type { NodeState, SkillNode } from "@/lib/skill-tree-core";
import { hrefForNode, type HrefViewer } from "@/lib/skill-tree-href";
import { formatUsd, resolveBuyPriceCents } from "@/lib/format-money";

const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

// Capstone projects get a distinct ★ glow (mirrors SkillNodeCard). Slug-keyed on
// purpose — the title copy is clean and must NOT be parsed for a star.
const CAPSTONE_SLUGS = new Set<string>([
  "l3-01-eeg-front-end",
  "l3-05-wireless-hub",
]);

// Track → accent color for the small leading dot (mirrors SkillNodeCard / DAG).
const TRACK_COLOR: Record<string, string> = {
  SENSE: "text-status-green",
  ACT: "text-command-gold",
  POWER: "text-alert-red",
  COMMS: "text-signal-blue",
};

// Honeycomb visual class for a node (the four `.gh-node.<kind>` states). The
// single recommended `isNext` step is the gold-pulsing "current"; every other
// actionable/locked state folds into pending, except an unmet-prereq lock, which
// is the red "blocked". The chip TEXT (below) carries the precise affordance.
function hexKind(node: SkillNode): "done" | "current" | "pending" | "blocked" {
  switch (node.state) {
    case "done":
      return "done";
    case "available":
      return node.isNext ? "current" : "pending";
    case "locked-prereq":
      return "blocked";
    default:
      return "pending"; // preview, locked-account, locked-paywall, coming-soon
  }
}

// The states that should RECEDE (not yet reachable for this viewer) — dimmed via
// the additive `.gh-node.sk-dim` modifier so they read behind the actionable
// ones without forking the base palette.
function isDim(state: NodeState): boolean {
  return (
    state === "locked-account" ||
    state === "locked-paywall" ||
    state === "coming-soon"
  );
}

// The lower-point status chip text per state. Price surfaces only when a project
// is really purchasable (positive priceCents AND a stripePriceId — both deferred
// today, so PREMIUM resolves to "Premium").
function statusText(node: SkillNode): string {
  switch (node.state) {
    case "done":
      return "Done";
    case "available":
      return node.isNext ? "Next →" : "Start →";
    case "preview":
      return "Preview";
    case "locked-account":
      return "Sign in";
    case "locked-paywall": {
      const cents = resolveBuyPriceCents({
        priceCents: node.priceCents,
        stripePriceId: node.stripePriceId,
      });
      return cents !== null ? formatUsd(cents) : "Premium";
    }
    case "locked-prereq":
      return "Locked";
    case "coming-soon":
      return "Soon";
    default:
      return "";
  }
}

// The hex inner — number hero, title (+ track dot / ★), tagline lead, chip. Same
// DOM shape as GuideHoneycomb so the shared `.gh-*` CSS styles it identically.
function HexInner({
  node,
  num,
  numFontSize,
  isStarred,
}: {
  node: SkillNode;
  num: string;
  // px when measured; a cqw clamp string in the pre-measure fallback (the
  // `.gh-node` is a `container-type: inline-size` container, so cqw resolves).
  numFontSize: number | string;
  isStarred: boolean;
}) {
  const trackColor = node.track ? TRACK_COLOR[node.track] : undefined;
  return (
    <>
      <svg
        className="gh-hex"
        viewBox="0 0 100 115.47"
        preserveAspectRatio="none"
        aria-hidden
      >
        <polygon points="50,0 100,28.87 100,86.6 50,115.47 0,86.6 0,28.87" />
      </svg>
      <span className="gh-num" aria-hidden style={{ fontSize: numFontSize }}>
        {num}
      </span>
      <span className="gh-m">
        <span className="gh-title">
          {trackColor ? (
            <span
              aria-hidden
              className={`mr-1.5 inline-block h-[0.5em] w-[0.5em] shrink-0 rounded-full align-middle ${trackColor}`}
              style={{ backgroundColor: "currentColor" }}
            />
          ) : null}
          {node.title}
          {isStarred ? (
            <span aria-hidden className="ml-1 text-command-gold">
              ★
            </span>
          ) : null}
        </span>
        {node.tagline ? <span className="gh-lead">{node.tagline}</span> : null}
      </span>
      <span className="gh-status">
        <span className="gh-chip">{statusText(node)}</span>
      </span>
    </>
  );
}

export interface SkillHoneycombProps {
  nodes: SkillNode[]; // pre-ordered (resolvePath)
  goalSlug?: string; // the build this path leads to — marked with the ★ glow
  viewer: HrefViewer & { isAdmin?: boolean };
}

export function SkillHoneycomb({ nodes, goalSlug, viewer }: SkillHoneycombProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<{ boxes: Box[]; height: number }>({
    boxes: [],
    height: 0,
  });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setLayout(computeLayout(el.clientWidth, nodes.length));
  }, [nodes.length]);

  useIsoLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, [measure]);

  const measured = layout.boxes.length === nodes.length && layout.height > 0;

  if (nodes.length === 0) return null;

  return (
    <div
      ref={ref}
      className="gh"
      style={{ position: "relative", height: measured ? layout.height : undefined }}
    >
      <svg width="0" height="0" aria-hidden className="absolute">
        <defs>
          <linearGradient id="gh-honey" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#eab94d" />
            <stop offset="1" stopColor="#b07f31" />
          </linearGradient>
        </defs>
      </svg>

      {nodes.map((node, i) => {
        const b = layout.boxes[i];
        const num = String(i + 1).padStart(2, "0");
        const kind = hexKind(node);
        const href = hrefForNode(node, viewer);
        const isStarred = node.slug === goalSlug || CAPSTONE_SLUGS.has(node.slug);
        const dim = isDim(node.state);

        // Wrapper: absolute box once measured; a stacked, fluid block before that
        // (the no-JS / pre-hydration fallback). The `#node-<slug>` anchor lives
        // here so it resolves in both modes.
        const wrapStyle: React.CSSProperties = b
          ? { position: "absolute", left: b.left, top: b.top, width: b.w, height: b.h }
          : {
              position: "relative",
              width: "100%",
              maxWidth: 340,
              margin: "0 auto 10px",
              aspectRatio: `1 / ${RATIO}`,
            };

        // Number-hero size: measured px (eased down on small cells, as the hub
        // does), else a container-query clamp for the fluid fallback.
        // Eased down vs the old Bebas tuning — Saira Condensed (the numeral face)
        // renders taller, so the smaller multiplier keeps the number off the title.
        const numFontSize: number | string = b
          ? Math.round(b.w * (b.w <= 200 ? 0.32 : 0.38))
          : "clamp(28px, 22cqw, 58px)";

        const nodeClass = `gh-node ${kind}${dim ? " sk-dim" : ""}${
          isStarred ? " sk-goal" : ""
        }`;
        const ariaLabel = `${num} — ${node.title} (${statusText(node)})`;

        const inner = (
          <HexInner
            node={node}
            num={num}
            numFontSize={numFontSize}
            isStarred={isStarred}
          />
        );

        const hex =
          href === null ? (
            <div
              aria-label={ariaLabel}
              className={`${nodeClass} cursor-default`}
              style={{ position: "absolute", inset: 0 }}
            >
              {inner}
            </div>
          ) : (
            <Link
              href={href}
              aria-current={node.isNext ? "step" : undefined}
              aria-label={ariaLabel}
              className={nodeClass}
              style={{ position: "absolute", inset: 0 }}
            >
              {inner}
            </Link>
          );

        // Unmet-prerequisite locks list what's missing in a Radix tooltip
        // (hover + keyboard focus), exactly as the old SkillNodeCard did.
        const withTooltip =
          node.state === "locked-prereq" && node.missingPrereqs.length > 0 ? (
            <Tooltip
              label="Locked: finish first"
              content={
                <ul className="space-y-0.5">
                  {node.missingPrereqs.map((p) => (
                    <li key={p.slug}>{p.title}</li>
                  ))}
                </ul>
              }
            >
              {hex}
            </Tooltip>
          ) : (
            hex
          );

        return (
          <div key={node.slug} id={`node-${node.slug}`} style={wrapStyle}>
            {withTooltip}
            {/* Admin-only inline tier toggle, tucked into the hex's empty top
                corner. The action re-checks requireAdmin (defense in depth). */}
            {viewer.isAdmin ? (
              <div className="absolute right-1 top-1 z-20 rounded bg-deep-space/90 px-1">
                <AdminTierToggle slug={node.slug} tier={node.accessTier} />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
