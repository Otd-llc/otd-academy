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
import { GlossaryTerm } from "@/components/GlossaryTerm";
import { ModelViewerLazy } from "@/components/ModelViewerLazy";
import { QuizBlock, type QuizContext } from "@/components/guide/QuizBlock";
import { GuideActionButton } from "@/components/guide/GuideActionButton";
import { CaptureLauncher } from "@/components/guide/CaptureLauncher";
import {
  affiliateLink,
  amazonProductLink,
  type AffiliateVendor,
} from "@/lib/affiliates";
import { ExternalLinkIcon, PhotoIcon, VideoIcon } from "@/components/icons";
import { parseInlineTerms } from "@/lib/inline-terms";
import type { RenderBounds } from "@/lib/schemas/part-asset";

// A partModel block's resolved 3D render, keyed by MPN. The card route presigns
// the part's MODEL_3D render URL + camera bounds server-side and passes this map
// in; a block whose MPN isn't present degrades to its caption.
export type ResolvedModel = { src: string; bounds: RenderBounds | null };

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

// "Draw it · X" → a DO-THIS step: gold left-rule, distinct from the boxed
// teaching callouts. The phase divider supplies the "Draw it" context, so the
// label drops that prefix.
function ActionCalloutBlock({ label, body }: { label: string; body: string }) {
  const title = label.split("·").pop()?.trim() || label;
  return (
    <div className="border-l-2 border-l-command-gold pl-4">
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-command-gold">
        Do · {title}
      </span>
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
      <Inline text={text} />
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
  return (
    <section className="border-t border-panel-border/60 pt-6">
      <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-command-gold">
        The bench
      </p>
      {intro ? (
        <p className="mb-4 whitespace-pre-wrap font-serif text-base leading-relaxed text-gray-2">
          <Inline text={intro} />
        </p>
      ) : null}
      <ul className="space-y-3">
        {items.map((it, i) => {
          const need = it.need ? KIT_NEED[it.need] : null;
          return (
            <li
              key={i}
              className="border-l border-panel-border/70 pl-3 leading-relaxed"
            >
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                {need ? (
                  <span className={`badge ${need.tone}`}>{need.label}</span>
                ) : null}
                <span className="font-serif text-base font-medium text-gray-1">
                  {it.label}
                </span>
                {it.note ? (
                  <span className="font-serif text-sm text-muted">
                    — <Inline text={it.note} />
                  </span>
                ) : null}
              </div>
              {it.picks && it.picks.length > 0 ? (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {it.picks.map((p, j) => (
                    <a
                      key={j}
                      href={amazonProductLink(p.asin).href}
                      target="_blank"
                      rel="noopener noreferrer nofollow sponsored"
                      className="inline-flex items-center gap-1 rounded border border-command-gold/60 px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space"
                    >
                      {p.label || "Shop"}
                      <ExternalLinkIcon className="h-3 w-3 shrink-0" />
                    </a>
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className="mt-4 font-mono text-[11px] uppercase tracking-wider text-muted">
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
  diagrams?: Record<string, string>;
  quizContext?: QuizContext;
  projectId?: string;
  isSignedIn?: boolean;
  cardId?: string;
  isAdmin?: boolean;
}) {
  switch (block.type) {
    case "prose":
      return <ProseBlock md={block.md} />;

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
      return (
        <a
          href={block.href}
          {...(external
            ? {
                target: "_blank",
                rel: "noopener noreferrer",
                "aria-label": `${block.label} (opens in a new tab)`,
              }
            : {})}
          className="inline-flex items-center gap-1 text-link-muted underline decoration-dotted underline-offset-2 transition-colors hover:text-signal-blue"
        >
          {block.label}
          {external ? (
            <ExternalLinkIcon className="h-3.5 w-3.5 shrink-0" />
          ) : null}
        </a>
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
  diagrams,
  quizContext,
  projectId,
  isSignedIn,
  cardId,
  isAdmin,
}: {
  blocks: ContentBlock[];
  models?: Record<string, ResolvedModel>;
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
  return (
    <div className="space-y-5">
      {blocks.map((block, i) => (
        <GuideBlock
          key={i}
          block={block}
          index={i}
          models={models}
          diagrams={diagrams}
          quizContext={quizContext}
          projectId={projectId}
          isSignedIn={isSignedIn}
          cardId={cardId}
          isAdmin={isAdmin}
        />
      ))}
    </div>
  );
}
