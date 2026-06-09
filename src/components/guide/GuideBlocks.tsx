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

import { Fragment } from "react";
import sanitizeHtml from "sanitize-html";
import type { ContentBlock } from "@/lib/schemas/guide";
import { GlossaryTerm } from "@/components/GlossaryTerm";
import { ModelViewerLazy } from "@/components/ModelViewerLazy";
import { QuizBlock, type QuizContext } from "@/components/guide/QuizBlock";
import { GuideActionButton } from "@/components/guide/GuideActionButton";
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

// Render text with inline `[[term]]` / `[[term|label]]` markers as a mix of
// plain text and click-to-read <GlossaryTerm> popovers. Pure split lives in
// `@/lib/inline-terms`; an unknown term degrades to plain text in GlossaryTerm.
function Inline({ text }: { text: string }) {
  const segments = parseInlineTerms(text);
  return (
    <>
      {segments.map((seg, i) =>
        seg.kind === "term" ? (
          <GlossaryTerm key={i} term={seg.term}>
            {seg.label}
          </GlossaryTerm>
        ) : (
          <span key={i}>{seg.value}</span>
        ),
      )}
    </>
  );
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
}: {
  src: string;
  alt: string;
  caption?: string;
}) {
  if (!src) return <MediaPlaceholder kind="photo" description={caption || alt} />;
  return (
    <figure className="space-y-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="w-full rounded border border-panel-border bg-deep-space"
      />
      {caption ? (
        <figcaption className="font-mono text-xs uppercase tracking-wider text-muted">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

// Video block. An mp4 source plays inline (controls); an empty src renders the
// placeholder slot, so build footage can be slotted in once it's filmed.
function VideoBlock({
  src,
  alt,
  caption,
}: {
  src: string;
  alt: string;
  caption?: string;
}) {
  if (!src) return <MediaPlaceholder kind="video" description={caption || alt} />;
  return (
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
  const lis = items.map((item, i) => <li key={i}>{item}</li>);
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

// Phase divider — marks a hard shift within a card (SCHEMATIC's
// understand-the-circuit → draw-it-in-KiCad), rendered before the first
// "Draw it ·" block.
function PhaseDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pt-3">
      <span className="h-px flex-1 bg-command-gold/30" />
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-command-gold">
        {label}
      </span>
      <span className="h-px flex-1 bg-command-gold/30" />
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
  return <td data-label={label}>{text}</td>;
}

function GuideBlock({
  block,
  models,
  quizContext,
  projectId,
  isSignedIn,
}: {
  block: ContentBlock;
  models?: Record<string, ResolvedModel>;
  quizContext?: QuizContext;
  projectId?: string;
  isSignedIn?: boolean;
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
        <ImageBlock src={block.src} alt={block.alt} caption={block.caption} />
      );

    case "video":
      return (
        <VideoBlock src={block.src} alt={block.alt} caption={block.caption} />
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
  quizContext,
  projectId,
  isSignedIn,
}: {
  blocks: ContentBlock[];
  models?: Record<string, ResolvedModel>;
  quizContext?: QuizContext;
  projectId?: string;
  isSignedIn?: boolean;
}) {
  // Mark the understand → "draw it" phase shift (SCHEMATIC) with a divider
  // before the first "Draw it ·" block.
  const drawStartIdx = blocks.findIndex(
    (b) => b.type === "callout" && /^draw it\b/i.test(b.label ?? ""),
  );
  return (
    <div className="space-y-5">
      {blocks.map((block, i) => (
        <Fragment key={i}>
          {i === drawStartIdx ? <PhaseDivider label="Draw it in KiCad" /> : null}
          <GuideBlock
            block={block}
            models={models}
            quizContext={quizContext}
            projectId={projectId}
            isSignedIn={isSignedIn}
          />
        </Fragment>
      ))}
    </div>
  );
}
