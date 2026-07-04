// Shared inline guide-text renderer — emphasis (**bold**/*italic*) + `[[term]]`
// glossary popovers. Extracted from GuideBlocks so BOTH the server block
// renderer AND the client KitBlock (an interactive island) render note/prose
// text the same way. No "use client": it renders <GlossaryTerm> (itself a
// client component), which a server OR client parent can host, so this module
// stays framework-neutral.

import { Fragment, type ReactNode } from "react";
import { GlossaryTerm } from "@/components/GlossaryTerm";
import { parseInlineTerms } from "@/lib/inline-terms";

// Resolve `[[term]]` / `[[term|label]]` markers in a run of text into
// click-to-read <GlossaryTerm> popovers (plain text otherwise). Pure split
// lives in `@/lib/inline-terms`; an unknown term degrades to plain text.
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

// Emphasis (**bold**/*italic*) is the OUTER layer — a bold/italic run can wrap a
// [[term]] (e.g. "**a filled [[ground pour]]**") — so we split emphasis FIRST,
// then resolve glossary terms inside each run (and inside the plain text
// between). Splitting terms first would orphan the `**` across segments. Bold is
// a restrained medium weight + a slightly brighter ink (gray-1 over gray-2
// body); italic is true italic. XSS-safe: only **/* and [[term]] are parsed; all
// other text is escaped — no HTML injected, no dangerouslySetInnerHTML.
export function Inline({ text }: { text: string }) {
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
