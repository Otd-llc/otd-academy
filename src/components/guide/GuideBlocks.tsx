// Content-block renderer for guide cards (plan Task 8.3; lands deferred 7.3:
// termRef → GlossaryTerm wiring).
//
// SERVER COMPONENT (no "use client"). Two reasons it stays server:
//   1. `prose` blocks are sanitized with `sanitize-html` — a server-side
//      concern. We reuse the exact allow-list pattern from
//      `src/lib/actions/artifacts.ts` (`sanitizeNote`): markdown source is the
//      storage format, so we strip ALL tags to plain text and render it as
//      text (whitespace-pre-wrap) rather than via dangerouslySetInnerHTML. The
//      repo ships no markdown→HTML renderer (see ErrataItem's plain
//      whitespace-pre-wrap description), so this matches the established
//      convention and is XSS-safe by construction.
//   2. The only interactive leaf, `termRef`, renders <GlossaryTerm> — itself a
//      "use client" component. A server component can render a client
//      component as a child, so no client boundary is needed here.
//
// Resilience: an unknown/extra block type is skipped (renders nothing) rather
// than crashing the page.

import { Fragment, type ReactNode } from "react";
import sanitizeHtml from "sanitize-html";
import type { ContentBlock } from "@/lib/schemas/guide";
import { scanIslands, RAIL_MIN_ISLANDS, deriveSetupRanges } from "@/lib/guide-islands";
import {
  MODE_VAR,
  MODE_TEXT,
  parseModeLabel,
  parseAlertLabel,
  parseAsideLabel,
  scanModeBands,
  type Rung,
  type AsideVerb,
} from "@/lib/guide-signposts";
import { RungGlyph } from "@/components/guide/RungGlyph";
import { IslandRail } from "@/components/guide/IslandRail";
import { ResumePill } from "@/components/guide/ResumePill";
import { SetupBand } from "@/components/guide/SetupBand";
import { resumeKey, type ResumeRecord } from "@/lib/resume-position";
import { GlossaryTerm } from "@/components/GlossaryTerm";
import { LessonProvider } from "@/components/guide/LessonContext";
import { Inline } from "@/components/guide/InlineText";
import { KitBlock, type KitItem } from "@/components/guide/KitBlock";
import { SelfCheckBlock } from "@/components/guide/SelfCheckBlock";
import { ModelViewerLazy } from "@/components/ModelViewerLazy";
import { WindowedPartModel } from "@/components/guide/WindowedPartModel";
import { QuizBlock, type QuizContext } from "@/components/guide/QuizBlock";

// Lesson-wide Logbook XP context (design §9.3 + Phase 2). `state` is today's
// per-question-key state; `questionKeysByBlock` maps a quiz block's array index to
// its questions' server-computed keys. Discriminated by `mode`: library lessons vs
// course (build-guide) stage cards (see QuizLogbook).
export type LessonLogbook = {
  signedIn: boolean;
  signInHref: string;
  state: Record<string, "earned" | "locked" | "open">;
  questionKeysByBlock: Record<number, string[]>;
} & (
  | { mode: "library"; slug: string }
  | { mode: "course"; enrollmentId: string; stage: string }
);
import { DIAGRAM_COMPONENTS } from "@/components/guide/diagram-registry";
import { DiagramChromeProvider } from "@/components/guide/diagrams/DiagramChrome";
import katex from "katex";
import { EMBED_ISLANDS } from "@/components/tools/embed-islands";
import { getTool } from "@/lib/tools/registry";
import { GuideActionButton } from "@/components/guide/GuideActionButton";
import { CaptureLauncher } from "@/components/guide/CaptureLauncher";
import { ZoomableImage } from "@/components/guide/ZoomableImage";
import { PartMpnLink } from "@/components/guide/PartMpnLink";
import { YouTubeEmbed } from "@/components/guide/YouTubeEmbed";
import {
  affiliateLink,
  amazonProductLink,
  type AffiliateVendor,
} from "@/lib/affiliates";
import { ExternalLinkIcon, PhotoIcon, VideoIcon, RotateIcon } from "@/components/icons";
import { assessPartAvailability, availabilityBadge } from "@/lib/part-availability";
import { bomTableHasDkData, liveBomCost } from "@/lib/live-bom-cost";
import { relativeAge } from "@/lib/relative-time";
import { formatUsd } from "@/lib/format-money";
import { httpUrlOrNull } from "@/lib/safe-url";
import type { RenderBounds } from "@/lib/schemas/part-asset";

// A partModel block's resolved 3D render, keyed by MPN. The card route presigns
// the part's MODEL_3D render URL + camera bounds server-side and passes this map
// in; a block whose MPN isn't present degrades to its caption.
export type ResolvedModel = { src: string; bounds: RenderBounds | null };

// A bomTable block's resolved rows — the revision's Bill of Materials, fetched
// from BomLine + Part by the card route and passed in (like `models`). A card
// with no BOM lines / no resolved rows degrades to a small "not locked" note.
export type BomRow = {
  partId: string;
  refDes: string;
  qty: number;
  mpn: string | null;
  manufacturer: string | null;
  description: string | null;
  datasheetUrl: string | null;
  // Sourcing-health signals (route-resolved from Part). `lifecycle` flags
  // NRND/EOL/OBSOLETE parts; `hasDatasheet` is true when a datasheet exists via
  // either the external URL or an uploaded PartDatasheet.
  lifecycle: "ACTIVE" | "NRND" | "EOL" | "OBSOLETE";
  hasDatasheet: boolean;
  // DigiKey availability snapshot (watchdog). Null when never checked / creds
  // absent → the badge renders a grey "unchecked".
  dkInStock: boolean | null;
  dkLifecycle: string | null;
  dkCheckedAt: Date | null;
  // DigiKey unit price snapshot (cents). Null when never checked / unpriced →
  // the Unit/Ext cells show "—" and the line is excluded from the design total.
  dkUnitPriceCents: number | null;
  // DigiKey part number (lowest-MOQ variation) for the FastAdd cart URL. Null
  // when unmatched → the line is omitted from the cart link.
  dkPartNumber: string | null;
  // Presigned MODEL_3D render (.glb) + camera bounds for the row's floating 3D
  // preview. Null when the part has no 3D / R2 is off → the row shows no model.
  modelSrc: string | null;
  modelBounds: RenderBounds | null;
};

// Lifecycle chip — shown only for non-ACTIVE parts (NRND = caution/gold,
// EOL/OBSOLETE = alert/red), so a healthy BOM stays clean.
function LifecycleBadge({ lifecycle }: { lifecycle: BomRow["lifecycle"] }) {
  if (lifecycle === "ACTIVE") return null;
  const danger = lifecycle === "EOL" || lifecycle === "OBSOLETE";
  return (
    <span
      className={`ml-1.5 inline-flex items-center rounded px-1 py-px align-middle font-mono text-[9px] font-bold uppercase tracking-wider ${
        danger
          ? "bg-alert-red/15 text-alert-red"
          : "bg-command-gold/15 text-command-gold"
      }`}
      title={
        danger
          ? "End-of-life / obsolete — find a replacement before sourcing"
          : "Not recommended for new designs — prefer an active alternative"
      }
    >
      {lifecycle}
    </span>
  );
}

const DK_TONE_CLASS: Record<string, string> = {
  green: "bg-signal-blue/15 text-signal-blue",
  amber: "bg-command-gold/15 text-command-gold",
  red: "bg-alert-red/15 text-alert-red",
  grey: "bg-muted/15 text-muted",
};

// DigiKey live-availability chip (watchdog). Reuses the pure assessor so the
// label matches board-readiness + the catalog. Hidden entirely when a part was
// never checked (creds absent / new part) to keep a clean BOM.
function DkAvailabilityBadge({
  inStock,
  lifecycle,
  checkedAt,
}: {
  inStock: boolean | null;
  lifecycle: string | null;
  checkedAt: Date | null;
}) {
  if (checkedAt == null) return null; // never checked → no chip (vs a noisy "unchecked")
  const { status } = assessPartAvailability(
    { dkInStock: inStock, dkLifecycle: lifecycle, dkCheckedAt: checkedAt },
    new Date(),
  );
  if (status === "OK") return null; // healthy parts stay clean
  const { label, tone, title } = availabilityBadge(status);
  return (
    <span
      title={title}
      className={`ml-1.5 inline-flex items-center rounded px-1 py-px align-middle font-mono text-[9px] font-bold uppercase tracking-wider ${DK_TONE_CLASS[tone]}`}
    >
      DK: {label}
    </span>
  );
}

// Strict allow-list mirrors `sanitizeNote` in artifacts.ts: drop every tag so
// the prose markdown source can never inject HTML. The output is plain text
// (or pure markdown punctuation), rendered with whitespace preserved.
function sanitizeProse(md: string): string {
  return sanitizeHtml(md, {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: "discard",
    nonTextTags: ["script", "style", "textarea", "noscript"],
  });
}

// Map the schema's callout severity → the bench `.callout` modifier class.
const SEVERITY_CLASS: Record<"critical" | "warn" | "info", string> = {
  critical: "critical",
  warn: "warn",
  info: "info",
};

// Map a table cell `tone` → the bench `.badge` tone modifier.
const BADGE_TONE_CLASS: Record<"gold" | "blue" | "critical" | "dim", string> = {
  gold: "gold",
  blue: "blue",
  critical: "critical",
  dim: "dim",
};

// `Inline` (emphasis + [[term]] glossary popovers) moved to ./InlineText so the
// interactive client KitBlock island can render note/intro text the same way;
// it's imported at the top of this file.

// 3D part viewer block. `model` is the route-resolved render (presigned R2 URL +
// camera bounds). Absent (no MODEL_3D asset, R2 off, or empty MPN) → caption
// only, so a card never shows a broken viewer.
function PartModelBlock({
  caption,
  model,
}: {
  caption?: string;
  model?: ResolvedModel;
}) {
  if (!model) {
    return caption ? (
      <p className="font-mono text-xs uppercase tracking-wider text-muted">
        {caption}
      </p>
    ) : null;
  }
  // Frameless floating preview, LOCKED narrow + centered (max-w-sm) so the part
  // reads clearly but the interactive canvas is a small target that can't hijack
  // scroll flow. The viewer is rotate-only (wheel scroll passes through). The
  // "drag to rotate" hint sits BELOW the model (showHint=false suppresses the
  // built-in centered pill) so nothing ever covers the part.
  return (
    <figure className="space-y-1.5">
      <div className="mx-auto w-full max-w-sm">
        <ModelViewerLazy src={model.src} bounds={model.bounds} float showHint={false} heightClass="h-64" />
      </div>
      <p className="flex items-center justify-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-command-gold">
        <RotateIcon className="h-2.5 w-2.5" /> drag to rotate
      </p>
      {caption ? (
        <figcaption className="text-center font-mono text-xs uppercase tracking-wider text-muted">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

// bomTable — the revision's Bill of Materials, rendered live from BomLine data.
// `rows` is route-resolved (BomLine + Part); absent / empty → a small note so a
// card whose BOM isn't locked yet stages cleanly instead of showing a broken
// table. Reuses the `.table-tech` / `.ref` / `.mpn` styling of the table block.
function BomTableBlock({
  caption,
  rows,
  collapsed,
}: {
  caption?: string;
  rows?: BomRow[];
  collapsed?: boolean;
}) {
  if (!rows || rows.length === 0) {
    return (
      <p className="font-mono text-xs uppercase tracking-wider text-muted">
        The bill of materials lists here once the BOM is locked.
      </p>
    );
  }
  const totalParts = rows.reduce((sum, r) => sum + r.qty, 0);
  const eolCount = rows.filter(
    (r) => r.lifecycle === "EOL" || r.lifecycle === "OBSOLETE",
  ).length;
  const nrndCount = rows.filter((r) => r.lifecycle === "NRND").length;
  const noDatasheetCount = rows.filter((r) => !r.hasDatasheet).length;
  const health = [
    eolCount ? `${eolCount} EOL/obsolete` : null,
    nrndCount ? `${nrndCount} NRND` : null,
    noDatasheetCount ? `${noDatasheetCount} missing datasheet` : null,
  ].filter(Boolean);
  const cost = liveBomCost(
    rows.map((r) => ({ quantity: r.qty, dkUnitPriceCents: r.dkUnitPriceCents })),
  );
  const tableHasDk = bomTableHasDkData(rows);
  const checkedDates = rows
    .map((r) => r.dkCheckedAt)
    .filter((d): d is Date => d != null);
  const oldestChecked = checkedDates.length
    ? checkedDates.reduce((a, b) => (a < b ? a : b))
    : null;
  const body = (
    <figure className="space-y-2">
      {/* Each part is introduced with its half-size floating 3D (windowed, so a
          long BOM never exceeds the WebGL context limit): 3D left, spec right.
          The "drag to rotate" cue lives in the spec column (off the model). */}
      <ul className="border-t border-panel-border/50">
        {rows.map((r, i) => (
          <li key={i} className="flex items-start gap-4 border-b border-panel-border/40 py-4">
            {r.modelSrc ? (
              <div className="w-24 shrink-0 sm:w-28">
                <WindowedPartModel src={r.modelSrc} bounds={r.modelBounds} />
              </div>
            ) : null}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-title">
                  {r.refDes}
                </span>
                <PartMpnLink
                  partId={r.partId}
                  mpn={r.mpn}
                  manufacturer={r.manufacturer}
                  description={r.description}
                  datasheetUrl={r.datasheetUrl}
                />
                <LifecycleBadge lifecycle={r.lifecycle} />
                <DkAvailabilityBadge
                  inStock={r.dkInStock}
                  lifecycle={r.dkLifecycle}
                  checkedAt={r.dkCheckedAt}
                />
                {r.manufacturer ? (
                  <span className="font-mono text-[11px] normal-case text-muted">{r.manufacturer}</span>
                ) : null}
              </div>
              {r.description ? (
                <p className="mt-1 font-serif text-sm leading-snug text-muted">{r.description}</p>
              ) : null}
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-muted">
                <span>
                  qty <span className="tabular-nums text-text">{r.qty}</span>
                </span>
                {tableHasDk ? (
                  <span>
                    unit{" "}
                    <span className="tabular-nums">
                      {r.dkUnitPriceCents != null ? formatUsd(r.dkUnitPriceCents) : "—"}
                    </span>{" "}
                    · ext{" "}
                    <span className="tabular-nums">
                      {r.dkUnitPriceCents != null ? formatUsd(r.qty * r.dkUnitPriceCents) : "—"}
                    </span>
                  </span>
                ) : null}
                <span className="ml-auto">
                  {httpUrlOrNull(r.datasheetUrl) ? (
                    <a
                      href={httpUrlOrNull(r.datasheetUrl)!}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="inline-flex items-center gap-1 text-signal-blue underline decoration-dotted underline-offset-2 hover:text-command-gold"
                    >
                      datasheet
                      <ExternalLinkIcon className="h-3 w-3 shrink-0" />
                    </a>
                  ) : r.hasDatasheet ? (
                    <span title="Datasheet on file in the parts library">datasheet on file</span>
                  ) : (
                    <span className="uppercase tracking-wider text-alert-red">datasheet missing</span>
                  )}
                </span>
              </div>
              {r.modelSrc ? (
                <p className="mt-1.5 flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-command-gold">
                  <RotateIcon className="h-2.5 w-2.5" /> drag to rotate
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {/* Compliance (load-bearing): the freshness "prices as of" line + this
          DigiKey attribution keep the cached snapshot display inside the API
          User Agreement's "present DigiKey Data on Your Site" grant. Do not
          remove. See docs/plans/2026-06-19-digikey-compliance-design.md. */}
      {cost.anyPriced ? (
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-panel-border pt-2 font-mono text-xs">
          <span className="text-link-muted">
            Design BOM cost ≈{" "}
            <span className="text-command-gold">{formatUsd(cost.totalCents)}</span>
            <span className="ml-1 text-muted normal-case">
              parts only — excludes MOQ/reels &amp; shipping
              {cost.unpricedCount > 0
                ? ` · ${cost.unpricedCount} line${cost.unpricedCount === 1 ? "" : "s"} unpriced`
                : ""}
            </span>
          </span>
          {oldestChecked ? (
            <span className="text-muted">
              DigiKey prices as of {relativeAge(oldestChecked, new Date())}
            </span>
          ) : null}
        </div>
      ) : null}
      {/* Attribution renders whenever ANY DigiKey data is shown (stock chips +
          price columns), not just when something is priced — so a
          checked-but-unpriced BOM is still attributed. Rendered as a footnote
          sibling right after the cost total. */}
      {tableHasDk ? (
        <span className="block font-mono text-xs text-muted normal-case">
          Pricing &amp; stock data via DigiKey.
        </span>
      ) : null}
      <figcaption className="font-mono text-xs uppercase tracking-wider text-muted">
        {caption ??
          `${rows.length} line ${rows.length === 1 ? "item" : "items"} · ${totalParts} parts`}
        {health.length ? (
          <span className="ml-2 text-alert-red">· {health.join(" · ")}</span>
        ) : null}
      </figcaption>
      {/* No "add to cart" here on purpose: the BOM section is for reviewing the
          bill of materials + live cost. Buying the parts lives in the ORDERING
          stage, not here. */}
    </figure>
  );

  // Always a native <details> (no client JS) with the summary header; `collapsed`
  // only controls the DEFAULT open state. Expanded by default (collapsed=false)
  // so the parts + 3D show on load; still collapsible via the summary.
  return (
    <details open={!collapsed} className="group border-t border-panel-border/60 pt-4">
      <summary className="flex cursor-pointer list-none items-center gap-2.5 py-1 [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden
          className="font-mono text-command-gold transition-transform group-open:rotate-90"
        >
          ▸
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-command-gold">
          Full bill of materials
        </span>
        <span className="font-mono text-[11px] tabular-nums text-muted">
          {rows.length} {rows.length === 1 ? "line" : "lines"} · {totalParts} parts
        </span>
      </summary>
      <div className="mt-4">{body}</div>
    </details>
  );
}

// Empty media (image/video with no src) → an intentional "to be added" slot
// rather than nothing, so a card can stake out where real build footage will go.
// The author fills the src in later and the same block becomes the real media.
function MediaPlaceholder({
  kind,
  description,
}: {
  kind: "photo" | "video";
  description?: string;
}) {
  const Icon = kind === "photo" ? PhotoIcon : VideoIcon;
  const label = kind === "photo" ? "Photo — to be added" : "Video — to be added";
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded border border-dashed border-panel-border bg-deep-space/40 px-6 py-10 text-center">
      <Icon className="h-7 w-7 text-muted" />
      <span className="font-mono text-xs uppercase tracking-wider text-muted">
        {label}
      </span>
      {description ? (
        <span className="max-w-md font-serif text-sm text-muted">
          {description}
        </span>
      ) : null}
    </div>
  );
}

// Diagram / illustration / photo block. `src` is scheme-validated by the schema
// (empty | http(s):// | root-relative); empty renders the placeholder slot. A
// plain <img> (not next/image) keeps arbitrary root-relative SVGs and external
// URLs simple and needs no domain config; it's a static asset, not a user upload.
function ImageBlock({
  src,
  alt,
  caption,
  reveal,
  boxed,
  zoom,
  captureHint,
  cardId,
  blockIndex,
  isAdmin,
  inlineSvg,
  fig,
}: {
  src: string;
  alt: string;
  caption?: string;
  reveal?: string;
  boxed?: boolean;
  /** Hi-res, zoomable "answer key" type: renders a click-to-open pan/zoom
   *  lightbox instead of a static figure. Precedence over reveal/boxed. */
  zoom?: boolean;
  captureHint?: string;
  cardId?: string;
  blockIndex?: number;
  isAdmin?: boolean;
  /** House-style diagram SVG markup, inlined so it inherits the site's
   *  Space Mono (an <img> SVG can't use the page webfont). When set, the
   *  figure renders the SVG inline instead of <img src>. */
  inlineSvg?: string;
  /** Figure number for a registry diagram; drives the bare frame's "Fig N". */
  fig?: number;
}) {
  if (!src) {
    // An empty media slot is an ADMIN-ONLY affordance: admins get the "to be
    // added" placeholder + the in-place screen-capture "+", but a student
    // (non-admin) sees NOTHING — no half-finished slot for media we haven't
    // shot yet (e.g. the deferred build photos/clips). The author fills `src`
    // later and the block becomes the real, everyone-visible media.
    if (isAdmin && cardId && blockIndex !== undefined) {
      return (
        <div className="space-y-2">
          <MediaPlaceholder kind="photo" description={caption || alt} />
          <CaptureLauncher
            key="capture-add"
            kind="image"
            cardId={cardId}
            blockIndex={blockIndex}
            captureHint={captureHint}
            caption={caption}
            zoom={zoom}
          />
        </div>
      );
    }
    return null;
  }
  // The part-number anatomy diagram renders as a responsive, scroll-triggered
  // HTML/CSS component (cards reflow 4→2→1 col, the "decode" reveal fires on
  // viewport entry) instead of the static fixed-viewBox SVG — see
  // MpnAnatomyDiagram for the why. The DB content stays a plain image block.
  const DiagramComponent = DIAGRAM_COMPONENTS[src];
  if (DiagramComponent) {
    // In-lesson: render bare (no title/eyebrow/caption) with a "Fig N" corner — the
    // prose beside it already carries the words. The standalone /diagram-render export
    // renders the same component with the default (full) context, titled for SEO.
    return (
      <DiagramChromeProvider bare fig={fig ?? null}>
        <DiagramComponent caption={caption} />
      </DiagramChromeProvider>
    );
  }
  // Admins can re-capture a shot they took (an /api/shot/ src) — NOT the baked-in
  // SVG diagrams. Computed ONCE here and appended to whichever figure variant
  // renders below (plain, boxed, OR reveal). It used to live only on the plain
  // path, so a captured `reveal`/`boxed` image — every "See it wired" slot is a
  // reveal — returned early and had no way to be re-shot.
  const recapture =
    isAdmin && cardId && blockIndex !== undefined && src.startsWith("/api/shot/") ? (
      <CaptureLauncher
        key="capture-redo"
        kind="image"
        cardId={cardId}
        blockIndex={blockIndex}
        captureHint={captureHint}
        caption={caption}
        existing
        currentSrc={src}
        zoom={zoom}
      />
    ) : null;
  const withRecapture = (node: ReactNode): ReactNode =>
    recapture ? (
      <div className="space-y-2">
        {node}
        {recapture}
      </div>
    ) : (
      node
    );

  // Hi-res "answer key" type: a click-to-open pan/zoom lightbox instead of a
  // static figure, so a learner can read fine detail (net labels, refdes) on a
  // dense capture. Takes precedence over reveal/boxed.
  if (zoom) return withRecapture(<ZoomableImage src={src} alt={alt} caption={caption} />);

  // Small, odd-aspect schematic crops render inside a fixed white box with
  // `object-contain` (the vector scales to FIT, no tall-narrow balloon). `reveal`
  // wraps that box in a collapsed <details> (a try-first "check your work");
  // `boxed` shows the same box always-open (a teaching diagram beside the prose).
  if (reveal || boxed) {
    const boxedFigure = (
      <figure className="space-y-2">
        <div className="mx-auto h-[24rem] w-full max-w-[34rem] rounded border border-panel-border bg-diagram-surface">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            loading="lazy"
            className="h-full w-full object-contain p-2"
          />
        </div>
        {caption ? (
          <figcaption className="text-center font-mono text-xs uppercase tracking-wider text-muted">
            {caption}
          </figcaption>
        ) : null}
      </figure>
    );
    // The recapture launcher sits OUTSIDE the collapsed <details> so an admin can
    // re-shot without expanding the "See it wired" reveal first.
    if (!reveal) return withRecapture(boxedFigure);
    return withRecapture(
      <details className="rounded border border-panel-border bg-deep-space/40 p-3">
        <summary className="cursor-pointer select-none font-mono text-[11px] uppercase tracking-wider text-command-gold transition-colors hover:text-gold-light">
          {reveal}
        </summary>
        <div className="mt-3">{boxedFigure}</div>
      </details>,
    );
  }
  const figure = (
    <figure className="space-y-2">
      {inlineSvg ? (
        // House-style diagram inlined so it inherits the page's Space Mono.
        // Trusted build asset (see resolveInlineDiagrams); not user content.
        <div
          className="guide-diagram w-full overflow-hidden rounded border border-panel-border bg-deep-space"
          role="img"
          aria-label={alt}
          dangerouslySetInnerHTML={{ __html: inlineSvg }}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="w-full rounded border border-panel-border bg-deep-space"
        />
      )}
      {caption ? (
        <figcaption className="font-mono text-xs uppercase tracking-wider text-muted">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
  return withRecapture(figure);
}

// Video block. An mp4 source plays inline (controls); an empty src renders the
// placeholder slot, so build footage can be slotted in once it's filmed.
function VideoBlock({
  src,
  alt,
  caption,
  captureHint,
  cardId,
  blockIndex,
  isAdmin,
}: {
  src: string;
  alt: string;
  caption?: string;
  captureHint?: string;
  cardId?: string;
  blockIndex?: number;
  isAdmin?: boolean;
}) {
  if (!src) {
    // Admin-only: a student (non-admin) sees nothing for an unshot clip; admins
    // keep the placeholder + capture "+". (Mirrors ImageBlock.)
    if (isAdmin && cardId && blockIndex !== undefined) {
      return (
        <div className="space-y-2">
          <MediaPlaceholder kind="video" description={caption || alt} />
          <CaptureLauncher
            key="capture-add"
            kind="video"
            cardId={cardId}
            blockIndex={blockIndex}
            captureHint={captureHint}
            caption={caption}
          />
        </div>
      );
    }
    return null;
  }
  const figure = (
    <figure className="space-y-2">
      <video
        controls
        preload="metadata"
        aria-label={alt || undefined}
        src={src}
        className="w-full rounded border border-panel-border bg-deep-space"
      />
      {caption ? (
        <figcaption className="font-mono text-xs uppercase tracking-wider text-muted">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
  if (
    isAdmin &&
    cardId &&
    blockIndex !== undefined &&
    src.startsWith("/api/shot/")
  ) {
    return (
      <div className="space-y-2">
        {figure}
        <CaptureLauncher
          key="capture-redo"
          kind="video"
          cardId={cardId}
          blockIndex={blockIndex}
          captureHint={captureHint}
          caption={caption}
          existing
          currentSrc={src}
        />
      </div>
    );
  }
  return figure;
}

function ProseBlock({ md }: { md: string }) {
  return (
    <p className="whitespace-pre-wrap font-serif text-base leading-relaxed text-gray-2">
      <Inline text={sanitizeProse(md)} />
    </p>
  );
}

// A prose block that is NOTHING but a short bold phrase ("**References**") is a
// section label, not a sentence — render it as a Space-Mono eyebrow with a gold
// tick and a hairline rule that closes the row (the same section-header language
// as the diagram eyebrow), instead of a bold paragraph. Guarded tight (letters /
// spaces / & only, ≤ 24 chars) so ordinary emphatic lines — "**Important.**",
// "**Note:**" — stay prose.
const SECTION_LABEL_RE = /^\*\*([A-Za-z][A-Za-z &]{0,23})\*\*$/;

function SectionEyebrow({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-3 pt-1 font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-command-gold">
      <span aria-hidden="true">▸</span>
      <span className="shrink-0">{label}</span>
      <span aria-hidden="true" className="h-px flex-1 bg-panel-border" />
    </p>
  );
}

// Optional "go deeper" disclosure — the surface stays plain; the math/why is one
// click away. Native <details> (no JS needed, keyboard/screen-reader accessible),
// COLLAPSED by default. The body renders like prose (sanitized + inline terms).
function DeepDiveBlock({ summary, body }: { summary: string; body: string }) {
  return (
    <details className="group rounded border border-panel-border bg-deep-space/40">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider [&::-webkit-details-marker]:hidden">
        <span className="text-gold-dim transition-transform group-open:rotate-90">
          ▸
        </span>
        <span className="text-gold-dim">Deep dive</span>
        <span className="text-command-gold">· {summary}</span>
      </summary>
      <div className="border-t border-panel-border px-4 py-3">
        <p className="whitespace-pre-wrap font-serif text-base leading-relaxed text-gray-2">
          <Inline text={sanitizeProse(body)} />
        </p>
      </div>
    </details>
  );
}

function CalloutBlock({
  severity,
  label,
  body,
}: {
  severity: "critical" | "warn" | "info";
  label: string;
  body: string;
}) {
  return (
    <div className={`callout ${SEVERITY_CLASS[severity]}`}>
      <span className="callout-label">{label}</span>
      <p className="whitespace-pre-wrap font-serif">
        <Inline text={body} />
      </p>
    </div>
  );
}

// C9a — the alert ladder. Three rungs, each with its own SHAPE as well as its own
// colour, so severity survives greyscale, print and colour-blindness. A bare
// "Gotcha" used to render as the same flat grey box as everything else, which is
// how a trap that costs a re-spin ended up reading as weightless.
//
// Colours are token vars, never literal hex, so every rung flips under
// `[data-theme="light"]`. `note` deliberately takes the hairline colour: the
// bottom rung should recede, not compete with the teaching spine.
const RUNG_META: Record<Rung, { accent: string; spine: string }> = {
  note: { accent: "text-muted", spine: "var(--color-panel-border)" },
  caution: { accent: "text-command-gold", spine: "var(--color-command-gold)" },
  warning: { accent: "text-alert-red", spine: "var(--color-alert-red)" },
};

function AlertBlock({
  rung,
  word,
  headline,
  body,
}: {
  rung: Rung;
  word: string;
  headline: string | null;
  body: string;
}) {
  const R = RUNG_META[rung];
  // Split the body at the FIRST sentence boundary: the trap, then what it costs.
  // "then" labels the consequence so the two are read as cause and price, not as
  // one undifferentiated paragraph.
  const cut = body.indexOf(". ");
  const trap = cut > 0 ? body.slice(0, cut + 1) : body;
  const cost = cut > 0 ? body.slice(cut + 2) : "";
  return (
    <section className="border-l-2 pl-4" style={{ borderColor: R.spine }}>
      <span
        className={`flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] ${R.accent}`}
      >
        <RungGlyph rung={rung} />
        {headline ? `${word} · ${headline}` : word}
      </span>
      {trap ? (
        <p className="mt-1.5 whitespace-pre-wrap font-serif text-[15px] leading-relaxed text-muted">
          <Inline text={trap} />
        </p>
      ) : null}
      {cost ? (
        <p className="mt-1.5 flex gap-2.5">
          <span
            aria-hidden
            className={`shrink-0 font-mono text-[9px] uppercase tracking-[0.2em] ${R.accent}`}
          >
            then
          </span>
          <span className="whitespace-pre-wrap font-serif text-[15px] leading-relaxed text-muted">
            <Inline text={cost} />
          </span>
        </p>
      ) : null}
    </section>
  );
}

// E6d1 — the aside. A glyph and its verb sitting in a break in a hairline: the
// classic manual divider, so an aside reads as a pause in the teaching spine
// rather than another block standing on it at the same weight.
//
// The verb set is closed (see ASIDE_VERBS); an unlisted verb falls through to the
// generic callout.
const ASIDE_GLYPH: Record<AsideVerb, ReactNode> = {
  Keys: (
    <>
      <rect x="2.5" y="6.5" width="19" height="11" rx="1" />
      <path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M7.5 14h9" />
    </>
  ),
  Alternative: (
    <>
      <path d="M5 3v6a4 4 0 0 0 4 4h10" />
      <path d="M16 10l3 3-3 3" />
      <path d="M5 21v-4" />
    </>
  ),
};

function AsideBlock({
  verb,
  headline,
  body,
}: {
  verb: AsideVerb;
  headline: string;
  body: string;
}) {
  return (
    <section>
      <div className="flex items-center gap-2.5">
        <span aria-hidden className="h-px w-6 bg-panel-border" />
        <svg
          className="h-3.5 w-3.5 shrink-0 text-muted"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          {ASIDE_GLYPH[verb]}
        </svg>
        <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted">
          {verb}
        </span>
        <span aria-hidden className="h-px flex-1 bg-panel-border" />
      </div>
      <p className="mt-2 font-serif text-[15px] font-semibold leading-snug text-title">
        {headline}
      </p>
      {body ? (
        <p className="mt-1 whitespace-pre-wrap font-serif text-[15px] leading-relaxed text-muted">
          <Inline text={body} />
        </p>
      ) : null}
    </section>
  );
}

function StepsBlock({
  ordered,
  items,
}: {
  ordered: boolean;
  items: string[];
}) {
  const className =
    "ml-6 space-y-1 font-serif text-base leading-relaxed text-muted " +
    (ordered ? "list-decimal" : "list-disc");
  const lis = items.map((item, i) => (
    <li key={i}>
      <Inline text={item} />
    </li>
  ));
  return ordered ? (
    <ol className={className}>{lis}</ol>
  ) : (
    <ul className={className}>{lis}</ul>
  );
}

// ── Role-styled callouts ──────────────────────────────────────────────
// A callout's ROLE is encoded in its label ("Exit this stage", "Check yourself",
// "Draw it · …", "NN · …"). The flat grey `info` box made all of them read alike,
// so a student couldn't tell teaching from a self-test from a thing to DO from
// "how do I advance". These give each role its own shape — rendering only, so
// every card gets the new signposting without touching content.

// "Exit this stage" → the unmissable advance banner: gold-rimmed, the literal
// answer to "where do I go next".
function AdvanceBlock({ body }: { body: string }) {
  return (
    <div className="rounded-lg border border-command-gold/50 bg-command-gold/[0.06] px-5 py-4">
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-command-gold">
        ✓ Exit this stage
      </span>
      <p className="mt-2 whitespace-pre-wrap font-serif text-base leading-relaxed text-gray-1">
        <Inline text={body} />
      </p>
    </div>
  );
}

// "Check yourself" → the write-then-compare self-test (client island
// ./SelfCheckBlock): the learner writes an attempt, which unlocks the authored
// answer to compare. Body is "…question?  answer." — split at the last "?"
// inside the component. Imported at the top of this file.

// "Draw it · X" → a DO-THIS step: a gold mono kicker + hairline (the Design-
// Stages kicker motif), distinct from the boxed teaching callouts. The phase
// divider supplies the "Draw it" context, so the label drops that prefix.
function ActionCalloutBlock({ label, body }: { label: string; body: string }) {
  const title = label.split("·").pop()?.trim() || label;
  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-command-gold">
          Do · {title}
        </span>
        <span
          aria-hidden
          className="h-px flex-1 bg-gradient-to-r from-command-gold/30 to-transparent"
        />
      </div>
      <p className="mt-1.5 whitespace-pre-wrap font-serif text-base leading-relaxed text-gray-2">
        <Inline text={body} />
      </p>
    </div>
  );
}

// "NN · Title" → a real numbered section header, not another grey box — so the
// card's spine is scannable at a glance.
function SectionHeaderBlock({ label, body }: { label: string; body: string }) {
  const m = label.match(/^(\d+)\s*·\s*(.*)$/);
  const num = m?.[1] ?? "";
  const title = m?.[2] ?? label;
  return (
    <div className="border-t border-panel-border/60 pt-5">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-sm font-bold tabular-nums text-command-gold">
          {num}
        </span>
        <h3 className="font-mono text-sm font-bold uppercase tracking-[0.12em] text-gray-1">
          {title}
        </h3>
      </div>
      {body ? (
        <p className="mt-2 whitespace-pre-wrap font-serif text-base leading-relaxed text-muted">
          <Inline text={body} />
        </p>
      ) : null}
    </div>
  );
}

// A12b2 — the mode band. `[ do 02 / 06 ]` in the gate's own bracket vocabulary,
// the venue as a mono chip (NOT inside the Bebas title, which is what the old
// positional parse did), and a hairline closing the row.
//
// The fraction is per CARD: a learner three hours into SCHEMATIC is not asking
// "which band is this", they are asking how much is left.
//
// The mode vocabulary lives in `@/lib/guide-signposts` so the colours resolve
// through CSS custom properties and flip under `[data-theme="light"]`. The old
// MODE_STYLE map held literal hex and could not.
function ModeBandBlock({
  label,
  body,
  ord,
  of,
}: {
  label: string;
  body: string;
  ord: number;
  of: number;
}) {
  const parsed = parseModeLabel(label);
  if (!parsed) return null;
  const { mode, venue, title } = parsed;
  return (
    <section className="mt-3">
      <div className="flex items-center gap-3">
        <span
          className={`shrink-0 font-mono text-[11px] font-bold uppercase tracking-[0.2em] ${MODE_TEXT[mode]}`}
        >
          [ {mode}{" "}
          <span className="font-numeral text-sm tabular-nums">
            {String(ord).padStart(2, "0")}
          </span>
          <span className="text-muted"> / </span>
          <span className="font-numeral text-sm tabular-nums text-muted">
            {String(of).padStart(2, "0")}
          </span>{" "}
          ]
        </span>
        {venue ? (
          <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.18em] text-muted">
            {venue}
          </span>
        ) : null}
        <span
          aria-hidden
          className="h-px flex-1"
          style={{ background: `color-mix(in srgb, ${MODE_VAR[mode]} 40%, transparent)` }}
        />
      </div>
      <h2 className="mt-2 font-display text-3xl leading-none tracking-wide text-title">
        {title}
      </h2>
      {body ? (
        <p className="mt-2 whitespace-pre-wrap font-serif text-[15px] leading-relaxed text-muted">
          <Inline text={body} />
        </p>
      ) : null}
    </section>
  );
}

function TableCell({
  text,
  decoration,
  tone,
  label,
}: {
  text: string;
  decoration?: "ref" | "mpn" | "badge";
  tone?: "gold" | "blue" | "critical" | "dim";
  /** Column header — surfaced as a caption when the table stacks on mobile. */
  label?: string;
}) {
  if (decoration === "ref") {
    return (
      <td data-label={label}>
        <span className="ref">{text}</span>
      </td>
    );
  }
  if (decoration === "mpn") {
    return (
      <td data-label={label}>
        <span className="mpn">{text}</span>
      </td>
    );
  }
  if (decoration === "badge") {
    const toneClass = tone ? ` ${BADGE_TONE_CLASS[tone]}` : "";
    return (
      <td data-label={label}>
        <span className={`badge${toneClass}`}>{text}</span>
      </td>
    );
  }
  return (
    <td data-label={label}>
      {text ? (
        <span className="cell">
          <Inline text={text} />
        </span>
      ) : null}
    </td>
  );
}

// vendorCta — an external AFFILIATE call-to-action (GTM). Server-resolves the
// vendor key → its configured referral URL (affiliates.ts, env-driven) and renders
// a gold CTA link. rel="sponsored nofollow" is the correct marking for a paid /
// affiliate link, and an FTC disclosure line sits beneath. The affiliate ID lives
// in env, never in guide content.
function VendorCtaBlock({
  vendor,
  label,
  sublabel,
}: {
  vendor: AffiliateVendor;
  label: string;
  sublabel?: string;
}) {
  const { href } = affiliateLink(vendor);
  return (
    <div className="my-2 space-y-1.5">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer nofollow sponsored"
        className="inline-flex items-center gap-1.5 rounded border border-command-gold bg-navy-dark px-4 py-2 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space"
      >
        {label}
        <ExternalLinkIcon className="h-3.5 w-3.5 shrink-0" />
      </a>
      <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
        {sublabel ??
          "Affiliate link — buying through it supports the academy at no extra cost to you."}
      </p>
    </div>
  );
}

// kit — "The Bench" per-lesson tools list. Now the 9C-5 "tick what you own"
// checklist, extracted to the client ./KitBlock island (interactive owned-state
// + localStorage). Picks are resolved to tagged Amazon hrefs HERE (server-side:
// the associate tag is server-only) and passed in already-tagged.
function GuideBlock({
  block,
  index,
  models,
  bomRows,
  diagrams,
  quizContext,
  projectId,
  userId,
  isSignedIn,
  cardId,
  isAdmin,
  logbook,
  fig,
  band,
}: {
  block: ContentBlock;
  index: number;
  models?: Record<string, ResolvedModel>;
  bomRows?: BomRow[];
  diagrams?: Record<string, string>;
  quizContext?: QuizContext;
  projectId?: string;
  userId?: string;
  isSignedIn?: boolean;
  cardId?: string;
  isAdmin?: boolean;
  logbook?: LessonLogbook;
  /** This diagram's figure number in the lesson (image blocks whose src is a
   *  registry diagram), passed to ImageBlock so the bare frame shows "Fig N". */
  fig?: number;
  /** This mode band's position among the card's bands, for A12b2's fraction. */
  band?: { ord: number; of: number };
}) {
  switch (block.type) {
    case "prose": {
      const m = block.md.trim().match(SECTION_LABEL_RE);
      if (m) return <SectionEyebrow label={m[1]} />;
      return <ProseBlock md={block.md} />;
    }

    case "heading": {
      // A real semantic section heading (h2/h3) for long lessons: scannable for
      // readers, snippet-eligible for search. Bebas display, subordinate to the
      // page H1, with a top margin that opens a new section.
      const Tag = block.level === 3 ? "h3" : "h2";
      return (
        <Tag
          className={`mb-1 mt-9 font-display font-normal leading-tight tracking-wide text-title first:mt-0 ${
            block.level === 3 ? "text-xl" : "text-2xl"
          }`}
        >
          {block.text}
        </Tag>
      );
    }

    case "callout": {
      // Dispatch by the label's ROLE so teaching / do-this / self-check / exit
      // each read distinctly (see the role-styled callout components above).
      const label = block.label ?? "";
      if (/^exit this stage/i.test(label))
        return <AdvanceBlock body={block.body} />;
      if (/^check yourself/i.test(label))
        return <SelfCheckBlock body={block.body} severity={block.severity} />;
      if (/^draw it\b/i.test(label))
        return <ActionCalloutBlock label={label} body={block.body} />;
      if (/^\d+\s*·/.test(label))
        return <SectionHeaderBlock label={label} body={block.body} />;
      if (/^mode\b/i.test(label))
        return (
          <ModeBandBlock
            label={label}
            body={block.body}
            ord={band?.ord ?? 1}
            of={band?.of ?? 1}
          />
        );
      const alert = parseAlertLabel(label, block.severity);
      if (alert) return <AlertBlock {...alert} body={block.body} />;
      const aside = parseAsideLabel(label);
      if (aside) return <AsideBlock {...aside} body={block.body} />;
      return (
        <CalloutBlock severity={block.severity} label={label} body={block.body} />
      );
    }

    case "steps":
      return <StepsBlock ordered={block.ordered} items={block.items} />;

    case "table":
      return (
        <table className="table-tech">
          <thead>
            <tr>
              {block.columns.map((col, i) => (
                <th key={i}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <TableCell
                    key={ci}
                    text={cell.text}
                    decoration={cell.decoration}
                    tone={cell.tone}
                    label={block.columns[ci]}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );

    case "termRef":
      return <GlossaryTerm term={block.term} />;

    case "partModel":
      return (
        <PartModelBlock
          caption={block.caption}
          model={block.mpn ? models?.[block.mpn] : undefined}
        />
      );

    case "bomTable":
      return <BomTableBlock caption={block.caption} rows={bomRows} collapsed={block.collapsed} />;

    case "image":
      return (
        <ImageBlock
          src={block.src}
          alt={block.alt}
          caption={block.caption}
          reveal={block.reveal}
          boxed={block.boxed}
          zoom={block.zoom}
          captureHint={block.captureHint}
          cardId={cardId}
          blockIndex={index}
          isAdmin={isAdmin}
          inlineSvg={block.src ? diagrams?.[block.src] : undefined}
          fig={fig}
        />
      );

    case "video":
      return (
        <VideoBlock
          src={block.src}
          alt={block.alt}
          caption={block.caption}
          captureHint={block.captureHint}
          cardId={cardId}
          blockIndex={index}
          isAdmin={isAdmin}
        />
      );

    case "youtube":
      // An unfilled embed (empty videoId) is an ADMIN-ONLY affordance, mirroring
      // the image/video empty slot: a student sees NOTHING (no half-built slot),
      // but an admin gets a "to be added" placeholder naming the video, so a
      // not-yet-filled section-hero / island slot is visible + fillable in the
      // editor instead of a silent gap. YouTube isn't captured in-app, so there's
      // no capture "+" — the author sets the id via the block editor.
      if (!block.videoId) {
        if (!isAdmin) return null;
        return (
          <div className="my-6 flex flex-col items-center justify-center gap-2 rounded border border-dashed border-panel-border bg-deep-space/40 px-6 py-10 text-center">
            <VideoIcon className="h-7 w-7 text-muted" />
            <span className="font-mono text-xs uppercase tracking-wider text-muted">
              YouTube — add id
            </span>
            {block.title || block.caption ? (
              <span className="max-w-md font-serif text-sm text-muted">
                {block.title || block.caption}
              </span>
            ) : null}
          </div>
        );
      }
      return (
        <figure className="my-6">
          <YouTubeEmbed
            videoId={block.videoId}
            title={block.title}
            start={block.start}
          />
          {block.caption || block.title ? (
            <figcaption className="mt-2 text-center font-mono text-xs uppercase tracking-wider text-muted">
              {block.caption ?? block.title}
            </figcaption>
          ) : null}
        </figure>
      );

    case "quiz":
      // Frame the comprehension check as a distinct CHECKPOINT — a hairline +
      // gold eyebrow break the flat block stream into learn → check rhythm.
      return (
        <section className="border-t border-panel-border/60 pt-6">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-command-gold">
            Checkpoint
          </p>
          <QuizBlock
            prompt={block.prompt}
            questions={block.questions}
            context={quizContext}
            logbook={
              logbook
                ? {
                    ...(logbook.mode === "course"
                      ? {
                          mode: "course" as const,
                          enrollmentId: logbook.enrollmentId,
                          stage: logbook.stage,
                        }
                      : { mode: "library" as const, slug: logbook.slug }),
                    signedIn: logbook.signedIn,
                    signInHref: logbook.signInHref,
                    questionKeys: logbook.questionKeysByBlock[index] ?? [],
                    state: logbook.state,
                  }
                : undefined
            }
          />
        </section>
      );

    case "deepDive":
      return <DeepDiveBlock summary={block.summary} body={block.body} />;

    case "action":
      // A "do this now" moment — same hairline + eyebrow treatment as the
      // checkpoint so the card's actionable beats stand out from the prose.
      return (
        <section className="border-t border-panel-border/60 pt-6">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-command-gold">
            Do this
          </p>
          <GuideActionButton
            action={block.action}
            label={block.label}
            projectId={projectId}
            isSignedIn={isSignedIn}
          />
        </section>
      );

    case "vendorCta":
      return (
        <section className="border-t border-panel-border/60 pt-6">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-command-gold">
            Order
          </p>
          <VendorCtaBlock
            vendor={block.vendor}
            label={block.label}
            sublabel={block.sublabel}
          />
        </section>
      );

    case "kit": {
      // Resolve each pick's ASIN → tagged Amazon href HERE (server-side; the
      // associate tag is server-only), then hand the client checklist island
      // already-tagged hrefs. The owned-state checklist persists per lesson.
      const kitItems: KitItem[] = block.items.map((it) => ({
        label: it.label,
        need: it.need,
        note: it.note,
        picks: it.picks?.map((p) => ({
          label: p.label,
          href: amazonProductLink(p.asin).href,
        })),
      }));
      return (
        <KitBlock
          intro={block.intro}
          items={kitItems}
          storageKey={`otd:bench:${userId ?? "anon"}:${projectId ?? "anon"}`}
        />
      );
    }

    case "sourceRef": {
      // href is scheme-validated by the schema (http(s):// or root-relative).
      // External links leave the guide, so open them in a new tab (with
      // `rel="noopener noreferrer"` for safety) and mark them with an
      // external-link icon; internal root-relative links stay in the same tab.
      const external = /^https?:\/\//.test(block.href);
      // Structure = information: the two hrefs serve two purposes, so they get
      // two looks. An EXTERNAL link is a supporting CITATION — quiet, serif, a
      // gold tick marker with a hanging indent so wrapped lines align like a
      // reference list, the external icon hugging the end. An INTERNAL link is
      // forward NAVIGATION — brighter (gray-1), a gold arrow that nudges right on
      // hover, reading as "next". Each stays a block so the parent stack spaces
      // them; consecutive refs no longer run together.
      if (external) {
        return (
          <div className="group">
            <a
              href={block.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${block.label} (opens in a new tab)`}
              className="block pl-5 -indent-5 text-sm leading-relaxed text-muted transition-colors hover:text-gray-1"
            >
              <span
                aria-hidden="true"
                className="mr-2 font-mono text-xs text-command-gold/70 transition-colors group-hover:text-command-gold"
              >
                ▸
              </span>
              <span className="font-serif">{block.label}</span>
              <ExternalLinkIcon className="ml-1 inline-block h-3 w-3 shrink-0 align-[-0.15em] text-muted/50 transition-colors group-hover:text-command-gold" />
            </a>
          </div>
        );
      }
      return (
        <div className="group">
          <a
            href={block.href}
            className="inline-flex items-baseline gap-2 font-serif text-base text-gray-1 transition-colors hover:text-command-gold"
          >
            <span
              aria-hidden="true"
              className="text-command-gold transition-transform group-hover:translate-x-0.5"
            >
              →
            </span>
            <span>{block.label}</span>
          </a>
        </div>
      );
    }

    case "calculator": {
      // Embed the live /tools calculator island inline. An unknown slug (not in
      // EMBED_ISLANDS) skips silently — same resilience rule as image/partModel.
      // The tools registry supplies the title + a link to the full calculator.
      const Island = EMBED_ISLANDS[block.slug];
      if (!Island) return null;
      const tool = getTool(block.slug);
      const label = tool ? (block.caption ?? tool.title) : block.caption;
      return (
        <figure className="my-6">
          <div className="rounded border border-panel-border bg-deep-space/40 p-4">
            <Island />
          </div>
          {label ? (
            <figcaption className="mt-2 text-center font-mono text-xs uppercase tracking-wider text-muted">
              {tool ? (
                <a
                  href={`/tools/${block.slug}`}
                  className="transition-colors hover:text-command-gold"
                >
                  {label} ↗
                </a>
              ) : (
                label
              )}
            </figcaption>
          ) : null}
        </figure>
      );
    }

    case "math": {
      // KaTeX rendered server-side to static HTML (no client JS). The tex is
      // admin-authored, so the markup is trusted. Display math centers and scrolls
      // if it overflows a narrow column; inline math flows in the line.
      const display = block.display ?? true;
      const html = katex.renderToString(block.tex, {
        displayMode: display,
        throwOnError: false,
      });
      return display ? (
        <div
          className="my-5 overflow-x-auto text-center text-text"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <span className="text-text" dangerouslySetInnerHTML={{ __html: html }} />
      );
    }

    default:
      // Unknown/extra block type → skip silently (resilience).
      return null;
  }
}

export function GuideBlocks({
  blocks,
  models,
  bomRows,
  diagrams,
  quizContext,
  projectId,
  isSignedIn,
  userId,
  isEnrolled = false,
  cardId,
  isAdmin,
  stage,
  serverResume = null,
  lessonBase = null,
  logbook,
}: {
  blocks: ContentBlock[];
  models?: Record<string, ResolvedModel>;
  bomRows?: BomRow[];
  diagrams?: Record<string, string>;
  quizContext?: QuizContext;
  projectId?: string;
  isSignedIn?: boolean;
  logbook?: LessonLogbook;
  // The viewer's user id — scopes the resume localStorage key so a record can
  // never leak across accounts on a shared browser. Undefined = anonymous.
  userId?: string;
  // Whether the viewer is an enrolled learner in this board. Resume is only
  // offered to an enrolled learner (or an anon reading a public lesson); it is
  // never offered to a signed-in non-enrollee (e.g. an admin preview, or a brand
  // new account that has not started this lesson).
  isEnrolled?: boolean;
  cardId?: string;
  isAdmin?: boolean;
  // Resume-position sync (Task 7): the current stage + the signed-in learner's
  // server record for it, merged with localStorage by the rail/pill.
  stage?: string;
  serverResume?: ResumeRecord | null;
  /** This lesson's guide base URL (`/projects/<slug>/<revLabel>/guide`) so a
   *  glossary term with a `where.stage` pointer can link to the stage that
   *  hands over the thing it names. Null outside a lesson. */
  lessonBase?: string | null;
}) {
  // Phase signposting is now carried by the per-card "Mode · …" ribbons
  // (ModeBandBlock) and the gold "Do ·" action blocks. The old hard-coded
  // "Draw it in KiCad" divider — injected before the first "Draw it ·" block of
  // ANY card — mislabelled the browser/bench cards (it told ORDERING and
  // ASSEMBLY learners to open KiCad) and double-announced the mode shift on the
  // ribboned cards, so it's been removed.
  // Island jump-nav (guide-pacing plan). Anchors let the rail's scroll-spy and
  // #island-NN deep-links target numbered sections. Anchored blocks get a
  // scroll-mt wrapper; everything else renders unchanged so the space-y-5
  // rhythm and PDF/readiness linear rendering are untouched.
  const islands = scanIslands(blocks);
  const anchorByIndex = new Map(islands.map((is) => [is.blockIndex, is.anchorId]));
  // The rail auto-rolls out wherever the numbered convention yields >= 3
  // islands (2-section cards skip it). storageKey is per-card and shared with
  // Task 6's resume layer.
  const showRail = islands.length >= RAIL_MIN_ISLANDS;
  // User-scoped resume key (no cross-account leak). Resume is only OFFERED to an
  // enrolled learner or an anonymous reader (someone who has actually seen the
  // content), never to a signed-in non-enrollee.
  const railKey = resumeKey(userId, projectId, cardId);
  const resumeEnabled = !isSignedIn || isEnrolled;

  // "Setup · …" ranges collapse into a SetupBand. Islands terminate a range, so
  // no anchored block ever falls inside one — the two derivations don't collide.
  const setupRanges = deriveSetupRanges(blocks);
  const setupStart = new Map(setupRanges.map((r) => [r.start, r]));

  // Figure numbers for in-lesson diagrams: an image block whose src resolves to a
  // registry diagram gets the next "Fig N" (plain images get none). Drives the bare
  // frame's corner label; the standalone export stays fully titled.
  const figByIndex = new Map<number, number>();
  {
    let n = 0;
    blocks.forEach((b, i) => {
      if (b.type === "image" && b.src && DIAGRAM_COMPONENTS[b.src]) figByIndex.set(i, ++n);
    });
  }

  // Mode-band ordinals, same shape as the figure scan: each band's position among
  // the bands IN THIS CARD, so A12b2 can render `[ do 02 / 06 ]`.
  const bandByIndex = scanModeBands(blocks);

  // The stage-gate quiz (WI-2): the quiz block flagged `gate: true`, else the first
  // quiz block. Only THIS block receives the gate `quizContext`, so only it records a
  // QuizPass; any other quiz blocks are practice mini-quizzes that still award
  // per-pick XP via `logbook`. Mirrors recordQuizPass's server-side selection so the
  // client and the gate never disagree on which block opens the stage.
  const gateQuizIndex = (() => {
    let firstQuiz = -1;
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i]!;
      if (b.type !== "quiz") continue;
      if (firstQuiz === -1) firstQuiz = i;
      if (b.gate) return i;
    }
    return firstQuiz;
  })();

  // One block → its anchor-wrapped (or plain) element. Reused inside the band.
  const renderBlock = (block: ContentBlock, i: number) => {
    const anchorId = anchorByIndex.get(i);
    const gb = (
      <GuideBlock
        block={block}
        index={i}
        models={models}
        bomRows={bomRows}
        diagrams={diagrams}
        quizContext={i === gateQuizIndex ? quizContext : undefined}
        projectId={projectId}
        userId={userId}
        isSignedIn={isSignedIn}
        cardId={cardId}
        isAdmin={isAdmin}
        logbook={logbook}
        fig={figByIndex.get(i)}
        band={bandByIndex.get(i)}
      />
    );
    return anchorId ? (
      <div key={i} id={anchorId} className="scroll-mt-24">
        {gb}
      </div>
    ) : (
      <Fragment key={i}>{gb}</Fragment>
    );
  };

  const out: ReactNode[] = [];
  for (let i = 0; i < blocks.length; ) {
    const range = setupStart.get(i);
    if (range) {
      // The Setup callout (range.start) becomes the band summary, not body.
      const children: ReactNode[] = [];
      for (let j = range.start + 1; j < range.end; j++) children.push(renderBlock(blocks[j]!, j));
      out.push(
        <SetupBand key={`setup-${i}`} title={range.title} count={range.end - range.start - 1} storageKey={railKey}>
          {children}
        </SetupBand>,
      );
      i = range.end;
    } else {
      out.push(renderBlock(blocks[i]!, i));
      i++;
    }
  }

  return (
    <LessonProvider lessonBase={lessonBase}>
      <div className="space-y-5">
        {showRail ? (
          <IslandRail
            islands={islands}
            storageKey={railKey}
            serverResume={resumeEnabled ? serverResume : null}
            // Server-sync (writes Enrollment.resumeState) only for an enrolled
            // learner — a non-enrollee has no enrollment row to write to.
            syncProjectId={isEnrolled ? projectId : undefined}
            syncStage={isEnrolled ? stage : undefined}
          />
        ) : null}
        {out}
        {showRail && resumeEnabled ? (
          <ResumePill
            islands={islands}
            storageKey={railKey}
            serverResume={serverResume}
          />
        ) : null}
      </div>
    </LessonProvider>
  );
}
