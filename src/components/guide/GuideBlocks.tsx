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

import { Fragment, type CSSProperties, type ReactNode } from "react";
import sanitizeHtml from "sanitize-html";
import type { ContentBlock } from "@/lib/schemas/guide";
import { scanIslands, RAIL_MIN_ISLANDS } from "@/lib/guide-islands";
import { IslandRail } from "@/components/guide/IslandRail";
import { GlossaryTerm } from "@/components/GlossaryTerm";
import { ModelViewerLazy } from "@/components/ModelViewerLazy";
import { QuizBlock, type QuizContext } from "@/components/guide/QuizBlock";
import { DIAGRAM_COMPONENTS } from "@/components/guide/diagram-registry";
import { GuideActionButton } from "@/components/guide/GuideActionButton";
import { CaptureLauncher } from "@/components/guide/CaptureLauncher";
import { PartMpnLink } from "@/components/guide/PartMpnLink";
import { YouTubeEmbed } from "@/components/guide/YouTubeEmbed";
import { buildFastAddUrl } from "@/lib/digikey-cart";
import {
  affiliateLink,
  amazonProductLink,
  type AffiliateVendor,
} from "@/lib/affiliates";
import { ExternalLinkIcon, PhotoIcon, VideoIcon } from "@/components/icons";
import { parseInlineTerms } from "@/lib/inline-terms";
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

// Resolve `[[term]]` / `[[term|label]]` markers in a run of text into click-to-read
// <GlossaryTerm> popovers (plain text otherwise). Pure split lives in
// `@/lib/inline-terms`; an unknown term degrades to plain text in GlossaryTerm.
function withTerms(text: string, keyPrefix: string): ReactNode[] {
  return parseInlineTerms(text).map((seg, i) =>
    seg.kind === "term" ? (
      <GlossaryTerm key={`${keyPrefix}-${i}`} term={seg.term}>
        {seg.label}
      </GlossaryTerm>
    ) : (
      <Fragment key={`${keyPrefix}-${i}`}>{seg.value}</Fragment>
    ),
  );
}

// Inline guide-text renderer. Emphasis (**bold**/*italic*) is the OUTER layer — a
// bold/italic run can wrap a [[term]] (e.g. "**a filled [[ground pour]]**") — so we
// split emphasis FIRST, then resolve glossary terms inside each run (and inside the
// plain text between). Splitting terms first would orphan the `**` across segments.
// Bold is a restrained medium weight + a slightly brighter ink (gray-1 over gray-2
// body), kept distinct from the gold terms; italic is true italic. XSS-safe: only
// **/* and [[term]] are parsed; all other text is escaped — no HTML injected, no
// dangerouslySetInnerHTML (the established convention).
function Inline({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let last = 0;
  let n = 0;
  for (const m of text.matchAll(/\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*/g)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push(...withTerms(text.slice(last, idx), `p${n}`));
    out.push(
      m[1] !== undefined ? (
        <strong key={`b${n}`} className="font-medium text-gray-1">
          {withTerms(m[1], `b${n}`)}
        </strong>
      ) : (
        <em key={`i${n}`} className="italic">
          {withTerms(m[2], `i${n}`)}
        </em>
      ),
    );
    last = idx + m[0].length;
    n++;
  }
  if (last < text.length) out.push(...withTerms(text.slice(last), `p${n}`));
  return <>{out}</>;
}

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
  return (
    <figure className="space-y-2">
      <ModelViewerLazy src={model.src} bounds={model.bounds} />
      {caption ? (
        <figcaption className="font-mono text-xs uppercase tracking-wider text-muted">
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
}: {
  caption?: string;
  rows?: BomRow[];
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
  const fastAddUrl = buildFastAddUrl(
    rows.map((r) => ({ dkPartNumber: r.dkPartNumber, quantity: r.qty, refDes: r.refDes })),
  );
  const cartMissing = rows.filter((r) => r.dkPartNumber == null).length;
  return (
    <figure className="space-y-2">
      <table className="table-tech">
        <thead>
          <tr>
            <th>Ref</th>
            <th>Qty</th>
            <th>Part</th>
            <th>Description</th>
            {tableHasDk ? (
              <>
                <th>Unit $</th>
                <th>Ext. $</th>
              </>
            ) : null}
            <th>Datasheet</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td data-label="Ref">
                <span className="ref">{r.refDes}</span>
              </td>
              <td data-label="Qty">{r.qty}</td>
              <td data-label="Part">
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
                  <span className="mt-0.5 block font-mono text-[11px] normal-case text-muted">
                    {r.manufacturer}
                  </span>
                ) : null}
              </td>
              <td data-label="Description">{r.description ?? ""}</td>
              {tableHasDk ? (
                <>
                  <td data-label="Unit $" className="text-muted">
                    {r.dkUnitPriceCents != null ? formatUsd(r.dkUnitPriceCents) : "—"}
                  </td>
                  <td data-label="Ext. $" className="text-muted">
                    {r.dkUnitPriceCents != null
                      ? formatUsd(r.qty * r.dkUnitPriceCents)
                      : "—"}
                  </td>
                </>
              ) : null}
              <td data-label="Datasheet">
                {httpUrlOrNull(r.datasheetUrl) ? (
                  <a
                    href={httpUrlOrNull(r.datasheetUrl)!}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="inline-flex items-center gap-1 text-signal-blue underline decoration-dotted underline-offset-2 hover:text-command-gold"
                  >
                    PDF
                    <ExternalLinkIcon className="h-3 w-3 shrink-0" />
                  </a>
                ) : r.hasDatasheet ? (
                  <span className="text-muted" title="Datasheet on file in the parts library">
                    on file
                  </span>
                ) : (
                  <span className="font-mono text-[11px] uppercase tracking-wider text-alert-red">
                    missing
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
      {tableHasDk && fastAddUrl ? (
        <div className="mt-2">
          <a
            href={fastAddUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="glass-button inline-flex items-center gap-2 px-4 py-2 font-mono text-xs uppercase tracking-[0.14em]"
          >
            Add whole BOM to DigiKey cart
            <span className="text-[10px] text-gold-dim">DigiKey</span>
          </a>
          {cartMissing > 0 ? (
            <p className="mt-1 font-mono text-[11px] normal-case text-muted">
              {cartMissing} line{cartMissing === 1 ? "" : "s"} not yet linked to DigiKey — add {cartMissing === 1 ? "it" : "them"} by MPN.
            </p>
          ) : null}
        </div>
      ) : null}
    </figure>
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
  captureHint,
  cardId,
  blockIndex,
  isAdmin,
  inlineSvg,
}: {
  src: string;
  alt: string;
  caption?: string;
  reveal?: string;
  boxed?: boolean;
  captureHint?: string;
  cardId?: string;
  blockIndex?: number;
  isAdmin?: boolean;
  /** House-style diagram SVG markup, inlined so it inherits the site's
   *  Space Mono (an <img> SVG can't use the page webfont). When set, the
   *  figure renders the SVG inline instead of <img src>. */
  inlineSvg?: string;
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
    return <DiagramComponent caption={caption} />;
  }
  // Small, odd-aspect schematic crops render inside a fixed white box with
  // `object-contain` (the vector scales to FIT, no tall-narrow balloon). `reveal`
  // wraps that box in a collapsed <details> (a try-first "check your work");
  // `boxed` shows the same box always-open (a teaching diagram beside the prose).
  if (reveal || boxed) {
    const boxedFigure = (
      <figure className="space-y-2">
        <div className="mx-auto h-[24rem] w-full max-w-[34rem] rounded border border-panel-border bg-white">
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
    if (!reveal) return boxedFigure;
    return (
      <details className="rounded border border-panel-border bg-deep-space/40 p-3">
        <summary className="cursor-pointer select-none font-mono text-[11px] uppercase tracking-wider text-command-gold transition-colors hover:text-gold-light">
          {reveal}
        </summary>
        <div className="mt-3">{boxedFigure}</div>
      </details>
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
  // Admins can re-capture a shot they took (an /api/shot/ src) — not the baked-in
  // SVG diagrams.
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
          kind="image"
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

// "Check yourself" → an interactive self-test: the question shows, the answer is
// one tap away (native <details>, no JS). Body is "…question?  answer." — split
// at the last "?" so the prompt is the summary and the rest is the reveal.
function SelfCheckBlock({
  body,
  severity,
}: {
  body: string;
  severity: "critical" | "warn" | "info";
}) {
  const cut = body.lastIndexOf("?");
  const question = cut >= 0 ? body.slice(0, cut + 1).trim() : body.trim();
  const answer = cut >= 0 ? body.slice(cut + 1).trim() : "";
  const accent = severity === "critical" ? "text-alert-red" : "text-signal-blue";
  return (
    <details className="group rounded border border-panel-border bg-deep-space/40">
      <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span
          className={`mt-1 shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.18em] ${accent}`}
        >
          Check
        </span>
        <span className="flex-1 font-serif text-base leading-relaxed text-gray-1">
          <Inline text={question} />
        </span>
        {answer ? (
          <span className="mt-0.5 shrink-0 font-mono text-[10px] uppercase tracking-wider text-gold-dim group-open:hidden">
            Show
          </span>
        ) : null}
      </summary>
      {answer ? (
        <div className="border-t border-panel-border py-3 pl-[4.25rem] pr-4">
          <p className="whitespace-pre-wrap font-serif text-base leading-relaxed text-gray-2">
            <Inline text={answer} />
          </p>
        </div>
      ) : null}
    </details>
  );
}

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

// "Mode · <eyebrow> · <title>" → a full-width, colour-coded section ribbon that tells
// the learner which MODE they're in — read (orient) vs hands-on (do) vs verify (check)
// — so "should I have hands on the keyboard right now?" is never ambiguous. The COLOUR
// keys off the first word of the eyebrow; the eyebrow text itself is free ("do — in
// KiCad", "do — at the bench", …) so the same ribbon generalises across stages.
// The colour keys off the eyebrow's first word; the eyebrow text is free
// ("do — in KiCad", "do — at the bench", …) so the same band generalises.
const MODE_STYLE: Record<string, { color: string; eyebrow: string }> = {
  orient: { color: "#4a8fff", eyebrow: "text-signal-blue" },
  do: { color: "#c8963e", eyebrow: "text-command-gold" },
  check: { color: "#8fe3a0", eyebrow: "text-status-green" },
};

// A thin-line mark per mode, stroke = the eyebrow colour (currentColor): a
// reticle for orient ("get your bearings"), a play glyph for do (hands on), a
// check for check.
function ModeIcon({ mode }: { mode: string }) {
  const p = {
    className: "h-3.5 w-3.5 shrink-0",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (mode === "orient")
    return (
      <svg {...p}>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      </svg>
    );
  if (mode === "check")
    return (
      <svg {...p}>
        <circle cx="12" cy="12" r="8" />
        <path d="m8.5 12 2.4 2.4 4.6-5.2" />
      </svg>
    );
  return (
    <svg {...p} fill="currentColor" stroke="none">
      <path d="M8 5.5v13l10.5-6.5z" />
    </svg>
  );
}

// A briefing-panel section marker: a colour-coded left spine, a soft corner glow
// and a registration tick (the same command motif as the start-here beacon),
// with the title set in the brand display face. `.mode-band` lives in
// globals.css; `--mode` is the band colour, set inline per variant.
function ModeBandBlock({ label, body }: { label: string; body: string }) {
  const parts = label.split("·").map((s) => s.trim());
  const eyebrow = parts[1] ?? "";
  const key = (eyebrow.split(/[\s—–-]+/)[0] || "do").toLowerCase();
  const title = parts.slice(2).join(" · ");
  const M = MODE_STYLE[key] ?? MODE_STYLE.do;
  return (
    <div className="mode-band" style={{ "--mode": M.color } as CSSProperties}>
      <span
        className={`flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.24em] ${M.eyebrow}`}
      >
        <ModeIcon mode={key} />
        {eyebrow}
      </span>
      {title ? (
        <h2 className="mt-1.5 font-display text-2xl leading-none tracking-wide text-gray-1">
          {title}
        </h2>
      ) : null}
      {body ? (
        <p className="mt-2 whitespace-pre-wrap font-serif text-sm leading-relaxed text-muted">
          <Inline text={body} />
        </p>
      ) : null}
    </div>
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

// kit — the unified "bench" list. Each tool shows its Need badge, a
// what-to-look-for note, and tagged Amazon picks (a single "Shop" link, or
// Budget/Hobby/Pro chips for the big-ticket items). Picks resolve ASIN → tagged
// link via amazonProductLink; an item with no picks renders as plain text so the
// list stages cleanly. The Amazon agreement REQUIRES the "As an Amazon Associate…"
// disclosure, so it renders unconditionally beneath the list.
const KIT_NEED: Record<
  "required" | "recommended" | "helpful",
  { tone: string; label: string }
> = {
  required: { tone: "gold", label: "Required" },
  recommended: { tone: "blue", label: "Recommended" },
  helpful: { tone: "dim", label: "Helpful" },
};
function KitBlock({
  intro,
  items,
}: {
  intro?: string;
  items: {
    label: string;
    need?: "required" | "recommended" | "helpful";
    note?: string;
    picks?: { label?: string; asin: string }[];
  }[];
}) {
  // Group by Need so the badge appears ONCE per tier (not on every row) — the
  // main declutter. Items with no need fall through into a trailing group.
  const groups = (["required", "recommended", "helpful"] as const).map(
    (need) => ({ need, meta: KIT_NEED[need], gi: items.filter((it) => it.need === need) }),
  );
  const ungrouped = items.filter((it) => !it.need);

  const renderItem = (
    it: (typeof items)[number],
    i: number,
  ) => (
    <li key={i}>
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className="font-serif text-base font-medium text-gray-1">
          {it.label}
        </span>
        {it.picks && it.picks.length > 0 ? (
          <span className="flex flex-wrap gap-1.5">
            {it.picks.map((p, j) => (
              <a
                key={j}
                href={amazonProductLink(p.asin).href}
                target="_blank"
                rel="noopener noreferrer nofollow sponsored"
                className="inline-flex items-center gap-1 rounded border border-command-gold/55 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space"
              >
                {p.label || "Shop"}
                <ExternalLinkIcon className="h-2.5 w-2.5 shrink-0" />
              </a>
            ))}
          </span>
        ) : null}
      </div>
      {it.note ? (
        <p className="mt-0.5 font-serif text-sm leading-snug text-muted">
          <Inline text={it.note} />
        </p>
      ) : null}
    </li>
  );

  return (
    <section className="border-t border-panel-border/60 pt-6">
      <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-command-gold">
        The bench
      </p>
      {intro ? (
        <p className="mb-5 whitespace-pre-wrap font-serif text-base leading-relaxed text-gray-2">
          <Inline text={intro} />
        </p>
      ) : null}
      <div className="space-y-5">
        {groups.map(({ need, meta, gi }) =>
          gi.length ? (
            <div key={need}>
              <div className="mb-2.5 flex items-center gap-3">
                <span className={`badge ${meta.tone}`}>{meta.label}</span>
                <span className="h-px flex-1 bg-panel-border/40" />
              </div>
              <ul className="space-y-3">{gi.map(renderItem)}</ul>
            </div>
          ) : null,
        )}
        {ungrouped.length ? (
          <ul className="space-y-3">{ungrouped.map(renderItem)}</ul>
        ) : null}
      </div>
      <p className="mt-5 font-mono text-[11px] uppercase tracking-wider text-muted">
        As an Amazon Associate, the academy earns from qualifying purchases — at
        no extra cost to you.
      </p>
    </section>
  );
}

function GuideBlock({
  block,
  index,
  models,
  bomRows,
  diagrams,
  quizContext,
  projectId,
  isSignedIn,
  cardId,
  isAdmin,
}: {
  block: ContentBlock;
  index: number;
  models?: Record<string, ResolvedModel>;
  bomRows?: BomRow[];
  diagrams?: Record<string, string>;
  quizContext?: QuizContext;
  projectId?: string;
  isSignedIn?: boolean;
  cardId?: string;
  isAdmin?: boolean;
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
        return <ModeBandBlock label={label} body={block.body} />;
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
      return <BomTableBlock caption={block.caption} rows={bomRows} />;

    case "image":
      return (
        <ImageBlock
          src={block.src}
          alt={block.alt}
          caption={block.caption}
          reveal={block.reveal}
          boxed={block.boxed}
          captureHint={block.captureHint}
          cardId={cardId}
          blockIndex={index}
          isAdmin={isAdmin}
          inlineSvg={block.src ? diagrams?.[block.src] : undefined}
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
      // An unfilled embed (empty videoId) renders nothing — mirrors the video
      // block's empty-src placeholder rule (the Library page has no admin capture
      // affordance, so there's nothing to show for a not-yet-filled slot).
      if (!block.videoId) return null;
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

    case "kit":
      return <KitBlock intro={block.intro} items={block.items} />;

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
  cardId,
  isAdmin,
}: {
  blocks: ContentBlock[];
  models?: Record<string, ResolvedModel>;
  bomRows?: BomRow[];
  diagrams?: Record<string, string>;
  quizContext?: QuizContext;
  projectId?: string;
  isSignedIn?: boolean;
  cardId?: string;
  isAdmin?: boolean;
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
  const railKey = `otd:resume:${projectId ?? "anon"}:${cardId ?? "card"}`;
  return (
    <div className="space-y-5">
      {showRail ? <IslandRail islands={islands} storageKey={railKey} /> : null}
      {blocks.map((block, i) => {
        const anchorId = anchorByIndex.get(i);
        const gb = (
          <GuideBlock
            block={block}
            index={i}
            models={models}
            bomRows={bomRows}
            diagrams={diagrams}
            quizContext={quizContext}
            projectId={projectId}
            isSignedIn={isSignedIn}
            cardId={cardId}
            isAdmin={isAdmin}
          />
        );
        return anchorId ? (
          <div key={i} id={anchorId} className="scroll-mt-24">
            {gb}
          </div>
        ) : (
          <Fragment key={i}>{gb}</Fragment>
        );
      })}
    </div>
  );
}
