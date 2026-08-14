"use client";

// SkillHoneycomb — the /courses learning-path body, rendered to the SAME standard as
// the build-guide hub (`GuideHoneycomb`): a VERTICAL SPINE of pointy-top hexes, single
// file, laced edge to edge, alternating left and right down the page. Each hex is the
// full course button (position watermark · the board render · title · status chip) and
// the whole hex is the link.
//
// A path is short by construction — the closure of one goal's prerequisites, three to
// six nodes, with the other builds living in the go-further comb at the foot of the
// page — so a single file is a page, not a scroll.
//
// It shares `lib/comb-spine.ts`, `SpineCombScene` and the `.gh-*` CSS with the hub (no
// fork — see the C1 design-system note in docs/tech-debt-register.md), and maps the
// skill tree's EIGHT `NodeState`s onto the four honeycomb visual states (done /
// current / pending / blocked) — the chip text + a `sk-dim` recede modifier carry the
// finer distinctions (Premium / Sign in / Soon / Locked).
//
// Progressive enhancement: unlike GuideHoneycomb (which renders nothing until it
// measures), every node ALSO renders in a stacked fallback before the client
// measures, so the `#node-<slug>` anchors (the no-JS "jump to your next step"
// target) and the course list exist in the SSR HTML for crawlers + JS-off users.

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { HexShell, RATIO } from "@/components/guide/GuideHoneycomb";
import { SpineCombScene } from "@/components/guide/SpineCombScene";
import { CombLock } from "@/components/guide/CombLock";
import { fitCellWidth, placeSpine, projectSpine, SPINE_CLIP } from "@/lib/comb-spine";
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
  /** true only before the layout is measured, when there is no scene to draw into.
   *  Without it the pre-hydration view is floating type with no hex, and with JS off
   *  it stays that way. */
  showShell: boolean;
}) {
  const trackColor = node.track ? TRACK_COLOR[node.track] : undefined;
  return (
    <>
      {showShell ? <HexShell className="gh-hex" /> : null}
      {/* The ordinal, as a watermark spanning the whole face. The stroke/fill
          colours travel as `--num-*` vars so the light theme can re-point them
          (an inline colour would beat any stylesheet). */}
      <span className="comb-num" aria-hidden style={{ fontSize: numFontSize }}>
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
  // container width; the spine solves everything else from it
  const [cw, setCw] = useState(0);
  // index of the hovered/focused node — lights its outline in the scene
  const [hot, setHot] = useState<number | null>(null);

  const measure = useCallback(() => {
    const el = ref.current;
    if (el) setCw(el.clientWidth);
  }, []);

  useIsoLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, [measure]);

  const w = cw > 0 ? fitCellWidth(nodes.length, cw) : 0;
  const { boxes, height } = placeSpine(nodes.length, w, cw);
  const solids = projectSpine(boxes, cw, height);
  const measured = boxes.length === nodes.length && height > 0;

  if (nodes.length === 0) return null;

  return (
    <div
      ref={ref}
      className="gh sk-lean"
      style={{ position: "relative", height: measured ? height : undefined }}
    >
      {measured && solids.length > 0 ? (
        <SpineCombScene
          solids={solids}
          sceneW={cw}
          sceneH={height}
          cellW={w}
          cells={nodes.map((n) => ({ kind: hexKind(n), dim: isDim(n.state) }))}
          hot={hot}
        />
      ) : null}

      {/* The current-cell marker, same component the build-guide comb uses, so
          all three site combs mark "you are here" the same way. */}
      {(() => {
        const ci = nodes.findIndex((n) => hexKind(n) === "current");
        const cb = ci >= 0 ? boxes[ci] : null;
        return cb && solids.length > 0 ? <CombLock box={cb} sceneW={cw} sceneH={height} /> : null;
      })()}
      {nodes.map((node, i) => {
        const b = boxes[i];
        const num = String(i + 1).padStart(2, "0");
        const kind = hexKind(node);
        const href = hrefForNode(node, viewer);
        const isStarred = node.slug === goalSlug || CAPSTONE_SLUGS.has(node.slug);
        const dim = isDim(node.state);

        // Wrapper: the measured box once measured; a stacked, fluid block before that.
        // The pre-measure branch is the no-JS / pre-hydration fallback and it is not
        // cosmetic — it is what keeps the `#node-<slug>` anchors (the "jump to your
        // next step" target) and the course links in the SSR HTML for crawlers.
        //
        // Measured cells take NO transform and NO scale: a one-point face lies in the
        // picture plane, so a cell's content sits at exactly its layout box.
        const wrapStyle: React.CSSProperties = b
          ? {
              position: "absolute",
              left: b.left,
              top: b.top,
              width: b.w,
              height: b.h,
              zIndex: 2,
              // HIT TEST, not decoration: overlapping rectangles at one z-index let
              // the later cell capture clicks on the earlier cell's own face.
              clipPath: SPINE_CLIP,
            }
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
            showShell={!b}
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
          </div>
        );
      })}

      {/* The board renders, in a LAYER of their own rather than inside each cell.
          A board has to sit above every hex in the comb, not just its own, and a cell
          is an absolutely-positioned z-indexed box, which is a stacking context: art
          parented inside one can never rise above the next cell's outline, so at spine
          sizes those outlines cut straight across the boards. The layer takes no
          pointer events and reads its hover state from the same `hot` index the scene
          does.

          Pre-measure there is no layer: the fallback is a stacked list of links for
          crawlers, and a board floating over it would land nowhere. */}
      {measured ? (
        <div className="gh-art-layer">
          {/* The current-cell marker, same component the build-guide comb uses, so
          all three site combs mark "you are here" the same way. */}
      {(() => {
        const ci = nodes.findIndex((n) => hexKind(n) === "current");
        const cb = ci >= 0 ? boxes[ci] : null;
        return cb && solids.length > 0 ? <CombLock box={cb} sceneW={cw} sceneH={height} /> : null;
      })()}
      {nodes.map((node, i) => {
            const b = boxes[i];
            if (!b) return null;
            return (
              <div
                key={node.slug}
                className={`gh-node ${hexKind(node)}${isDim(node.state) ? " sk-dim" : ""}${
                  hot === i ? " hot" : ""
                }`}
                style={{
                  position: "absolute",
                  left: b.left,
                  top: b.top,
                  width: b.w,
                  height: b.h,
                }}
              >
                <BoardArt
                  slug={node.slug}
                  isCurrent={node.state === "available" && node.isNext}
                />
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Admin-only tier toggles, in a layer ABOVE the artwork.
          They used to sit inside each cell at z-20, which does not work: `.gh-node` is
          `container-type: inline-size`, so it establishes a stacking context and the
          z-20 was trapped at the cell's own level, underneath the art layer. A board at
          1.3 scale covers the whole upper half of a hex, including the corner the
          toggle sits in, so it was buried (still clickable, just invisible). */}
      {viewer.isAdmin && measured ? (
        <div className="gh-admin-layer">
          {/* The current-cell marker, same component the build-guide comb uses, so
          all three site combs mark "you are here" the same way. */}
      {(() => {
        const ci = nodes.findIndex((n) => hexKind(n) === "current");
        const cb = ci >= 0 ? boxes[ci] : null;
        return cb && solids.length > 0 ? <CombLock box={cb} sceneW={cw} sceneH={height} /> : null;
      })()}
      {nodes.map((node, i) => {
            const b = boxes[i];
            if (!b) return null;
            return (
              <div
                key={node.slug}
                className="absolute rounded bg-deep-space/90 px-1"
                style={{ left: b.left + b.w * 0.62, top: b.top + b.h * 0.1 }}
              >
                <AdminTierToggle slug={node.slug} tier={node.accessTier} />
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
