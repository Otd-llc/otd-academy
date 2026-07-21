// The Library PDF — a print-faithful, no-drift render of the live mini-lesson
// content blocks (the same data the /library page renders). Two documents share
// one block renderer:
//   • LibraryPdf      — a single reference guide (its own header + the blocks).
//   • FieldGuidePdf   — the whole Library as one book: cover, contents, then
//                       every guide back-to-back.
// Generated server-side from the DB on each request, so a content edit shows up
// in the PDF with zero manual export (the whole point — no doc drift).
//
// Design: a warm-ivory PRINT document (not the dark web theme — dark wastes ink
// and reads poorly on paper) styled to the OTD house system (otd-frontend-design)
// with the four faces bundled for print (see library-fonts.ts):
//   Bebas   — display: cover title, lesson titles, section headings (CAPS)
//   Mono    — Space Mono labels: eyebrows, captions, footer, table heads
//   Numeral — Saira Condensed for the contents numbers
//   Serif   — Crimson Text body reading voice (the cert serif; the family stays
//             coherent with the certificate). Gold accent + warm hairlines + the
//             gold brandmark, on the cert print palette.
// House rule holds: no em-dashes in any rendered string; `·` is the separator.
import {
  Document,
  Page,
  View,
  Text,
  Image,
  Link,
  Svg,
  Path,
  Defs,
  LinearGradient,
  Stop,
  StyleSheet,
} from "@react-pdf/renderer";
import { type ReactNode } from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { ContentBlock } from "@/lib/schemas/guide";
import { parseInlineTerms } from "@/lib/inline-terms";
import { PDF_SAIRA_FALLBACK } from "@/lib/pdf/pdf-fallback-set";
import { BRANDMARK_PATH, BRANDMARK_VIEWBOX } from "@/lib/pdf/certificate-content";
import type { ResolvedImage } from "@/lib/pdf/library-images";
import { mathToPdf } from "@/lib/pdf/math-svg";
import { getTool } from "@/lib/tools/registry";
import type {
  FieldGuidePart,
  FieldGuideIntro as FieldGuideIntroData,
  FieldGuideOutro as FieldGuideOutroData,
  FieldGuideChrome,
} from "@/lib/pdf/field-guide-chrome";

export type LibraryPdfLesson = {
  slug: string;
  title: string;
  summary: string | null;
  byline: string | null;
  updatedAt: Date;
  blocks: ContentBlock[];
};

const IVORY = "#faf7f0";
const PAPER = "#ffffff";
const INK = "#14181f";
const GOLD = "#b5882e";
const GOLD_DEEP = "#8a6212"; // deeper gold for the big Saira numerals (cover / openers)
const GOLD_TINT = "#f6efe0";
const MUTED = "#6b7280";
const FAINT = "#9aa0ad";
const HAIR = "#d8d2c4";
const RED = "#b4453f";
const RED_TINT = "#f8ecea";
const BLUE = "#3a6ea5";

const CONTENT_W = 595.28 - 54 * 2; // A4 width minus the page's horizontal padding

// The corner watermark as a pre-rendered PNG (the brandmark + its 135deg gradient-alpha
// fill, baked by scripts/_gen-wm at build; regen if the mark changes). A PNG because
// react-pdf's View-render (used to draw it on the LAST page of a per-lesson PDF) paints
// an <Image> but NOT an <Svg>. Read once, as a data URI.
const WM_BRANDMARK_PNG: string | null = (() => {
  try {
    const buf = readFileSync(path.join(process.cwd(), "public", "otd-wm-brandmark.png"));
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return null; // missing asset → skip the watermark, never crash the PDF
  }
})();
const WM_W = 230;
const WM_H = WM_W * (400 / 418);

const s = StyleSheet.create({
  page: {
    backgroundColor: IVORY,
    color: INK,
    paddingTop: 54,
    paddingBottom: 60,
    paddingHorizontal: 54,
    fontFamily: "Serif",
    fontSize: 11,
    // NOTE: do NOT set `lineHeight` on the Page. A page-level lineHeight combined
    // with the big Saira cover numeral (its own lineHeight 0.78) corrupts
    // react-pdf 4.5.1's layout pass and silently kills the fixed `render` page
    // numbers document-wide. Body copy sets its own lineHeight per block instead.
  },
  // ── running header (fixed, A1) — section · doc, on a hairline ──
  runHeader: {
    position: "absolute",
    top: 30,
    left: 54,
    right: 54,
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 0.6,
    borderBottomColor: HAIR,
    paddingBottom: 5,
    fontFamily: "Mono",
    fontSize: 7.5,
    letterSpacing: 1.4,
    color: MUTED,
    textTransform: "uppercase",
  },
  runHeaderSection: { flex: 1 },
  runHeaderDoc: { color: FAINT, marginLeft: 10 },
  // ── running footer (fixed, A1) — url left, on a hairline. The page number is
  // a SEPARATE absolutely-positioned fixed element (below) so react-pdf evaluates
  // its dynamic page callback reliably; nesting the render Text inside this flex
  // row did not render. ──
  footer: {
    position: "absolute",
    bottom: 26,
    left: 54,
    right: 54,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderTopWidth: 0.6,
    borderTopColor: HAIR,
    paddingTop: 5,
    fontFamily: "Mono",
    fontSize: 7.5,
    letterSpacing: 1,
    color: FAINT,
    textTransform: "uppercase",
  },
  pageNum: {
    position: "absolute",
    bottom: 24,
    left: 54,
    right: 54,
    textAlign: "right",
    fontFamily: "Numeral",
    fontSize: 11,
    letterSpacing: 0,
    color: GOLD,
  },
  // ── lesson header ──
  eyebrow: {
    fontFamily: "Mono",
    fontSize: 8,
    letterSpacing: 2.5,
    color: GOLD,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  title: { fontFamily: "Bebas", fontSize: 33, color: INK, lineHeight: 0.95, letterSpacing: 0.4, textTransform: "uppercase" },
  summary: { fontFamily: "Serif", fontSize: 12, fontStyle: "italic", color: MUTED, marginTop: 8, lineHeight: 1.45 },
  headRule: { height: 1.4, backgroundColor: GOLD, marginTop: 14, marginBottom: 4 },
  byline: { fontFamily: "Mono", fontSize: 7.5, letterSpacing: 1.2, color: FAINT, textTransform: "uppercase", marginTop: 8 },
  // ── lesson opener — big Saira guide numeral beside the title block ──
  lhRow: { flexDirection: "row", alignItems: "flex-start" },
  // NOTE: letterSpacing must stay >= 0 here. A negative letterSpacing on a large
  // Saira numeral corrupts react-pdf's layout pass and silently kills the fixed
  // `render` page numbers on every later page (verified with @react-pdf 4.5.1).
  lhNum: { fontFamily: "Numeral", fontSize: 52, color: GOLD_DEEP, lineHeight: 0.8, letterSpacing: 0, marginRight: 16, marginTop: 0 },
  lhBody: { flex: 1 },
  // vertical separation when one guide's opener lands mid-page, right after the
  // previous guide's tail (the continuous-flow field guide). No effect worth
  // worrying about at the top of a freshly broken page.
  lessonFollow: { marginTop: 24 },

  // ── blocks ──
  prose: { fontFamily: "Serif", fontSize: 11, color: INK, marginTop: 9, lineHeight: 1.55 },
  bold: { fontWeight: 600 },
  italic: { fontStyle: "italic" },
  term: { color: GOLD },
  // Inline code (a part value / ref / unit) — deep-gold mono, sized down from
  // the 11pt Serif body so it reads as a token without towering over the prose.
  code: { fontFamily: "Mono", fontSize: 9.5, color: GOLD_DEEP, fontStyle: "normal", fontWeight: "normal" },
  h2: { fontFamily: "Bebas", fontSize: 19, color: INK, marginTop: 22, marginBottom: 4, letterSpacing: 0.5, textTransform: "uppercase" },
  h3: { fontFamily: "Bebas", fontSize: 14.5, color: INK, marginTop: 16, marginBottom: 3, letterSpacing: 0.6, textTransform: "uppercase" },
  sectionEyebrow: {
    fontFamily: "Mono",
    fontSize: 8.5,
    fontWeight: 700,
    letterSpacing: 2,
    color: GOLD,
    textTransform: "uppercase",
    marginTop: 18,
    marginBottom: 2,
    borderBottomWidth: 0.8,
    borderBottomColor: HAIR,
    paddingBottom: 5,
  },

  callout: { marginTop: 12, paddingVertical: 9, paddingHorizontal: 12, borderLeftWidth: 2.5, backgroundColor: GOLD_TINT },
  calloutLabel: { fontFamily: "Mono", fontSize: 8, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4 },
  calloutBody: { fontFamily: "Serif", fontSize: 10.5, color: INK, lineHeight: 1.5 },

  steps: { marginTop: 9, marginBottom: 2 },
  stepRow: { flexDirection: "row", marginBottom: 4 },
  stepMark: { fontFamily: "Mono", fontSize: 10, color: GOLD, width: 20 },
  stepText: { flex: 1, fontFamily: "Serif", fontSize: 11, color: INK, lineHeight: 1.5 },

  // doSteps / traceList. Print is static: there is no ticking and no reveal, so
  // everything the screen hides behind an interaction is printed OPEN. A field
  // guide the learner carries to the bench with the answer key withheld would be
  // worse than no field guide.
  signKicker: { fontFamily: "Mono", fontSize: 8, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: GOLD, marginTop: 12, marginBottom: 2 },
  signRevealRow: { flexDirection: "row", marginLeft: 20, marginBottom: 4 },
  signRevealLabel: { fontFamily: "Mono", fontSize: 7, letterSpacing: 1, textTransform: "uppercase", color: GOLD, width: 62 },
  signRevealText: { flex: 1, fontFamily: "Serif", fontSize: 9.5, color: MUTED, lineHeight: 1.45 },

  // tables
  table: { marginTop: 12, borderTopWidth: 1, borderTopColor: GOLD },
  thRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: GOLD, backgroundColor: GOLD_TINT },
  th: { flex: 1, fontFamily: "Mono", fontSize: 7.5, fontWeight: 700, letterSpacing: 0.8, color: INK, textTransform: "uppercase", padding: 5 },
  tr: { flexDirection: "row", borderBottomWidth: 0.6, borderBottomColor: HAIR },
  td: { flex: 1, fontFamily: "Serif", fontSize: 9.5, color: INK, padding: 5, lineHeight: 1.4 },
  tdMono: { flex: 1, fontFamily: "Mono", fontSize: 8.5, color: INK, padding: 5 },

  // figures — frameless (Diagram C). The exported light raster already carries the
  // diagram's own ivory frame + warm hairline, so the PDF adds no box around it.
  figure: { marginTop: 10, marginBottom: 4, alignItems: "center" },
  caption: { fontFamily: "Mono", fontSize: 7.5, letterSpacing: 1, color: MUTED, textTransform: "uppercase", marginTop: 6, textAlign: "center" },

  // quiz
  quizWrap: { marginTop: 16, borderTopWidth: 0.8, borderTopColor: HAIR, paddingTop: 10 },
  quizKicker: { fontFamily: "Mono", fontSize: 8, fontWeight: 700, letterSpacing: 2, color: GOLD, textTransform: "uppercase", marginBottom: 8 },
  quizQ: { fontFamily: "Serif", fontSize: 11, fontWeight: 600, color: INK, marginTop: 8, lineHeight: 1.4 },
  quizOpt: { fontFamily: "Serif", fontSize: 10, color: INK, marginTop: 2, marginLeft: 12, lineHeight: 1.4 },
  quizOptRight: { color: GOLD, fontWeight: 600 },
  quizAns: { fontFamily: "Mono", fontSize: 8, letterSpacing: 0.5, color: GOLD, textTransform: "uppercase", marginTop: 4, marginLeft: 12 },
  quizExplain: { fontFamily: "Serif", fontSize: 9.5, fontStyle: "italic", color: MUTED, marginTop: 2, marginLeft: 12, lineHeight: 1.4 },

  // deep dive
  deep: { marginTop: 12, borderWidth: 0.8, borderColor: HAIR, borderRadius: 2, padding: 11 },
  deepKicker: { fontFamily: "Mono", fontSize: 8, fontWeight: 700, letterSpacing: 1.2, color: GOLD, textTransform: "uppercase", marginBottom: 5 },

  // source refs — a small gold square marks each (a registration tick); the
  // on-page ▸/→ glyphs aren't in the bundled fonts, so a drawn View is used.
  ref: { flexDirection: "row", marginTop: 4, paddingLeft: 2 },
  refDot: { width: 3, height: 3, backgroundColor: GOLD, marginTop: 5.5, marginRight: 8 },
  refBody: { flex: 1, fontFamily: "Serif", fontSize: 9.5, color: INK, lineHeight: 1.4 },
  refHost: { fontFamily: "Mono", fontSize: 7.5, color: FAINT, textTransform: "lowercase" },
  link: { color: BLUE, textDecoration: "none" },

  // field-guide cover (F1 split) + contents
  coverSplit: { flexGrow: 1, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  // lineHeight 1 (never <1) keeps the line-box symmetric — see the page-number
  // layout note above. marginBottom raises the numeral's optical centre to sit
  // level with the FIELD GUIDE title: the right column's tall rule+2-line meta
  // below the title otherwise drag the alignItems:center anchor below it. Tuned
  // by eye against the rendered cover.
  coverBig: { fontFamily: "Numeral", fontSize: 168, color: GOLD_DEEP, lineHeight: 1, letterSpacing: 0, marginBottom: 150 },
  coverRight: { marginLeft: 24 },
  coverVolEyebrow: { fontFamily: "Mono", fontSize: 9, letterSpacing: 3, color: MUTED, textTransform: "uppercase" },
  coverTitle: { fontFamily: "Bebas", fontSize: 56, color: INK, letterSpacing: 1, lineHeight: 0.86, textTransform: "uppercase", marginTop: 6 },
  coverRule: { width: 70, height: 1.6, backgroundColor: GOLD, marginTop: 14, marginBottom: 12 },
  coverMeta: { fontFamily: "Mono", fontSize: 8.5, letterSpacing: 2, color: FAINT, textTransform: "uppercase", lineHeight: 1.8 },
  // The cover watermark anchor sits on the content-margin grid (the text column's
  // bottom-right corner: right = the 54pt horizontal margin, bottom = the 60pt bottom
  // margin), not flush to the page edge, so the mark reads as a placed element.
  wmCorner: { position: "absolute", right: 54, bottom: 60 },

  tocTitle: { fontFamily: "Bebas", fontSize: 30, color: INK, marginBottom: 6, letterSpacing: 0.4, textTransform: "uppercase" },

  // ── field-guide chrome (book-only: part dividers + intro/outro + CTA) ──
  // Part divider: a gold-topped band before each part's first guide.
  partBand: { marginTop: 2, marginBottom: 8, borderTopWidth: 1.4, borderTopColor: GOLD, paddingTop: 10 },
  partEyebrow: { fontFamily: "Mono", fontSize: 8, letterSpacing: 2.5, color: GOLD, textTransform: "uppercase" },
  partTitle: { fontFamily: "Bebas", fontSize: 27, color: INK, letterSpacing: 0.6, textTransform: "uppercase", marginTop: 3 },
  partBlurb: { fontFamily: "Serif", fontSize: 11, fontStyle: "italic", color: MUTED, marginTop: 4, lineHeight: 1.45 },
  // Intro / outro reading matter — a touch larger than body prose.
  matterBody: { marginTop: 12 },
  matterPara: { fontFamily: "Serif", fontSize: 12, color: INK, marginTop: 10, lineHeight: 1.6 },
  // Closing CTA panel.
  cta: { marginTop: 20, borderWidth: 1, borderColor: GOLD, backgroundColor: GOLD_TINT, padding: 15 },
  ctaLabel: { fontFamily: "Mono", fontSize: 8.5, fontWeight: 700, letterSpacing: 2, color: GOLD, textTransform: "uppercase", marginBottom: 6 },
  ctaBody: { fontFamily: "Serif", fontSize: 12.5, color: INK, lineHeight: 1.5 },
  ctaLink: { fontFamily: "Mono", fontSize: 8.5, letterSpacing: 0.8, color: GOLD, marginTop: 9 },
  ctaSecondary: { fontFamily: "Serif", fontSize: 10.5, color: MUTED, marginTop: 12 },
  tocRow: { borderBottomWidth: 0.6, borderBottomColor: HAIR, paddingVertical: 7 },
  tocNum: { fontFamily: "Numeral", fontSize: 12, color: GOLD },
  tocText: { fontFamily: "Serif", fontSize: 12, color: INK, lineHeight: 1.35 },
  tocSub: { fontFamily: "Serif", fontSize: 9.5, fontStyle: "italic", color: MUTED, marginTop: 3, lineHeight: 1.4, maxLines: 1, textOverflow: "ellipsis" },
});

// ── inline markup → react-pdf <Text> spans ──────────────────────────────────
// Mirrors the on-page `Inline`: emphasis (**bold** / *italic*) is the OUTER layer
// (a bold run can wrap a [[term]]), resolved first; glossary [[term]] / [[term|label]]
// markers inside each run render the label in gold (the on-page term color). Only
// **/* and [[ ]] are parsed; everything else is literal text.
// react-pdf font-glyph gap: the body faces (Serif = Crimson Text, Mono = Space
// Mono) are missing a set of technical glyphs (ohm, pi, delta, integral, approx,
// ...) that would each render as a .notdef box. react-pdf has no cross-family
// fallback, so we substitute ANY codepoint in PDF_SAIRA_FALLBACK with the Saira
// ("Numeral") face — which carries them — at the emit level; size + color inherit
// from the parent <Text>, so a rescued glyph matches its neighbours. The set is
// derived from the fonts (see pdf-fallback-set.ts) and kept complete + safe by
// pdf-glyphs.test.ts, so a NEW symbol is handled without touching this function.
// The common no-symbol case returns the string untouched (one node).
function withSymbols(value: string): ReactNode | ReactNode[] {
  let hit = false;
  for (const ch of value) {
    if (PDF_SAIRA_FALLBACK.has(ch.codePointAt(0)!)) { hit = true; break; }
  }
  if (!hit) return value;
  const out: ReactNode[] = [];
  let buf = "";
  let n = 0;
  for (const ch of value) {
    if (PDF_SAIRA_FALLBACK.has(ch.codePointAt(0)!)) {
      if (buf) { out.push(buf); buf = ""; }
      // Numeral is registered as a single variant (weight 400, normal). Pin
      // style + weight so a rescued glyph inside *italic* / **bold** prose
      // doesn't inherit an unregistered variant ("Could not resolve font").
      out.push(
        <Text key={`y${n++}`} style={{ fontFamily: "Numeral", fontStyle: "normal", fontWeight: "normal" }}>
          {ch}
        </Text>,
      );
    } else {
      buf += ch;
    }
  }
  if (buf) out.push(buf);
  return out;
}

function termSpans(text: string, key: string): ReactNode[] {
  return parseInlineTerms(text).map((seg, i) => {
    if (seg.kind === "term") {
      return (
        <Text key={`${key}t${i}`} style={s.term}>
          {withSymbols(seg.label)}
        </Text>
      );
    }
    // Plain run: emit the raw string as before (identical layout) unless it
    // holds an Ω, in which case wrap so the Numeral fallback spans are keyed.
    const parts = withSymbols(seg.value);
    return typeof parts === "string" ? (
      parts
    ) : (
      <Text key={`${key}s${i}`}>{parts}</Text>
    );
  });
}

// Emphasis (**bold** / *italic*) + [[term]] resolution over a run with NO code
// spans. `inlineSpans` peels code off first (below) and feeds the rest here.
function emphasisSpans(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let n = 0;
  for (const m of text.matchAll(/\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*/g)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push(...termSpans(text.slice(last, idx), `${key}${n}p`));
    out.push(
      m[1] !== undefined ? (
        <Text key={`${key}${n}b`} style={s.bold}>
          {termSpans(m[1], `${key}${n}b`)}
        </Text>
      ) : (
        <Text key={`${key}${n}i`} style={s.italic}>
          {termSpans(m[2], `${key}${n}i`)}
        </Text>
      ),
    );
    last = idx + m[0].length;
    n++;
  }
  if (last < text.length) out.push(...termSpans(text.slice(last), `${key}${n}p`));
  return out;
}

// `code` is the OUTERMOST layer — literal content (a part value / ref / unit
// like `5.1 kΩ`), so peel it off FIRST and render it as a deep-gold mono span
// with no emphasis/term parsing inside. Mirrors the on-page `Inline` code chip
// so web and print read the same; withSymbols keeps Ω legible inside the mono.
function inlineSpans(text: string, key = "x"): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let n = 0;
  for (const m of text.matchAll(/`([^`]+)`/g)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push(...emphasisSpans(text.slice(last, idx), `${key}c${n}`));
    out.push(
      <Text key={`${key}code${n}`} style={s.code}>
        {withSymbols(m[1])}
      </Text>,
    );
    last = idx + m[0].length;
    n++;
  }
  if (last < text.length) out.push(...emphasisSpans(text.slice(last), `${key}c${n}`));
  return out;
}

// A lone bold phrase ("**References**") is a section label, not a sentence —
// render it as a gold eyebrow with a closing hairline (matches the on-page
// SectionEyebrow). Same guard: letters / spaces / & only, <= 24 chars.
const SECTION_LABEL_RE = /^\*\*([A-Za-z][A-Za-z &]{0,23})\*\*$/;

const CALLOUT_ACCENT: Record<"critical" | "warn" | "info", { bar: string; bg: string; label: string }> = {
  critical: { bar: RED, bg: RED_TINT, label: RED },
  warn: { bar: GOLD, bg: GOLD_TINT, label: GOLD },
  info: { bar: BLUE, bg: "#eef2f7", label: BLUE },
};

function hostOf(href: string): string | null {
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

type QuizBlock = Extract<ContentBlock, { type: "quiz" }>;

// One checkpoint question — its options, answer, and explanation kept together
// (wrap={false}) so a question never splits across a page break.
function QuizItem({ q, qi }: { q: QuizBlock["questions"][number]; qi: number }) {
  return (
    <View wrap={false}>
      <Text style={s.quizQ}>
        {qi + 1}. {inlineSpans(q.q, `qq${qi}`)}
      </Text>
      {q.options.map((opt, oi) => (
        <Text key={oi} style={{ ...s.quizOpt, ...(oi === q.answer ? s.quizOptRight : {}) }}>
          {String.fromCharCode(97 + oi)}. {inlineSpans(opt, `qo${qi}_${oi}`)}
        </Text>
      ))}
      <Text style={s.quizAns}>Answer · {String.fromCharCode(97 + q.answer)}</Text>
      {q.explain ? <Text style={s.quizExplain}>{inlineSpans(q.explain, `qe${qi}`)}</Text> : null}
    </View>
  );
}

function Block({ block, images }: { block: ContentBlock; images: Map<string, ResolvedImage> }) {
  switch (block.type) {
    case "prose": {
      const m = block.md.trim().match(SECTION_LABEL_RE);
      // minPresenceAhead keeps a section label from stranding alone at a page
      // bottom with its list/content pushed to the next page. Sized to pull the
      // label AND its first few following rows (a "References"/"Keep going"
      // eyebrow + its links) onto the next page together, not leave the links
      // orphaned on a near-empty page.
      if (m) return <Text style={s.sectionEyebrow} minPresenceAhead={140}>{m[1]}</Text>;
      return <Text style={s.prose}>{inlineSpans(block.md)}</Text>;
    }

    case "heading":
      return <Text style={block.level === 3 ? s.h3 : s.h2} minPresenceAhead={56}>{block.text}</Text>;

    case "callout": {
      const a = CALLOUT_ACCENT[block.severity];
      return (
        <View style={{ ...s.callout, borderLeftColor: a.bar, backgroundColor: a.bg }} wrap={false}>
          <Text style={{ ...s.calloutLabel, color: a.label }}>{block.label}</Text>
          <Text style={s.calloutBody}>{inlineSpans(block.body)}</Text>
        </View>
      );
    }

    case "steps":
      return (
        <View style={s.steps}>
          {block.items.map((it, i) => (
            <View key={i} style={s.stepRow}>
              <Text style={s.stepMark}>{block.ordered ? `${i + 1}.` : "·"}</Text>
              <Text style={s.stepText}>{inlineSpans(it, `s${i}`)}</Text>
            </View>
          ))}
        </View>
      );

    case "doSteps":
      return (
        <View style={s.steps}>
          <Text style={s.signKicker}>{`Do · ${block.title}`}</Text>
          {block.body ? <Text style={s.calloutBody}>{inlineSpans(block.body, "dsb")}</Text> : null}
          {block.steps.map((st, i) => (
            <View key={i} wrap={false}>
              <View style={s.stepRow}>
                <Text style={s.stepMark}>{`${i + 1}.`}</Text>
                <Text style={s.stepText}>{inlineSpans(st.text, `ds${i}`)}</Text>
              </View>
              {st.proof ? (
                <View style={s.signRevealRow}>
                  <Text style={s.signRevealLabel}>You should see</Text>
                  <Text style={s.signRevealText}>{inlineSpans(st.proof, `dsp${i}`)}</Text>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      );

    case "traceList":
      return (
        <View style={s.steps}>
          <Text style={s.signKicker}>{`Eyeball it · ${block.headline}`}</Text>
          {block.body ? <Text style={s.calloutBody}>{inlineSpans(block.body, "tlb")}</Text> : null}
          {block.items.map((it, i) => (
            <View key={i} wrap={false}>
              <View style={s.stepRow}>
                <Text style={s.stepMark}>{`${i + 1}.`}</Text>
                <Text style={s.stepText}>{inlineSpans(it.text, `tl${i}`)}</Text>
              </View>
              {it.help ? (
                <View style={s.signRevealRow}>
                  <Text style={s.signRevealLabel}>Look for</Text>
                  <Text style={s.signRevealText}>{inlineSpans(it.help, `tlh${i}`)}</Text>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      );

    case "table":
      return (
        <View style={s.table}>
          <View style={s.thRow}>
            {block.columns.map((c, i) => (
              <Text key={i} style={s.th}>
                {c}
              </Text>
            ))}
          </View>
          {block.rows.map((row, ri) => (
            <View key={ri} style={s.tr} wrap={false}>
              {row.map((cell, ci) => {
                const mono = cell.decoration === "ref" || cell.decoration === "mpn";
                const color =
                  cell.tone === "gold" ? GOLD : cell.tone === "blue" ? BLUE : cell.tone === "critical" ? RED : cell.tone === "dim" ? MUTED : undefined;
                return (
                  <Text key={ci} style={{ ...(mono ? s.tdMono : s.td), ...(color ? { color } : {}) }}>
                    {cell.text ? inlineSpans(cell.text, `c${ri}_${ci}`) : ""}
                  </Text>
                );
              })}
            </View>
          ))}
        </View>
      );

    case "image": {
      const img = images.get(block.src);
      if (!img) {
        return block.caption ? <Text style={s.caption}>{withSymbols(block.caption)}</Text> : null;
      }
      // A diagram is a RASTER: shrinking the figure shrinks its baked text, so
      // size for legibility, not just fit. Fill the text column; cap height
      // generously (a tall diagram + caption still fits the ~728pt column); and
      // FLOOR the width so a tall, height-capped diagram never gets so narrow its
      // labels fall below ~9pt. Every diagram exports ~1088px wide, so
      // displaying at >= MIN_W keeps even the smallest baked label legible. A
      // very tall diagram then takes its own page (wrap={false}) rather than
      // rendering with unreadable text.
      const MIN_W = 445;
      const maxH = 500;
      let w = CONTENT_W;
      let h = w / img.ratio;
      if (h > maxH) {
        h = maxH;
        w = h * img.ratio;
      }
      if (w < MIN_W) {
        w = MIN_W;
        h = w / img.ratio;
      }
      return (
        <View style={s.figure} wrap={false}>
          {/* react-pdf <Image> is not a DOM img and takes no alt; the diagram's
              own baked caption (or block.caption) carries the description. */}
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={img.dataUri} style={{ width: w, height: h }} />
          {block.caption ? <Text style={s.caption}>{withSymbols(block.caption)}</Text> : null}
        </View>
      );
    }

    case "quiz":
      return (
        <View style={s.quizWrap}>
          {/* Keep the Checkpoint header + prompt + FIRST question together as one
              wrap={false} unit, so the section never opens with an orphaned
              "Checkpoint" header stranded at a page bottom. Remaining questions
              flow individually (each still wrap={false} inside QuizItem). */}
          <View wrap={false}>
            <Text style={s.quizKicker}>Checkpoint</Text>
            {block.prompt ? <Text style={s.prose}>{inlineSpans(block.prompt, "qp")}</Text> : null}
            {block.questions.length > 0 ? <QuizItem q={block.questions[0]} qi={0} /> : null}
          </View>
          {block.questions.slice(1).map((q, k) => (
            <QuizItem key={k + 1} q={q} qi={k + 1} />
          ))}
        </View>
      );

    case "deepDive":
      return (
        <View style={s.deep} wrap={false}>
          <Text style={s.deepKicker}>Deep dive · {block.summary}</Text>
          <Text style={s.calloutBody}>{inlineSpans(block.body, "dd")}</Text>
        </View>
      );

    case "sourceRef": {
      const external = /^https?:\/\//.test(block.href);
      const host = external ? hostOf(block.href) : null;
      return (
        <View style={s.ref} wrap={false}>
          <View style={s.refDot} />
          <Text style={s.refBody}>
            <Link src={block.href} style={s.link}>
              {block.label}
            </Link>
            {host ? <Text style={s.refHost}>{`  ${host}`}</Text> : null}
          </Text>
        </View>
      );
    }

    case "termRef":
      // Not used by the current Library set; render the term in gold so it never
      // crashes if one is added later.
      return <Text style={{ ...s.prose, color: GOLD }}>{block.term}</Text>;

    case "vendorCta":
      return (
        <Text style={{ ...s.prose, color: GOLD }}>
          {block.label}
          {block.sublabel ? ` · ${block.sublabel}` : ""}
        </Text>
      );

    case "youtube":
      if (!block.videoId) return null;
      return (
        <Text style={s.prose}>
          <Link src={`https://www.youtube.com/watch?v=${block.videoId}`} style={s.link}>
            {`Watch: ${block.title || "video"}`}
          </Link>
        </Text>
      );

    case "calculator": {
      // react-pdf can't run an interactive calculator, so degrade to a static
      // reference: the tool title, its one-line summary, and the live URL.
      // getTool returns undefined for an unknown slug → fall back to the slug.
      const tool = getTool(block.slug);
      const title = tool?.title ?? block.slug;
      return (
        <View style={s.deep} wrap={false}>
          <Text style={s.deepKicker}>Calculator · {withSymbols(title)}</Text>
          {tool?.summary ? <Text style={s.calloutBody}>{withSymbols(tool.summary)}</Text> : null}
          <Text style={s.calloutBody}>
            <Link src={`https://academy.onethousanddrones.com/tools/${block.slug}`} style={s.link}>
              {`Interactive calculator: academy.onethousanddrones.com/tools/${block.slug}`}
            </Link>
          </Text>
          {block.caption ? <Text style={s.caption}>{withSymbols(block.caption)}</Text> : null}
        </View>
      );
    }

    case "math": {
      // Real typeset math: MathJax -> react-pdf <Svg> (see math-svg.tsx). Centered
      // for a display equation, left for inline. If the render fails, fall back to
      // the plain-ASCII string (or raw tex) so an equation never crashes the PDF.
      const display = block.display !== false;
      const rendered = block.tex ? mathToPdf(block.tex, display, INK) : null;
      if (rendered) {
        return (
          <View style={{ marginTop: 10, marginBottom: 4, alignItems: display ? "center" : "flex-start" }} wrap={false}>
            {rendered}
          </View>
        );
      }
      return (
        <Text style={{ ...s.prose, textAlign: display ? "center" : "left" }}>
          {withSymbols(block.plain ?? block.tex)}
        </Text>
      );
    }

    default:
      return null;
  }
}

/**
 * The per-block renderer, exported for `library-pdf-coverage.test.ts`.
 *
 * That switch ends in `default: return null`, so a block type it does not handle
 * prints as NOTHING — silently, with a green typecheck. It is the only
 * contentBlocks consumer with no compiler backstop, so the coverage test is the
 * backstop instead. `Block` is a plain function with no hooks, so calling it
 * directly is safe.
 */
export function renderBlockToPdf(
  block: ContentBlock,
  images: Map<string, ResolvedImage>,
) {
  return Block({ block, images });
}

function Blocks({ blocks, images }: { blocks: ContentBlock[]; images: Map<string, ResolvedImage> }) {
  return (
    <>
      {blocks.map((b, i) => (
        <Block key={i} block={b} images={images} />
      ))}
    </>
  );
}

// A1 running header — section on the left, document on the right, on a hairline.
// Fixed, so it repeats on every page of a multi-page lesson.
function RunningHeader({ section, doc = "Field Guide" }: { section: string; doc?: string }) {
  return (
    <View style={s.runHeader} fixed>
      <Text style={s.runHeaderSection}>{section}</Text>
      <Text style={s.runHeaderDoc}>{doc}</Text>
    </View>
  );
}

// A1 running footer — url on the left, page number (gold Saira) on the right.
function PageFooter({ slug }: { slug?: string }) {
  return (
    <View style={s.footer} fixed>
      <Text>{slug ? `academy.onethousanddrones.com/library/${slug}` : "academy.onethousanddrones.com/library"}</Text>
    </View>
  );
}

// The dynamic page number. A lone `fixed` Text placed LAST in each Page (the
// canonical react-pdf pattern); it must not be nested with other fixed siblings.
function PageNumber() {
  return (
    <Text style={s.pageNum} fixed render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
  );
}

// Lesson opener — a big Saira guide numeral (field guide only) beside the title
// block. `index` present → the numeral shows and the eyebrow carries the number.
function LessonHeader({ lesson, index }: { lesson: LibraryPdfLesson; index?: number }) {
  const nn = index != null ? String(index).padStart(2, "0") : null;
  return (
    <View style={s.lhRow}>
      {nn ? <Text style={s.lhNum}>{nn}</Text> : null}
      <View style={s.lhBody}>
        <Text style={s.eyebrow}>{nn ? `Reference Guide ${nn}` : "Library · Reference Guide"}</Text>
        <Text style={s.title}>{lesson.title}</Text>
        {lesson.summary ? <Text style={s.summary}>{lesson.summary}</Text> : null}
        <View style={s.headRule} />
        {lesson.byline ? <Text style={s.byline}>{lesson.byline}</Text> : null}
      </View>
    </View>
  );
}

// ── field-guide chrome components (book-only) ───────────────────────────────
// Inline part divider, rendered inside the following guide's wrap={false} opener
// so the band never separates from the guide it introduces. `total` is the book's
// part count (per-cluster or the renumbered combined set).
function PartDivider({ part, total }: { part: FieldGuidePart; total: number }) {
  return (
    <View style={s.partBand}>
      <Text style={s.partEyebrow}>{`Part ${part.n} of ${total}`}</Text>
      <Text style={s.partTitle}>{part.title}</Text>
      <Text style={s.partBlurb}>{part.blurb}</Text>
    </View>
  );
}

// Front matter — "how to read this volume", set up before the guides begin.
function FieldGuideIntro({ intro }: { intro: FieldGuideIntroData }) {
  return (
    <Page size="A4" style={s.page}>
      <RunningHeader section="Start Here" />
      <PageFooter />
      <View style={{ marginTop: 8 }}>
        <Text style={s.eyebrow}>{intro.eyebrow}</Text>
        <Text style={s.tocTitle}>{intro.title}</Text>
      </View>
      <View style={s.matterBody}>
        {intro.paras.map((p, i) => (
          <Text key={i} style={s.matterPara}>{inlineSpans(p, `in${i}`)}</Text>
        ))}
      </View>
      <PageNumber />
    </Page>
  );
}

// Back matter — recap + the one build CTA (course path; generic-safe).
function FieldGuideOutro({ outro }: { outro: FieldGuideOutroData }) {
  const { cta } = outro;
  return (
    <Page size="A4" style={s.page}>
      <RunningHeader section="Where This Goes" />
      <PageFooter />
      <View style={{ marginTop: 8 }}>
        <Text style={s.eyebrow}>{outro.eyebrow}</Text>
        <Text style={s.tocTitle}>{outro.title}</Text>
      </View>
      <View style={s.matterBody}>
        {outro.paras.map((p, i) => (
          <Text key={i} style={s.matterPara}>{inlineSpans(p, `out${i}`)}</Text>
        ))}
      </View>
      <View style={s.cta} wrap={false}>
        <Text style={s.ctaLabel}>{cta.label}</Text>
        <Text style={s.ctaBody}>{cta.body}</Text>
        <Link src={cta.href} style={s.ctaLink}>{cta.hrefLabel}</Link>
        <Text style={s.ctaSecondary}>
          {`${cta.secondaryLabel}  ·  `}
          <Link src={cta.secondaryHref} style={s.link}>{cta.secondaryHrefLabel}</Link>
        </Text>
      </View>
      <PageNumber />
    </Page>
  );
}

// ── single guide ───────────────────────────────────────────────────────────
export function LibraryPdf({
  lesson,
  images,
}: {
  lesson: LibraryPdfLesson;
  images: Map<string, ResolvedImage>;
}) {
  return (
    <Document title={`${lesson.title} · OTD Academy Library`} author="One Thousand Drones Academy">
      <Page size="A4" style={s.page}>
        <RunningHeader section={lesson.title} doc="Library" />
        <PageFooter slug={lesson.slug} />
        <LessonHeader lesson={lesson} />
        <View style={{ marginTop: 4 }}>
          <Blocks blocks={lesson.blocks} images={images} />
        </View>
        {/* Corner brandmark watermark — the SAME mark, gradient, size, and bottom-right
            grid position as the field-guide cover, but on the LAST page only. A fixed
            slot whose render draws it just when this is the final page; rendered as an
            <Image> (react-pdf's View-render paints an Image, not an Svg) so it's out of
            flow and never spills onto an extra page. */}
        <View
          style={s.wmCorner}
          fixed
          render={(props) => {
            const p = props as unknown as { pageNumber: number; totalPages: number };
            return WM_BRANDMARK_PNG && p.pageNumber === p.totalPages ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={WM_BRANDMARK_PNG} style={{ width: WM_W, height: WM_H }} />
            ) : null;
          }}
        />
        <PageNumber />
      </Page>
    </Document>
  );
}

// ── whole library, one book ──────────────────────────────────────────────────
// The corner watermark brandmark: anchored bottom-right (where it has always sat),
// but with a 135deg gradient-alpha fill (owner pick) — brightest at the bottom-right
// corner, fading toward the top-left — matching the site footer's gradient watermark
// treatment (vs the old flat single-opacity fill).
function Brandmark({ size }: { size: number }) {
  return (
    <Svg width={size} height={size * (400 / 418)} viewBox={BRANDMARK_VIEWBOX}>
      <Defs>
        <LinearGradient id="wmGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={GOLD} stopOpacity={0.05} />
          <Stop offset="1" stopColor={GOLD} stopOpacity={0.16} />
        </LinearGradient>
      </Defs>
      <Path d={BRANDMARK_PATH} fill="url(#wmGrad)" />
    </Svg>
  );
}

export function FieldGuidePdf({
  lessons,
  images,
  reviewed,
  chrome,
}: {
  lessons: LibraryPdfLesson[];
  images: Map<string, ResolvedImage>;
  /** A pre-formatted "month year" stamp (computed in the route; no Date here). */
  reviewed: string;
  /** Cluster (or combined) chrome: cover/header identity, intro/outro, parts. */
  chrome: FieldGuideChrome;
}) {
  // slug → the part it opens, so the divider renders before that guide's opener.
  const partByStartSlug = new Map(chrome.parts.map((p) => [p.startsAtSlug, p]));
  return (
    <Document title={chrome.documentTitle} author="One Thousand Drones Academy">
      {/* cover — F1 split: big Saira volume numeral · title block · faint
          corner brandmark watermark (no header/footer on the cover) */}
      <Page size="A4" style={s.page}>
        <View style={s.wmCorner}>
          <Brandmark size={230} />
        </View>
        <View style={s.coverSplit}>
          <Text style={s.coverBig}>{chrome.coverNumeral}</Text>
          <View style={s.coverRight}>
            <Text style={s.coverVolEyebrow}>Reference Vol.</Text>
            <Text style={s.coverTitle}>{`Field\nGuide`}</Text>
            <View style={s.coverRule} />
            <Text style={s.coverMeta}>
              {`${chrome.coverLabel} · ${lessons.length} Guides`}
              {"\n"}
              {`Reviewed ${reviewed}`}
            </Text>
          </View>
        </View>
      </Page>

      {/* contents — dotted-leader entries with a gold Saira number */}
      <Page size="A4" style={s.page}>
        <RunningHeader section="Contents" />
        <PageFooter />
        <View style={{ marginTop: 8 }}>
          <Text style={s.eyebrow}>Reference Library</Text>
          <Text style={s.tocTitle}>Contents</Text>
        </View>
        <View style={{ marginTop: 10 }}>
          {lessons.map((l, i) => (
            <View key={l.slug} style={s.tocRow} wrap={false}>
              <Text style={s.tocText}>
                <Text style={s.tocNum}>{`${String(i + 1).padStart(2, "0")}    `}</Text>
                {l.title}
              </Text>
              {/* one-line clamp (see s.tocSub maxLines): the full summary lives on
                  the lesson opener; on the contents page it must not spill 12
                  entries onto a 2nd page */}
              {l.summary ? <Text style={s.tocSub}>{l.summary}</Text> : null}
            </View>
          ))}
        </View>
        <PageNumber />
      </Page>

      {/* front matter — how to read this volume, before the guides begin */}
      <FieldGuideIntro intro={chrome.intro} />

      {/* All guides flow continuously in one page stream. Each opens with a soft
          break: the wrap={false} opener carries minPresenceAhead, so a new guide
          starts on a fresh page only when little room remains, otherwise it fills
          the tail the previous guide left. This replaces a hard page-per-guide
          that stranded 30-50% of every closing page. The header/footer are the
          book's (a fixed element is per-Page, not per-guide); per-guide identity
          lives in the opener numeral + title + gold rule. A part divider (when the
          guide opens a new part) rides INSIDE the opener group so the two never
          separate. */}
      <Page size="A4" style={s.page}>
        <RunningHeader section={chrome.runningHeader} />
        <PageFooter />
        {lessons.map((lesson, i) => {
          const part = partByStartSlug.get(lesson.slug);
          return (
            <View key={lesson.slug} style={i > 0 ? s.lessonFollow : undefined}>
              <View wrap={false} minPresenceAhead={part ? 340 : 260}>
                {part ? <PartDivider part={part} total={chrome.parts.length} /> : null}
                <LessonHeader lesson={lesson} index={i + 1} />
              </View>
              <View style={{ marginTop: 4 }}>
                <Blocks blocks={lesson.blocks} images={images} />
              </View>
            </View>
          );
        })}
        <PageNumber />
      </Page>

      {/* back matter — recap + the one build CTA */}
      <FieldGuideOutro outro={chrome.outro} />
    </Document>
  );
}
