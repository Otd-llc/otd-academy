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

import sanitizeHtml from "sanitize-html";
import type { ContentBlock } from "@/lib/schemas/guide";
import { GlossaryTerm } from "@/components/GlossaryTerm";
import { ModelViewerLazy } from "@/components/ModelViewerLazy";
import { QuizBlock } from "@/components/guide/QuizBlock";
import { PhotoIcon, VideoIcon } from "@/components/icons";
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
    <p className="whitespace-pre-wrap font-serif text-base leading-relaxed text-muted">
      <Inline text={sanitizeProse(md)} />
    </p>
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

function TableCell({
  text,
  decoration,
  tone,
}: {
  text: string;
  decoration?: "ref" | "mpn" | "badge";
  tone?: "gold" | "blue" | "critical" | "dim";
}) {
  if (decoration === "ref") {
    return (
      <td>
        <span className="ref">{text}</span>
      </td>
    );
  }
  if (decoration === "mpn") {
    return (
      <td>
        <span className="mpn">{text}</span>
      </td>
    );
  }
  if (decoration === "badge") {
    const toneClass = tone ? ` ${BADGE_TONE_CLASS[tone]}` : "";
    return (
      <td>
        <span className={`badge${toneClass}`}>{text}</span>
      </td>
    );
  }
  return <td>{text}</td>;
}

function GuideBlock({
  block,
  models,
}: {
  block: ContentBlock;
  models?: Record<string, ResolvedModel>;
}) {
  switch (block.type) {
    case "prose":
      return <ProseBlock md={block.md} />;

    case "callout":
      return (
        <CalloutBlock
          severity={block.severity}
          label={block.label}
          body={block.body}
        />
      );

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
      return <QuizBlock prompt={block.prompt} questions={block.questions} />;

    case "sourceRef":
      // href is scheme-validated by the schema (http(s):// or root-relative).
      return (
        <a
          href={block.href}
          className="text-link-muted underline decoration-dotted underline-offset-2 transition-colors hover:text-signal-blue"
        >
          {block.label}
        </a>
      );

    default:
      // Unknown/extra block type → skip silently (resilience).
      return null;
  }
}

export function GuideBlocks({
  blocks,
  models,
}: {
  blocks: ContentBlock[];
  models?: Record<string, ResolvedModel>;
}) {
  return (
    <div className="space-y-4">
      {blocks.map((block, i) => (
        <GuideBlock key={i} block={block} models={models} />
      ))}
    </div>
  );
}
