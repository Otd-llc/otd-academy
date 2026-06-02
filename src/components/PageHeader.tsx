// Bench-styled page header (design §8 / plan Task 8.2).
//
// Pure presentational; safe as a server component (no client hooks, no state).
// Renders the bench-console header stack:
//   - optional `.nav-back` breadcrumb ("← {backLabel}")
//   - `.meta-strip` of mono key/value pairs with "/" `.sep` separators
//   - `.bench-hero` Bebas title with a gold `.ord` eyebrow and an optional
//     trailing gold `.accent` word
//   - optional `.subhead` Lora-italic lead
//
// The CSS recipes live in `src/app/globals.css` (@layer components, Task 8.1).

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
  /** The hero title. Its trailing `accentWord` (if any) renders gold. */
  title: string;
  /** A trailing word/phrase of `title` to render in gold `.accent`. */
  accentWord?: string;
  /** Optional Lora-italic `.subhead` lead beneath the title. */
  lead?: string;
}

/**
 * Split a hero `title` into a plain `head` and an optional trailing `accent`
 * word/phrase (rendered gold). The match is on a trailing word boundary and is
 * case-insensitive, but the returned `accent` preserves the title's original
 * casing.
 *
 * Examples:
 *   splitTitle("INVENTORY CHECK", "CHECK") → { head: "INVENTORY", accent: "CHECK" }
 *   splitTitle("REQUIREMENTS")             → { head: "REQUIREMENTS", accent: null }
 *   splitTitle("INVENTORY CHECK", "FOO")   → { head: "INVENTORY CHECK", accent: null }
 *   splitTitle("BRINGUP", "BRINGUP")       → { head: "BRINGUP", accent: null }  (whole-title accent → white)
 */
export function splitTitle(
  title: string,
  accentWord?: string,
): { head: string; accent: string | null } {
  const trimmedTitle = title.trim();
  const trimmedAccent = accentWord?.trim();

  // No accent requested → whole title is the head.
  if (!trimmedAccent) {
    return { head: trimmedTitle, accent: null };
  }

  // The accent must be a trailing suffix on a word boundary, matched
  // case-insensitively.
  const lowerTitle = trimmedTitle.toLowerCase();
  const lowerAccent = trimmedAccent.toLowerCase();

  if (lowerTitle === lowerAccent) {
    // The accent would be the ENTIRE title → an all-gold hero with no white
    // anchor (and the gold `.ord` eyebrow already supplies the gold). Render the
    // whole title white instead; the eyebrow is the accent. This is what keeps
    // single-word stage titles (LAYOUT, BRINGUP, …) from becoming a wall of gold.
    return { head: trimmedTitle, accent: null };
  }

  const suffix = " " + lowerAccent;
  if (!lowerTitle.endsWith(suffix)) {
    // Not a trailing suffix → degrade gracefully to a plain title.
    return { head: trimmedTitle, accent: null };
  }

  const headLength = trimmedTitle.length - trimmedAccent.length;
  // Slice off the original-cased accent and trim the boundary space.
  const head = trimmedTitle.slice(0, headLength).trimEnd();
  const accent = trimmedTitle.slice(headLength).trim();
  return { head, accent };
}

export function PageHeader({
  backHref,
  backLabel = "Back",
  meta = [],
  eyebrow,
  title,
  accentWord,
  lead,
}: PageHeaderProps) {
  const { head, accent } = splitTitle(title, accentWord);

  return (
    <header className="mb-10">
      {backHref ? (
        <a href={backHref} className="nav-back">
          <span className="arrow" aria-hidden="true">
            ←
          </span>
          {backLabel}
        </a>
      ) : null}

      {meta.length > 0 ? (
        <p className="meta-strip mt-6">
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

      <h1 className="bench-hero mt-6">
        <span className="ord">{eyebrow}</span>
        {head}
        {accent ? (
          <>
            {head ? " " : null}
            <span className="accent">{accent}</span>
          </>
        ) : null}
      </h1>

      {lead ? <p className="subhead">{lead}</p> : null}
    </header>
  );
}
