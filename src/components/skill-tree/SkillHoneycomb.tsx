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
  HexPrism,
  RATIO,
  buildCombScene,
  type Box,
} from "@/components/guide/GuideHoneycomb";
import { CombArrows, HexPrismScene } from "@/components/guide/HexPrismScene";
import { Tooltip } from "@/components/Tooltip";
import { AdminTierToggle } from "@/components/skill-tree/AdminTierToggle";
import type { NodeState, SkillNode } from "@/lib/skill-tree-core";
import { hrefForNode, type HrefViewer } from "@/lib/skill-tree-href";
import { formatUsd, resolveBuyPriceCents } from "@/lib/format-money";
import { COMB_STANDIN_GHOST, combPoster } from "@/lib/board-posters";

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

// The finished-board graphic on a cell (sandbox rounds A–J, 2026-07-25).
//
// A course with a baked comb render draws it. One without draws L1.01 as a gold
// GHOST instead, so it reads as "a board goes here, not this board".
//
// The ghost masks against COMB_STANDIN_GHOST, not against the render's own alpha.
// The render carries a baked contact shadow as a clean band at alpha ~0.2, and
// masking that produced a smear offset below the board. (An earlier round kept the
// shadow deliberately; it was reversed once the alpha was actually measured.) The
// ghost map is `coverage x ink` off luminance, so what shows is the board's own
// structure. Regenerate with `pnpm tsx scripts/make-stage-ghosts.ts`.
//
// Geometry is a share of the cell box, grown about a fixed centre at 26% so the
// active step's larger board sits on the same line as its neighbours' (round I,
// scale 1.30). The art is `pointer-events: none`; the whole hex is still the link.
const ART_SCALE = 1.3;

function BoardArt({ slug, isCurrent }: { slug: string; isCurrent: boolean }) {
  const poster = combPoster(slug);
  const w = (isCurrent ? 96 : 82) * ART_SCALE;
  const h = (isCurrent ? 56 : 46) * ART_SCALE;
  const inset = (100 - w) / 2;
  const box: React.CSSProperties = {
    position: "absolute",
    pointerEvents: "none",
    left: `${inset}%`,
    right: `${inset}%`,
    top: `${26 - h / 2}%`,
    height: `${h}%`,
    zIndex: 2,
  };

  if (poster) {
    return (
      <span
        aria-hidden
        className="sk-art"
        style={{ ...box, backgroundImage: `url(${poster})` }}
      />
    );
  }
  return (
    <span aria-hidden className="sk-art-soon" style={box}>
      <span
        className="sk-art-soon-fill"
        style={{
          WebkitMaskImage: `url(${COMB_STANDIN_GHOST})`,
          maskImage: `url(${COMB_STANDIN_GHOST})`,
        }}
      />
    </span>
  );
}

// The hex inner — number hero, title (+ track dot / ★), tagline lead, chip. Same
// DOM shape as GuideHoneycomb so the shared `.gh-*` CSS styles it identically,
// except the ordinal: on this comb it is a full-cell watermark clipped to the hex
// face rather than the hub's top-third numeral (rounds C–G).
function HexInner({
  node,
  num,
  numFontSize,
  isStarred,
  showShell,
}: {
  node: SkillNode;
  num: string;
  // px when measured; a cqw clamp string in the pre-measure fallback (the
  // `.gh-node` is a `container-type: inline-size` container, so cqw resolves).
  numFontSize: number | string;
  isStarred: boolean;
  /** true only before the layout is measured, when there is no scene to draw into. */
  showShell: boolean;
}) {
  const trackColor = node.track ? TRACK_COLOR[node.track] : undefined;
  return (
    <>
      {/* The flat shell is the PRE-MEASURE fallback only. Once the layout is
          measured the hexes come from the shared perspective scene, so a measured
          cell renders content alone. */}
      {showShell ? <HexPrism className="gh-hex" /> : null}
      {/* The ordinal, as a watermark spanning the whole face. The stroke/fill
          colours travel as `--num-*` vars so the light theme can re-point them
          (an inline colour would beat any stylesheet). */}
      <span className="comb-num" aria-hidden style={{ fontSize: numFontSize }}>
        {num}
      </span>
      <BoardArt slug={node.slug} isCurrent={node.state === "available" && node.isNext} />
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
  // container width, kept for the arrow overlay's coordinate space
  const [cw, setCw] = useState(0);
  // index of the hovered/focused node — lights its OUTGOING path arrow
  const [hot, setHot] = useState<number | null>(null);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCw(el.clientWidth);
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

  const scene = buildCombScene(layout.boxes, cw);

  return (
    <div
      ref={ref}
      className="gh sk-lean"
      style={{ position: "relative", height: measured ? scene.height : undefined }}
    >
      {measured && scene.solids.length > 0 ? (
        <HexPrismScene
          solids={scene.solids}
          vb={scene.vb}
          cells={nodes.map((n) => ({ kind: hexKind(n), dim: isDim(n.state) }))}
          hot={hot}
        />
      ) : null}

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
        // Measured: the cell's content, billboarded onto its projected face (the hex
        // itself is in the scene svg above). Pre-measure: the stacked fluid fallback
        // that keeps the `#node-<slug>` anchors and the links in the SSR HTML.
        const placed = b ? scene.place(i) : null;
        const wrapStyle: React.CSSProperties = placed
          ? placed
          : {
              position: "relative",
              width: "100%",
              maxWidth: 340,
              margin: "0 auto 10px",
              aspectRatio: `1 / ${RATIO}`,
            };

        // Watermark ordinal size. Saira's two digits run about one em wide, so a
        // font-size of the cell width spans the face; the `.comb-num` clip keeps it
        // off the neighbours. The fallback uses a container query, since the
        // pre-measure cell has no measured width yet.
        const numFontSize: number | string = b ? Math.round(b.w * 0.98) : "98cqw";

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
            showShell={!placed}
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
          <div
            key={node.slug}
            id={`node-${node.slug}`}
            style={wrapStyle}
            onMouseEnter={() => setHot(i)}
            onMouseLeave={() => setHot((h) => (h === i ? null : h))}
            onFocus={() => setHot(i)}
            onBlur={() => setHot((h) => (h === i ? null : h))}
          >
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

      {/* Path-direction arrows (K10): a 12 × 10 solid triangle on each
          consecutive pair's seam, base 7px (scaled) off the line on the
          destination face, rotated along the flow. The seam midpoint is the
          midpoint of the two cell centers (true for tessellated hexes). Gold =
          traversed (source done); dim = ahead; a hovered/focused hex lights its
          outgoing arrow. Decorative — the chips carry the affordance. */}
      {measured ? (
        <CombArrows
          solids={scene.solids}
          vb={scene.vb}
          on={nodes.map((n) => hexKind(n) === "done")}
          hot={hot}
        />
      ) : null}
    </div>
  );
}
