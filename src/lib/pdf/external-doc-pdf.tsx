// External-document PDF — a branded, print-faithful render of an OTD external /
// stakeholder document (investor one-pager, capability statement, security & trust
// overview, diligence brief) authored as markdown in the out-of-tree confidential
// store. Reuses the Library Field Guide house system verbatim (same four bundled
// faces via library-fonts.ts, the same warm-ivory print palette, the same gold
// hairlines + brandmark), so an external brief reads as the SAME instrument as the
// field guides, not a second-rate approximation.
//
// The GENERATOR is generic and public-safe (it holds no confidential content); the
// DOCUMENTS it renders live in the private store and are passed in by path. Classi-
// fication drives the masthead badge + the footer handling (confidential/internal =
// "provided by link" note; the destination matrix still bans emailing the PDF).
//
// House rule holds: no em-dashes in any rendered string; `·` is the separator.
import {
  Document,
  Page,
  View,
  Text,
  Image,
  Svg,
  Path,
  Link,
  StyleSheet,
} from "@react-pdf/renderer";
import { type ReactNode } from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { BRANDMARK_PATH, BRANDMARK_VIEWBOX } from "@/lib/pdf/certificate-content";

// ── palette (identical to library-pdf.tsx / the Field Guides) ───────────────
const IVORY = "#faf7f0";
const INK = "#14181f";
const GOLD = "#b5882e";
const GOLD_DEEP = "#8a6212";
const GOLD_TINT = "#f6efe0";
const MUTED = "#6b7280";
const FAINT = "#9aa0ad";
const HAIR = "#d8d2c4";
const RED = "#b4453f";
const BLUE = "#3a6ea5";

// last-page corner watermark (same PNG + placement as the field guide)
const WM_BRANDMARK_PNG: string | null = (() => {
  try {
    const buf = readFileSync(path.join(process.cwd(), "public", "otd-wm-brandmark.png"));
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
})();
const WM_W = 210;
const WM_H = WM_W * (400 / 418);

// ── document model ──────────────────────────────────────────────────────────
export type DocBlock =
  | { t: "h2"; text: string }
  | { t: "h3"; text: string }
  | { t: "eyebrow"; text: string }
  | { t: "p"; text: string }
  | { t: "ul"; items: string[] }
  | { t: "ol"; items: string[] }
  | { t: "quote"; text: string }
  | { t: "table"; head: string[]; rows: string[][] }
  | { t: "hr" };

export type ExternalDoc = {
  classification: string; // PUBLIC | CONFIDENTIAL | INTERNAL | CUI | ITAR | EAR
  title: string;
  banner: string[]; // the bold status lines under the head
  asOf?: string; // extracted "accurate as of" date, for the meta strip
  reviewBy?: string; // extracted "review by" date
  blocks: DocBlock[];
};

const CONTROLLED = new Set(["CONFIDENTIAL", "INTERNAL", "CUI", "ITAR", "EAR"]);
const RED_TINT = "#f8ecea";
// tinted badge tone per class: public/internal on warm gold, everything sensitive on red
const TONE: Record<string, { c: string; bg: string }> = {
  PUBLIC: { c: GOLD, bg: GOLD_TINT },
  INTERNAL: { c: GOLD_DEEP, bg: GOLD_TINT },
};
const toneFor = (k: string) => TONE[k] ?? { c: RED, bg: RED_TINT };

// ── markdown → ExternalDoc ──────────────────────────────────────────────────
// A focused parser for the external-doc house style: title, bold banner lines,
// headings, bold section labels, lists, tables, blockquotes, rules, and inline
// **bold** / *italic* / `code` / [text](url). Internal-only content (HTML
// comments, the DRAFT/FILLED/SCAFFOLD authoring note, the [[logo]] placeholder)
// is stripped so the deliverable carries no scaffolding.
export function parseExternalMarkdown(src: string): ExternalDoc {
  const cm = src.match(/CLASSIFICATION:\s*(\w+)/i);
  const classification = (cm ? cm[1] : "PUBLIC").toUpperCase();
  const asOf = (src.match(/accurate as of\s+(\d{4}-\d{2}-\d{2})/i) ?? [])[1];
  const reviewBy = (src.match(/review by\s+(\d{4}-\d{2}-\d{2})/i) ?? [])[1];

  let text = src.replace(/<!--[\s\S]*?-->/g, "");
  // strip a leading authoring note blockquote (> DRAFT / FILLED / SCAFFOLD ...)
  text = text.replace(/^\s*>\s.*(?:DRAFT|FILLED|SCAFFOLD)[\s\S]*?(?:\n\s*\n)/m, "\n");
  text = text.replace(/^\*\[\[logo[\s\S]*?\]\]\*\s*$/m, "");
  // the review-by date now lives in the head meta strip; drop a standalone stamp line
  text = text.replace(/^\s*Review by\s+\d{4}-\d{2}-\d{2}\.?\s*$/gim, "");

  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let title = "";
  const banner: string[] = [];
  const blocks: DocBlock[] = [];
  let i = 0;

  // title = first `# ` line
  for (; i < lines.length; i++) {
    const m = lines[i].match(/^#\s+(.*)$/);
    // drop the "One Thousand Drones[, LLC]:" prefix; the brandmark + badge ID it
    if (m) { title = m[1].trim().replace(/^One Thousand Drones(?:,?\s*LLC)?:\s*/i, "").trim(); i++; break; }
  }
  // leading bold banner lines (status / as-of), until a blank line
  for (; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l) { i++; break; }
    const b = l.match(/^\*\*(.+)\*\*$/);
    if (b) banner.push(b[1].trim());
    else break;
  }

  // Block loop with soft-wrap folding: a paragraph or list item spread across
  // several wrapped source lines is joined back into one logical block.
  const isStruct = (t: string) => /^(#{1,6}\s|>|\||[-*]\s|\d+\.\s)/.test(t) || t === "---" || t === "***";
  const cells = (row: string) => row.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

  while (i < lines.length) {
    const l = lines[i].trim();
    if (!l) { i++; continue; }
    let m: RegExpMatchArray | null;

    if ((m = l.match(/^##\s+(.*)$/))) { blocks.push({ t: "h2", text: m[1].trim() }); i++; continue; }
    if ((m = l.match(/^###\s+(.*)$/))) { blocks.push({ t: "h3", text: m[1].trim() }); i++; continue; }
    if (l === "---" || l === "***") { blocks.push({ t: "hr" }); i++; continue; }
    // a lone short bold phrase is a section label (matches the field-guide eyebrow)
    if ((m = l.match(/^\*\*([A-Za-z][A-Za-z0-9 &/]{0,28})\*\*$/))) { blocks.push({ t: "eyebrow", text: m[1].trim() }); i++; continue; }

    // table: a `|` header row followed by a `|---|` separator
    if (l.startsWith("|") && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const head = cells(l);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) { rows.push(cells(lines[i])); i++; }
      blocks.push({ t: "table", head, rows });
      continue;
    }

    // blockquote: consecutive `>` lines
    if (l.startsWith(">")) {
      const parts: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) { parts.push(lines[i].trim().replace(/^>\s?/, "")); i++; }
      blocks.push({ t: "quote", text: parts.join(" ").trim() });
      continue;
    }

    // list: gather items until a blank line, folding wrapped continuation lines
    if (/^[-*]\s+/.test(l) || /^\d+\.\s+/.test(l)) {
      const ordered = /^\d+\.\s+/.test(l);
      const items: string[] = [];
      let cur = l.replace(/^([-*]|\d+\.)\s+/, "");
      i++;
      while (i < lines.length) {
        const t = lines[i].trim();
        if (!t) { i++; break; }
        const mk = t.match(/^([-*]|\d+\.)\s+(.*)$/);
        if (mk) { items.push(cur); cur = mk[2]; i++; continue; }
        if (isStruct(t)) break;
        cur += " " + t;
        i++;
      }
      items.push(cur);
      blocks.push({ t: ordered ? "ol" : "ul", items });
      continue;
    }

    // paragraph: fold wrapped lines until a blank line or a structural line
    const buf = [l];
    i++;
    while (i < lines.length) {
      const t = lines[i].trim();
      if (!t) { i++; break; }
      if (isStruct(t)) break;
      buf.push(t);
      i++;
    }
    blocks.push({ t: "p", text: buf.join(" ").trim() });
  }
  return { classification, title, banner, asOf, reviewBy, blocks };
}

// ── inline markup → react-pdf spans ─────────────────────────────────────────
const st = StyleSheet.create({
  bold: { fontFamily: "Serif", fontWeight: 600 },
  italic: { fontFamily: "Serif", fontStyle: "italic" },
  code: { fontFamily: "Mono", fontSize: 9.5, color: GOLD_DEEP },
  link: { color: BLUE, textDecoration: "none" },
  marker: { color: RED, fontStyle: "italic" },
});

function inline(text: string, key = "x"): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)|(\[[^\]]+\])/g;
  let last = 0;
  let n = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) out.push(<Text key={`${key}${n}`} style={st.bold}>{m[1]}</Text>);
    else if (m[2] !== undefined) out.push(<Text key={`${key}${n}`} style={st.italic}>{m[2]}</Text>);
    else if (m[3] !== undefined) out.push(<Text key={`${key}${n}`} style={st.code}>{m[3]}</Text>);
    else if (m[4] !== undefined) out.push(<Link key={`${key}${n}`} src={m[5]} style={st.link}>{m[4]}</Link>);
    else if (m[6] !== undefined) out.push(<Text key={`${key}${n}`} style={st.marker}>{m[6]}</Text>);
    last = m.index + m[0].length;
    n++;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

// ── styles (from the field-guide StyleSheet) ────────────────────────────────
const s = StyleSheet.create({
  page: { backgroundColor: IVORY, color: INK, paddingTop: 48, paddingBottom: 58, paddingHorizontal: 54, fontFamily: "Serif", fontSize: 11 },
  // light running header, repeats on every page (field-guide pattern)
  runHeader: { position: "absolute", top: 30, left: 54, right: 54, flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 0.6, borderBottomColor: HAIR, paddingBottom: 5, fontFamily: "Mono", fontSize: 7.5, letterSpacing: 1.4, textTransform: "uppercase" },
  // C4 doc head (page 1): brandmark + title/badge row + meta strip + short gold rule
  headWrap: { flexDirection: "row", alignItems: "flex-start", marginBottom: 6 },
  headCol: { flex: 1, marginLeft: 18 },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  title: { flex: 1, fontFamily: "Bebas", fontSize: 29, color: INK, lineHeight: 0.95, letterSpacing: 0.4, textTransform: "uppercase", marginRight: 12 },
  badge: { fontFamily: "Mono", fontSize: 7.5, letterSpacing: 1.6, textTransform: "uppercase", paddingVertical: 2.5, paddingHorizontal: 8 },
  metaStrip: { fontFamily: "Mono", fontSize: 7.5, letterSpacing: 1.4, color: MUTED, textTransform: "uppercase", borderTopWidth: 0.6, borderTopColor: HAIR, paddingTop: 5, marginTop: 8 },
  headRule: { height: 1.4, backgroundColor: GOLD, marginTop: 6, marginBottom: 4, width: 90 },
  bannerLine: { fontFamily: "Serif", fontSize: 10, fontWeight: 600, color: INK, marginTop: 6, lineHeight: 1.4 },
  h2: { fontFamily: "Bebas", fontSize: 19, color: INK, marginTop: 22, marginBottom: 4, letterSpacing: 0.5, textTransform: "uppercase" },
  h3: { fontFamily: "Bebas", fontSize: 14.5, color: INK, marginTop: 16, marginBottom: 3, letterSpacing: 0.6, textTransform: "uppercase" },
  sectionEyebrow: { fontFamily: "Mono", fontSize: 8.5, fontWeight: 700, letterSpacing: 2, color: GOLD, textTransform: "uppercase", marginTop: 18, marginBottom: 2, borderBottomWidth: 0.8, borderBottomColor: HAIR, paddingBottom: 5 },
  prose: { fontFamily: "Serif", fontSize: 11, color: INK, marginTop: 9, lineHeight: 1.55 },
  li: { flexDirection: "row", marginTop: 4 },
  liMark: { fontFamily: "Mono", fontSize: 10, color: GOLD, width: 16 },
  liText: { flex: 1, fontFamily: "Serif", fontSize: 11, color: INK, lineHeight: 1.5 },
  quote: { marginTop: 12, borderLeftWidth: 2, borderLeftColor: GOLD, backgroundColor: GOLD_TINT, paddingVertical: 8, paddingHorizontal: 12, fontFamily: "Serif", fontStyle: "italic", fontSize: 10, color: MUTED, lineHeight: 1.5 },
  table: { marginTop: 12, borderTopWidth: 1, borderTopColor: GOLD },
  thRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: GOLD, backgroundColor: GOLD_TINT },
  th: { flex: 1, fontFamily: "Mono", fontSize: 7.5, fontWeight: 700, letterSpacing: 0.8, color: INK, textTransform: "uppercase", padding: 5 },
  tr: { flexDirection: "row", borderBottomWidth: 0.6, borderBottomColor: HAIR },
  td: { flex: 1, fontFamily: "Serif", fontSize: 9.5, color: INK, padding: 5, lineHeight: 1.4 },
  hr: { height: 0.8, backgroundColor: HAIR, marginTop: 16, marginBottom: 2 },
  runFooter: { position: "absolute", bottom: 26, left: 54, right: 54, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 0.6, borderTopColor: HAIR, paddingTop: 5, fontFamily: "Mono", fontSize: 7.5, letterSpacing: 1, color: FAINT, textTransform: "uppercase" },
  pageNum: { position: "absolute", bottom: 24, left: 54, right: 54, textAlign: "right", fontFamily: "Numeral", fontSize: 11, color: GOLD },
  wmCorner: { position: "absolute", right: 54, bottom: 58 },
});

// Solid-gold brandmark for the masthead (an in-flow Svg paints fine). The
// last-page corner watermark uses the pre-baked gradient PNG instead, because
// react-pdf's fixed `render` slot paints an <Image> but not an <Svg>.
function Brandmark({ size }: { size: number }) {
  return (
    <Svg width={size} height={size * (400 / 418)} viewBox={BRANDMARK_VIEWBOX}>
      <Path d={BRANDMARK_PATH} fill={GOLD} />
    </Svg>
  );
}

function DocBlockView({ b }: { b: DocBlock }) {
  switch (b.t) {
    case "h2": return <Text style={s.h2} minPresenceAhead={56}>{b.text}</Text>;
    case "h3": return <Text style={s.h3} minPresenceAhead={48}>{b.text}</Text>;
    case "eyebrow": return <Text style={s.sectionEyebrow} minPresenceAhead={90}>{b.text}</Text>;
    case "p": return <Text style={s.prose}>{inline(b.text)}</Text>;
    case "hr": return <View style={s.hr} />;
    case "quote": return <Text style={s.quote}>{inline(b.text)}</Text>;
    case "ul":
    case "ol":
      return (
        <View style={{ marginTop: 6 }}>
          {b.items.map((it, i) => (
            <View key={i} style={s.li} wrap={false}>
              <Text style={s.liMark}>{b.t === "ol" ? `${i + 1}.` : "·"}</Text>
              <Text style={s.liText}>{inline(it, `l${i}`)}</Text>
            </View>
          ))}
        </View>
      );
    case "table":
      return (
        <View style={s.table}>
          <View style={s.thRow}>
            {b.head.map((c, i) => <Text key={i} style={s.th}>{c}</Text>)}
          </View>
          {b.rows.map((row, ri) => (
            <View key={ri} style={s.tr} wrap={false}>
              {row.map((cell, ci) => <Text key={ci} style={s.td}>{inline(cell, `t${ri}_${ci}`)}</Text>)}
            </View>
          ))}
        </View>
      );
  }
}

export function ExternalDocPdf({ doc }: { doc: ExternalDoc }) {
  const controlled = CONTROLLED.has(doc.classification);
  const tone = toneFor(doc.classification);
  const metaLine =
    doc.classification +
    (doc.asOf ? ` · accurate ${doc.asOf}` : "") +
    (doc.reviewBy ? ` · review ${doc.reviewBy}` : "");
  const footNote = controlled
    ? `${doc.classification} · provided by access-controlled link, not attachment`
    : `${doc.classification} · informational only`;
  return (
    <Document title={`${doc.title} · One Thousand Drones`} author="One Thousand Drones, LLC">
      <Page size="A4" style={s.page}>
        <View style={s.runHeader} fixed>
          <Text style={{ color: tone.c }}>{doc.classification}</Text>
          <Text style={{ color: FAINT }}>onethousanddrones.com</Text>
        </View>

        {/* C4 head (page 1): brandmark + title/badge + meta strip + gold rule */}
        <View style={s.headWrap}>
          <Brandmark size={42} />
          <View style={s.headCol}>
            <View style={s.titleRow}>
              <Text style={s.title}>{doc.title}</Text>
              <Text style={{ ...s.badge, color: tone.c, backgroundColor: tone.bg }}>{doc.classification}</Text>
            </View>
            <Text style={s.metaStrip}>{metaLine}</Text>
            <View style={s.headRule} />
          </View>
        </View>
        {doc.banner.map((b, i) => <Text key={i} style={s.bannerLine}>{inline(b, `b${i}`)}</Text>)}

        <View style={{ marginTop: 6 }}>
          {doc.blocks.map((b, i) => <DocBlockView key={i} b={b} />)}
        </View>

        {/* url/note LEFT only; the gold Saira page number is a separate fixed
            element on the right, so the two never overlap (field-guide pattern). */}
        <View style={s.runFooter} fixed>
          <Text>{footNote}</Text>
        </View>
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
        <Text style={s.pageNum} fixed render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
      </Page>
    </Document>
  );
}
