// Bench-styled page header (design §8 / plan Task 8.2).
//
// Pure presentational; safe as a server component (no client hooks, no state).
// Renders the capability-brief title stack:
//   - a `.title-rule` gold-gradient hairline (the "document top")
//   - optional `.nav-back` breadcrumb (ChevronLeftIcon + {backLabel})
//   - `.meta-strip` of mono key/value pairs with "/" `.sep` separators
//   - `.bench-hero` Bebas title — warm ivory, thick-stroked "fat" glyphs, with a
//     gold `.ord` eyebrow and gold `.accent` WORDS (punctuation stays ivory, so
//     a headline reads white → gold → white, matching BriefDocument)
//   - optional `.subhead` Lora-italic lead
//
// The CSS recipes live in `src/app/globals.css` (@layer components, Task 8.1).

import { Fragment } from "react";
import { ChevronLeftIcon } from "@/components/icons";

export interface PageHeaderMeta {
  label: string;
  value: React.ReactNode;
}

export interface PageHeaderProps {
  /** Optional back-breadcrumb target. Omit to hide `.nav-back`. */
  backHref?: string;
  /** Visible label for the back link. Defaults to "Back". */
  backLabel?: string;
  /** Mono key/value pairs rendered in the `.meta-strip`. */
  meta?: PageHeaderMeta[];
  /** Small gold `.ord` eyebrow above the title (e.g. "PHASE 04"). */
  eyebrow: string;
  /** The hero title. */
  title: string;
  /** @deprecated Ignored. Titles now auto-alternate ivory → gold by word. */
  accentWord?: string;
  /** @deprecated Ignored. Titles now auto-alternate ivory → gold by word. */
  accentWords?: string[];
  /** Optional Lora-italic `.subhead` lead beneath the title. */
  lead?: string;
}

/**
 * Split a hero `title` into a plain `head` and an optional trailing `accent`
 * word/phrase. Retained for back-compat and unit-tested directly;
 * `highlightTitle` (below) is what the component renders with.
 */
export function splitTitle(
  title: string,
  accentWord?: string,
): { head: string; accent: string | null } {
  const trimmedTitle = title.trim();
  const trimmedAccent = accentWord?.trim();

  if (!trimmedAccent) {
    return { head: trimmedTitle, accent: null };
  }

  const lowerTitle = trimmedTitle.toLowerCase();
  const lowerAccent = trimmedAccent.toLowerCase();

  if (lowerTitle === lowerAccent) {
    return { head: trimmedTitle, accent: null };
  }

  const suffix = " " + lowerAccent;
  if (!lowerTitle.endsWith(suffix)) {
    return { head: trimmedTitle, accent: null };
  }

  const headLength = trimmedTitle.length - trimmedAccent.length;
  const head = trimmedTitle.slice(0, headLength).trimEnd();
  const accent = trimmedTitle.slice(headLength).trim();
  return { head, accent };
}

// Small function words stay ivory and don't consume a gold slot, so the
// alternation tracks the meaningful words: "Built to pass" → Built ivory, to
// ivory, pass gold (not "to" gold).
const FUNCTION_WORDS = new Set([
  "a", "an", "the", "to", "of", "and", "or", "for", "in", "on", "at", "by",
  "as", "it", "is", "its", "with", "from", "into", "onto", "per", "via", "vs",
  "but", "no",
]);

/** The alphanumeric core of a token, lowercased — "" for pure punctuation. */
function wordKey(token: string): string {
  return token.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

/** A real (gold-eligible) word: has letters/digits and isn't a function word. */
export function isContentWord(token: string): boolean {
  const k = wordKey(token);
  return k.length > 0 && !FUNCTION_WORDS.has(k);
}

/**
 * Render `title` as nodes with the house alternation: ivory → gold across the
 * CONTENT words — the first content word ivory, the second gold, the third
 * ivory, and so on. Function words (the / to / of / …) stay ivory and never
 * shift the cadence. Periods are wrapped in a hollow `.tdot` span. The pattern
 * is automatic, so a title can't be mis-coloured (e.g. "Reference Guides" is
 * always Reference ivory, Guides gold).
 */
export function highlightTitle(title: string): React.ReactNode[] {
  const trimmed = title.trim();

  // Wrap every period in a hollow `.tdot` span; other characters pass through.
  const text = (s: string, key: string): React.ReactNode => {
    if (!s.includes(".")) return s;
    return s.split(/(\.)/g).map((part, i) =>
      part === "." ? (
        <span key={`${key}-${i}`} className="tdot">
          .
        </span>
      ) : (
        <Fragment key={`${key}-${i}`}>{part}</Fragment>
      ),
    );
  };

  let content = 0;
  return trimmed.split(/(\s+)/).map((tok, i) => {
    if (tok === "" || /^\s+$/.test(tok)) {
      return <Fragment key={i}>{tok}</Fragment>;
    }
    // Peel leading + trailing punctuation off the alphanumeric core.
    const m = tok.match(
      /^([^\p{L}\p{N}]*)([\p{L}\p{N}](?:.*[\p{L}\p{N}])?)?([^\p{L}\p{N}]*)$/u,
    );
    const pre = m?.[1] ?? "";
    const core = m?.[2] ?? "";
    const post = m?.[3] ?? "";
    if (core) {
      const gold = isContentWord(core) && ++content % 2 === 0;
      return (
        <Fragment key={i}>
          {text(pre, `${i}p`)}
          {gold ? <span className="accent">{core}</span> : core}
          {text(post, `${i}o`)}
        </Fragment>
      );
    }
    return <Fragment key={i}>{text(tok, `${i}w`)}</Fragment>;
  });
}

export function PageHeader({
  backHref,
  backLabel = "Back",
  meta = [],
  eyebrow,
  title,
  lead,
}: PageHeaderProps) {
  const titleNodes = highlightTitle(title);
  // Every page title ends with a hollow period. Its colour follows the words:
  // a title with two-plus content words carries a gold word, so the period is
  // ivory; a one-word title has no gold word, so the gold moves to the period.
  const hasGoldWord =
    title.trim().split(/\s+/).filter(isContentWord).length >= 2;
  const needsPeriod = !/[.!?…]$/.test(title.trim());

  return (
    <header className="mb-10">
      {backHref ? (
        <a href={backHref} className="nav-back">
          <span className="arrow inline-flex" aria-hidden="true">
            <ChevronLeftIcon className="h-3.5 w-3.5" />
          </span>
          {backLabel}
        </a>
      ) : null}

      <div className={`title-rule ${backHref ? "mt-5" : ""}`} aria-hidden="true" />

      {meta.length > 0 ? (
        <p className="meta-strip">
          {meta.map((item, i) => (
            <span key={`${item.label}-${i}`} className="inline-flex gap-2">
              {i > 0 ? (
                <span className="sep" aria-hidden="true">
                  /
                </span>
              ) : null}
              <span className="label">{item.label}</span>
              <span>{item.value}</span>
            </span>
          ))}
        </p>
      ) : null}

      <h1 className={`bench-hero ${meta.length > 0 ? "mt-6" : ""}`}>
        <span className="ord">{eyebrow}</span>
        <span className="hero-line">
          <span>
            {titleNodes}
            {needsPeriod ? (
              <span className={hasGoldWord ? "tdot" : "tdot accent"}>.</span>
            ) : null}
          </span>
        </span>
      </h1>

      {lead ? <p className="subhead">{lead}</p> : null}
    </header>
  );
}
