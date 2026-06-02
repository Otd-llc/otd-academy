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

function ProseBlock({ md }: { md: string }) {
  return (
    <p className="whitespace-pre-wrap font-serif text-base leading-relaxed text-muted">
      {sanitizeProse(md)}
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
      <p className="whitespace-pre-wrap font-serif">{body}</p>
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

function GuideBlock({ block }: { block: ContentBlock }) {
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

export function GuideBlocks({ blocks }: { blocks: ContentBlock[] }) {
  return (
    <div className="space-y-4">
      {blocks.map((block, i) => (
        <GuideBlock key={i} block={block} />
      ))}
    </div>
  );
}
