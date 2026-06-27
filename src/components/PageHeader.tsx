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
  /**
   * A single trailing word/phrase of `title` to render gold. Kept for
   * back-compat; prefer `accentWords` for headlines with internal gold words.
   */
  accentWord?: string;
  /**
   * Words in `title` to render in gold, wherever they appear. Punctuation around
   * a matched word stays ivory, so "One mind. Many machines." with
   * `["mind","machines"]` reads ivory→gold→ivory→ivory→gold→ivory.
   */
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

/**
 * Render `title` as nodes, wrapping each whole-word occurrence of an `accents`
 * word in a gold `<span class="accent">`. Leading/trailing punctuation on a
 * matched token stays OUTSIDE the span (ivory), which is what produces the
 * white → gold → white headline (the period after a gold word is not gold).
 */
export function highlightTitle(
  title: string,
  accents: string[],
): React.ReactNode[] {
  const trimmed = title.trim();
  const wanted = new Set(
    accents
      .map((a) => a.trim().toLowerCase().replace(/[^\p{L}\p{N}]/gu, ""))
      .filter(Boolean),
  );

  // Render a run of plain text, wrapping every period in a hollow `.tdot` span
  // (the title period's hollow/outline look). Other characters pass through.
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

  if (wanted.size === 0) {
    return [<Fragment key="t">{text(trimmed, "t")}</Fragment>];
  }

  // Keep the whitespace runs as their own tokens so spacing is preserved.
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
    if (core && wanted.has(core.toLowerCase())) {
      return (
        <Fragment key={i}>
          {text(pre, `${i}p`)}
          <span className="accent">{core}</span>
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
  accentWord,
  accentWords,
  lead,
}: PageHeaderProps) {
  const rawAccents = accentWords ?? (accentWord ? [accentWord] : []);
  // A single-word title can't show the white → gold → white contrast on the
  // words (golding the only word makes the whole title gold). So for one-word
  // titles the WORD stays white and the gold moves to the period instead.
  const singleWord =
    title.trim().split(/\s+/).filter(Boolean).length === 1;
  const accents = singleWord ? [] : rawAccents;
  const titleNodes = highlightTitle(title, accents);
  // House rule: every page title ends with a period. If the title doesn't
  // already end in terminal punctuation, append one. It renders OUTSIDE any
  // gold accent span, so it's always the ivory title colour — the white period
  // of the "One Mind. Many Machines." treatment, on every page title.
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
              <span className={singleWord ? "tdot accent" : "tdot"}>.</span>
            ) : null}
          </span>
        </span>
      </h1>

      {lead ? <p className="subhead">{lead}</p> : null}
    </header>
  );
}
