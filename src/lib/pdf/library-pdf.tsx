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
// and reads poorly on paper), reusing the certificate's bundled Crimson Text
// serif + the cert print palette so the PDF family stays coherent. Labels and
// captions are built-in Helvetica (the mono-substitute, as on the certificate);
// no Bebas/Saira/Space Mono are bundled for PDF, and a serif reading document is
// the right call for a field guide anyway. House rule holds: no em-dashes in any
// rendered string; `·` is the separator.
import {
  Document,
  Page,
  View,
  Text,
  Image,
  Link,
  Svg,
  Path,
  StyleSheet,
} from "@react-pdf/renderer";
import { type ReactNode } from "react";
import type { ContentBlock } from "@/lib/schemas/guide";
import { parseInlineTerms } from "@/lib/inline-terms";
import { BRANDMARK_PATH, BRANDMARK_VIEWBOX } from "@/lib/pdf/certificate-content";
import type { ResolvedImage } from "@/lib/pdf/library-images";

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
const GOLD_TINT = "#f6efe0";
const MUTED = "#6b7280";
const FAINT = "#9aa0ad";
const HAIR = "#d8d2c4";
const RED = "#b4453f";
const RED_TINT = "#f8ecea";
const BLUE = "#3a6ea5";
const INK_FIG = "#0f1622"; // dark figure frame (diagrams are dark-on-gold by design)

const CONTENT_W = 595.28 - 54 * 2; // A4 width minus the page's horizontal padding

const s = StyleSheet.create({
  page: {
    backgroundColor: IVORY,
    color: INK,
    paddingTop: 54,
    paddingBottom: 60,
    paddingHorizontal: 54,
    fontFamily: "Serif",
    fontSize: 11,
    lineHeight: 1.5,
  },
  // ── footer (fixed) ──
  footer: {
    position: "absolute",
    bottom: 28,
    left: 54,
    right: 54,
    flexDirection: "row",
    justifyContent: "space-between",
    fontFamily: "Helvetica",
    fontSize: 7.5,
    letterSpacing: 1,
    color: FAINT,
    textTransform: "uppercase",
  },
  // ── lesson header ──
  eyebrow: {
    fontFamily: "Helvetica",
    fontSize: 8,
    letterSpacing: 2.5,
    color: GOLD,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  title: { fontFamily: "Serif", fontSize: 25, fontWeight: 600, color: INK, lineHeight: 1.15 },
  summary: { fontFamily: "Serif", fontSize: 12, fontStyle: "italic", color: MUTED, marginTop: 8, lineHeight: 1.45 },
  headRule: { height: 1.4, backgroundColor: GOLD, marginTop: 14, marginBottom: 4 },
  byline: { fontFamily: "Helvetica", fontSize: 7.5, letterSpacing: 1.2, color: FAINT, textTransform: "uppercase", marginTop: 8 },

  // ── blocks ──
  prose: { fontFamily: "Serif", fontSize: 11, color: INK, marginTop: 9, lineHeight: 1.55 },
  bold: { fontWeight: 600 },
  italic: { fontStyle: "italic" },
  term: { color: GOLD },
  h2: { fontFamily: "Serif", fontSize: 16, fontWeight: 600, color: INK, marginTop: 20, marginBottom: 2 },
  h3: { fontFamily: "Serif", fontSize: 13, fontWeight: 600, color: INK, marginTop: 16, marginBottom: 2 },
  sectionEyebrow: {
    fontFamily: "Helvetica",
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
  calloutLabel: { fontFamily: "Helvetica", fontSize: 8, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4 },
  calloutBody: { fontFamily: "Serif", fontSize: 10.5, color: INK, lineHeight: 1.5 },

  steps: { marginTop: 9, marginBottom: 2 },
  stepRow: { flexDirection: "row", marginBottom: 4 },
  stepMark: { fontFamily: "Helvetica", fontSize: 10, color: GOLD, width: 20 },
  stepText: { flex: 1, fontFamily: "Serif", fontSize: 11, color: INK, lineHeight: 1.5 },

  // tables
  table: { marginTop: 12, borderTopWidth: 1, borderTopColor: GOLD },
  thRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: GOLD, backgroundColor: GOLD_TINT },
  th: { flex: 1, fontFamily: "Helvetica", fontSize: 7.5, fontWeight: 700, letterSpacing: 0.8, color: INK, textTransform: "uppercase", padding: 5 },
  tr: { flexDirection: "row", borderBottomWidth: 0.6, borderBottomColor: HAIR },
  td: { flex: 1, fontFamily: "Serif", fontSize: 9.5, color: INK, padding: 5, lineHeight: 1.4 },
  tdMono: { flex: 1, fontFamily: "Helvetica", fontSize: 8.5, color: INK, padding: 5 },

  // figures
  figure: { marginTop: 14, marginBottom: 4, alignItems: "center" },
  figFrame: { borderWidth: 0.8, borderColor: HAIR, backgroundColor: INK_FIG, padding: 6, borderRadius: 2 },
  caption: { fontFamily: "Helvetica", fontSize: 7.5, letterSpacing: 1, color: MUTED, textTransform: "uppercase", marginTop: 6, textAlign: "center" },

  // quiz
  quizWrap: { marginTop: 16, borderTopWidth: 0.8, borderTopColor: HAIR, paddingTop: 10 },
  quizKicker: { fontFamily: "Helvetica", fontSize: 8, fontWeight: 700, letterSpacing: 2, color: GOLD, textTransform: "uppercase", marginBottom: 8 },
  quizQ: { fontFamily: "Serif", fontSize: 11, fontWeight: 600, color: INK, marginTop: 8, lineHeight: 1.4 },
  quizOpt: { fontFamily: "Serif", fontSize: 10, color: INK, marginTop: 2, marginLeft: 12, lineHeight: 1.4 },
  quizOptRight: { color: GOLD, fontWeight: 600 },
  quizAns: { fontFamily: "Helvetica", fontSize: 8, letterSpacing: 0.5, color: GOLD, textTransform: "uppercase", marginTop: 4, marginLeft: 12 },
  quizExplain: { fontFamily: "Serif", fontSize: 9.5, fontStyle: "italic", color: MUTED, marginTop: 2, marginLeft: 12, lineHeight: 1.4 },

  // deep dive
  deep: { marginTop: 12, borderWidth: 0.8, borderColor: HAIR, borderRadius: 2, padding: 11 },
  deepKicker: { fontFamily: "Helvetica", fontSize: 8, fontWeight: 700, letterSpacing: 1.2, color: GOLD, textTransform: "uppercase", marginBottom: 5 },

  // source refs — a small gold square marks each (a registration tick); the
  // on-page ▸/→ glyphs aren't in the bundled fonts, so a drawn View is used.
  ref: { flexDirection: "row", marginTop: 4, paddingLeft: 2 },
  refDot: { width: 3, height: 3, backgroundColor: GOLD, marginTop: 5.5, marginRight: 8 },
  refBody: { flex: 1, fontFamily: "Serif", fontSize: 9.5, color: INK, lineHeight: 1.4 },
  refHost: { fontFamily: "Helvetica", fontSize: 7.5, color: FAINT, textTransform: "lowercase" },
  link: { color: BLUE, textDecoration: "none" },

  // field-guide cover + contents
  cover: { flexGrow: 1, justifyContent: "center", alignItems: "center" },
  coverEyebrow: { fontFamily: "Helvetica", fontSize: 10, letterSpacing: 5, color: MUTED, textTransform: "uppercase" },
  coverTitle: { fontFamily: "Serif", fontSize: 52, fontWeight: 600, color: INK, marginTop: 18, marginBottom: 4, letterSpacing: 1, lineHeight: 1.1 },
  coverSub: { fontFamily: "Serif", fontSize: 14, fontStyle: "italic", color: MUTED, marginTop: 12, textAlign: "center", lineHeight: 1.45, maxWidth: 360 },
  coverRule: { width: 150, height: 1.4, backgroundColor: GOLD, marginVertical: 24 },
  coverMeta: { fontFamily: "Helvetica", fontSize: 8.5, letterSpacing: 2, color: FAINT, textTransform: "uppercase", textAlign: "center", lineHeight: 1.8 },
  wmWrap: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },

  tocTitle: { fontFamily: "Serif", fontSize: 22, fontWeight: 600, color: INK, marginBottom: 6 },
  tocRow: { borderBottomWidth: 0.6, borderBottomColor: HAIR, paddingVertical: 9 },
  tocNum: { fontFamily: "Helvetica", fontSize: 9, fontWeight: 700, color: GOLD },
  tocText: { fontFamily: "Serif", fontSize: 12, color: INK, lineHeight: 1.35 },
  tocSub: { fontFamily: "Serif", fontSize: 9.5, fontStyle: "italic", color: MUTED, marginTop: 3, lineHeight: 1.4 },
});

// ── inline markup → react-pdf <Text> spans ──────────────────────────────────
// Mirrors the on-page `Inline`: emphasis (**bold** / *italic*) is the OUTER layer
// (a bold run can wrap a [[term]]), resolved first; glossary [[term]] / [[term|label]]
// markers inside each run render the label in gold (the on-page term color). Only
// **/* and [[ ]] are parsed; everything else is literal text.
function termSpans(text: string, key: string): ReactNode[] {
  return parseInlineTerms(text).map((seg, i) =>
    seg.kind === "term" ? (
      <Text key={`${key}t${i}`} style={s.term}>
        {seg.label}
      </Text>
    ) : (
      seg.value
    ),
  );
}

function inlineSpans(text: string, key = "x"): ReactNode[] {
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

function Block({ block, images }: { block: ContentBlock; images: Map<string, ResolvedImage> }) {
  switch (block.type) {
    case "prose": {
      const m = block.md.trim().match(SECTION_LABEL_RE);
      if (m) return <Text style={s.sectionEyebrow}>{m[1]}</Text>;
      return <Text style={s.prose}>{inlineSpans(block.md)}</Text>;
    }

    case "heading":
      return <Text style={block.level === 3 ? s.h3 : s.h2}>{block.text}</Text>;

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
        return block.caption ? <Text style={s.caption}>{block.caption}</Text> : null;
      }
      const maxW = CONTENT_W;
      const maxH = 320;
      let w = maxW;
      let h = w / img.ratio;
      if (h > maxH) {
        h = maxH;
        w = h * img.ratio;
      }
      return (
        <View style={s.figure} wrap={false}>
          <View style={s.figFrame}>
            {/* react-pdf <Image> is not a DOM img and takes no alt; the caption
                carries the description. */}
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={img.dataUri} style={{ width: w, height: h }} />
          </View>
          {block.caption ? <Text style={s.caption}>{block.caption}</Text> : null}
        </View>
      );
    }

    case "quiz":
      return (
        <View style={s.quizWrap}>
          <Text style={s.quizKicker}>Checkpoint</Text>
          {block.prompt ? <Text style={s.prose}>{inlineSpans(block.prompt, "qp")}</Text> : null}
          {block.questions.map((q, qi) => (
            <View key={qi} wrap={false}>
              <Text style={s.quizQ}>
                {qi + 1}. {q.q}
              </Text>
              {q.options.map((opt, oi) => (
                <Text key={oi} style={{ ...s.quizOpt, ...(oi === q.answer ? s.quizOptRight : {}) }}>
                  {String.fromCharCode(97 + oi)}. {opt}
                </Text>
              ))}
              <Text style={s.quizAns}>Answer · {String.fromCharCode(97 + q.answer)}</Text>
              {q.explain ? <Text style={s.quizExplain}>{q.explain}</Text> : null}
            </View>
          ))}
        </View>
      );

    case "deepDive":
      return (
        <View style={s.deep}>
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

    default:
      return null;
  }
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

function PageFooter({ slug }: { slug?: string }) {
  return (
    <View style={s.footer} fixed>
      <Text>One Thousand Drones Academy</Text>
      <Text
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      />
      <Text>{slug ? `academy.onethousanddrones.com/library/${slug}` : "academy.onethousanddrones.com/library"}</Text>
    </View>
  );
}

function LessonHeader({ lesson }: { lesson: LibraryPdfLesson }) {
  return (
    <View>
      <Text style={s.eyebrow}>Library · Reference Guide</Text>
      <Text style={s.title}>{lesson.title}</Text>
      {lesson.summary ? <Text style={s.summary}>{lesson.summary}</Text> : null}
      <View style={s.headRule} />
      {lesson.byline ? <Text style={s.byline}>{lesson.byline}</Text> : null}
    </View>
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
        <PageFooter slug={lesson.slug} />
        <LessonHeader lesson={lesson} />
        <View style={{ marginTop: 4 }}>
          <Blocks blocks={lesson.blocks} images={images} />
        </View>
      </Page>
    </Document>
  );
}

// ── whole library, one book ──────────────────────────────────────────────────
function Brandmark({ size, opacity }: { size: number; opacity: number }) {
  return (
    <Svg width={size} height={size * (400 / 418)} viewBox={BRANDMARK_VIEWBOX}>
      <Path d={BRANDMARK_PATH} fill={GOLD} fillOpacity={opacity} />
    </Svg>
  );
}

export function FieldGuidePdf({
  lessons,
  images,
  reviewed,
}: {
  lessons: LibraryPdfLesson[];
  images: Map<string, ResolvedImage>;
  /** A pre-formatted "month year" stamp (computed in the route; no Date here). */
  reviewed: string;
}) {
  return (
    <Document title="OTD Academy Field Guide · The EEG & BCI Reference Library" author="One Thousand Drones Academy">
      {/* cover */}
      <Page size="A4" style={s.page}>
        <View style={s.wmWrap}>
          <Brandmark size={420} opacity={0.05} />
        </View>
        <View style={s.cover}>
          <Brandmark size={64} opacity={0.9} />
          <Text style={{ ...s.coverEyebrow, marginTop: 18 }}>One Thousand Drones Academy</Text>
          <Text style={s.coverTitle}>Field Guide</Text>
          <Text style={s.coverSub}>The EEG and BCI reference library: the ideas behind the builds.</Text>
          <View style={s.coverRule} />
          <Text style={s.coverMeta}>
            {`${lessons.length} reference guides`}
            {"\n"}
            {`Reviewed ${reviewed}`}
            {"\n"}
            academy.onethousanddrones.com/library
          </Text>
        </View>
      </Page>

      {/* contents */}
      <Page size="A4" style={s.page}>
        <PageFooter />
        <Text style={s.eyebrow}>Library</Text>
        <Text style={s.tocTitle}>Contents</Text>
        <View style={{ marginTop: 10 }}>
          {lessons.map((l, i) => (
            <View key={l.slug} style={s.tocRow} wrap={false}>
              <Text style={s.tocText}>
                <Text style={s.tocNum}>{`${String(i + 1).padStart(2, "0")}    `}</Text>
                {l.title}
              </Text>
              {l.summary ? <Text style={s.tocSub}>{l.summary}</Text> : null}
            </View>
          ))}
        </View>
      </Page>

      {/* one page-break-started section per guide */}
      {lessons.map((lesson) => (
        <Page key={lesson.slug} size="A4" style={s.page}>
          <PageFooter slug={lesson.slug} />
          <LessonHeader lesson={lesson} />
          <View style={{ marginTop: 4 }}>
            <Blocks blocks={lesson.blocks} images={images} />
          </View>
        </Page>
      ))}
    </Document>
  );
}
